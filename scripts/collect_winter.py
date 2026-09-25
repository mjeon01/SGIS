"""Collect actual KMA winter daily observations, separately from heat inputs."""
import argparse
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json
from backend.app.services.weather.extremes import summarize_daily
from scripts.collect_kma import BASE, SOURCES, parse_daily, parse_history
from scripts.public_collection import request


def summarize_winter(rows, period):
    series=summarize_daily(rows,period)
    minima=[r['minimum'] for r in series['daily'] if r['minimum'] is not None]
    return {**series,'freezing_days':sum(t<0 for t in minima) if len(minima)==len(series['daily']) else None,
            'observed_freezing_days':sum(t<0 for t in minima)}


def collect(start_year=2025, refresh=False):
    start, end = date(start_year, 12, 1), date(start_year+1, 3, 1)-timedelta(days=1)
    if end >= date.today():
        raise ValueError('Only completed winter seasons are collected')
    season = f'winter-{start_year}-{start_year+1}'
    root = DATA_ROOT/'raw/kma'/season
    root.mkdir(parents=True, exist_ok=True)
    with public_client() as client:
        def cached(name, path, params, parser):
            target=root/f'{name}.json'
            if target.exists() and not refresh:
                return json.loads(target.read_text())['data']
            # Reuse the previously collected official location history. The live
            # metadata page can be under maintenance; never infer coordinates.
            previous=DATA_ROOT/'raw/kma/current'/str(start_year+1)/f'{name}.json'
            if name.startswith('history_') and previous.exists() and not refresh:
                saved=json.loads(previous.read_text())
                atomic_json(target,saved)
                return saved['data']
            response=request(client,'POST',BASE+path,data=params)
            result=parser(response.text)
            atomic_json(target, {'source_url':BASE+path,'request':params,
                'collected_at':datetime.now(timezone.utc).isoformat(),'data':result})
            return result
        stations={}
        for kind,spec in SOURCES.items():
            def catalog(text):
                rows=re.findall(r'groupNm\s*:\s*"부산광역시"[^\n]*?groupSn\s*:\s*"(\d+)"[^\n]*?stnId\s*:\s*"(\d+)"[^\n]*?stnNm\s*:\s*"([^"]+)"',text)
                if not rows:raise ValueError('Official Busan station catalog missing')
                return [dict(group=g,station_id=c,name=n,kind=kind) for g,c,n in rows]
            for station in cached(f'catalog_{kind}','/cmmn/stnGroupPopup.do?type=button',
                    {'lrgClssCd':'SFC','mddlClssCd':spec['category'],'dataFormCd':'F00501','serviceSe':'F00102'},catalog):
                stations[station['station_id']]=station
        completed=[]
        excluded=[]
        for code,station in sorted(stations.items()):
            spec=SOURCES[station['kind']]
            history=cached(f'history_{code}','/tmeta/stn/selectStnList.do',
                {'pgmNo':'123','mddlClssCd':spec['category'],'stnIds':code,'serviceSe':'F00101','pageIndex':'1','schListCnt':'10'},lambda t:parse_history(t,code))
            locations=[r for r in history if r['start_date']<=end.isoformat() and (not r['end_date'] or r['end_date']>=start.isoformat())]
            if not locations:
                excluded.append({'station_id':code,'reason':'관측기간에 유효한 관측소 위치 없음'})
                continue
            rows=[];cursor=start
            while cursor<=end:
                until=min(cursor+timedelta(days=9),end)
                prefix='SFC02015' if station['kind']=='AWS' else 'SFC01013'
                params={'lrgClssCd':'SFC','mddlClssCd':spec['category'],'dataFormCd':'F00501','serviceSe':'F00102',
                    'stnIds':f"{station['group']}_{code}",'startDt':cursor.strftime('%Y%m%d'),'endDt':until.strftime('%Y%m%d'),
                    'elementCds':f'{prefix}002,{prefix}004','elementGroupSns':spec['element_group'],'firstLoading':'N',
                    'pageIndex':'1','pageRowCount':'31','startYear':str(cursor.year),'endYear':str(until.year),
                    'startHh':'00','endHh':'23','cmmnCdList':'F00501,F00502,F00503,F00512,F00513','upperCmmnCode':'F005','menuNo':'33'}
                part=cached(f'daily_{code}_{cursor}_{until}',f"/data/grnd/{spec['page']}?pgmNo={spec['program']}",params,
                    lambda t:parse_daily(t,code,cursor,until))
                rows.extend({'date':r['TM'],'maximum':r.get('MAX_TA'),'minimum':r.get('MIN_TA')} for r in part)
                cursor=until+timedelta(days=1)
            series=summarize_winter(rows,[start.isoformat(),end.isoformat()])
            minima=[r['minimum'] for r in series['daily'] if r['minimum'] is not None]
            completed.append({'station_id':code,'station_name':station['name'],'kind':station['kind'],
                'locations':locations,'source_url':BASE+f"/data/grnd/{spec['page']}",**series})
            print(f"{code} {station['name']}: {len(minima)}/{len(series['daily'])} minimum observations",flush=True)
        if not completed or not any(s['summary']['minimum']['valid_days'] for s in completed):
            raise ValueError('No winter observations; preserving existing snapshot')
        result={'meta':{'season':season,'source':'기상청 ASOS/AWS 일 관측자료',
            'source_url':BASE+'/data/grnd/selectAwsRltmList.do','collected_at':max(json.loads(p.read_text())['collected_at'] for p in root.glob('daily_*.json')),
            'period':[start.isoformat(),end.isoformat()],'timezone':'Asia/Seoul','is_realtime':False,
            'freezing_days_definition':'일최저기온 < 0℃; 공식 한파특보 일수가 아님','excluded_stations':excluded},'stations':completed}
        atomic_json(DATA_ROOT/'processed'/f'{season}.json',result)
        print(json.dumps({'season':season,'stations':len(completed),'excluded':len(excluded)}),flush=True)
        return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start-year',type=int,default=2025)
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args()
    collect(args.start_year,args.refresh)

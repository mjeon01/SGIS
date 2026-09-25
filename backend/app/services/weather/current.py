"""Current-year station observations, isolated from historical vulnerability inputs."""
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import fcntl
import json
import re
import threading

import httpx
from ...core.settings import DATA_ROOT, IS_VERCEL
from ..public_http import public_client
from ..sgis.cache import atomic_json
from .extremes import summarize_daily

KST = ZoneInfo('Asia/Seoul')
_guard = threading.Lock()
_job = {'state':'idle', 'message':None}


def observation_cutoff():
    return datetime.now(KST).date() - timedelta(days=1)


def period_summary(rows, start, end):
    series = summarize_daily([r for r in rows if start <= r['date'] <= end], [start,end])
    maxima = [r['maximum'] for r in series['daily'] if r['maximum'] is not None]
    series.update(period=[start,end], heatwave_days=sum(v>=33 for v in maxima) if len(maxima)==series['summary']['expected_days'] else None)
    return series


def current_snapshot_path():
    path = DATA_ROOT / 'processed' / f'current_weather_{observation_cutoff().year}.json'
    if IS_VERCEL and not path.exists():
        # Keep a deployed snapshot readable after New Year; the API still marks
        # its actual requested_through date as outdated.
        saved = sorted((DATA_ROOT / 'processed').glob('current_weather_[0-9][0-9][0-9][0-9].json'))
        if saved:
            return saved[-1]
    return path


def collect_current(as_of=None, progress=None):
    from scripts.collect_kma import SOURCES, BASE, parse_daily, parse_history
    end = as_of or observation_cutoff()
    recent_start = max(date(end.year,1,1), end-timedelta(days=29))
    summer_start, summer_end = date(end.year,6,1), min(date(end.year,8,31),end)
    start = min(recent_start, summer_start) if summer_start <= end else recent_start
    root = DATA_ROOT / 'raw/kma/current' / str(end.year)
    root.mkdir(parents=True,exist_ok=True)
    with (root/'collection.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        with public_client() as client:
            def cached(name, path, params, parser, renew=False):
                target=root/f'{name}.json'
                if target.exists():
                    saved=json.loads(target.read_text())
                    age=datetime.now(timezone.utc)-datetime.fromisoformat(saved['collected_at'])
                    if not renew or age.total_seconds()<21600:
                        return saved['data']
                for attempt in range(3):
                    try:
                        response=client.post(BASE+path,data=params)
                        if response.status_code==429 and attempt<2:continue
                        response.raise_for_status()
                        result=parser(response.text)
                        atomic_json(target,{'source_url':BASE+path,'request':params,'collected_at':datetime.now(timezone.utc).isoformat(),'data':result})
                        return result
                    except (httpx.TimeoutException,httpx.NetworkError):
                        if attempt==2:raise
            stations={}
            for kind,spec in SOURCES.items():
                def catalog(text):
                    found=re.findall(r'groupNm\s*:\s*"부산광역시"[^\n]*?groupSn\s*:\s*"(\d+)"[^\n]*?stnId\s*:\s*"(\d+)"[^\n]*?stnNm\s*:\s*"([^"]+)"',text)
                    if not found:raise ValueError('Current Busan catalog missing')
                    return [dict(group=g,station_id=c,name=n,kind=kind) for g,c,n in found]
                for station in cached(f'catalog_{kind}','/cmmn/stnGroupPopup.do?type=button',{'lrgClssCd':'SFC','mddlClssCd':spec['category'],'dataFormCd':'F00501','serviceSe':'F00102'},catalog,True):
                    stations[station['station_id']]=station
            completed=[]
            for index,(code,station) in enumerate(sorted(stations.items())):
                spec=SOURCES[station['kind']]
                history=cached(f'history_{code}','/tmeta/stn/selectStnList.do',{'pgmNo':'123','mddlClssCd':spec['category'],'stnIds':code,'serviceSe':'F00101','pageIndex':'1','schListCnt':'10'},lambda t:parse_history(t,code),True)
                locations=[r for r in history if r['start_date']<=end.isoformat() and (not r['end_date'] or r['end_date']>=end.isoformat())]
                location=locations[0] if len(locations)==1 else None
                rows=[]; cursor=start
                while cursor<=end:
                    until=min(cursor+timedelta(days=9),end)
                    prefix='SFC02015' if station['kind']=='AWS' else 'SFC01013'
                    params={'lrgClssCd':'SFC','mddlClssCd':spec['category'],'dataFormCd':'F00501','serviceSe':'F00102','stnIds':f"{station['group']}_{code}",'startDt':cursor.strftime('%Y%m%d'),'endDt':until.strftime('%Y%m%d'),'elementCds':f'{prefix}002,{prefix}004','elementGroupSns':spec['element_group'],'firstLoading':'N','pageIndex':'1','pageRowCount':'31','startYear':str(end.year),'endYear':str(end.year),'startHh':'00','endHh':'23','cmmnCdList':'F00501,F00502,F00503,F00512,F00513','upperCmmnCode':'F005','menuNo':'33'}
                    part=cached(f'daily_{code}_{cursor}_{until}',f"/data/grnd/{spec['page']}?pgmNo={spec['program']}",params,lambda t:parse_daily(t,code,cursor,until),until>=end-timedelta(days=10))
                    rows.extend({'date':r['TM'],'maximum':r.get('MAX_TA'),'minimum':r.get('MIN_TA')} for r in part)
                    cursor=until+timedelta(days=1)
                recent=period_summary(rows,recent_start.isoformat(),end.isoformat())
                summer=period_summary(rows,summer_start.isoformat(),summer_end.isoformat()) if summer_start<=end else None
                valid=[r for r in recent['daily'] if r['maximum'] is not None or r['minimum'] is not None]
                completed.append({'station_id':code,'station_name':station['name'],'kind':station['kind'],'location':location,'source_url':BASE+f"/data/grnd/{spec['page']}",'recent':recent,'summer':summer,'latest':valid[-1] if valid else None})
                message=f"{index+1}/{len(stations)} {station['name']}: recent {len(valid)}/{len(recent['daily'])}"
                if progress:progress(message)
                else:print(message,flush=True)
            latest=max((s['latest']['date'] for s in completed if s['latest']),default=None)
            if latest is None:raise ValueError('No current observations; preserving previous snapshot')
            result={'meta':{'reference_year':end.year,'requested_through':end.isoformat(),'latest_observation_date':latest,'collected_at':datetime.now(timezone.utc).isoformat(),'source':'기상청 ASOS/AWS 일 관측자료','request_interval_seconds':3,'recent_period':[recent_start.isoformat(),end.isoformat()],'summer_period':[summer_start.isoformat(),summer_end.isoformat()] if summer_start<=end else None,'is_realtime':False},'stations':completed}
            atomic_json(DATA_ROOT/'processed'/f'current_weather_{end.year}.json',result)
            return result


def refresh_status():
    if IS_VERCEL:
        return {'state': 'disabled', 'message': '저장된 관측자료를 제공하는 버전입니다. 자료 갱신은 다음 업데이트에 반영됩니다.'}
    with _guard:return dict(_job)


def start_refresh():
    if IS_VERCEL:
        return refresh_status()
    with _guard:
        if _job['state']=='running':return dict(_job)
        path=current_snapshot_path()
        if path.exists():
            meta=json.loads(path.read_text())['meta']
            age=(datetime.now(timezone.utc)-datetime.fromisoformat(meta['collected_at'])).total_seconds()
            if age<21600 and meta['requested_through']==observation_cutoff().isoformat():
                return {'state':'fresh','message':'최근 6시간 이내에 조회한 자료입니다.'}
        _job.update(state='running',message='기상청 일 관측자료를 갱신하고 있습니다.')
    def update(message):
        with _guard:_job['message']=message
    def run():
        try:
            collect_current(progress=update)
            with _guard:_job.update(state='complete',message='최신 관측자료를 저장했습니다.')
        except Exception:
            with _guard:_job.update(state='error',message='기상청 자료를 갱신하지 못했습니다. 기존 저장자료를 유지합니다.')
    threading.Thread(target=run,daemon=True).start()
    return refresh_status()

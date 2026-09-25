"""Cache KMA public past-typhoon tracks (reported positions, no forecasts)."""
import argparse
from datetime import datetime,timezone
import json,math
from pathlib import Path
import sys
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json
from scripts.public_collection import request

SOURCE='https://www.weather.go.kr/w/hazard/typhoon/history.do'
ENDPOINT='https://www.weather.go.kr/w/renew2021/rest/typhoon/search.do'
KST=ZoneInfo('Asia/Seoul')


def normalize(storm):
    by_time={};excluded=0
    for r in storm['tracks']:
        try:
            observed=datetime.strptime(r['tm'],'%Y%m%d%H%M').replace(tzinfo=KST)
            reported=datetime.strptime(r['tmFc'],'%Y%m%d%H%M').replace(tzinfo=KST)
            if observed>reported:raise ValueError('Forecast position')
            lat,lng=float(r['lat']),float(r['lon'])
            if not(math.isfinite(lat) and math.isfinite(lng) and -90<=lat<=90 and -180<=lng<=180):raise ValueError('Invalid coordinates')
            pressure=float(r['ps']) if r.get('ps') not in (None,'') else None
            wind=float(r['ws']) if r.get('ws') not in (None,'') else None
            pressure=pressure if pressure is not None and math.isfinite(pressure) and 800<=pressure<=1100 else None
            wind=wind if wind is not None and math.isfinite(wind) and 0<=wind<=150 else None
            timestamp=observed.isoformat()
            point={'timestamp':timestamp,'reported_at':reported.isoformat(),'latitude':lat,'longitude':lng,
                'pressure_hpa':pressure,'wind_speed_ms':wind,'classification':r.get('tp') or None}
            # Official updates for a recorded time: retain the latest bulletin.
            if timestamp not in by_time or by_time[timestamp]['reported_at']<point['reported_at']:
                by_time[timestamp]=point
        except (ValueError,TypeError,KeyError):excluded+=1
    points=sorted(by_time.values(),key=lambda p:p['timestamp'])
    if len(points)<2:raise ValueError('Insufficient validated track positions')
    year,number=int(storm['year']),int(storm['seq'])
    return {'id':f'{year}-{number:02d}','year':year,'number':number,'name':storm.get('name') or storm['nameEn'],
        'name_en':storm['nameEn'],'period':[points[0]['timestamp'],points[-1]['timestamp']],
        'point_count':len(points),'excluded_count':excluded,'points':points}


def collect(first=2020,last=2025,refresh=False):
    if not 2000<=first<=last<datetime.now().year:raise ValueError('Choose completed years')
    root=DATA_ROOT/'raw/typhoons';root.mkdir(parents=True,exist_ok=True)
    storms=[];collected=[]
    with public_client() as client:
        for year in range(first,last+1):
            target=root/f'{year}.json'
            params={'name':'','startYear':str(year),'endYear':str(year),'startYear2':str(year),'endYear2':str(year),
                'startMonth':'1','endMonth':'12','startMonth2':'1','endMonth2':'12',
                'effType':'0','sortType':'0','sortDir':'0','gubun':'1','startCP':'','endCP':'','startWS':'','endWS':''}
            if refresh or not target.exists():
                response=request(client,'GET',ENDPOINT,params={'json':json.dumps(params,ensure_ascii=False)})
                response.raise_for_status();rows=response.json()
                if not isinstance(rows,list) or not rows:raise ValueError('No public typhoon records')
                # Do not retain bulletin authors or unrelated attributes.
                rows=[{**{k:s[k] for k in ['year','seq','name','nameEn']},
                    'tracks':[{k:r.get(k) for k in ['tm','tmFc','lat','lon','ps','ws','tp']} for r in s['tracks']]} for s in rows]
                atomic_json(target,{'source_url':ENDPOINT,'request':params,'collected_at':datetime.now(timezone.utc).isoformat(),'storms':rows})
            raw=json.loads(target.read_text());collected.append(raw['collected_at'])
            for s in raw['storms']:
                if int(s['year'])!=year:raise ValueError('Unexpected typhoon year')
                storms.append(normalize(s))
            print(f'{year}: {len(raw["storms"])} storms',flush=True)
    if len({s['id'] for s in storms})!=len(storms):raise ValueError('Duplicate storm identity')
    result={'meta':{'source':'기상청 날씨누리 · 과거태풍','source_url':SOURCE,'collected_at':max(collected),
        'years':list(range(first,last+1)),'timezone':'Asia/Seoul','wind_unit':'m/s','pressure_unit':'hPa',
        'is_realtime':False,'track_kind':'과거 통보 시각별 중심 위치; 예보 위치 제외'},'storms':storms}
    atomic_json(DATA_ROOT/'processed/typhoons.json',result)
    print(json.dumps({'storms':len(storms),'positions':sum(s['point_count'] for s in storms)}))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args();collect(refresh=args.refresh)

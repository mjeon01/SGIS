"""Prepare a separate 2026 facility inventory; never joins 2024 observations."""
import json
import sys
from collections import Counter
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shapely.geometry import Point, shape
from backend.app.core.settings import DATA_ROOT
from backend.app.services.sgis.cache import atomic_json
from scripts.collect_shelters import DISTRICTS, SOURCE


def locate(lon, lat, polygons):
    matches = [code for code, polygon in polygons.items() if polygon.covers(Point(lon, lat))]
    return matches[0] if len(matches) == 1 else None


def prepare():
    data = json.loads((DATA_ROOT / 'processed/sgis.json').read_text())
    regions = [r for r in data['regions'].values() if r['region_code'].startswith('21')]
    polygons = {r['region_code']:shape(r['geometry']) for r in regions if r['region_level']=='dong'}
    facilities, excluded = [], []
    source_counts = Counter()
    def append(row):
        lon,lat = row['longitude'], row['latitude']
        # City bounding box validates source coordinates; no invented locations.
        if not isinstance(lon,(int,float)) or not isinstance(lat,(int,float)) or not (128.7 < lon < 129.4 and 34.8 < lat < 35.5):
            excluded.append(row['id']); return
        row['region_code'] = locate(lon,lat,polygons)
        row['region_name'] = data['regions'].get(row['region_code'],{}).get('full_name')
        facilities.append(row)
    for code in DISTRICTS:
        saved = json.loads((DATA_ROOT / f'raw/shelters/{code}.json').read_text())
        source_counts['shelter'] += saved['total_count']
        for r in saved['facilities']:
            if r['year'] != '2026':
                raise ValueError('Facility year changed; review before publishing')
            begin,end=r.get('wkdayOperBeginTime'),r.get('wkdayOperEndTime')
            day_names=['월','화','수','목','금','토','일']
            raw_days=r.get('bassOperDay')
            days=[i for i,d in enumerate(day_names) if d in raw_days] if raw_days else None
            def fmt(t): return t[:2]+':'+t[2:] if t and len(t)==4 and t.isdigit() else '미확인'
            append({'id':f"shelter-{r['rstrFcltyNo']}", 'kind':'shelter', 'name':r['title'], 'address':r.get('rnDtlAdres') or '주소 미확인', 'longitude':r.get('lo'),'latitude':r.get('la'), 'reference_year':2026,'reference_date':'2026년 등록자료', 'source':'국민안전24 무더위쉼터', 'source_url':SOURCE, 'access':'누구나' if r.get('usePsblDiv')=='2' else '특정인' if r.get('usePsblDiv')=='1' else '미확인', 'capacity':r.get('usePsblNmpr'), 'hours':f"{r.get('bassOperDay') or '운영요일 미확인'} {fmt(begin)}–{fmt(end)}",'operating':r.get('fcltyOprnAt'),'schedule':{'days':days,'weekday':[begin,end],'weekend':[r.get('wkendHdayOperBeginTime'),r.get('wkendHdayOperEndTime')],'weekend_open':r.get('chckMatterWkendHdayOpnAt')}})
    shade=json.loads((DATA_ROOT/'raw/shelters/shade_2026.json').read_text())
    source_counts['shade'] = len(shade['featureSet']['features'])
    for i,f in enumerate(shade['featureSet']['features']):
        if f['geometry']['spatialReference']['wkid'] != 4326:
            raise ValueError('Unexpected shade CRS')
        a,g=f['attributes'],f['geometry']
        append({'id':f'shade-{i+1}', 'kind':'shade', 'name':f"그늘막 {a.get('관리번호') or i+1}", 'address':a.get('상세주소') or '주소 미확인', 'longitude':g['x'],'latitude':g['y'], 'reference_year':2026,'reference_date':'2026-04-30', 'source':'부산생활지도 폭염 그늘막 설치장소', 'source_url':'https://lifemap.busan.go.kr/li/index.do', 'access':'미확인', 'capacity':None,'hours':'운영시간 미제공','operating':None,'installed_at':a.get('설치일자')})
    if len({r['id'] for r in facilities}) != len(facilities):
        raise ValueError('Duplicate facility ID')
    output={'meta':{'reference_year':2026,'boundary_year':2025,'collected_at':datetime.now(timezone.utc).isoformat(),'source_counts':dict(source_counts),'mapped_counts':dict(Counter(r['kind'] for r in facilities)),'excluded_coordinate_count':len(excluded),'unassigned_region_count':sum(r['region_code'] is None for r in facilities),'notes':['현재 시설은 2024년 취약도·인구와 수치 비교하지 않습니다.','시설별 기준일이 다릅니다. 실시간 개방 여부는 제공하지 않습니다.','출처에 등록된 시설만 표시하며 부산의 모든 피서 공간을 뜻하지 않습니다.','동 연결은 2025년 경계 내 좌표 포함 여부로 판정합니다. 경계 밖·중복 경계 좌표는 임의 배정하지 않습니다.']},'regions':[{k:r[k] for k in ['region_code','region_name','full_name','parent_region_code','region_level']} for r in regions],'facilities':facilities}
    atomic_json(DATA_ROOT/'processed/facilities_2026.json',output)
    print(output['meta'])

if __name__=='__main__': prepare()

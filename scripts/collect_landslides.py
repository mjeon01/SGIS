"""Save Busan's officially designated landslide-prone points, not incidents."""
import argparse
from datetime import datetime,timezone
import json, math
from pathlib import Path
import sys
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from shapely.geometry import Point,shape
from backend.app.core.settings import DATA_ROOT
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json
from scripts.public_collection import request

SOURCE='https://safecity.busan.go.kr/'
ENDPOINT=SOURCE+'iots/landslide/selectWeakLandslideInfo.do'
FIELDS=['seq','originId','jurisdiction','sido','sigungu','umdong','li','jibun','type','appointedDate','clearYn','currentStatus','lat','lon']


def normalize(rows,regions):
    polygons=[(r,shape(r['geometry'])) for r in regions.values() if r['region_code'].startswith('21') and len(r['region_code'])==8]
    records=[];excluded=0;seen=set()
    for row in rows:
        try:
            identifier=str(row.get('seq') or '').strip();lat,lng=float(row['lat']),float(row['lon'])
            if not identifier or identifier in seen or not(math.isfinite(lat) and math.isfinite(lng) and 34.9<=lat<=35.5 and 128.7<=lng<=129.4):raise ValueError('Invalid id/position')
            appointed=row.get('appointedDate')
            designated=datetime.fromisoformat(appointed.replace('Z','+00:00')).astimezone(ZoneInfo('Asia/Seoul')).date().isoformat() if appointed else None
        except (ValueError,TypeError,KeyError):
            excluded+=1;continue
        seen.add(identifier)
        matches=[r for r,p in polygons if p.covers(Point(lng,lat))]
        region=matches[0] if len(matches)==1 else None
        address=' '.join(str(row.get(k) or '').strip() for k in ['sido','sigungu','umdong','li','jibun']).strip()
        records.append({'id':identifier,'source_id':str(row.get('originId') or ''),'latitude':lat,'longitude':lng,
            'name':address,'type':str(row.get('type') or '').strip() or None,'designated_date':designated,
            'status':str(row.get('clearYn') or '').strip() or None,'current_status':str(row.get('currentStatus') or '').strip() or None,
            'source_district':row.get('sigungu'),'region_code':region['region_code'] if region else None,'region_name':region['region_name'] if region else None})
    return records,excluded


def collect(refresh=False):
    target=DATA_ROOT/'raw/landslides/points.json'
    if refresh or not target.exists():
        with public_client() as client:
            response=request(client,'GET',ENDPOINT);rows=response.json()
        if not isinstance(rows,list) or not rows:raise ValueError('Official landslide list missing')
        atomic_json(target,{'source_url':ENDPOINT,'collected_at':datetime.now(timezone.utc).isoformat(),'rows':[{k:r.get(k) for k in FIELDS} for r in rows]})
    raw=json.loads(target.read_text())
    sgis=json.loads((DATA_ROOT/'processed/sgis.json').read_text())
    regions=sgis['regions']
    records,excluded=normalize(raw['rows'],regions)
    if not records:raise ValueError('No validated designated points')
    result={'meta':{'source':'부산광역시 부산 안전 ON · 산사태 취약지역','source_url':SOURCE,'endpoint':ENDPOINT,
        'collected_at':raw['collected_at'],'reference_date':None,'source_count':len(raw['rows']),'excluded_count':excluded,
        'unassigned_count':sum(r['region_code'] is None for r in records),'boundary_year':sgis['meta']['boundary_year'],
        'meaning':'공식 지정 취약지역의 대표 지점. 실제 발생 위치나 위험 면적이 아님.'},'records':records}
    atomic_json(DATA_ROOT/'processed/landslides.json',result)
    print(json.dumps({'records':len(records),'excluded':excluded,'unassigned':result['meta']['unassigned_count']}))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--refresh',action='store_true')
    collect(parser.parse_args().refresh)

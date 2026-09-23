"""Cache the public National Safety 24 Busan cooling-centre inventory."""
import json
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json
from backend.app.core.settings import DATA_ROOT

SOURCE = 'https://www.safekorea.go.kr/safekorea-kor/flsm/flsm/facilitiesSafteyMap.do?menuSn=2&title=무더위쉼터'
ENDPOINT = 'https://www.safekorea.go.kr/safekorea-kor/flsm/flsm/facilityDataList.do'
DISTRICTS = ['26110','26140','26170','26200','26230','26260','26290','26320','26350','26380','26410','26440','26470','26500','26530','26710']
# Only facility attributes needed by this product; exclude staff names and account IDs.
FIELDS = ['rstrFcltyNo','year','arcd','title','rnDtlAdres','lo','la','usePsblNmpr','usePsblDiv','useAt','fcltyOprnAt','wkdayOperBeginTime','wkdayOperEndTime','bassOperDay','fcltyTy','fcltySclas','modfTime']
FIELDS += ['wkendHdayOperBeginTime','wkendHdayOperEndTime','chckMatterWkendHdayOpnAt','aditOperDay','etOperDay']

def collect(refresh=False):
    folder = DATA_ROOT / 'raw' / 'shelters'
    folder.mkdir(parents=True, exist_ok=True)
    counts = {}
    with public_client() as client:
        for code in DISTRICTS:
            path = folder / f'{code}.json'
            if path.exists() and not refresh:
                saved = json.loads(path.read_text())
            else:
                response = client.post(ENDPOINT, data={'tableNm':'TFK_HTW_RSTR_TEMP', 'tableKorNm':'무더위쉼터','sggCd':code,'page':'1','size':'5'})
                response.raise_for_status()
                data = response.json()
                rows = data['mapList']
                if len(rows) != int(data['totalCnt']):
                    raise ValueError(f'Incomplete inventory: {code}')
                saved = {'source_url':SOURCE,'endpoint':ENDPOINT,'district_code':code,'collected_at':datetime.now(timezone.utc).isoformat(), 'total_count':len(rows), 'facilities':[{k:r.get(k) for k in FIELDS} for r in rows]}
                atomic_json(path, saved)
            counts[code] = saved['total_count']
            print(code, counts[code], flush=True)
        shade_path = folder / 'shade_2026.json'
        if not shade_path.exists():
            listing = client.post('http://lifemap.busan.go.kr/li/mymap/pbsearch.do', data={'publicAt':'3','pageIndex':'1','recordCountPerPage':'100','mapNm':'그늘'})
            listing.raise_for_status()
            source = next(r for r in listing.json()['resultList'] if r['mapNm']=='폭염 그늘막 설치장소')
            if source['dataCreateDt'] != '2026-04-30':
                raise ValueError('Shade source date changed; review metadata before publishing')
            response = client.get('http://lifemap.busan.go.kr/file/json/read/mymap.do', params={'atchFileId':source['fileId'],'fileSn':'0'})
            response.raise_for_status()
            atomic_json(shade_path, json.loads(response.json()['fileCn']))
    print('total',sum(counts.values()))

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true')
    collect(parser.parse_args().refresh)

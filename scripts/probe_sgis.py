"""Read-only SGIS connectivity probe. Never print credentials or request URLs."""
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
env = {}
for line in (ROOT / '.env').read_text().splitlines():
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('\"\'')

BASE = 'https://sgisapi.mods.go.kr/OpenAPI3'
_original_urlopen = urlopen
_last_request = 0.0

def urlopen(*args, **kwargs):
    global _last_request
    time.sleep(max(0, 3.0 - (time.monotonic() - _last_request)))
    _last_request = time.monotonic()
    return _original_urlopen(*args, **kwargs)


if '--code-docs' in sys.argv:
    dest = ROOT / 'var' / 'probe'
    dest.mkdir(parents=True, exist_ok=True)
    for name in ['ConstYearCode', 'PplAgeCode', 'HouseHoldCode']:
        with urlopen(f'https://sgis.mods.go.kr/developer/html/openApi/api/dataCode/{name}.html', timeout=30) as response:
            (dest / f'{name}.html').write_bytes(response.read())
        print('Saved code table:', name)
    raise SystemExit(0)

def get(path, params):
    try:
        with urlopen(BASE + path + '?' + urlencode(params), timeout=30) as response:
            return json.load(response)
    except Exception as exc:
        print(json.dumps({'endpoint': path, 'transport_error': type(exc).__name__}))
        raise SystemExit(2)

auth = get('/auth/authentication.json', {'consumer_key': env['SGIS_SERVICE_ID'], 'consumer_secret': env['SGIS_SECURITY_KEY']})
token = auth.get('result', {}).get('accessToken')
print(json.dumps({'authentication_errCd': auth.get('errCd'), 'token_received': bool(token)}))
if not token:
    raise SystemExit(1)

requests = [
    ('/stats/population.json', {'year': '2024', 'adm_cd': '21', 'low_search': '1'}),
    ('/addr/stage.json', {'cd': '21', 'pg_yn': '0'}),
]
if '--discover' in sys.argv:
    requests = [
        ('/year/data.json', {}),
        ('/stats/searchpopulation.json', {'year': '2024', 'adm_cd': '21', 'low_search': '1', 'age_type': '36'}),
        ('/stats/household.json', {'year': '2024', 'adm_cd': '21', 'low_search': '1', 'household_type': 'A0'}),
        ('/stats/house.json', {'year': '2024', 'adm_cd': '21', 'low_search': '1', 'const_year': '01'}),
        ('/ndsm/prevHwSpcnwsList.json', {'searchYear': '2024', 'searchMonth': '08'}),
        ('/boundary/hadmarea.geojson', {'year': '2024', 'adm_cd': '21', 'low_search': '1'}),
    ]
if '--alignment' in sys.argv:
    requests = [('/boundary/hadmarea.geojson', {'year': '2025', 'adm_cd': '21120', 'low_search': '1'})]
for index, (path, params) in enumerate(requests):
    data = get(path, {**params, 'accessToken': token})
    result = data.get('result')
    summary = {'endpoint': path, 'params': params, 'errCd': data.get('errCd'), 'count': len(result) if isinstance(result, list) else None, 'first_row': result[0] if isinstance(result, list) and result else result}
    if 'features' in data:
        summary['features'] = len(data['features'])
        summary['properties'] = data['features'][0]['properties'] if data['features'] else None
        if '--alignment' in sys.argv:
            summary['regions'] = [f['properties'] for f in data['features']]
    if path.startswith('/ndsm/') and isinstance(result, list):
        summary['busan_rows'] = [r for r in result if '부산' in str(r)]
    dest = ROOT / 'var' / 'probe'
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f'{index}.json').write_text(json.dumps({'path': path, 'params': params, 'data': data}, ensure_ascii=False))
    print(json.dumps(summary, ensure_ascii=False), flush=True)

if '--docs' in sys.argv:
    for name in ['census', 'naturalCalamity', 'addressBoundary']:
        try:
            with urlopen(f'https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/{name}.html', timeout=30) as response:
                content = response.read().decode('utf-8')
            (dest / f'{name}.html').write_text(content)
            print('Saved official documentation:', name)
        except Exception as exc:
            print(type(exc).__name__)

import json
from typing import Annotated, Literal
from fastapi import FastAPI, Query, Request, Path
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from .core.settings import DATA_MODE, DATA_ROOT
from .schemas.models import Mode, ExplainRequest, AnalysisLevel
from .repositories.dataset import DatasetRepository, DatasetUnavailable
from .services.sgis.base import SgisError
from .services.ai.explain import explain
from .analytics.risk import INDICATORS, ranking
from .services.weather.extremes import summarize_daily
from .services.review import build_review
from .services.weather.current import current_snapshot_path, observation_cutoff, refresh_status, start_refresh
from .services.weather.regional import nearest_current_station
from .services.weather.comparison import build_comparison
from .services.facilities import filtered
from .services.flood import inventory as flood_inventory

app = FastAPI(title='기후안심지도 API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:3000', 'http://localhost:3000'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
repo = DatasetRepository()
Parent = Annotated[str, Query(pattern=r'^(?:00|\d{2}|\d{5})$')]
Code = Annotated[str, Path(pattern=r'^[0-9]{2}(?:[0-9]{3}(?:[0-9]{3})?)?$')]
LAYERS = {'risk', 'hazard', 'exposure', 'vulnerability', *INDICATORS}


@app.exception_handler(DatasetUnavailable)
async def unavailable(_request: Request, exc: DatasetUnavailable):
    return JSONResponse(status_code=503, content={'detail': str(exc), 'sample_available': True})


@app.exception_handler(SgisError)
async def sgis_error(_request: Request, exc: SgisError):
    return JSONResponse(status_code=502, content={'detail': 'SGIS 연결을 확인해 주세요. 저장된 부산 데이터는 계속 사용할 수 있습니다.', 'code': str(exc.code)})


@app.exception_handler(KeyError)
async def not_found(_request: Request, _exc: KeyError):
    return JSONResponse(status_code=404, content={'detail': '해당 비교범위에서 지역을 찾을 수 없습니다.'})


@app.get('/api/health')
def health():
    return {'status': 'ok', 'default_mode': DATA_MODE, 'explanation_engine': 'rules'}


@app.get('/api/meta')
def metadata(mode: Mode = DATA_MODE):
    data = repo.load(mode)
    return {**data['meta'], 'indicators': INDICATORS, 'default_mode': DATA_MODE}


@app.get('/api/facilities')
def facilities(region: Annotated[str, Query(pattern=r'^21(?:\d{3}(?:\d{3})?)?$')]='21', kind: Literal['all','shelter','shade']='all', access: Literal['all','anyone']='all', day: Annotated[int|None,Query(ge=0,le=6)]=None, time: Annotated[str|None,Query(pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')]=None):
    path = DATA_ROOT / 'processed/facilities_2026.json'
    if not path.exists():
        raise DatasetUnavailable('현재 시설 자료가 없습니다. 시설 수집 및 전처리를 실행하세요.')
    if time and day is None:return JSONResponse(status_code=422,content={'detail':'시간을 선택하려면 요일도 선택하세요.'})
    return filtered(region,kind,access,day,time)


@app.get('/api/regions')
def regions(parent_code: Parent = '00', mode: Mode = DATA_MODE):
    return [{k: v for k, v in r.items() if k != 'geometry'} for r in repo.children(parent_code, mode)]


@app.get('/api/flood')
def flood():
    return flood_inventory()


@app.get('/api/flood/forecast/{scenario}.png')
def flood_image(scenario: Literal['30', '50', '80', '100']):
    path = DATA_ROOT / 'raw/flood' / f'forecast-{scenario}.png'
    if not path.exists():
        raise DatasetUnavailable('선택한 조건의 침수 예상도를 불러올 수 없습니다.')
    return FileResponse(path, media_type='image/png', headers={'Cache-Control': 'public, max-age=3600'})


@app.get('/api/weather/{region_code}')
def daily_weather(region_code: Code, mode: Mode = DATA_MODE):
    data = repo.load(mode)
    repo.region(region_code, mode)
    provenance = data['observations'].get(region_code, {}).get('source_detail', {}).get('heatwave_intensity', {})
    if mode == 'sample' or not provenance.get('station_id'):
        return {'available':False, 'reason':'이 지역·모드에는 실제 일별 관측자료가 연결되지 않았습니다.'}
    year = data['meta']['reference_year']
    path = DATA_ROOT / 'processed' / f'kma_extremes_{year}.json'
    if not path.exists():
        raise DatasetUnavailable('일별 최고·최저 관측자료를 준비하고 있습니다.')
    snapshot = json.loads(path.read_text())
    if snapshot['reference_year'] != year or snapshot['period'] != provenance['period']:
        raise ValueError('Temperature period mismatch')
    station = snapshot['stations'].get(provenance['station_id'])
    if not station:
        return {'available':False, 'reason':'연결 관측소의 일별 자료가 없습니다.'}
    return {'available':True, 'region_code':region_code, 'reference_year':year,
            'period':snapshot['period'], 'source':snapshot['source'], 'source_url':snapshot['source_url'],
            'station_id':provenance['station_id'], 'station_name':provenance['station_name'],
            'distance_km':provenance['distance_km'], 'is_local_measurement':False,
            'heatwave_days':data['observations'][region_code].get('heatwave_history_index'),
            **summarize_daily(station['daily'], snapshot['period'])}


@app.get('/api/current-weather')
def current_weather():
    path=current_snapshot_path()
    if not path.exists():
        raise DatasetUnavailable('현재 기상 자료를 준비하고 있습니다.')
    snapshot=json.loads(path.read_text())
    snapshot['meta']['outdated']=snapshot['meta']['requested_through'] < observation_cutoff().isoformat()
    return snapshot


@app.get('/api/current-weather/refresh')
def current_weather_refresh_status():
    return refresh_status()


@app.post('/api/current-weather/refresh')
def current_weather_refresh():
    return start_refresh()


@app.get('/api/current-weather/regions/{region_code}')
def regional_current_weather(region_code: Code):
    if len(region_code) != 8 or not region_code.startswith('21'):
        raise KeyError(region_code)
    region=repo.region(region_code,'sgis')
    snapshot=current_weather()
    return {'region_code':region_code, 'region_name':region['region_name'], 'meta':snapshot['meta'],
            **nearest_current_station(region['geometry'],snapshot)}


@app.get('/api/current-weather/comparison')
def current_weather_comparison():
    snapshot = current_weather()
    return {'meta': snapshot['meta'], **build_comparison(snapshot, repo.load('sgis')['regions'].values())}


@app.get('/api/review/{region_code}')
def review_sheet(region_code: Code, mode: Mode = DATA_MODE):
    return build_review(repo, region_code, mode)


@app.get('/api/regions/{region_code}/children')
def children(region_code: Code, mode: Mode = DATA_MODE):
    repo.region(region_code, mode)
    return [{k: v for k, v in r.items() if k != 'geometry'} for r in repo.children(region_code, mode)]


@app.get('/api/regions/{region_code}')
def region(region_code: Code, mode: Mode = DATA_MODE):
    return repo.region(region_code, mode)


@app.get('/api/view')
def view(parent_code: Parent = '00', mode: Mode = DATA_MODE, layer: str = 'risk', level: AnalysisLevel = 'children'):
    if layer not in LAYERS:
        return JSONResponse(status_code=422, content={'detail': '지원하지 않는 레이어입니다.'})
    return repo.view(parent_code, mode, layer, level)


@app.get('/api/risk')
def risks(parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    return repo.results(parent_code, mode, level)


@app.get('/api/risk/ranking')
def ranks(parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    return ranking(repo.results(parent_code, mode, level))


@app.get('/api/risk/{region_code}/factors')
def factors(region_code: Code, parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    return repo.detail(region_code, parent_code, mode, level)['factors']


@app.get('/api/risk/{region_code}/comparison')
def comparison(region_code: Code, parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    data = repo.detail(region_code, parent_code, mode, level)
    return {'parent': data['factors'], 'busan': data['busan_comparison'], 'risk_average': data['comparison_risk_average'], 'risk_difference': data['risk_difference']}


@app.get('/api/risk/{region_code}')
def risk(region_code: Code, parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    return repo.detail(region_code, parent_code, mode, level)


@app.get('/api/map/heatwave')
def heatwave_map(parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    return repo.view(parent_code, mode, 'risk', level)['geojson']


@app.get('/api/map/layer/{layer_name}')
def map_layer(layer_name: str, parent_code: Parent = '21', mode: Mode = DATA_MODE, level: AnalysisLevel = 'children'):
    if layer_name not in LAYERS:
        return JSONResponse(status_code=422, content={'detail': '지원하지 않는 레이어입니다.'})
    return repo.view(parent_code, mode, layer_name, level)['geojson']


@app.post('/api/ai/explain')
def explanation(body: ExplainRequest):
    return explain(repo.detail(body.region_code, body.parent_code, body.mode, body.level))

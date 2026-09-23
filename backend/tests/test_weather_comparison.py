from copy import deepcopy
import hashlib
import pytest
from fastapi.testclient import TestClient
from backend.app.core.settings import DATA_ROOT
from backend.app.main import app
from backend.app.services.weather.comparison import build_comparison

GEOMETRY={'type':'Polygon','coordinates':[[[129,35],[129.01,35],[129.01,35.01],[129,35.01],[129,35]]]}
REGIONS=[{'region_code':'21111111','region_name':'동 A','full_name':'부산광역시 동 A','geometry':GEOMETRY}]


def snapshot():
    return {'meta':{'requested_through':'2026-09-22'}, 'stations':[
        {'station_id':'near','station_name':'가까운 관측소',
         'location':{'longitude':129.005,'latitude':35.005,'start_date':'2020-01-01','end_date':None},
         'latest':{'date':'2026-09-21','maximum':40,'minimum':20},
         'recent':{'daily':[{'date':'2026-09-21','maximum':40,'minimum':20}]}},
        {'station_id':'far','station_name':'먼 관측소',
         'location':{'longitude':129.2,'latitude':35.005,'start_date':'2020-01-01','end_date':None},
         'latest':{'date':'2026-09-22','maximum':28,'minimum':19},
         'recent':{'daily':[{'date':'2026-09-22','maximum':28,'minimum':19}]}},
    ]}


def test_comparison_uses_one_date_and_does_not_replace_missing_nearest_station():
    data=snapshot();before=deepcopy(data)
    result=build_comparison(data,REGIONS)
    assert result['observed_on']=='2026-09-22' and result['observed_count']==1
    assert [r['station_id'] for r in result['stations']]==['far','near']
    near=result['stations'][1]
    assert near['maximum'] is None and near['minimum'] is None
    assert near['regions'][0]['region_code']=='21111111'
    assert result['stations'][0]['regions']==[]
    assert data==before


def test_missing_maximum_keeps_available_minimum_and_invalid_position_is_not_mapped():
    data=snapshot()
    data['stations'][0]['recent']['daily'].append({'date':'2026-09-22','maximum':None,'minimum':21})
    data['stations'][0]['location']['start_date']='2026-10-01'
    result=build_comparison(data,REGIONS)
    near=next(r for r in result['stations'] if r['station_id']=='near')
    assert near['maximum'] is None and near['minimum']==21 and near['location'] is None
    assert near['regions']==[]
    assert result['stations'][0]['regions'][0]['region_code']=='21111111'


def test_api_connections_match_regional_weather_and_do_not_change_risk_snapshot():
    path=DATA_ROOT/'processed/sgis.json'
    if not path.exists():pytest.skip('Requires actual local snapshot')
    client=TestClient(app)
    if client.get('/api/current-weather').status_code==503:pytest.skip('Requires current observations')
    before=hashlib.sha256(path.read_bytes()).hexdigest()
    response=client.get('/api/current-weather/comparison')
    assert response.status_code==200
    data=response.json();codes=[]
    assert data['observed_on']==data['meta']['requested_through']
    for station in data['stations']:
        expected=next((r for r in station['recent']['daily'] if r['date']==data['observed_on']),{})
        assert station['maximum']==expected.get('maximum')
        codes.extend(r['region_code'] for r in station['regions'])
    assert len(codes)==len(set(codes))==206
    code='21110600'
    linked=next(s for s in data['stations'] if any(r['region_code']==code for r in s['regions']))
    regional=client.get('/api/current-weather/regions/'+code).json()
    assert linked['station_id']==regional['station']['station_id']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==before

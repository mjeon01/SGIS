from copy import deepcopy
import hashlib
import pytest
from fastapi.testclient import TestClient
from backend.app.core.settings import DATA_ROOT
from backend.app.main import app
from backend.app.services.weather.regional import nearest_current_station
from backend.app.analytics.climate import representative_point


GEOMETRY={'type':'Polygon','coordinates':[[[129,35],[129.01,35],[129.01,35.01],[129,35.01],[129,35]]]}


def fixture():
    x,y=representative_point(GEOMETRY)
    return {'meta':{'requested_through':'2026-09-22'},'stations':[
        {'station_id':'near','location':{'longitude':x+.001,'latitude':y,'start_date':'2025-01-01','end_date':None},'latest':None},
        {'station_id':'far','location':{'longitude':x+.1,'latitude':y,'start_date':'2020-01-01','end_date':None},'latest':{'date':'2026-09-22','maximum':30,'minimum':20}},
    ]}


def test_nearest_current_station_keeps_missing_data_without_farther_substitution():
    snapshot=fixture();before=deepcopy(snapshot)
    result=nearest_current_station(GEOMETRY,snapshot)
    assert result['available'] and result['station']['station_id']=='near'
    assert result['station']['latest'] is None
    assert result['is_local_measurement'] is False
    assert .08<result['distance_km']<.1
    assert snapshot==before


def test_current_location_history_is_required_and_expired_locations_are_excluded():
    snapshot=fixture()
    snapshot['stations'][0]['location']['end_date']='2025-12-31'
    assert nearest_current_station(GEOMETRY,snapshot)['station']['station_id']=='far'
    snapshot['stations'][0]['location']['end_date']=None
    snapshot['stations'][0]['location']['start_date']='2026-10-01'
    assert nearest_current_station(GEOMETRY,snapshot)['station']['station_id']=='far'
    snapshot['stations'][1]['location']=None
    assert nearest_current_station(GEOMETRY,snapshot)['available'] is False


def test_regional_current_weather_is_separate_from_historical_risk_and_changes_by_dong():
    path=DATA_ROOT/'processed/sgis.json'
    if not path.exists():pytest.skip('Requires downloaded SGIS snapshot')
    before=hashlib.sha256(path.read_bytes()).hexdigest()
    client=TestClient(app)
    if client.get('/api/current-weather').status_code==503:pytest.skip('Requires current observations')
    first=client.get('/api/current-weather/regions/21110600')
    assert first.status_code==200
    codes=client.get('/api/regions?parent_code=21090&mode=sgis').json()
    second=client.get('/api/current-weather/regions/'+codes[0]['region_code'])
    assert second.status_code==200
    a,b=first.json(),second.json()
    assert a['meta']['reference_year']==2026 and a['is_local_measurement'] is False
    assert a['station']['station_id']!=b['station']['station_id']
    assert a['station']['recent']['period'][1]==a['meta']['requested_through']
    assert not {'risk_score','total_population'} & a.keys()
    assert client.get('/api/current-weather/regions/21090').status_code==404
    assert client.get('/api/current-weather/regions/11010530').status_code==404
    assert hashlib.sha256(path.read_bytes()).hexdigest()==before

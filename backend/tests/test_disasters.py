import copy
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from shapely.geometry import box, mapping
from backend.app.main import app, repo
from backend.app.services import disasters
from scripts.collect_landslides import normalize as landslides
from scripts.collect_typhoons import normalize as typhoon
from scripts.collect_winter import summarize_winter


def test_landslide_coordinates_identity_timezone_and_status():
    row={'seq':1,'lat':35.12,'lon':129.02,'appointedDate':'2014-11-16T15:00:00Z','clearYn':'해제'}
    regions={'21111111':{'region_code':'21111111','region_name':'검증용 경계','geometry':mapping(box(129,35.1,129.1,35.2))}}
    data,excluded=landslides([row,row,{**row,'seq':None},{**row,'seq':2,'lat':129.02},
                             {**row,'seq':3,'lon':float('nan')},{**row,'seq':4,'lon':129.2}],regions)
    assert excluded==4 and len(data)==2
    assert data[0]['designated_date']=='2014-11-17'
    assert data[0]['status']=='해제' and data[0]['region_code']=='21111111'
    assert data[1]['region_code'] is None


def test_typhoon_excludes_forecasts_orders_and_deduplicates_bulletins():
    p={'tm':'202209060600','tmFc':'202209060700','lat':'35.2','lon':'129.2','ps':'955','ws':'40'}
    storm={'year':'2022','seq':'11','name':'힌남노','nameEn':'HINNAMNOR','tracks':[
        p,{**p,'tm':'202209060500'}, {**p,'tmFc':'202209060600','ps':'960'},
        {**p,'tm':'202209060900'}, {**p,'lat':'nan'}, {**p,'tm':'bad'}]}
    result=typhoon(storm)
    assert result['point_count']==2 and result['excluded_count']==3
    assert result['points'][-1]['timestamp']=='2022-09-06T06:00:00+09:00'
    assert result['points'][-1]['pressure_hpa']==955
    assert result['points'][-1]['wind_speed_ms']==40


def test_freezing_days_zero_excluded_and_missing_period_not_imputed():
    rows=[{'date':'2025-12-31','minimum':-1,'maximum':3},{'date':'2026-01-01','minimum':0,'maximum':4}]
    full=summarize_winter(rows,['2025-12-31','2026-01-01'])
    assert full['freezing_days']==1
    partial=summarize_winter(rows,['2025-12-31','2026-01-02'])
    assert partial['freezing_days'] is None and partial['observed_freezing_days']==1
    assert partial['summary']['minimum']['value'] is None
    assert partial['daily'][-1]['minimum'] is None


def test_missing_official_files_return_unavailable_never_sample(tmp_path,monkeypatch):
    monkeypatch.setattr(disasters,'DATA_ROOT',tmp_path)
    client=TestClient(app)
    assert all(s['status']=='unavailable' for s in client.get('/api/disasters').json().values())
    for route in ['/api/landslides','/api/typhoons','/api/typhoons/2022-11','/api/climate/seasons/winter-2025-2026']:
        response=client.get(route)
        assert response.status_code==503
        assert 'sample_available' not in response.json()
    assert client.get('/api/climate/seasons/winter-9999-9999').status_code==422
    assert client.get('/api/typhoons/nope').status_code==422


def test_distance_uses_measured_positions_and_does_not_mutate_snapshot(monkeypatch):
    reference={'latitude':35.2,'longitude':129.2}
    data={'meta':{},'storms':[{'id':'2022-11','points':[
        {'timestamp':'a','latitude':35.3,'longitude':129.2},
        {'timestamp':'b','latitude':35.2,'longitude':129.2}]}]}
    original=copy.deepcopy(data)
    monkeypatch.setattr(disasters,'snapshot',lambda _:data)
    result=disasters.typhoon_detail('2022-11',reference)
    assert result['closest']['timestamp']=='b' and result['closest']['distance_km']==0
    assert 11<result['storm']['points'][0]['distance_km']<11.2
    assert data==original
    with pytest.raises(HTTPException):disasters.typhoon_detail('2022-99')


def test_winter_nearest_station_requires_location_valid_for_whole_season(monkeypatch):
    data={'meta':{'period':['2025-12-01','2026-02-28']},'stations':[
        {'station_id':'closed','station_name':'closed','locations':[{'latitude':35,'longitude':129,'start_date':'2020-01-01','end_date':'2025-12-31'}]},
        {'station_id':'valid','station_name':'valid','locations':[{'latitude':35.1,'longitude':129,'start_date':'2020-01-01','end_date':None}]}]}
    monkeypatch.setattr(disasters,'snapshot',lambda _:data)
    assert disasters.winter_season({'latitude':35,'longitude':129})['nearest']['station_id']=='valid'


def test_collected_snapshots_and_api_integration():
    if not all((disasters.DATA_ROOT/'processed'/f).exists() for f in disasters.FILES.values()):
        pytest.skip('Run official collectors for integration checks')
    client=TestClient(app)
    landslide=client.get('/api/landslides').json()
    assert len(landslide['records'])+landslide['meta']['excluded_count']==landslide['meta']['source_count']
    storms=client.get('/api/typhoons').json()
    assert set(storms['meta']['years'])==set(range(2020,2026))
    track=client.get('/api/typhoons/2022-11?region=21110600').json()
    assert track['storm']['name']=='힌남노'
    points=track['storm']['points']
    assert len({p['timestamp'] for p in points})==len(points)
    assert points==sorted(points,key=lambda p:p['timestamp'])
    assert all(p['timestamp']<=p['reported_at'] for p in points)
    assert track['closest']['distance_km']==min(p['distance_km'] for p in points)
    winter=client.get('/api/climate/seasons/winter-2025-2026?region=21110600').json()
    assert winter['meta']['period']==['2025-12-01','2026-02-28']
    assert winter['nearest']['station_id'] in [s['station_id'] for s in winter['stations']]
    for station in winter['stations']:
        assert len(station['daily'])==90
        assert station['freezing_days']==sum(d['minimum']<0 for d in station['daily']) if station['summary']['minimum']['complete'] else station['freezing_days'] is None
    profile=client.get('/api/disaster-profile/21110600').json()
    assert profile['stats']['total_population']==repo.load('sgis')['observations']['21110600']['total_population']
    assert profile['stats']['business_count'] is None
    assert set(profile['hazards'])=={'heat','flood','landslide','typhoon','cold'}
    assert profile['hazards']['heat']['period']==['2026-06-01','2026-08-31']
    nearby=client.get('/api/typhoons?region=21110600').json()['storms']
    for year in range(2020,2026):
        distances=[s['closest_distance_km'] for s in nearby if s['year']==year]
        assert distances==sorted(distances)
    hinnamnor=next(s for s in nearby if s['id']=='2022-11')
    assert hinnamnor['closest_distance_km']==track['closest']['distance_km']


def test_collector_retries_transient_errors_but_not_unauthorized():
    import httpx
    from scripts.public_collection import request
    attempts=[]
    def handler(r):
        attempts.append(r)
        return httpx.Response(503 if len(attempts)<3 else 200,json={'ok':True})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert request(client,'GET','https://example.test/data').json()=={'ok':True}
    assert len(attempts)==3
    attempts.clear()
    def unauthorized(r):
        attempts.append(r)
        return httpx.Response(401)
    with httpx.Client(transport=httpx.MockTransport(unauthorized)) as client:
        with pytest.raises(httpx.HTTPStatusError):request(client,'GET','https://example.test/data')
    assert len(attempts)==1

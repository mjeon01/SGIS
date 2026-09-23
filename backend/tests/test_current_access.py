import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.settings import DATA_ROOT
from backend.app.services.facilities import match
from backend.app.services.weather.current import period_summary

client=TestClient(app)


def shelter(**kwargs):
    return {'kind':'shelter','access':'누구나','operating':'Y',**kwargs}


def test_missing_schedule_is_unknown_and_eligibility_is_enforced():
    row=shelter()
    assert match(row,'anyone')=='matched'
    assert match(row,'anyone',0,'14:00')=='unknown'
    assert match(shelter(access='특정인'),'anyone',0,'14:00')=='excluded'
    assert match(shelter(access='미확인'),'anyone')=='unknown'
    assert match(shelter(operating='N'))=='excluded'


def test_schedule_boundaries_weekend_unknown_and_24h():
    row=shelter(schedule={'days':[0,1,2,3,4,5],'weekday':['0900','1800'],'weekend':[None,None]})
    assert match(row,'all',0,'09:00')=='matched'
    assert match(row,'all',0,'18:00')=='excluded'
    assert match(row,'all',5,'14:00')=='unknown'
    assert match(row,'all',6,'14:00')=='excluded'
    row['schedule']['weekday']=['0000','2400']
    assert match(row,'all',0,'23:59')=='matched'
    row['schedule']['weekday']=['2200','0600']
    assert match(row,'all',0,'23:00')=='unknown'


def test_current_heatwave_days_require_complete_maxima_not_complete_minima():
    rows=[{'date':'2026-06-01','maximum':33,'minimum':None},{'date':'2026-06-02','maximum':32,'minimum':20}]
    series=period_summary(rows,'2026-06-01','2026-06-02')
    assert series['heatwave_days']==1
    assert series['summary']['maximum']['value']==33
    assert series['summary']['minimum']['value'] is None
    assert period_summary(rows,'2026-06-01','2026-06-03')['heatwave_days'] is None


@pytest.mark.parametrize('url',['/api/facilities?time=14:00','/api/facilities?day=7','/api/facilities?day=0&time=24:00'])
def test_invalid_filters_are_rejected(url):
    assert client.get(url).status_code==422


def test_actual_current_sources_leave_historical_file_untouched():
    historical=DATA_ROOT/'processed/sgis.json'
    if not historical.exists():pytest.skip('Requires downloaded snapshots')
    before=hashlib.sha256(historical.read_bytes()).hexdigest()
    weather=client.get('/api/current-weather')
    assert weather.status_code==200
    data=weather.json();assert data['meta']['reference_year']==2026
    assert data['meta']['is_realtime'] is False
    assert len(data['stations'])==16
    assert all(s['recent']['period'][1]==data['meta']['requested_through'] for s in data['stations'])
    assert any(s['latest'] is None for s in data['stations'])
    facilities=client.get('/api/facilities?kind=shelter&access=anyone&day=0&time=14:00').json()
    assert all(f['access']=='누구나' for f in facilities['facilities'])
    assert facilities['facilities']
    all_access=client.get('/api/facilities?kind=shelter&day=0&time=14:00').json()
    assert {f['filter_status'] for f in all_access['facilities']}=={'matched','unknown'}
    assert hashlib.sha256(historical.read_bytes()).hexdigest()==before


def test_weather_refresh_uses_fresh_cache_without_contacting_provider(monkeypatch,tmp_path):
    from datetime import datetime,timezone
    from backend.app.services.weather import current
    path=tmp_path/'current.json';path.write_text(json.dumps({'meta':{'collected_at':datetime.now(timezone.utc).isoformat(),'requested_through':current.observation_cutoff().isoformat()}}))
    monkeypatch.setattr(current,'current_snapshot_path',lambda:path)
    monkeypatch.setattr(current,'collect_current',lambda **_:pytest.fail('Fresh snapshots must not trigger collection'))
    monkeypatch.setattr(current,'_job',{'state':'idle','message':None})
    assert current.start_refresh()['state']=='fresh'

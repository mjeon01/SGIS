import pytest
from shapely.geometry import Polygon
from scripts.prepare_facilities import locate
from backend.app.main import app
from fastapi.testclient import TestClient


def test_facility_on_boundary_or_outside_is_not_assigned_arbitrarily():
    areas = {'a':Polygon([(0,0),(1,0),(1,1),(0,1)]), 'b':Polygon([(1,0),(2,0),(2,1),(1,1)])}
    assert locate(.5,.5,areas) == 'a'
    assert locate(3,3,areas) is None
    assert locate(1,.5,areas) is None


def test_current_facility_inventory_has_no_historical_risk_or_population():
    response = TestClient(app).get('/api/facilities')
    if response.status_code == 503:
        pytest.skip('Requires downloaded official facility snapshot')
    assert response.status_code == 200
    data = response.json()
    assert data['meta']['reference_year'] == 2026
    assert data['meta']['source_counts'] == {'shelter':1735,'shade':1835}
    assert len(data['facilities']) == sum(data['meta']['mapped_counts'].values())
    assert len({r['id'] for r in data['facilities']}) == len(data['facilities'])
    assert all(r['reference_year']==2026 for r in data['facilities'])
    assert not any({'risk_score','population','total_population','facilities_per_capita'} & r.keys() for r in data['facilities'])
    assert all(128.7<r['longitude']<129.4 and 34.8<r['latitude']<35.5 for r in data['facilities'])
    assert {r['access'] for r in data['facilities'] if r['kind']=='shelter'} == {'누구나','특정인'}

import re
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.ai.explain import ACTIONS

client = TestClient(app)


def test_sample_drilldown_and_geojson():
    nation = client.get('/api/view?mode=sample').json()
    assert len(nation['regions']) == 17
    busan = client.get('/api/view?mode=sample&parent_code=21').json()
    assert len(busan['regions']) == 16
    assert busan['scored_count'] == 16
    assert len(busan['ranking']) == 5
    for feature in busan['geojson']['features']:
        assert feature['properties']['is_sample'] is True
    district = client.get('/api/view?mode=sample&parent_code=21090').json()
    assert len(district['regions']) > 10
    assert all(r['region_level'] == 'dong' for r in district['regions'])


def test_ranking_route_not_swallowed_by_region_route():
    data = client.get('/api/risk/ranking?mode=sample').json()
    assert len(data) == 5
    assert data[0]['risk_score'] >= data[-1]['risk_score']


def test_explanation_is_grounded_and_actions_are_linked():
    results = client.get('/api/risk?mode=sample').json()
    for region in results:
        response = client.post('/api/ai/explain', json={'region_code': region['region_code'], 'parent_code': '21', 'mode': 'sample'})
        assert response.status_code == 200
        explanation = response.json()
        text = explanation['summary'] + ' '.join(c['text'] for c in explanation['causes'])
        allowed = set(explanation['evidence_values'].values()) | {'65', '1', '30'}  # indicator labels
        assert set(re.findall(r'\d[\d,]*(?:\.\d+)?', text)) <= allowed
        top_keys = {f['key'] for f in region['top_factors']}
        for action in explanation['actions']:
            assert action['factor_key'] in top_keys
            assert action['title'] in ACTIONS[action['factor_key']]
        assert explanation['engine'] == 'rules'
        assert '반드시' not in text and '피해가 발생' not in text


def test_client_cannot_supply_fabricated_scores():
    response = client.post('/api/ai/explain', json={'region_code': '21010', 'mode': 'sample', 'risk_score': 999})
    assert response.status_code == 422


def test_invalid_inputs_and_out_of_scope():
    assert client.get('/api/view?mode=invalid').status_code == 422
    assert client.get('/api/regions/not-a-code').status_code == 422
    assert client.get('/api/view?parent_code=../../').status_code == 422
    assert client.get('/api/map/layer/invalid?mode=sample').status_code == 422
    assert client.get('/api/risk/11010?mode=sample&parent_code=21').status_code == 404
    nation = client.get('/api/risk?mode=sample&parent_code=00').json()
    assert all(r['risk_score'] is None for r in nation)


def test_comparison_and_layer_endpoints():
    response = client.get('/api/risk/21010/comparison?mode=sample')
    assert response.status_code == 200
    assert len(response.json()['parent']) == 7
    assert len(response.json()['busan']) == 7
    assert client.get('/api/map/layer/exposure?mode=sample').json()['features'][0]['properties']['value'] is not None
    assert len(client.get('/api/regions/21/children?mode=sample').json()) == 16


def test_actual_snapshot_is_never_sample_or_filled_with_zero():
    response = client.get('/api/view?mode=sgis&parent_code=21')
    if response.status_code == 503:
        return  # Fresh checkout requires authenticated collection; checked by live smoke when available.
    assert response.status_code == 200
    data = response.json()
    assert data['meta']['reference_year'] == 2024
    assert data['meta']['boundary_year'] == 2025
    assert all(not r['is_sample'] for r in data['regions'])
    if data['meta'].get('enrichment_version'):
        assert data['scored_count'] > 0
        assert len(data['ranking']) == 5
        for region in data['regions']:
            assert (region['risk_score'] is not None) == (region['data_completeness'] == 1)
            old = next(f for f in region['factors'] if f['key'] == 'old_house_ratio')
            weather = next(f for f in region['factors'] if f['key'] == 'heatwave_history_index')
            assert old['value'] is not None and old['comparison_average'] == 31.8
            assert weather['unit'] == '일'
            assert weather['source_detail']['is_local_measurement'] is False
            assert region['observation']['old_house_count'] is None
    else:
        assert all(r['risk_score'] is None and r['data_completeness'] == 4 / 7 for r in data['regions'])
        assert data['ranking'] == []


def test_busan_all_dongs_share_one_comparison_scope():
    data = client.get('/api/view?parent_code=21&mode=sample&level=dong').json()
    assert data['level'] == 'dong'
    assert len(data['regions']) == 206
    assert all(r['region_level'] == 'dong' and r['comparison_region'] == '부산광역시' for r in data['regions'])
    assert len({r['parent_region_code'] for r in data['regions']}) == 16
    top = data['ranking'][0]
    detail = client.get(f"/api/risk/{top['region_code']}?parent_code=21&mode=sample&level=dong").json()
    assert detail['risk_score'] == top['risk_score'] == 100
    scores = {r['region_code']:r['risk_score'] for r in data['regions']}
    assert all(f['properties']['risk_score'] == scores[f['id']] for f in data['geojson']['features'])
    explanation = client.post('/api/ai/explain', json={'region_code':top['region_code'],'parent_code':'21','mode':'sample','level':'dong'})
    assert explanation.status_code == 200
    assert '부산광역시' in explanation.json()['summary']
    assert client.get('/api/view?parent_code=00&mode=sample&level=dong').status_code == 404
    assert client.get('/api/view?level=invalid').status_code == 422

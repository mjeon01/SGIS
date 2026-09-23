from fastapi.testclient import TestClient
import pytest
from backend.app.main import app
from backend.app.services.weather.extremes import summarize_daily

client = TestClient(app)


def test_temperature_extrema_keep_dates_and_gaps_without_filling():
    rows = [{'date':'2024-06-01','maximum':33,'minimum':20},
            {'date':'2024-06-03','maximum':35,'minimum':None}]
    result = summarize_daily(rows, ['2024-06-01','2024-06-03'])
    assert result['daily'][1] == {'date':'2024-06-02','maximum':None,'minimum':None}
    assert result['summary']['maximum']['value'] is None
    assert result['summary']['minimum']['valid_days'] == 1
    rows.insert(1, {'date':'2024-06-02','maximum':35,'minimum':19})
    rows[2]['minimum'] = 19
    result = summarize_daily(rows, ['2024-06-01','2024-06-03'])
    assert result['summary']['maximum']['value'] == 35
    assert result['summary']['maximum']['dates'] == ['2024-06-02','2024-06-03']
    assert result['summary']['minimum']['value'] == 19
    with pytest.raises(ValueError):
        summarize_daily(rows + rows[:1], ['2024-06-01','2024-06-03'])
    rows[0]['minimum'] = 34
    with pytest.raises(ValueError):
        summarize_daily(rows, ['2024-06-01','2024-06-03'])


def test_review_is_citywide_and_only_contains_evidence_linked_checks():
    overview = client.get('/api/view?parent_code=21&mode=sample&level=dong').json()
    top = overview['ranking'][0]
    sheet = client.get(f"/api/review/{top['region_code']}?mode=sample").json()
    assert sheet['rank'] == 1
    assert sheet['region']['risk_score'] == top['risk_score']
    assert sheet['scored_count'] == sheet['total_count'] == 206
    assert sheet['region']['is_sample'] is True
    assert all(c['factor_name'] in {f['name'] for f in top['top_factors']} for c in sheet['field_checks'])
    assert '2026' in sheet['facility_note'] and '2024' in sheet['facility_note']
    assert client.get('/api/review/21010?mode=sample').status_code == 404
    assert client.get('/api/weather/21010?mode=sample').json()['available'] is False


def test_actual_weather_does_not_change_scores_and_incomplete_review_has_no_rank():
    view = client.get('/api/view?parent_code=21&mode=sgis&level=dong')
    if view.status_code == 503:
        pytest.skip('Actual snapshot unavailable')
    before = view.json()
    top = before['ranking'][0]
    response = client.get(f"/api/weather/{top['region_code']}?mode=sgis")
    if response.status_code == 503:
        pytest.skip('Supplementary KMA snapshot unavailable')
    data = response.json()
    assert data['available'] and data['is_local_measurement'] is False
    assert len(data['daily']) == 92
    assert data['summary']['maximum']['value'] == max(r['maximum'] for r in data['daily'])
    assert data['summary']['minimum']['value'] == min(r['minimum'] for r in data['daily'])
    assert client.get('/api/view?parent_code=21&mode=sgis&level=dong').json() == before
    missing = next(r for r in before['regions'] if r['risk_score'] is None)
    sheet = client.get(f"/api/review/{missing['region_code']}?mode=sgis").json()
    assert sheet['rank'] is None and sheet['region']['risk_score'] is None

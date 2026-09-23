from copy import deepcopy
import json
import pytest
import httpx
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.repositories.dataset import DatasetRepository, DatasetUnavailable
from backend.app.services.ai import prepared
from backend.app.services.ai.guidance import action_plans, SOURCES


@pytest.fixture
def region():
    repo = DatasetRepository()
    try:
        return repo.detail('21110600', '21', 'sgis', 'dong')
    except DatasetUnavailable:
        pytest.skip('Actual snapshot unavailable')


def write_report(root, region, narrative=None):
    root.mkdir(parents=True, exist_ok=True)
    data = {'region_code': region['region_code'], 'fingerprint': prepared.fingerprint(prepared.report_input(region)),
            'prepared_at': '2026-09-23T00:00:00+00:00', 'provenance': {'model': 'qwen2.5:7b'},
            'narrative': narrative or {'overview': '시설 운영시간과 보행 대기 장소의 그늘을 함께 점검하고, 확인한 내용을 바탕으로 운영기관과 조정 방안을 협의합니다.',
                                      'next_step': '현재 시설의 운영시간과 이용대상을 먼저 확인합니다.'}}
    path = root / f"{region['region_code']}.json"
    path.write_text(json.dumps(data, ensure_ascii=False))
    return path


def test_climate_factors_have_action_plans_and_real_citations(region):
    plans = action_plans(region)
    assert {p['id'] for p in plans} == {'shade', 'shelter', 'continuity'}
    assert all(len(p['steps']) >= 2 and p['condition'] and p['completion'] for p in plans)
    assert all(s['id'] in SOURCES and s['url'].startswith('https://') for p in plans for s in p['sources'])
    assert {k for p in plans for k in p['factor_keys']} == {f['key'] for f in region['top_factors']}


def test_serving_prepared_report_never_uses_network(region, tmp_path, monkeypatch):
    root = tmp_path / 'reports'
    write_report(root, region)
    monkeypatch.setattr(prepared, 'REPORT_ROOT', root)
    def forbidden(*args, **kwargs):
        raise AssertionError('Serving reports must not make HTTP calls')
    monkeypatch.setattr(httpx.Client, 'send', forbidden)
    # ASGI client uses httpx internally, so call the endpoint service directly.
    from backend.app.services.review import build_review
    result = build_review(DatasetRepository(), region['region_code'], 'sgis')
    assert result['report']['status'] == 'prepared'
    assert result['rank'] == 1 and result['region']['risk_score'] == 100
    assert result['report']['narrative']['next_step'].startswith('현재 시설')


def test_changed_facts_and_missing_or_synthetic_data_never_reuse_prose(region, tmp_path):
    write_report(tmp_path, region)
    changed = deepcopy(region)
    changed['top_factors'][0]['value'] += 1
    assert prepared.report_content(changed, tmp_path)['status'] == 'stale'
    changed = deepcopy(region)
    changed['risk_score'] = None
    assert prepared.report_content(changed, tmp_path)['status'] == 'insufficient'
    changed = deepcopy(region)
    changed['is_sample'] = True
    assert prepared.report_content(changed, tmp_path)['status'] == 'sample'
    assert prepared.report_content(region, tmp_path / 'missing')['narrative'] is None


@pytest.mark.parametrize('text', ['반드시 쉼터를 설치해야 합니다.', '쉼터가 10개 부족합니다.', '평균보다 높으므로 점검합니다.', '<script>확인합니다.</script>', '고령인구가 증가하여 점검을 검토합니다.'])
def test_unverified_prose_is_rejected(text):
    with pytest.raises(ValueError):
        prepared.validate_narrative({'overview': text * 3, 'next_step': '현재 시설의 운영시간과 이용대상을 먼저 확인합니다.'})


@pytest.mark.parametrize('content', ['broken json', '[]', '{}'])
def test_broken_artifact_falls_back_to_grounded_plans(region, tmp_path, content):
    path = write_report(tmp_path, region)
    path.write_text(content)
    report = prepared.report_content(region, tmp_path)
    assert report['status'] == 'stale' and report['narrative'] is None
    assert len(report['plans']) == 3


def test_report_endpoint_does_not_accept_generation_or_prompt_injection():
    client = TestClient(app)
    assert client.post('/api/review/21110600', json={'prompt': 'invent a score'}).status_code == 405
    sample = client.get('/api/review/21110600?mode=sample').json()
    assert sample['report']['status'] == 'sample' and sample['report']['narrative'] is None


def test_failed_model_request_still_observes_call_spacing(region, tmp_path, monkeypatch):
    from scripts import prepare_reports
    sleeps = []
    monkeypatch.setattr(prepare_reports, 'REPORT_ROOT', tmp_path / 'data/reports/heatwave')
    monkeypatch.setattr(prepare_reports.time, 'sleep', sleeps.append)
    transport = httpx.MockTransport(lambda request: httpx.Response(503, request=request))
    with httpx.Client(transport=transport, base_url='http://127.0.0.1:11434') as local:
        with pytest.raises(httpx.HTTPStatusError):
            prepare_reports.generate(local, 'qwen2.5:7b', 'test', prepared.report_input(region))
    assert sleeps == [3]

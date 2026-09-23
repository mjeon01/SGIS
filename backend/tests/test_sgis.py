import json
import httpx
import pytest
from backend.app.services.sgis.parser import number, ratio, index_rows, parse_observations, parse_boundaries
from backend.app.services.sgis.client import SgisClient
from backend.app.services.sgis.auth import TokenManager
from backend.app.services.sgis.base import SgisError
from backend.app.schemas.models import Observation


@pytest.mark.parametrize('value', ['N/A', '-', 'X', '*', '<5', '', None, 'NaN', 'Infinity', '-3', True])
def test_suppressed_or_invalid_values_are_missing(value):
    assert number(value) is None


def test_zero_and_formatted_numbers():
    assert number('0') == 0
    assert number('1,234') == 1234
    assert ratio(None, 10) is None
    assert ratio(2, 0) is None
    assert ratio(15, 10) is None


def test_join_by_code_not_position():
    base = [{'adm_cd': '21010', 'tot_ppltn': 100}, {'adm_cd': '21020', 'tot_ppltn': 200}]
    elders = [{'adm_cd': '21020', 'population': 50}, {'adm_cd': '21010', 'population': 10}]
    result = parse_observations(base, elders, [], [], 2024, {})
    assert result['21010']['elderly_ratio'] == 10
    assert result['21020']['elderly_ratio'] == 25
    assert result['21010']['old_house_ratio'] is None


def test_duplicate_join_keys_rejected():
    with pytest.raises(ValueError):
        index_rows([{'adm_cd': '21'}, {'adm_cd': '21'}])


def test_coordinate_conversion():
    raw = {'features': [{'properties': {'adm_cd': '21010', 'adm_nm': '부산광역시 중구'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[1139637, 1679989], [1140000, 1679989], [1140000, 1680000], [1139637, 1679989]]]}}]}
    geometry = parse_boundaries(raw, '21', 2025)[0]['geometry']
    lon, lat = geometry['coordinates'][0][0]
    assert 128 < lon < 130 and 34 < lat < 36


def test_auth_and_cache_do_not_persist_secrets(monkeypatch, tmp_path):
    monkeypatch.setenv('SGIS_SERVICE_ID', 'fake-key')
    monkeypatch.setenv('SGIS_SECURITY_KEY', 'fake-secret')
    monkeypatch.delenv('SGIS_ACCESS_TOKEN', raising=False)
    calls = []
    def handler(request):
        calls.append(request.url.path)
        if request.url.path.endswith('authentication.json'):
            assert request.url.params['consumer_key'] == 'fake-key'
            return httpx.Response(200, json={'errCd': 0, 'result': {'accessToken': 'fake-token', 'accessTimeout': '9999999999000'}})
        assert request.url.params['accessToken'] == 'fake-token'
        return httpx.Response(200, json={'errCd': 0, 'result': [{'adm_cd': '21'}]})
    client = SgisClient(transport=httpx.MockTransport(handler), cache_root=tmp_path)
    client.get('/stats/population.json', {'year': '2024'})
    client.get('/stats/population.json', {'year': '2024'})
    assert len(calls) == 2
    assert 'fake-token' not in ''.join(p.read_text() for p in tmp_path.glob('*.json'))
    assert 'fake-secret' not in ''.join(p.read_text() for p in tmp_path.glob('*.json'))
    client.close()


def test_expired_token_retried_once(monkeypatch, tmp_path):
    monkeypatch.setenv('SGIS_SERVICE_ID', 'key')
    monkeypatch.setenv('SGIS_SECURITY_KEY', 'secret')
    monkeypatch.setenv('SGIS_ACCESS_TOKEN', 'expired')
    def handler(request):
        if request.url.path.endswith('authentication.json'):
            return httpx.Response(200, json={'errCd': 0, 'result': {'accessToken': 'fresh', 'accessTimeout': '9999999999000'}})
        return httpx.Response(200, json={'errCd': -401} if request.url.params['accessToken'] == 'expired' else {'errCd': 0, 'result': []})
    client = SgisClient(transport=httpx.MockTransport(handler), cache_root=tmp_path)
    assert client.get('/stats/population.json')['errCd'] == 0
    client.close()


def test_no_credentials_error_is_safe(monkeypatch):
    for key in ['SGIS_SERVICE_ID', 'SGIS_SECURITY_KEY', 'SGIS_ACCESS_TOKEN']:
        monkeypatch.delenv(key, raising=False)
    with httpx.Client() as http:
        with pytest.raises(SgisError, match='credentials_missing'):
            TokenManager(http, 'https://example.invalid').get()


@pytest.mark.parametrize('value', [float('nan'), float('inf')])
def test_nonfinite_input_rejected(value):
    with pytest.raises(ValueError):
        Observation(region_code='21', reference_year=2024, heatwave_intensity=value)

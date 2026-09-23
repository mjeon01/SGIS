from shapely.geometry import box, mapping
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.flood import normalize_history


def record(**changes):
    return {'sensor_cd': 'a', 'sensor_name': '기록 지점', 'lat': '129.02',
            'lon': '35.12', 'period': ' 2024.09.21~2024.09.21',
            'inundation_depth': '약 20cm', **changes}


def test_public_coordinate_order_and_unknown_date_are_not_guessed():
    regions = {'21111111': {'region_code': '21111111', 'region_name': '동 A',
                          'geometry': mapping(box(129, 35.1, 129.1, 35.2))}}
    rows, excluded = normalize_history([
        record(), record(sensor_cd='b', period='~'),
        record(sensor_cd='c', lat='35.12'),  # malformed source repeats latitude
        record(sensor_cd='d', lat='nan'),
        record(sensor_cd='e', lat='fdsa'),
        record(),  # duplicate ID must not inflate history totals
    ], regions)
    assert excluded == 4
    assert len(rows) == 2
    assert rows[0]['longitude'] == 129.02 and rows[0]['latitude'] == 35.12
    assert rows[0]['region_code'] == '21111111'
    assert rows[0]['year'] == 2024 and rows[0]['depth'] == '약 20cm'
    assert rows[1]['year'] is None and rows[1]['period'] is None


def test_unassigned_or_ambiguous_membership_is_not_forced():
    regions = {code: {'region_code': code, 'region_name': code,
                     'geometry': mapping(box(129, 35.1, 129.1, 35.2))}
               for code in ['21111111', '21111112']}
    rows, _ = normalize_history([record(), record(sensor_cd='b', lat='129.2')], regions)
    assert all(row['region_code'] is None for row in rows)


def test_forecast_rejects_unpublished_scenarios_and_paths():
    client = TestClient(app)
    assert client.get('/api/flood/forecast/1000.png').status_code == 422
    assert client.get('/api/flood/forecast/abc.png').status_code == 422


def test_cached_collection_keeps_original_timestamp_without_network(tmp_path, monkeypatch):
    from contextlib import nullcontext
    from scripts import collect_flood
    folder = tmp_path / 'raw/flood'
    folder.mkdir(parents=True)
    for filename in ['history.json', 'forecast-30.png', 'forecast-50.png',
                     'forecast-80.png', 'forecast-100.png']:
        (folder / filename).write_text('cached')
    original = '{"collected_at":"2026-09-23T01:00:00+00:00"}'
    (folder / 'meta.json').write_text(original)
    monkeypatch.setattr(collect_flood, 'DATA_ROOT', tmp_path)
    # Any attempted HTTP call fails: the cached run requires no client methods.
    monkeypatch.setattr(collect_flood, 'public_client', lambda: nullcontext(object()))
    collect_flood.collect()
    assert (folder / 'meta.json').read_text() == original

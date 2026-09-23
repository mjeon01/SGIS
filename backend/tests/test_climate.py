from datetime import date, timedelta
import json

import httpx
import pytest
from shapely.geometry import Point, shape

from backend.app.analytics.climate import attach_climate, representative_point, station_summary
from backend.app.analytics.risk import comparison_average
from backend.app.services.public_http import ThrottledTransport
from scripts.collect_kma import parse_daily


def test_kma_parser_rejects_wrong_station_duplicate_and_error_page():
    row = {'TM': '2024-06-01', 'STN_ID': 159, 'AVG_TA': 24, 'MAX_TA': 33}
    def text(rows):
        return "var egovMapList1 = '" + json.dumps(rows) + "';"
    assert parse_daily(text([row]), '159', date(2024, 6, 1), date(2024, 6, 10))[0]['MAX_TA'] == 33
    for value, code in [(text([row]), '910'), (text([row, row]), '159'), ('<html>Error</html>', '159')]:
        with pytest.raises(ValueError):
            parse_daily(value, code, date(2024, 6, 1), date(2024, 6, 10))


def test_heatwave_threshold_and_missing_day_are_not_zero():
    station = {'daily': [{'TM': '2024-06-01', 'AVG_TA': 25, 'MAX_TA': 32.9},
                         {'TM': '2024-06-02', 'AVG_TA': 27, 'MAX_TA': 33}]}
    result = station_summary(station, ['2024-06-01', '2024-06-02'])
    assert result['mean_temperature'] == 26
    assert result['heatwave_days'] == 1
    result = station_summary(station, ['2024-06-01', '2024-06-03'])
    assert result['mean_temperature'] is None and result['heatwave_days'] is None
    station['daily'][0]['AVG_TA'] = None
    result = station_summary(station, ['2024-06-01', '2024-06-02'])
    assert result['mean_temperature'] is None and result['heatwave_days'] == 1


def test_nearest_incomplete_station_is_not_silently_replaced():
    geometry = {'type': 'Polygon', 'coordinates': [[[129,35],[129.01,35],[129.01,35.01],[129,35.01],[129,35]]]}
    stations = {}
    for code, lon, rows in [('1',129.005,[]), ('2',129.1,[{'TM':'2024-06-01','AVG_TA':25,'MAX_TA':34}])]:
        stations[code] = {'station_id':code,'name':code,'kind':'AWS','daily':rows,
                          'summer_locations':[{'longitude':lon,'latitude':35.005,'start_date':'2020-01-01','end_date':None}]}
    observations = {'21010':{'reference_year':2024,'source_detail':{}}}
    attach_climate(observations, {'21010':{'geometry':geometry}},
                   {'reference_year':2024,'period':['2024-06-01','2024-06-01'],'stations':stations})
    assert observations['21010']['heatwave_history_index'] is None
    assert observations['21010']['source_detail']['heatwave_intensity']['station_id'] == '1'
    assert shape(geometry).covers(Point(*representative_point(geometry)))


def test_published_housing_comparison_does_not_invent_counts():
    parent = {'old_house_ratio':31.8,'source_detail':{'old_house_ratio':{'comparison_method':'official_parent_ratio'}}}
    assert comparison_average([{'old_house_ratio':90,'total_houses':100}], 'old_house_ratio', parent) == 31.8
    assert comparison_average([{'old_house_ratio':90,'total_houses':100}], 'old_house_ratio') is None


def test_request_spacing_is_shared_and_respects_retry_after(tmp_path):
    now, calls = [1000.0], []
    def handler(request):
        calls.append(now[0])
        return httpx.Response(429, headers={'Retry-After':'12'}) if len(calls) == 2 else httpx.Response(200)
    def sleep(seconds):
        now[0] += seconds
    def client():
        return httpx.Client(transport=ThrottledTransport(httpx.MockTransport(handler), root=tmp_path,
                                                        clock=lambda:now[0], sleep=sleep))
    with client() as a, client() as b:
        a.get('https://example.test/first')
        b.get('https://example.test/second')
        a.get('https://example.test/third')
    assert calls == [1000,1003,1015]

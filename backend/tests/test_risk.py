import math
import pytest
from backend.app.analytics.risk import analyze, aggregate, compare, normalize, risk_level, ranking, load_weights
from backend.app.schemas.models import Observation


def region(code):
    return {'region_code': code, 'region_name': code, 'parent_region_code': '21', 'region_level': 'sigungu'}


def row(code, scalar):
    return Observation(region_code=code, reference_year=2024, heatwave_intensity=scalar,
        heatwave_history_index=scalar, total_population=scalar * 100,
        population_density=scalar * 1000, elderly_ratio=scalar,
        single_household_ratio=scalar, old_house_ratio=scalar).model_dump()


def test_scaling_and_identical():
    assert normalize(20, [10, 20, 30]) == .5
    assert normalize(10, [10, 10]) == .5
    assert normalize(None, [10]) is None


def test_hev_product_and_relative_scale():
    codes = ['21010', '21020', '21030']
    result = analyze([region(c) for c in codes], {c: row(c, i + 1) for i, c in enumerate(codes)}, '부산')
    assert [r['hazard_score'] for r in result] == [0, 50, 100]
    assert [r['exposure_score'] for r in result] == [0, 50, 100]
    assert [r['vulnerability_score'] for r in result] == [0, 50, 100]
    assert [r['risk_raw'] for r in result] == [0, .125, 1]
    assert [r['risk_score'] for r in result] == [0, 12.5, 100]
    assert result[1]['data_completeness'] == 1


def test_equal_final_values_use_midpoint_and_explain():
    results = analyze([region('21010'), region('21020')], {'21010': row('21010', 1), '21020': row('21020', 1)}, '부산')
    assert all(r['risk_score'] == 50 and r['no_variation'] for r in results)


@pytest.mark.parametrize('score,expected', [(0, '매우 낮음'), (19.9, '매우 낮음'), (20, '낮음'), (40, '보통'), (60, '높음'), (80, '매우 높음'), (100, '매우 높음'), (None, '데이터 부족')])
def test_thresholds(score, expected):
    assert risk_level(score) == expected


def test_missing_blocks_risk_but_keeps_complete_component():
    data = row('21010', 1)
    data['heatwave_intensity'] = None
    results = analyze([region('21010')], {'21010': data}, '부산')
    r = results[0]
    assert r['risk_score'] is None and r['hazard_score'] is None
    assert r['exposure_score'] == 50 and r['vulnerability_score'] == 50
    assert math.isclose(r['data_completeness'], 6 / 7)
    assert r['missing_indicators'] == ['heatwave_intensity']
    assert ranking(results) == []


def test_real_zero_preserved():
    r = analyze([region('21010')], {'21010': row('21010', 0)}, '부산')[0]
    assert r['risk_score'] == 50
    assert r['data_completeness'] == 1


def test_average_is_ratio_of_sums_and_matched_pairs_only():
    rows = [{'elderly_population': 1, 'total_population': 10}, {'elderly_population': 90, 'total_population': 100}, {'elderly_population': None, 'total_population': 200}]
    assert aggregate(rows, 'elderly_ratio') == pytest.approx(91 / 110 * 100)
    assert aggregate([{'elderly_population': 0, 'total_population': 0}], 'elderly_ratio') is None


def test_population_density_uses_total_population_over_area():
    assert aggregate([{'total_population': 100, 'population_density': 10}, {'total_population': 200, 'population_density': 40}], 'population_density') == 20


def test_percentage_points_and_division_by_zero():
    c = compare(31.2, 20.1, '%')
    assert c['difference_pp'] == pytest.approx(11.1)
    assert c['relative_ratio'] == pytest.approx(31.2 / 20.1)
    assert compare(4, 0, '%')['relative_ratio'] is None
    assert compare(400, 100, '명')['difference_pp'] is None


def test_contribution_and_ranking():
    codes = [f'210{i}0' for i in range(1, 8)]
    results = analyze([region(c) for c in codes], {c: row(c, i) for i, c in enumerate(codes)}, '부산')
    high = results[-1]
    assert len(high['top_factors']) == 3
    assert high['top_factors'][0]['contribution'] == .6
    assert [r['region_code'] for r in ranking(results)] == codes[::-1][:5]


def test_comparison_scope_changes_normalization():
    rows = {c: row(c, i) for c, i in [('21010', 1), ('21020', 2), ('21030', 3)]}
    all_results = analyze([region(c) for c in rows], rows, 'all')
    subset = analyze([region('21010'), region('21020')], rows, 'subset')
    assert all_results[1]['risk_score'] == 12.5
    assert subset[1]['risk_score'] == 100


def test_invalid_weights_rejected(tmp_path):
    path = tmp_path / 'bad.yaml'
    path.write_text('hazard: {indicators: {heatwave_intensity: 2}}')
    with pytest.raises(ValueError):
        load_weights(path)

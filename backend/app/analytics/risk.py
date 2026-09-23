from pathlib import Path
import math
import yaml
from ..core.settings import ROOT

INDICATORS = {
    'heatwave_intensity': {'name': '여름 평균기온', 'unit': '℃', 'group': 'hazard'},
    'heatwave_history_index': {'name': '여름 폭염일수', 'unit': '일', 'group': 'hazard'},
    'total_population': {'name': '총인구', 'unit': '명', 'group': 'exposure'},
    'population_density': {'name': '인구밀도', 'unit': '명/㎢', 'group': 'exposure'},
    'elderly_ratio': {'name': '65세 이상 인구 비율', 'unit': '%', 'group': 'vulnerability'},
    'single_household_ratio': {'name': '1인가구 비율', 'unit': '%', 'group': 'vulnerability'},
    'old_house_ratio': {'name': '30년 이상 노후주택 비율', 'unit': '%', 'group': 'vulnerability'},
}
RATIOS = {
    'elderly_ratio': ('elderly_population', 'total_population'),
    'single_household_ratio': ('single_household_count', 'total_households'),
    'old_house_ratio': ('old_house_count', 'total_houses'),
}
LEVELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음']


def load_weights(path: Path = ROOT / 'config' / 'risk_weights.yaml'):
    data = yaml.safe_load(path.read_text())
    if set(data) != {'hazard', 'exposure', 'vulnerability'}:
        raise ValueError('All three risk groups are required')
    for group, spec in data.items():
        weights = spec['indicators']
        expected = {k for k, v in INDICATORS.items() if v['group'] == group}
        if set(weights) != expected or any(not math.isfinite(v) or v < 0 for v in weights.values()) or not math.isclose(sum(weights.values()), 1):
            raise ValueError(f'Invalid weights for {group}')
    return data


def normalize(value, values):
    if value is None or not values:
        return None
    lo, hi = min(values), max(values)
    return 0.5 if lo == hi else (value - lo) / (hi - lo)


def risk_level(score):
    if score is None:
        return '데이터 부족'
    if not 0 <= score <= 100:
        raise ValueError('Score outside 0–100')
    return LEVELS[min(int(score // 20), 4)]


def aggregate(rows, indicator):
    """Ratios use matched numerator/denominator pairs, never a mean of percentages."""
    if indicator in RATIOS:
        num, den = RATIOS[indicator]
        pairs = [r for r in rows if r.get(num) is not None and r.get(den) is not None and r[den] > 0]
        denominator = sum(r[den] for r in pairs)
        return sum(r[num] for r in pairs) / denominator * 100 if denominator else None
    valid = [r for r in rows if r.get(indicator) is not None]
    if not valid:
        return None
    if indicator == 'population_density':
        pairs = [r for r in valid if r.get('total_population') is not None and r[indicator] > 0]
        area = sum(r['total_population'] / r[indicator] for r in pairs)
        return sum(r['total_population'] for r in pairs) / area if area else None
    return sum(r[indicator] for r in valid) / len(valid)


def compare(value, average, unit):
    return {
        'comparison_average': average,
        'difference': value - average if value is not None and average is not None else None,
        'difference_pp': value - average if unit == '%' and value is not None and average is not None else None,
        'relative_ratio': value / average if value is not None and average is not None and average != 0 else None,
    }


def comparison_average(rows, indicator, parent_observation=None):
    parent = parent_observation or {}
    if indicator == 'old_house_ratio' and parent.get('source_detail', {}).get(indicator, {}).get('comparison_method') == 'official_parent_ratio':
        return parent.get(indicator)
    return aggregate(rows, indicator)


def analyze(regions, observations, comparison_name, weights=None, parent_observation=None):
    weights = weights or load_weights()
    rows = [observations[r['region_code']] for r in regions if r['region_code'] in observations]
    populations = {key: [r[key] for r in rows if r.get(key) is not None] for key in INDICATORS}
    averages = {key: comparison_average(rows, key, parent_observation) for key in INDICATORS}
    output = []
    for region in regions:
        row = observations.get(region['region_code'], {})
        factors, missing, scores = [], [], {}
        for key, definition in INDICATORS.items():
            value = row.get(key)
            norm = normalize(value, populations[key])
            weight = weights[definition['group']]['indicators'][key]
            if value is None:
                missing.append(key)
            factors.append({
                'key': key, **definition, 'value': value, 'normalized_value': norm, 'weight': weight,
                'contribution': norm * weight if norm is not None else None,
                'comparison_region': comparison_name, **compare(value, averages[key], definition['unit']),
                'source': row.get('source_detail', {}).get(key, {}).get('source', row.get('source', '미확보')), 'reference_year': row.get('reference_year'),
                'source_detail': row.get('source_detail', {}).get(key, {}),
            })
        for group in weights:
            components = [f['contribution'] for f in factors if f['group'] == group]
            scores[group + '_score'] = sum(components) * 100 if all(v is not None for v in components) else None
        raw = math.prod(v / 100 for v in scores.values()) if not missing else None
        top = sorted([f for f in factors if f['contribution'] is not None], key=lambda f: (-f['contribution'], f['key']))[:3]
        output.append({
            **{k: v for k, v in region.items() if k != 'geometry'}, **scores,
            'risk_raw': raw, 'risk_score': None, 'risk_level': '데이터 부족',
            'data_completeness': (len(INDICATORS) - len(missing)) / len(INDICATORS),
            'missing_indicators': missing, 'top_factors': top, 'factors': factors,
            'is_sample': bool(row.get('is_sample', False)), 'reference_year': row.get('reference_year'),
            'source': row.get('source', '분석 범위 밖'), 'observation': row or None,
            'comparison_region': comparison_name, 'no_variation': False,
        })
    valid_raw = [r['risk_raw'] for r in output if r['risk_raw'] is not None]
    for result in output:
        raw = result['risk_raw']
        if raw is not None:
            result['risk_score'] = round(normalize(raw, valid_raw) * 100, 1)
            result['risk_level'] = risk_level(result['risk_score'])
            result['no_variation'] = len(set(valid_raw)) == 1
    valid_scores = [r['risk_score'] for r in output if r['risk_score'] is not None]
    average_score = sum(valid_scores) / len(valid_scores) if valid_scores else None
    for result in output:
        result['comparison_risk_average'] = average_score
        result['risk_difference'] = result['risk_score'] - average_score if result['risk_score'] is not None else None
    return output


def ranking(results, limit=5):
    return sorted([r for r in results if r['risk_score'] is not None], key=lambda r: (-r['risk_score'], r['region_code']))[:limit]

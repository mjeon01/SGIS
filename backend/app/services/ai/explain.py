from ...analytics.risk import INDICATORS
from .guidance import CATALOG, FACTOR_ACTION

ACTIONS = {key: [CATALOG[action]['title']] for key, action in FACTOR_ACTION.items()}


def particle(word, consonant, vowel):
    last = ord(word[-1])
    return consonant if 0xAC00 <= last <= 0xD7A3 and (last - 0xAC00) % 28 else vowel


def explain(result):
    evidence, causes, actions = {}, [], []
    name = result['region_name']
    if result['risk_score'] is None:
        missing = ', '.join(INDICATORS[k]['name'] for k in result['missing_indicators'])
        summary = f'{name}{particle(name, "은", "는")} {missing} 자료가 부족하여 종합 폭염 취약도를 산출하지 않았습니다. 확보된 지표를 중심으로 추가 점검이 필요합니다.'
    else:
        evidence['risk_score'] = f"{result['risk_score']:.1f}"
        summary = f"{name}의 상대적 폭염 취약도는 {evidence['risk_score']}점으로 ‘{result['risk_level']}’ 단계입니다. {result['comparison_region']} 내 비교 결과이며 실제 재난 발생확률이 아닙니다."
        if result['no_variation']:
            summary += ' 비교지역 간 계산 결과의 차이가 없어 중간값으로 표시했습니다.'
    if not result['is_sample'] and any(f['source_detail'].get('station_id') for f in result['factors']):
        summary += ' 기상지표는 인근 관측소 기준이며 해당 지역에서 직접 관측한 값은 아닙니다.'
    for factor in result['top_factors']:
        key = factor['key']
        value = f"{factor['value']:,.1f}"
        evidence[key] = value
        cause = f"{factor['name']}{particle(factor['name'], '은', '는')} {value}{factor['unit']}입니다."
        avg = factor['comparison_average']
        if avg is not None:
            average = f'{avg:,.1f}'
            evidence[key + '_average'] = average
            cause += f" {factor['comparison_region']} 비교 기준은 {average}{factor['unit']}입니다."
        if factor['difference_pp'] is not None:
            difference = f"{abs(factor['difference_pp']):.1f}"
            evidence[key + '_difference'] = difference
            direction = '높습니다' if factor['difference_pp'] > 0 else '낮습니다' if factor['difference_pp'] < 0 else '같습니다'
            cause += f' 차이는 {difference}%p로, 비교 기준보다 {direction}.' if factor['difference_pp'] else ' 비교 기준과 같습니다.'
        causes.append({'factor_key': key, 'text': cause})
        if factor['contribution'] > 0:
            for action in ACTIONS.get(key, []):
                phrasing = f'{action}할 수 있습니다.' if action.endswith('검토') else f'{action}{particle(action, "을", "를")} 검토할 수 있습니다.'
                actions.append({'factor_key': key, 'factor_name': factor['name'], 'title': action, 'text': f'{factor["name"]}{particle(factor["name"], "을", "를")} 고려하여 {phrasing}'})
    return {
        'engine': 'rules', 'engine_label': '규칙 기반 설명', 'summary': summary,
        'causes': causes, 'actions': actions, 'evidence_values': evidence,
        'is_sample': result['is_sample'], 'disclaimer': '기존 시설의 존재나 정책 시행 여부는 확인하지 않았으며, 제안은 추가 현장 검토를 위한 참고사항입니다.',
    }

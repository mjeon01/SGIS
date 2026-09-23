"""Grounded, citywide dong review sheets for subsequent field checks."""
from datetime import datetime, timezone
from .ai.explain import explain
from .ai.prepared import report_content

FIELD_CHECKS = {
    'elderly_ratio': ['쉼터까지의 이동 경로와 계단·경사 등 접근 장애 확인', '고령층 지원 담당부서의 대상자 현황과 방문·연락체계 확인'],
    'single_household_ratio': ['안부확인 지원 대상과 연락 동의·연락망 현황 확인', '주간·야간에 연락이 닿지 않을 때의 담당자 대응체계 확인'],
    'old_house_ratio': ['노후주택의 냉방설비·환기·차열 상태 현장 확인', '냉방·에너지 지원 대상 기준과 기존 지원 중복 여부 확인'],
    'population_density': ['보행 동선·대기 장소의 햇빛 노출과 이용시간 현장 확인', '기존 시설의 개방시간·이용대상·접근경로 확인 후 설치 여건 검토'],
    'total_population': ['시간대별 생활인구와 주요 보행·대기 장소 현장 확인'],
    'heatwave_intensity': ['관측소와 생활권의 고도·해안·포장면 차이 확인'],
    'heatwave_history_index': ['폭염 시 운영할 지원시설과 안내·연락체계 확인'],
}


def build_review(repo, code, mode):
    if len(code) != 8 or not code.startswith('21'):
        raise KeyError(code)
    region = repo.detail(code, '21', mode, 'dong')
    rows = repo.results('21', mode, 'dong')
    scored = [r for r in rows if r['risk_score'] is not None]
    score = region['risk_score']
    position = 1 + sum(r['risk_score'] > score for r in scored) if score is not None else None
    explanation = explain(region)
    checks = []
    for factor in region['top_factors']:
        for index, text in enumerate(FIELD_CHECKS.get(factor['key'], [])):
            checks.append({'id':f"{factor['key']}-{index}", 'factor_name':factor['name'], 'text':text})
    if not checks:
        checks.append({'id':'missing-data', 'factor_name':'자료 확인', 'text':'결측 통계와 관측자료를 확보한 뒤 우선순위 재검토'})
    return {'region':region, 'rank':position, 'scored_count':len(scored), 'total_count':len(rows),
            'rank_method':'동점은 같은 순위', 'scope':'부산 전체 읍면동', 'explanation':explanation,
            'field_checks':checks, 'generated_at':datetime.now(timezone.utc).isoformat(),
            'report':report_content(region),
            'facility_note':'2026년 현재 시설은 별도 화면에서 확인하며 2024년 취약도·인구와 수치 비교하지 않습니다.',
            'purpose':'현장점검·지원 대상지역 검토를 위한 참고자료. 특정 시설의 부족이나 신규 설치 위치를 확정하지 않습니다.'}

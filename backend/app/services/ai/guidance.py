"""Reviewed public guidance. Local application steps are proposals, not official orders."""
from copy import deepcopy

SOURCES = {
    'mois-summer-2026': {
        'id': 'mois-summer-2026', 'publisher': '행정안전부',
        'title': '2026년 여름철 자연재난 종합대책',
        'url': 'https://mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=125943',
        'checked_on': '2026-09-23',
        'summary': '폭염 취약대상별 안전관리, 안부 확인·냉방 지원과 쉼터 점검·운영시간 조정을 제시한 전국 대책입니다.',
    },
    'mois-shade-2026': {
        'id': 'mois-shade-2026', 'publisher': '행정안전부',
        'title': '폭염 속 태양을 피하자, 그늘막 설치 확대',
        'url': 'https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=128541',
        'checked_on': '2026-09-23',
        'summary': '보도·횡단보도 앞에서 잠시 더위를 피할 수 있는 그늘막의 역할과 확충 방향을 설명합니다.',
    },
}

CATALOG = {
    'shade': {
        'title': '보행 대기 장소의 그늘 점검', 'source_ids': ['mois-shade-2026'],
        'basis': '그늘막은 보도·횡단보도 앞 등 일상적인 보행 공간의 폭염 노출을 줄이는 시설로 제시됩니다.',
        'steps': ['횡단보도·정류장 등 주민이 기다리는 장소의 이용시간과 햇빛 노출을 현장에서 확인합니다.',
                  '현재 시설 지도와 현장 상태를 확인하고, 그늘이 필요한 장소의 보행공간·설치 여건을 검토합니다.'],
        'condition': '행정동의 인구밀도만으로 그늘막 부족이나 설치 지점을 확정할 수 없습니다.',
        'partners': '도로·시설 관리 담당자와 협의 검토',
        'completion': '후보 장소별 이용시간·그늘 유무·설치 제약을 기록했는지 확인',
    },
    'shelter': {
        'title': '쉼터를 실제 이용할 수 있는 시간 확인', 'source_ids': ['mois-summer-2026'],
        'basis': '전국 대책은 쉼터 점검과 폭염특보 상황에 따른 운영시간 연장을 제시합니다.',
        'steps': ['현재 시설의 운영시간·이용대상을 확인하고, 등록정보가 없는 곳은 운영기관에 문의합니다.',
                  '폭염 시 필요한 이용시간을 현장에서 확인한 뒤 운영시간 조정 가능성을 협의합니다.'],
        'condition': '인근 관측소의 기온은 동 내부의 모든 장소를 대표하지 않으며, 현재 특보 발령 여부는 별도 확인이 필요합니다.',
        'partners': '쉼터 운영기관·재난 담당자와 협의 검토',
        'completion': '운영시간·이용대상·문의처의 확인 여부와 안내정보 수정 사항 기록',
    },
    'continuity': {
        'title': '폭염이 이어질 때의 운영·연락 계획 준비', 'source_ids': ['mois-summer-2026'],
        'basis': '전국 대책은 특보 상황에 맞춘 쉼터 운영과 취약대상 안전관리를 함께 제시합니다.',
        'steps': ['폭염 기간에 쉼터 운영과 주민 안내를 이어갈 담당자·대체 연락처를 확인합니다.',
                  '휴일 등 운영 공백이 있는지 점검하고, 실제 특보 발령 시 사용할 운영·연락 계획을 협의합니다.'],
        'condition': '과거 폭염일수는 올해의 폭염일수나 특보 발령 횟수를 예측한 값이 아닙니다.',
        'partners': '재난·복지 담당자와 시설 운영기관의 협의 검토',
        'completion': '담당자 부재·휴일을 포함한 연락 및 운영 계획 확보 여부 확인',
    },
    'contact': {
        'title': '도움이 필요한 주민의 안부 확인 연결', 'source_ids': ['mois-summer-2026'],
        'basis': '전국 대책은 폭염에 취약한 대상에 대한 맞춤형 안전관리와 취약어르신 안부 확인을 제시합니다.',
        'steps': ['복지 담당자와 실제 지원이 필요한 주민의 확인 절차·연락 동의 여부를 점검합니다.',
                  '기존 방문·연락 지원과 연결하고, 연락이 닿지 않을 때의 담당자 대응 절차를 협의합니다.'],
        'condition': '고령인구나 혼자 사는 가구 모두를 지원 대상 또는 고립 상태로 간주하지 않습니다.',
        'partners': '행정복지센터·방문건강 및 돌봄 담당자와 협의 검토',
        'completion': '지원 동의·담당자·연락 불응 시 절차의 확인 여부 기록',
    },
    'housing': {
        'title': '주거 냉방 여건과 지원 가능성 점검', 'source_ids': ['mois-summer-2026'],
        'basis': '전국 대책에는 지원 대상에 대한 에너지바우처·냉방설비 지원 등 에너지 복지 대책이 포함됩니다.',
        'steps': ['주민 동의를 받아 냉방설비 사용 가능 여부와 실내 열환경을 현장에서 확인합니다.',
                  '실제 지원사업의 신청 자격·접수기간·기존 수혜 여부를 확인한 뒤 연결 가능성을 검토합니다.'],
        'condition': '주택 연수만으로 냉방 불량이나 지원 자격을 판단할 수 없습니다.',
        'partners': '주거·에너지 복지 담당자와 협의 검토',
        'completion': '실내 상태 확인과 현행 지원사업 자격 확인을 구분해 기록',
    },
    'outreach': {
        'title': '주민에게 닿는 폭염 안내 경로 점검', 'source_ids': ['mois-summer-2026'],
        'basis': '전국 대책은 폭염 취약대상별 행동요령 홍보와 맞춤형 안전관리를 제시합니다.',
        'steps': ['동네에서 사용하는 안내 채널과 쉼터 정보의 게시 상태를 확인합니다.',
                  '안내를 받기 어려운 주민이 있는지 확인하고, 대면·전화 등 보완 경로를 검토합니다.'],
        'condition': '주민등록인구만으로 시간대별 생활인구나 정보 전달의 누락 규모를 알 수 없습니다.',
        'partners': '행정복지센터·지역 주민조직과 협의 검토',
        'completion': '안내 채널·정보 갱신 담당자·보완 경로의 확인 여부 기록',
    },
}

FACTOR_ACTION = {
    'heatwave_intensity': 'shelter', 'heatwave_history_index': 'continuity',
    'total_population': 'outreach', 'population_density': 'shade',
    'elderly_ratio': 'contact', 'single_household_ratio': 'contact', 'old_house_ratio': 'housing',
}


def action_plans(region):
    """Preserve the existing top-factor order; never infer facility shortages."""
    selected = {}
    for factor in region['top_factors']:
        if factor['value'] is None or not factor['contribution'] or factor['key'] not in FACTOR_ACTION:
            continue
        key = FACTOR_ACTION[factor['key']]
        if key not in selected:
            selected[key] = {'id': key, **deepcopy(CATALOG[key]), 'factor_keys': [], 'factor_names': []}
        selected[key]['factor_keys'].append(factor['key'])
        selected[key]['factor_names'].append(factor['name'])
    plans = list(selected.values())
    for plan in plans:
        names = ' · '.join(plan['factor_names'])
        plan['reason'] = f'{names} 지표가 주요 검토 요인에 포함되어 관련 대응을 연결했습니다. 지표의 크기만으로 개인의 상태나 시설 부족을 판단하지 않습니다.'
        plan['sources'] = [SOURCES[key] for key in plan['source_ids']]
    return plans

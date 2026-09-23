"""Merge approved SGIS housing ratios and KMA station observations atomically."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.analytics.climate import attach_climate
from backend.app.analytics.risk import INDICATORS
from backend.app.schemas.models import Observation
from backend.app.services.sgis.cache import atomic_json
from scripts.collect_housing import collect as collect_housing


def enrich():
    path = DATA_ROOT / 'processed' / 'sgis.json'
    data = json.loads(path.read_text())
    year = data['meta']['reference_year']
    climate = json.loads((DATA_ROOT / 'processed' / f'kma_observations_{year}.json').read_text())
    housing = collect_housing()
    if housing['reference_year'] != year:
        raise ValueError('Housing/census year mismatch')
    for code, row in data['observations'].items():
        row['old_house_ratio'] = housing['regions'][code]['value']
        row['old_house_count'] = None
        row['source'] = 'SGIS 공간통계 · 기상청 관측자료'
        for info in row['source_detail'].values():
            info.setdefault('source', 'SGIS OpenAPI')
        row['source_detail']['old_house_ratio'] = {
            'source': 'SGIS 살고싶은 우리동네', 'source_url': housing['source_url'], 'reference_year': year,
            'definition': '건축 후 30년 이상 주택 / 전체 주택 × 100', 'class_id': 'B005',
            'published_precision': 1, 'comparison_method': 'official_parent_ratio',
            'note': '공식 비율 원천값. 노후주택 수 역산 없음.'}
    attach_climate(data['observations'], data['regions'], climate)
    for row in data['observations'].values():
        Observation(**row)
    complete = [code for code, row in data['observations'].items() if all(row.get(k) is not None for k in INDICATORS)]
    data['meta'].update(source='SGIS 공간통계 · 기상청 관측자료', available_indicator_count=7,
                        climate_source='기상청 ASOS/AWS 일 관측자료', climate_period=climate['period'],
                        complete_region_count=len(complete), enrichment_version=1,
                        notes=['기상은 지역 내부 대표점의 최근접 관측소 기준이며 해당 동의 실측값이 아닙니다.',
                               '관측소 결측일이 있으면 해당 기상지표와 종합점수를 산출하지 않습니다.',
                               '노후주택 비교는 SGIS 공식 상위지역 비율을 사용합니다.', '전국은 경계 탐색, 부산은 실제 통계 분석'])
    atomic_json(path, data)
    print(json.dumps({'complete_regions': len(complete), 'total_regions': len(data['observations']),
                      'complete_districts': sum(len(c) == 5 for c in complete),
                      'complete_dongs': sum(len(c) == 8 for c in complete)}, ensure_ascii=False))


if __name__ == '__main__':
    enrich()

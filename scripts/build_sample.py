"""Generate deterministic synthetic statistics over explicitly sourced SGIS geometry."""
import csv
import json
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.schemas.models import Observation
from backend.app.services.sgis.cache import atomic_json
from backend.app.services.sgis.parser import ratio


def build():
    actual = json.loads((DATA_ROOT / 'processed' / 'sgis.json').read_text())
    regions = actual['regions']
    year = actual['meta']['reference_year']
    observations = {}
    for code, region in regions.items():
        if len(code) != 8 or not code.startswith('21'):
            continue
        rng = random.Random(int(code))
        population = rng.randint(3500, 38000)
        household = round(population / rng.uniform(1.5, 2.8))
        houses = round(household * rng.uniform(0.65, 1.0))
        elderly = round(population * rng.uniform(0.1, 0.43))
        single = round(household * rng.uniform(0.18, 0.62))
        old = round(houses * rng.uniform(0.08, 0.64))
        temperature = round(rng.uniform(26.5, 31.5), 1)
        observations[code] = Observation(
            region_code=code, reference_year=year, heatwave_intensity=temperature, avg_summer_temperature=temperature,
            heatwave_history_index=rng.randint(5, 40), total_population=population,
            population_density=round(rng.uniform(700, 23000), 2), elderly_population=elderly,
            elderly_ratio=ratio(elderly, population), total_households=household,
            single_household_count=single, single_household_ratio=ratio(single, household),
            total_houses=houses, old_house_count=old, old_house_ratio=ratio(old, houses),
            source='시연용 합성 데이터', is_sample=True,
            source_detail={'method': 'region_code를 seed로 생성한 합성 통계. 실제 관측값이 아님.'},
        ).model_dump()
    for size in [5, 2]:
        for code in [c for c in regions if len(c) == size and c.startswith('21')]:
            rows = [r for c, r in observations.items() if c.startswith(code) and len(c) == (8 if size == 5 else 5)]
            if not rows:
                continue
            result = {**rows[0], 'region_code': code}
            for key in ['total_population', 'elderly_population', 'total_households', 'single_household_count', 'total_houses', 'old_house_count']:
                result[key] = sum(r[key] for r in rows)
            area = sum(r['total_population'] / r['population_density'] for r in rows)
            result['population_density'] = result['total_population'] / area
            for key, num, den in [('elderly_ratio', 'elderly_population', 'total_population'), ('single_household_ratio', 'single_household_count', 'total_households'), ('old_house_ratio', 'old_house_count', 'total_houses')]:
                result[key] = ratio(result[num], result[den])
            for key in ['heatwave_intensity', 'avg_summer_temperature', 'heatwave_history_index']:
                result[key] = sum(r[key] for r in rows) / len(rows)
            observations[code] = Observation(**result).model_dump()
    root = DATA_ROOT / 'sample'
    root.mkdir(parents=True, exist_ok=True)
    features = [{'type': 'Feature', 'geometry': r['geometry'], 'properties': {k: v for k, v in r.items() if k != 'geometry'}} for r in regions.values()]
    atomic_json(root / 'regions.geojson', {'type': 'FeatureCollection', 'features': features})
    atomic_json(root / 'observations.json', observations)
    atomic_json(root / 'metadata.json', {
        'mode': 'sample', 'reference_year': year, 'boundary_year': actual['meta']['boundary_year'],
        'source': '시연용 합성 데이터', 'geometry_source': 'SGIS OpenAPI 실제 행정경계',
        'analysis_scope': '부산광역시', 'available_indicator_count': 7,
        'notes': ['테스트용 데이터입니다. 통계·점수·순위는 실제 지역 위험을 나타내지 않습니다.', '경계만 SGIS 실제 자료이며 모든 분석 수치는 합성했습니다.'],
    })
    groups = {
        'climate': ['avg_summer_temperature', 'heatwave_intensity', 'heatwave_history_index'],
        'population': ['total_population', 'population_density', 'elderly_population', 'elderly_ratio'],
        'household': ['total_households', 'single_household_count', 'single_household_ratio'],
        'housing': ['total_houses', 'old_house_count', 'old_house_ratio'],
    }
    for name, columns in groups.items():
        fields = ['region_code', 'reference_year', *columns, 'source', 'is_sample']
        with (root / f'{name}.csv').open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(observations.values())
    print(f'Sample: {len(regions)} actual geometries, {len(observations)} synthetic observations')


if __name__ == '__main__':
    build()

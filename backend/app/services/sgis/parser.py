import math
from pyproj import Transformer
from ...schemas.models import Observation

TRANSFORMER = Transformer.from_crs('EPSG:5179', 'EPSG:4326', always_xy=True)


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(str(value).replace(',', ''))
        return n if math.isfinite(n) and n >= 0 else None
    except (ValueError, TypeError):
        return None


def ratio(numerator, denominator):
    return numerator / denominator * 100 if numerator is not None and denominator is not None and denominator > 0 and numerator <= denominator else None


def index_rows(rows):
    result = {}
    for row in rows:
        code = str(row['adm_cd'])
        if code in result:
            raise ValueError(f'Duplicate region_code: {code}')
        result[code] = row
    return result


def parse_observations(base, elderly, single, old, year, provenance):
    groups = [index_rows(rows) for rows in (base, elderly, single, old)]
    result = {}
    for code, row in groups[0].items():
        pop, density, households, houses = [number(row.get(key)) for key in ('tot_ppltn', 'ppltn_dnsty', 'tot_family', 'tot_house')]
        aged = number(groups[1].get(code, {}).get('population'))
        alone = number(groups[2].get(code, {}).get('household_cnt'))
        old_count = number(groups[3].get(code, {}).get('house_cnt'))
        result[code] = Observation(
            region_code=code, reference_year=year, total_population=pop, population_density=density,
            elderly_population=aged, elderly_ratio=ratio(aged, pop), total_households=households,
            single_household_count=alone, single_household_ratio=ratio(alone, households),
            total_houses=houses, old_house_count=old_count, old_house_ratio=ratio(old_count, houses),
            source_detail=provenance,
        ).model_dump()
    return result


def transform_coordinates(coords):
    if coords and isinstance(coords[0], (int, float)):
        lng, lat = TRANSFORMER.transform(coords[0], coords[1])
        if not (120 <= lng <= 135 and 30 <= lat <= 45):
            raise ValueError('Boundary outside expected Korea extent')
        return [round(lng, 6), round(lat, 6)]
    return [transform_coordinates(part) for part in coords]


def parse_boundaries(data, parent_code, year):
    regions = []
    seen = set()
    for feature in data.get('features', []):
        p = feature['properties']
        code = str(p['adm_cd'])
        if code in seen:
            raise ValueError(f'Duplicate boundary: {code}')
        seen.add(code)
        if parent_code != '00' and not code.startswith(parent_code):
            raise ValueError('Boundary parent mismatch')
        regions.append({
            'region_code': code, 'region_name': p['adm_nm'].split()[-1],
            'full_name': p['adm_nm'], 'parent_region_code': parent_code,
            'region_level': {2: 'sido', 5: 'sigungu', 8: 'dong'}[len(code)],
            'geometry': {'type': feature['geometry']['type'], 'coordinates': transform_coordinates(feature['geometry']['coordinates'])},
            'boundary_year': year, 'geometry_source': 'SGIS 행정구역경계',
        })
    return regions

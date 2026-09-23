"""Official flood records, kept separate from heat-vulnerability statistics."""
from datetime import datetime
from functools import lru_cache
import json
import math
import re
from shapely.geometry import Point, shape
from ..core.settings import DATA_ROOT
from ..repositories.dataset import DatasetUnavailable


def normalize_history(rows, regions):
    polygons = [(r, shape(r['geometry'])) for r in regions.values()
                if r['region_code'].startswith('21') and len(r['region_code']) == 8]
    records, excluded, seen = [], 0, set()
    for row in rows:
        try:
            # This public source names the longitude field lat and latitude lon.
            lng, lat = float(row['lat']), float(row['lon'])
            if not (math.isfinite(lng) and math.isfinite(lat) and 128.7 <= lng <= 129.4 and 34.9 <= lat <= 35.5):
                raise ValueError('Invalid Busan position')
            identifier = str(row['sensor_cd']) if row.get('sensor_cd') else ''
            if not identifier or identifier in seen or not (row.get('sensor_name') or '').strip():
                raise ValueError('Invalid or duplicate record')
        except (TypeError, ValueError, KeyError):
            excluded += 1
            continue
        seen.add(identifier)
        point = Point(lng, lat)
        containing = [r for r, polygon in polygons if polygon.covers(point)]
        region = containing[0] if len(containing) == 1 else None
        period = (row.get('period') or '').strip()
        year_match = re.match(r'^(20\d{2})[.\-/]', period)
        year = int(year_match.group(1)) if year_match else None
        if year and year > datetime.now().year:
            year = None
        records.append({'id': identifier, 'name': row['sensor_name'].strip(),
            'longitude': lng, 'latitude': lat, 'year': year,
            'period': period if year else None,
            'event': (row.get('disaster_name') or '').strip(),
            'cause': (row.get('type_name') or '').strip(),
            'depth': (row.get('inundation_depth') or '').strip(),
            'area': (row.get('area_size') or '').strip(),
            'source_district': row.get('gu'),
            'region_code': region['region_code'] if region else None,
            'region_name': region['region_name'] if region else None})
    return records, excluded


@lru_cache(maxsize=2)
def _load(history_stamp, meta_stamp, region_stamp):
    folder = DATA_ROOT / 'raw/flood'
    raw = json.loads((folder / 'history.json').read_text())
    meta = json.loads((folder / 'meta.json').read_text())
    regions = json.loads((DATA_ROOT / 'processed/sgis.json').read_text())['regions']
    records, excluded = normalize_history(raw['rows'], regions)
    return {'meta': {**meta, 'history_collected_at': raw['collected_at'],
                    'source_count': len(raw['rows']), 'excluded_count': excluded,
                    'unassigned_count': sum(r['region_code'] is None for r in records),
                    'unknown_year_count': sum(r['year'] is None for r in records)},
            'records': records,
            'regions': [{k: r[k] for k in ['region_code', 'region_name', 'full_name']}
                        for r in regions.values() if r['region_code'].startswith('21')]}


def inventory():
    paths = [DATA_ROOT / 'raw/flood/history.json', DATA_ROOT / 'raw/flood/meta.json',
             DATA_ROOT / 'processed/sgis.json']
    if not all(p.exists() for p in paths):
        raise DatasetUnavailable('침수 자료를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.')
    return _load(*(p.stat().st_mtime_ns for p in paths))

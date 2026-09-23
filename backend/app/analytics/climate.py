"""Attach nearest observed station; incomplete periods remain missing."""
from datetime import date, timedelta
from pyproj import Geod, Transformer
from shapely.geometry import shape
from shapely.ops import transform

GEOD = Geod(ellps='WGS84')
TO_METERS = Transformer.from_crs(4326, 5179, always_xy=True).transform
TO_LONLAT = Transformer.from_crs(5179, 4326, always_xy=True).transform


def representative_point(geometry):
    area = transform(TO_METERS, shape(geometry))
    center = area.centroid
    if not area.covers(center):
        center = area.representative_point()
    return TO_LONLAT(center.x, center.y)


def station_summary(station, period):
    start, end = map(date.fromisoformat, period)
    expected = {(start + timedelta(days=i)).isoformat() for i in range((end-start).days + 1)}
    rows = station['daily']
    dates = [r['TM'] for r in rows]
    if len(dates) != len(set(dates)) or not set(dates) <= expected:
        raise ValueError('Duplicate or out-of-period observations')
    means = [r['AVG_TA'] for r in rows if r.get('AVG_TA') is not None]
    maxima = [r['MAX_TA'] for r in rows if r.get('MAX_TA') is not None]
    return {'mean_temperature': sum(means) / len(means) if len(means) == len(expected) else None,
            'heatwave_days': sum(v >= 33 for v in maxima) if len(maxima) == len(expected) else None,
            'valid_mean_days': len(means), 'valid_max_days': len(maxima), 'expected_days': len(expected)}


def attach_climate(observations, regions, climate):
    candidates = []
    start, end = map(date.fromisoformat, climate['period'])
    for station in climate['stations'].values():
        history = station['summer_locations']
        locations = {(r['longitude'], r['latitude']) for r in history}
        covers_period = any(date.fromisoformat(r['start_date']) <= start and
                            (r['end_date'] is None or date.fromisoformat(r['end_date']) >= end) for r in history)
        if len(locations) != 1 or not covers_period:
            continue
        lon, lat = next(iter(locations))
        candidates.append((station, lon, lat, station_summary(station, climate['period'])))
    if not candidates:
        raise ValueError('No stations with verified locations for the analysis period')
    for code, row in observations.items():
        if row['reference_year'] != climate['reference_year']:
            raise ValueError('Climate/census year mismatch')
        lon, lat = representative_point(regions[code]['geometry'])
        station, x, y, summary = min(candidates, key=lambda s: (GEOD.inv(lon, lat, s[1], s[2])[2], s[0]['station_id']))
        provenance = {'source': '기상청 ASOS/AWS 일 관측자료', 'source_url': 'https://data.kma.go.kr/data/grnd/selectAwsRltmList.do',
                      'reference_year': climate['reference_year'], 'period': climate['period'],
                      'method': '지역 내부 대표점의 최근접 관측소 연결', 'is_local_measurement': False,
                      'representative_point': [lon, lat], 'station_id': station['station_id'], 'station_name': station['name'],
                      'station_kind': station['kind'], 'station_location': [x, y],
                      'distance_km': round(GEOD.inv(lon, lat, x, y)[2] / 1000, 2), **summary}
        row['heatwave_intensity'] = row['avg_summer_temperature'] = summary['mean_temperature']
        row['heatwave_history_index'] = summary['heatwave_days']
        for key, field in [('heatwave_intensity', 'valid_mean_days'), ('heatwave_history_index', 'valid_max_days')]:
            row['source_detail'][key] = {**provenance, 'valid_days': summary[field],
                                       'reason': f"최근접 관측소 유효 관측 {summary[field]}/{summary['expected_days']}일. 결측 보완 없음." if row[key] is None else None}
    return observations

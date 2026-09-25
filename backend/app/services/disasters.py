"""Read collected official snapshots; never fetch or synthesize disaster data."""
import json
from functools import lru_cache
from fastapi import HTTPException
from ..core.settings import DATA_ROOT
from ..analytics.climate import GEOD, representative_point
from ..repositories.dataset import DatasetUnavailable
from .flood import inventory as flood_inventory
from .weather.current import current_snapshot_path

FILES = {'landslide': 'landslides.json', 'typhoon': 'typhoons.json', 'cold': 'winter-2025-2026.json'}


@lru_cache(maxsize=12)
def _read(path, stamp):
    return json.loads(path.read_text())


def snapshot(kind):
    path = DATA_ROOT / 'processed' / FILES[kind]
    if not path.exists():
        raise HTTPException(503, detail='데이터 준비 중 · 해당 재해의 공식 수집 자료가 아직 연결되지 않았습니다.')
    return _read(path, path.stat().st_mtime_ns)


def inventory():
    result = {}
    for kind in FILES:
        try:
            data = snapshot(kind)
            result[kind] = {'status': 'ready', 'meta': data['meta']}
        except HTTPException:
            result[kind] = {'status': 'unavailable'}
    return result


def region_reference(repo, code):
    # Only the saved SGIS dataset is used. No dynamic external boundary requests.
    region = repo.load('sgis')['regions'].get(code)
    if not region or not code.startswith('21'):
        raise HTTPException(404, detail='저장된 부산 지역을 선택해 주세요.')
    lon, lat = representative_point(region['geometry'])
    return {'region_code': code, 'region_name': region['region_name'], 'longitude': lon, 'latitude': lat}


def distance(reference, point):
    return GEOD.inv(reference['longitude'], reference['latitude'], point['longitude'], point['latitude'])[2] / 1000


def typhoon_detail(identifier, reference=None):
    data = snapshot('typhoon')
    storm = next((s for s in data['storms'] if s['id'] == identifier), None)
    if not storm:
        raise HTTPException(404, detail='저장된 태풍 기록을 찾을 수 없습니다.')
    points = [{**p, 'distance_km': round(distance(reference, p), 2) if reference else None} for p in storm['points']]
    closest = min(points, key=lambda p: distance(reference, p)) if reference else None
    return {'meta': data['meta'], 'storm': {**storm, 'points': points}, 'region': reference, 'closest': closest,
            'distance_method': 'WGS84 타원체 측지거리 · 지역 내부 대표점과 기록된 태풍 중심 사이 · 시각 보간 없음'}


def winter_season(reference=None):
    data = snapshot('cold')
    first, last = data['meta']['period']
    candidates = []
    if reference:
        for station in data['stations']:
            # Season summaries are linked only when a single known location
            # covers the entire season. Day-specific markers use full history.
            locations = [p for p in station['locations'] if p['start_date'] <= first and (not p['end_date'] or p['end_date'] >= last)]
            if len(locations) == 1:
                candidates.append({'station_id': station['station_id'], 'station_name': station['station_name'],
                                   'distance_km': round(distance(reference, locations[0]), 2)})
    candidates.sort(key=lambda p: (p['distance_km'], p['station_id']))
    return {**data, 'region': reference, 'nearby_stations': candidates, 'nearest': candidates[0] if candidates else None}


def region_profile(repo, code, typhoon_id):
    reference = region_reference(repo, code)
    sgis = repo.load('sgis')
    row = sgis['observations'].get(code, {})
    stats = {key: row.get(key) for key in ['total_population', 'elderly_population', 'elderly_ratio',
             'single_household_count', 'single_household_ratio', 'total_houses', 'old_house_ratio',
             'infant_population', 'business_count', 'worker_count']}
    hazards = {}
    # Reuse the existing collected summer/flood records without changing scores.
    path = current_snapshot_path()
    candidates = []
    if path.exists():
        weather = _read(path, path.stat().st_mtime_ns)
        for station in weather['stations']:
            season, location = station.get('summer'), station.get('location')
            if not season or not location:
                continue
            first, last = season['period']
            if location['start_date'] <= first and (not location['end_date'] or location['end_date'] >= last):
                candidates.append((distance(reference, location), station['station_id'], station))
    nearest = min(candidates, key=lambda p: (p[0], p[1])) if candidates else None
    hazards['heat'] = {'station_name': nearest[2]['station_name'], 'distance_km': round(nearest[0], 2),
                       'period': nearest[2]['summer']['period'], 'maximum': nearest[2]['summer']['summary']['maximum']} if nearest else None
    try:
        flood = flood_inventory()
        hazards['flood'] = {'count': sum((p['region_code'] or '').startswith(code) for p in flood['records']),
                           'meaning': '선택 행정구역 안의 과거 침수 기록 지점 수 · 발생 횟수가 아님'}
    except DatasetUnavailable:
        hazards['flood'] = None
    try:
        points = snapshot('landslide')['records']
        hazards['landslide'] = {'count': sum((p['region_code'] or '').startswith(code) for p in points),
                                'meaning': '좌표가 선택 행정구역에 포함된 공식 지정 대표 지점 수'}
    except HTTPException:
        hazards['landslide'] = None
    try:
        season = winter_season(reference)
        station = next((s for s in season['stations'] if season['nearest'] and s['station_id'] == season['nearest']['station_id']), None)
        hazards['cold'] = {'station_name': station['station_name'], 'minimum': station['summary']['minimum'],
                           'freezing_days': station['freezing_days'], **season['nearest']} if station else None
    except HTTPException:
        hazards['cold'] = None
    try:
        track = typhoon_detail(typhoon_id, reference)
        hazards['typhoon'] = {'name': track['storm']['name'], 'year': track['storm']['year'], 'closest': track['closest']}
    except HTTPException:
        hazards['typhoon'] = None
    return {'region': reference, 'reference_year': sgis['meta']['reference_year'],
            'boundary_year': sgis['meta']['boundary_year'], 'stats': stats, 'hazards': hazards,
            'spatial_scope': '행정구역 전체 통계 · 반경 300m/500m 통계가 아님',
            'source_url': 'https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html'}

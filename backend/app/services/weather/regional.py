"""Link a dong to current station coordinates without changing historical risk."""
from ...analytics.climate import GEOD, representative_point


def nearest_current_station(geometry, snapshot):
    lon, lat = representative_point(geometry)
    through = snapshot['meta']['requested_through']
    candidates = []
    for station in snapshot['stations']:
        location = station.get('location')
        if not location or location['start_date'] > through or (location.get('end_date') and location['end_date'] < through):
            continue
        distance = GEOD.inv(lon, lat, location['longitude'], location['latitude'])[2]
        candidates.append((distance, station['station_id'], station))
    if not candidates:
        return {'available': False, 'reason': '현재 위치가 확인된 인근 관측소가 없습니다.'}
    distance, _, station = min(candidates, key=lambda item: (item[0], item[1]))
    return {'available': True, 'station': station, 'distance_km': round(distance / 1000, 2),
            'representative_point': [lon, lat], 'is_local_measurement': False,
            'method': '조회 기준일의 관측소 위치와 동 내부 대표점 사이 최근접 연결'}

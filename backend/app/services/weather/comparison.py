"""Compare one observation date, with the same dong links as regional weather."""
from .regional import nearest_current_station


def build_comparison(snapshot, regions):
    observed_on = snapshot['meta']['requested_through']
    linked = {s['station_id']: [] for s in snapshot['stations']}
    for region in regions:
        if not region['region_code'].startswith('21') or len(region['region_code']) != 8:
            continue
        match = nearest_current_station(region['geometry'], snapshot)
        if match['available']:
            linked[match['station']['station_id']].append({
                'region_code': region['region_code'], 'region_name': region['region_name'],
                'full_name': region['full_name'], 'distance_km': match['distance_km']})
    stations = []
    for station in snapshot['stations']:
        daily = next((r for r in station['recent']['daily'] if r['date'] == observed_on), None)
        location = station.get('location')
        if location and (location['start_date'] > observed_on or
                         (location.get('end_date') and location['end_date'] < observed_on)):
            location = None
        stations.append({**station,
                         'location': location, 'maximum': daily.get('maximum') if daily else None,
                         'minimum': daily.get('minimum') if daily else None,
                         'regions': sorted(linked[station['station_id']], key=lambda r: r['full_name'])})
    # Missing observations remain in the list, after observed values. No temperature imputation.
    stations.sort(key=lambda s: (s['maximum'] is None, -(s['maximum'] or 0), s['station_id']))
    return {'observed_on': observed_on, 'stations': stations,
            'observed_count': sum(s['maximum'] is not None for s in stations),
            'station_count': len(stations)}

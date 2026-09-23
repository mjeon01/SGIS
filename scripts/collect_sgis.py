"""Collect real SGIS boundaries/statistics once; serving never recollects statistics."""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.services.sgis.client import SgisClient
from backend.app.services.sgis.base import SgisError
from backend.app.services.sgis.cache import atomic_json
from backend.app.services.sgis.parser import parse_boundaries, parse_observations


def collect(refresh=False):
    client = SgisClient()
    log, errors = [], []

    def get(endpoint, params):
        data = client.get(endpoint, params, refresh=refresh)
        log.append({'endpoint': endpoint, 'params': params, 'errCd': data['errCd'], 'record_count': len(data.get('features', data.get('result', [])))})
        return data

    years = get('/year/data.json', {})['result']
    common = sorted(set(years['tin_yr']) & set(years['tboudary_yr']), reverse=True)
    if not common:
        raise ValueError('No common census/boundary year')
    year = int(common[0])
    # User-approved: latest boundary vintage matches 2024 census region codes.
    boundary_year = int(years['lboudary_yr'])
    regions = {}
    for parent in ['00', '21']:
        params = {'year': str(boundary_year), 'low_search': '1'}
        if parent != '00':
            params['adm_cd'] = parent
        data = get('/boundary/hadmarea.geojson', params)
        for r in parse_boundaries(data, parent, boundary_year):
            regions[r['region_code']] = r
        print(f'Boundaries: {parent}', flush=True)
    districts = [r['region_code'] for r in regions.values() if r['parent_region_code'] == '21']
    for parent in districts:
        data = get('/boundary/hadmarea.geojson', {'year': str(boundary_year), 'adm_cd': parent, 'low_search': '1'})
        for r in parse_boundaries(data, parent, boundary_year):
            regions[r['region_code']] = r
        print(f'Boundaries: {parent}', flush=True)

    provenance = {
        'total_population': {'endpoint': '/stats/population.json', 'field': 'tot_ppltn', 'reference_year': year},
        'population_density': {'endpoint': '/stats/population.json', 'field': 'ppltn_dnsty', 'reference_year': year},
        'elderly_ratio': {'endpoint': '/stats/searchpopulation.json', 'filter': {'age_type': '24'}, 'numerator': 'population', 'denominator': 'tot_ppltn', 'reference_year': year},
        'single_household_ratio': {'endpoint': '/stats/household.json', 'filter': {'household_type': 'A0'}, 'numerator': 'household_cnt', 'denominator': 'tot_family', 'reference_year': year},
        'old_house_ratio': {'status': 'unavailable', 'definition': '건축 후 30년 이상', 'reason': '건축연도 구간으로 30년 경계를 정확히 분리할 수 없음'},
        'heatwave_intensity': {'status': 'unavailable', 'reason': '행정동별 동일연도 기온 또는 대체 강도지표 미확보'},
        'heatwave_history_index': {'status': 'unavailable', 'reason': '특보구역과 행정동 대응 및 이력 지표 정의 미확정'},
    }
    observations = {}
    for level in ['0', '1', '2']:
        params = {'year': str(year), 'adm_cd': '21', 'low_search': level}
        base = get('/stats/population.json', params)['result']
        elderly = get('/stats/searchpopulation.json', {**params, 'age_type': '24'})['result']
        single = get('/stats/household.json', {**params, 'household_type': 'A0'})['result']
        parsed = parse_observations(base, elderly, single, [], year, provenance)
        extra = set(parsed) - set(regions)
        if extra:
            raise ValueError(f'Unmatched region codes: {sorted(extra)}')
        observations.update(parsed)
        print(f'Statistics: level {level}, {len(parsed)} regions', flush=True)

    climate_metadata = []
    for month in ['06', '07', '08']:
        params = {'searchYear': str(year), 'searchMonth': month}
        try:
            rows = get('/ndsm/prevHwSpcnwsList.json', params)['result']
            busan = [r for r in rows if r.get('up_spcnws_zone_nm') == '부산광역시' or r.get('spcnws_zone_nm', '').startswith('부산')]
            climate_metadata.append({'month': month, 'total_records': len(rows), 'busan_records': len(busan), 'used_in_score': False})
        except SgisError as e:
            errors.append(str(e))

    snapshot = {
        'meta': {'mode': 'sgis', 'reference_year': year, 'boundary_year': boundary_year, 'collected_at': datetime.now(timezone.utc).isoformat(),
                 'source': 'SGIS OpenAPI', 'analysis_scope': '부산광역시', 'available_indicator_count': 4,
                 'notes': ['기후 지표와 정확한 30년 이상 주택 비율 미확보: 종합 위험도 미산출', '전국은 경계 탐색, 부산은 실제 통계 제공'],
                 'collection_log': log, 'climate_probe': climate_metadata, 'errors': errors,
                 'alignment_notes': ['2024 통계의 녹산동·신호동 코드에 맞춰 사용자 승인으로 2025 경계 사용. 통계 연도 혼합 없음.']},
        'regions': regions, 'observations': observations,
    }
    atomic_json(DATA_ROOT / 'processed' / 'sgis.json', snapshot)
    client.close()
    print(json.dumps({'year': year, 'boundaries': len(regions), 'observations': len(observations), 'missing_boundary_statistics': len(set(regions) - set(observations))}, ensure_ascii=False))
    return snapshot


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='Explicitly refresh annual cached source responses')
    try:
        collect(parser.parse_args().refresh)
    except SgisError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)

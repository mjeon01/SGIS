import json
import threading
from ..core.settings import DATA_ROOT
from ..analytics.risk import analyze, comparison_average, compare, INDICATORS, ranking
from ..schemas.models import Observation
from ..services.sgis.cache import atomic_json
from ..services.sgis.client import SgisClient
from ..services.sgis.mock import load_sample
from ..services.sgis.parser import parse_boundaries


class DatasetUnavailable(Exception):
    pass


class DatasetRepository:
    def __init__(self):
        self.snapshots = {}
        self.lock = threading.RLock()

    def load(self, mode):
        with self.lock:
            path = DATA_ROOT / ('processed/sgis.json' if mode == 'sgis' else 'sample/metadata.json')
            if not path.exists():
                raise DatasetUnavailable('실제 데이터 캐시가 없습니다. scripts/collect_sgis.py를 실행하세요.' if mode == 'sgis' else '샘플 데이터가 없습니다. scripts/build_sample.py를 실행하세요.')
            stamp = path.stat().st_mtime_ns
            if mode not in self.snapshots or self.snapshots[mode][0] != stamp:
                data = json.loads(path.read_text()) if mode == 'sgis' else load_sample()
                for code, row in data['observations'].items():
                    validated = Observation(**row)
                    if code != validated.region_code or validated.reference_year != data['meta']['reference_year']:
                        raise ValueError('Dataset code/year mismatch')
                    if validated.is_sample != (mode == 'sample'):
                        raise ValueError('Mixed sample/actual observations')
                self.snapshots[mode] = (stamp, data)
            return self.snapshots[mode][1]

    def children(self, parent, mode):
        data = self.load(mode)
        if parent != '00' and parent not in data['regions']:
            # Resolve known nationwide code hierarchy, no arbitrary filesystem paths.
            if len(parent) == 5:
                self.children(parent[:2], mode)
            if parent not in data['regions']:
                raise KeyError(parent)
        rows = [r for r in data['regions'].values() if r['parent_region_code'] == parent]
        if rows or len(parent) == 8:
            return sorted(rows, key=lambda r: r['region_code'])
        if mode == 'sample':
            return []
        with self.lock:
            cache = DATA_ROOT / 'processed' / f"boundaries_{data['meta']['boundary_year']}_{parent}.json"
            if cache.exists():
                rows = json.loads(cache.read_text())
            else:
                client = SgisClient()
                try:
                    raw = client.get('/boundary/hadmarea.geojson', {'year': str(data['meta']['boundary_year']), 'adm_cd': parent, 'low_search': '1'})
                    rows = parse_boundaries(raw, parent, data['meta']['boundary_year'])
                    atomic_json(cache, rows)
                finally:
                    client.close()
            data['regions'].update({r['region_code']: r for r in rows})
        return sorted(rows, key=lambda r: r['region_code'])

    def region(self, code, mode):
        data = self.load(mode)
        if code not in data['regions']:
            self.children(code[:2] if len(code) == 5 else code[:5] if len(code) == 8 else '00', mode)
        if code not in data['regions']:
            raise KeyError(code)
        return data['regions'][code]

    def analysis_regions(self, parent, mode, level='children'):
        if level == 'dong' and parent == '21':
            return sorted((r for r in self.load(mode)['regions'].values()
                           if r['region_code'].startswith('21') and r['region_level'] == 'dong'),
                          key=lambda r: r['region_code'])
        if level == 'dong' and len(parent) != 5:
            raise KeyError(parent)
        return self.children(parent, mode)

    def results(self, parent, mode, level='children'):
        data = self.load(mode)
        regions = self.analysis_regions(parent, mode, level)
        comparison = '대한민국' if parent == '00' else data['regions'][parent]['region_name']
        # National risk comparisons are outside the agreed MVP scope.
        observations = data['observations'] if parent.startswith('21') else {}
        return analyze(regions, observations, comparison, parent_observation=observations.get(parent))

    def detail(self, code, parent, mode, level='children'):
        result = next((r for r in self.results(parent, mode, level) if r['region_code'] == code), None)
        if result is None:
            raise KeyError(code)
        data = self.load(mode)
        busan_rows = [row for c, row in data['observations'].items() if len(c) == 5 and c.startswith('21')]
        result['busan_comparison'] = [
            {'key': f['key'], 'name': f['name'], 'unit': f['unit'], 'value': f['value'],
             'comparison_region': '부산광역시', **compare(f['value'], comparison_average(busan_rows, f['key'], data['observations'].get('21')), f['unit'])}
            for f in result['factors']
        ] if parent.startswith('21') else []
        return result

    def view(self, parent, mode, layer, level='children'):
        data = self.load(mode)
        results = self.results(parent, mode, level)
        indexed = {r['region_code']: r for r in results}
        features = []
        for region in self.analysis_regions(parent, mode, level):
            r = indexed[region['region_code']]
            value = r.get(layer + '_score')
            if layer in INDICATORS:
                factor = next(f for f in r['factors'] if f['key'] == layer)
                value = factor['normalized_value'] * 100 if factor['normalized_value'] is not None else None
            features.append({'type': 'Feature', 'id': region['region_code'], 'geometry': region['geometry'], 'properties': {
                'region_code': region['region_code'], 'region_name': region['region_name'],
                'value': value, 'risk_score': r['risk_score'], 'risk_level': r['risk_level'],
                'is_sample': mode == 'sample',
            }})
        breadcrumbs = [{'region_code': '00', 'region_name': '대한민국'}]
        if parent != '00':
            for code in [parent[:2], parent] if len(parent) == 5 else [parent]:
                region = data['regions'][code]
                breadcrumbs.append({'region_code': code, 'region_name': region['region_name']})
        return {
            'meta': {k: v for k, v in data['meta'].items() if k != 'collection_log'},
            'parent_code': parent, 'breadcrumbs': breadcrumbs, 'layer': layer, 'level': level,
            'regions': results, 'ranking': ranking(results),
            'geojson': {'type': 'FeatureCollection', 'features': features},
            'scored_count': sum(r['risk_score'] is not None for r in results),
            'in_analysis_scope': parent.startswith('21'),
        }

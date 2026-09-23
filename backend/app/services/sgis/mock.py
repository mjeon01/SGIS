import json
from ...core.settings import DATA_ROOT


def load_sample():
    root = DATA_ROOT / 'sample'
    features = json.loads((root / 'regions.geojson').read_text())['features']
    return {
        'meta': json.loads((root / 'metadata.json').read_text()),
        'observations': json.loads((root / 'observations.json').read_text()),
        'regions': {f['properties']['region_code']: {**f['properties'], 'geometry': f['geometry']} for f in features},
    }

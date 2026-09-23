"""Cache Busan's public flood history and original urban-flood WMS images.

All upstream calls use the shared three-second host gate. No WFS service,
live-alert endpoint, authentication or third-party map credentials are used.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyproj import Transformer
from backend.app.core.settings import DATA_ROOT
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json

SOURCE = 'https://safecity.busan.go.kr/'
HISTORY = SOURCE + 'iots/vmap/sensor_flood_trace.do'
WMS = SOURCE + 'geoserver/iots/wms'
BBOX = [128.79, 34.99, 129.30, 35.40]
SCENARIOS = [(30, 98.1), (50, 106.8), (80, 114.7), (100, 118.5)]


def collect(refresh=False):
    folder = DATA_ROOT / 'raw/flood'
    folder.mkdir(parents=True, exist_ok=True)
    collected = datetime.now(timezone.utc).isoformat()
    images_updated = False
    transform = Transformer.from_crs(4326, 3857, always_xy=True)
    projected = (*transform.transform(*BBOX[:2]), *transform.transform(*BBOX[2:]))
    with public_client() as client:
        if refresh or not (folder / 'history.json').exists():
            response = client.get(HISTORY)
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list) or not rows:
                raise ValueError('Empty or invalid public history response')
            # Publish only attributes displayed in the official public history view.
            fields = ['sensor_cd', 'sensor_name', 'lat', 'lon', 'gu', 'disaster_name',
                      'type_name', 'period', 'inundation_depth', 'area_size']
            atomic_json(folder / 'history.json', {'collected_at': collected,
                        'rows': [{k: r.get(k) for k in fields} for r in rows]})
        for years, rainfall in SCENARIOS:
            path = folder / f'forecast-{years}.png'
            if not refresh and path.exists():
                continue
            response = client.get(WMS, params={'service': 'WMS', 'version': '1.1.1',
                'request': 'GetMap', 'layers': f'iots:fldm_{years}', 'styles': '',
                'srs': 'EPSG:3857', 'bbox': ','.join(map(str, projected)),
                'width': '4096', 'height': '4096', 'format': 'image/png', 'transparent': 'true'})
            response.raise_for_status()
            if not response.content.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('WMS did not return a PNG')
            temporary = path.with_suffix('.tmp')
            temporary.write_bytes(response.content)
            temporary.replace(path)
            images_updated = True
            print(f'{years}-year scenario: {len(response.content)} bytes', flush=True)
        if images_updated or not (folder / 'meta.json').exists():
            atomic_json(folder / 'meta.json', {'source': '부산광역시 부산 안전 ON',
                'source_url': SOURCE, 'history_endpoint': HISTORY, 'wms_endpoint': WMS,
                'collected_at': collected, 'bbox': BBOX, 'image_size': [4096, 4096],
                'scenario_reference_year': None,
                'scenarios': [{'years': y, 'rainfall_mm_hour': mm, 'layer': f'fldm_{y}'} for y, mm in SCENARIOS]})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    collect(parser.parse_args().refresh)

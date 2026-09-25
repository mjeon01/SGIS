"""Run the packaged application without the local data directory or credentials."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
from zipfile import ZipFile

import pytest

from backend.app.core.deployment import unpack_snapshot

ROOT = Path(__file__).resolve().parents[2]


def test_deployment_snapshot_serves_existing_features_without_keys(tmp_path):
    shutil.copytree(ROOT / 'backend/app', tmp_path / 'backend/app', ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copytree(ROOT / 'config', tmp_path / 'config')
    shutil.copytree(ROOT / 'deployment', tmp_path / 'deployment')
    env = {k: v for k, v in os.environ.items() if not k.startswith(('SGIS_', 'PYTHONPATH'))}
    env.update(VERCEL='1', DATA_MODE='sgis')
    result = subprocess.run([sys.executable, '-c', '''
from datetime import date
from fastapi.testclient import TestClient
from backend.app.core.settings import DATA_ROOT, ROOT
from backend.app.main import app
from backend.app.services.sgis.client import SgisClient
from backend.app.services.sgis.cache import atomic_json
from backend.app.services.weather import current

def no_network(*args, **kwargs):
    raise AssertionError('Bundled features must not require external credentials')
SgisClient.get = no_network
assert not (ROOT / 'data').exists()
assert DATA_ROOT.is_dir() and DATA_ROOT != ROOT / 'data'
atomic_json(DATA_ROOT / 'raw/runtime-check.json', {'writable': True})
client = TestClient(app)
for route in ['/api/health', '/api/meta', '/api/regions', '/api/view?parent_code=21&level=dong',
              '/api/facilities', '/api/flood', '/api/disasters', '/api/landslides',
              '/api/typhoons?region=21', '/api/typhoons/2022-11?region=21',
              '/api/climate/seasons/winter-2025-2026?region=21', '/api/current-weather',
              '/api/current-weather/comparison', '/api/disaster-profile/21']:
    response = client.get(route)
    assert response.status_code == 200, (route, response.status_code, response.text[:200])
view = client.get('/api/view?parent_code=21&level=dong').json()
assert view['scored_count'] > 0 and all(not row['is_sample'] for row in view['regions'])
code = view['regions'][0]['region_code']
for route in [f'/api/weather/{code}', f'/api/current-weather/regions/{code}',
              f'/api/risk/{code}?parent_code=21&level=dong']:
    assert client.get(route).status_code == 200, route
for scenario in (30, 50, 80, 100):
    response = client.get(f'/api/flood/forecast/{scenario}.png')
    assert response.status_code == 200 and response.content.startswith(b'\\x89PNG')
from unittest.mock import patch
with patch.object(current.threading, 'Thread', side_effect=no_network):
    assert current.start_refresh()['state'] == 'disabled'
assert client.get('/api/current-weather/refresh').json()['state'] == 'disabled'
assert client.post('/api/current-weather/refresh').json()['state'] == 'disabled'
current.observation_cutoff = lambda: date(2099, 1, 1)
response = client.get('/api/current-weather')
assert response.status_code == 200 and response.json()['meta']['outdated']
print('Packaged heat, flood, facilities, disasters, weather and writable cache: OK')
'''], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr


def test_snapshot_missing_or_unsafe_fails_clearly(tmp_path):
    with pytest.raises(RuntimeError, match='Deployment snapshot missing'):
        unpack_snapshot(tmp_path / 'missing.zip')
    archive = tmp_path / 'unsafe.zip'
    with ZipFile(archive, 'w') as bundle:
        bundle.writestr('../outside.json', '{}')
    with pytest.raises(ValueError, match='Invalid snapshot path'):
        unpack_snapshot(archive)

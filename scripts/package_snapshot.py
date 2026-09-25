"""Package existing public runtime data only; never collect or generate observations.

Run after the collectors: python scripts/package_snapshot.py
Commit deployment/snapshot.zip alongside application changes for Git deployments.
"""
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    'processed/sgis.json',
    'processed/facilities_2026.json',
    'processed/kma_extremes_2024.json',
    'processed/landslides.json',
    'processed/typhoons.json',
    'processed/winter-2025-2026.json',
    'raw/flood/history.json',
    'raw/flood/meta.json',
    *(f'raw/flood/forecast-{mm}.png' for mm in (30, 50, 80, 100)),
    'sample/metadata.json',
    'sample/observations.json',
    'sample/regions.geojson',
)
OPTIONAL = (
    'processed/boundaries_[0-9][0-9][0-9][0-9]_*.json',
    'reports/heatwave/[0-9]*.json',
)
SECRET_KEY = re.compile(r'^(?:access_?token|security_?key|consumer_?(?:key|secret)|service_?key|api_?key|password|authorization)$', re.I)
SECRET_QUERY = re.compile(r'[?&](?:accessToken|access_token|consumer_key|consumer_secret|serviceKey|security_key|api_key)=[^&\s]+', re.I)


def check_public(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEY.fullmatch(key) and child:
                raise ValueError('Credential field found in snapshot input')
            check_public(child)
    elif isinstance(value, list):
        for child in value:
            check_public(child)
    elif isinstance(value, str) and SECRET_QUERY.search(value):
        raise ValueError('Credential query parameter found in snapshot input')


def package(data_root=ROOT / 'data', output=ROOT / 'deployment/snapshot.zip'):
    paths = {data_root / name for name in REQUIRED}
    weather = sorted(data_root.glob('processed/current_weather_[0-9][0-9][0-9][0-9].json'))
    if not weather:
        raise ValueError('Collect a current-weather snapshot before packaging')
    paths.add(weather[-1])
    for pattern in OPTIONAL:
        paths.update(data_root.glob(pattern))
    for path in paths:
        if not path.is_file():
            raise ValueError(f'Missing required snapshot: {path.relative_to(data_root)}')
        if path.suffix in {'.json', '.geojson'}:
            check_public(json.loads(path.read_text()))
    actual = json.loads((data_root / 'processed/sgis.json').read_text())
    if actual['meta']['mode'] != 'sgis' or any(row.get('is_sample') is not False for row in actual['observations'].values()):
        raise ValueError('The deployment requires collected SGIS observations, not samples')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    try:
        with ZipFile(temporary, 'w', compression=ZIP_DEFLATED) as archive:
            for path in sorted(paths):
                info = ZipInfo(path.relative_to(data_root).as_posix())
                info.compress_type = ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                archive.writestr(info, path.read_bytes())
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Packaged {len(paths)} public data files ({output.stat().st_size / 1024**2:.1f} MiB)')
    print(f'SHA256: {hashlib.sha256(output.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    package()

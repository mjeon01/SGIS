import os
from pathlib import Path
from dotenv import load_dotenv
from .deployment import unpack_snapshot

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / '.env')
IS_VERCEL = os.getenv('VERCEL') == '1'
# The bundled snapshot is immutable. SGIS caches/locks can write only to /tmp;
# these writes are disposable and are never treated as durable collected data.
DATA_ROOT = unpack_snapshot(ROOT / 'deployment/snapshot.zip') if IS_VERCEL else ROOT / 'data'
DATA_MODE = os.getenv('DATA_MODE', 'sgis')
if DATA_MODE not in {'sgis', 'sample'}:
    raise ValueError('DATA_MODE must be sgis or sample')
SGIS_BASE_URL = os.getenv('SGIS_BASE_URL', 'https://sgisapi.mods.go.kr/OpenAPI3')

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / '.env')
DATA_ROOT = ROOT / 'data'
DATA_MODE = os.getenv('DATA_MODE', 'sgis')
if DATA_MODE not in {'sgis', 'sample'}:
    raise ValueError('DATA_MODE must be sgis or sample')
SGIS_BASE_URL = os.getenv('SGIS_BASE_URL', 'https://sgisapi.mods.go.kr/OpenAPI3')

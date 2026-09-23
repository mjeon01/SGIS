import hashlib
import json
import os
import tempfile
from pathlib import Path


def atomic_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


class RawCache:
    def __init__(self, root: Path):
        self.root = root

    def path(self, endpoint, params):
        safe = {k: v for k, v in params.items() if k not in {'accessToken', 'consumer_key', 'consumer_secret'}}
        key = hashlib.sha256(json.dumps([endpoint, safe], sort_keys=True).encode()).hexdigest()
        return self.root / f'{key}.json'

    def read(self, endpoint, params):
        path = self.path(endpoint, params)
        return json.loads(path.read_text()) if path.exists() else None

    def write(self, endpoint, params, response):
        atomic_json(self.path(endpoint, params), response)

import time
import httpx
from ...core.settings import DATA_ROOT, SGIS_BASE_URL
from .auth import TokenManager
from .base import SgisError
from .cache import RawCache
from ..public_http import ThrottledTransport


class SgisClient:
    def __init__(self, transport=None, cache_root=None):
        self.http = httpx.Client(timeout=45, transport=transport or ThrottledTransport(), follow_redirects=False)
        self.auth = TokenManager(self.http, SGIS_BASE_URL)
        self.cache = RawCache(cache_root or DATA_ROOT / 'raw')

    def get(self, endpoint, params=None, refresh=False):
        params = params or {}
        if not refresh:
            cached = self.cache.read(endpoint, params)
            if cached is not None:
                return cached
        refresh_token = False
        for attempt in range(3):
            token = self.auth.get(force=refresh_token)
            refresh_token = False
            try:
                response = self.http.get(SGIS_BASE_URL + endpoint, params={**params, 'accessToken': token})
                response.raise_for_status()
                data = response.json()
            except (httpx.HTTPError, ValueError):
                if attempt < 2:
                    time.sleep(3 * 2 ** attempt)
                    continue
                raise SgisError(endpoint, 'connection_failed') from None
            if data.get('errCd') in (-401, -1000) and attempt < 2:
                refresh_token = True
                continue
            if data.get('errCd') != 0:
                raise SgisError(endpoint, data.get('errCd', 'invalid_response'))
            self.cache.write(endpoint, params, data)
            return data
        raise SgisError(endpoint, 'authentication_failed')

    def close(self):
        self.http.close()

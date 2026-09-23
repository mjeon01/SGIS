import os
import threading
import time
import httpx
from .base import SgisError


class TokenManager:
    def __init__(self, client: httpx.Client, base_url: str):
        self.client = client
        self.base_url = base_url
        self.token = os.getenv('SGIS_ACCESS_TOKEN', '')
        self.expires_at = time.time() + 300 if self.token else 0
        self.lock = threading.Lock()

    def get(self, force=False):
        with self.lock:
            if not force and self.token and time.time() < self.expires_at - 60:
                return self.token
            key, secret = os.getenv('SGIS_SERVICE_ID'), os.getenv('SGIS_SECURITY_KEY')
            if not key or not secret:
                raise SgisError('auth', 'credentials_missing')
            try:
                response = self.client.get(self.base_url + '/auth/authentication.json', params={
                    'consumer_key': key, 'consumer_secret': secret,
                })
                response.raise_for_status()
                data = response.json()
            except (httpx.HTTPError, ValueError):
                raise SgisError('auth', 'connection_failed') from None
            if data.get('errCd') != 0 or not data.get('result', {}).get('accessToken'):
                raise SgisError('auth', data.get('errCd', 'invalid_response'))
            self.token = data['result']['accessToken']
            expires = float(data['result'].get('accessTimeout', 0))
            if expires > 1e12:
                expires /= 1000
            self.expires_at = expires if expires > time.time() else time.time() + 3600
            return self.token

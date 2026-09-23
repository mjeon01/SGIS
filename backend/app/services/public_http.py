"""Three-second, per-host request spacing shared by local processes."""
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import fcntl
import hashlib
import threading
import time

import httpx
from ..core.settings import DATA_ROOT

_LOCK = threading.RLock()


def retry_delay(value):
    if value:
        try:
            return max(3.0, float(value))
        except ValueError:
            try:
                return max(3.0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError):
                pass
    return 30.0


class ThrottledTransport(httpx.BaseTransport):
    def __init__(self, transport=None, root=None, clock=time.time, sleep=time.sleep):
        self.transport = transport or httpx.HTTPTransport()
        self.root = root or DATA_ROOT / 'raw' / '.request_limits'
        self.clock, self.sleep = clock, sleep

    @contextmanager
    def gate(self, host):
        self.root.mkdir(parents=True, exist_ok=True)
        with _LOCK, (self.root / (hashlib.sha256(host.encode()).hexdigest() + '.lock')).open('a+') as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            try:
                stream.seek(0)
                raw = stream.read().strip()
                wait = max(0, float(raw or 0) - self.clock())
                # The process may sleep longer for Retry-After, without holding the UI thread.
                if wait:
                    self.sleep(wait)
                def save(deadline):
                    stream.seek(0)
                    stream.truncate()
                    stream.write(str(deadline))
                    stream.flush()
                save(self.clock() + 3.0)
                yield save
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)

    def handle_request(self, request):
        with self.gate(request.url.host) as save:
            response = self.transport.handle_request(request)
            if response.status_code == 429:
                save(self.clock() + retry_delay(response.headers.get('Retry-After')))
            return response

    def close(self):
        self.transport.close()


def public_client():
    return httpx.Client(timeout=45, follow_redirects=True, transport=ThrottledTransport())

"""Collector retries on top of the shared three-second host limiter."""
import logging
import httpx

logger = logging.getLogger(__name__)


def request(client, method, url, **kwargs):
    for attempt in range(3):
        try:
            response = client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            # Never log request bodies, URLs with credentials, or response data.
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            logger.warning('Public collection request failed: host=%s attempt=%s status=%s error=%s',
                           httpx.URL(url).host, attempt + 1, status, type(exc).__name__)
            if attempt == 2 or (status is not None and status != 429 and status < 500):
                raise

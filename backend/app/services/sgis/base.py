class SgisError(Exception):
    """Safe error: no URL, credentials, or raw upstream text."""
    def __init__(self, endpoint: str, code: str | int):
        self.endpoint = endpoint
        self.code = code
        super().__init__(f'SGIS {endpoint}: {code}')

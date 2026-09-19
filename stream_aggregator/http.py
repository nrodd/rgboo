"""Do not expose URLs, response bodies or credentials in exception logs."""


class APIError(Exception):
    def __init__(self, status, reason=""):
        self.status = status
        self.reason = reason
        super().__init__(f"HTTP {status}")


async def request(session, method, url, **kwargs):
    async with session.request(method, url, allow_redirects=False, **kwargs) as response:
        if not 200 <= response.status < 300:
            reason = ""
            try:
                body = await response.json(content_type=None)
                reason = body.get("error", {}).get("errors", [{}])[0].get("reason", "")
            except (ValueError, AttributeError, IndexError, TypeError):
                pass
            raise APIError(response.status, reason)
        return await response.json()

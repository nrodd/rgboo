"""Do not expose URLs, response bodies or credentials in exception logs."""

SAFE_REASONS = {
    "invalid_grant", "invalid_client", "unauthorized_client", "invalid_scope",
    "access_denied", "forbidden", "insufficientPermissions", "quotaExceeded",
    "dailyLimitExceeded", "rateLimitExceeded", "liveChatEnded", "liveChatDisabled",
    "liveChatNotFound", "messageTextInvalid", "chatMessageNotSent",
}


class APIError(Exception):
    def __init__(self, status, reason=""):
        self.status = status
        self.reason = reason
        super().__init__(f"HTTP {status}")

    @property
    def log_reason(self):
        return self.reason if isinstance(self.reason, str) and self.reason in SAFE_REASONS else "unknown"


async def request(session, method, url, **kwargs):
    async with session.request(method, url, allow_redirects=False, **kwargs) as response:
        if not 200 <= response.status < 300:
            reason = ""
            try:
                body = await response.json(content_type=None)
                detail = body.get("error", {})
                reason = detail if isinstance(detail, str) else detail.get("errors", [{}])[0].get("reason", "")
            except (ValueError, AttributeError, IndexError, TypeError):
                pass
            raise APIError(response.status, reason)
        return await response.json()

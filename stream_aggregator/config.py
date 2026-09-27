import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class Config:
    cloud_url: str
    cloud_key: str
    youtube_key: str = ""
    youtube_video: str = ""
    youtube_chat: str = ""
    twitch_client: str = ""
    twitch_user: str = ""
    twitch_channel: str = ""
    twitch_token: str = ""
    twitch_secret: str = ""
    twitch_refresh: str = ""
    twitch_token_file: str = ""
    youtube_token: str = ""
    youtube_client: str = ""
    youtube_secret: str = ""
    youtube_refresh: str = ""

    youtube_budget_file: str = ":memory:"
    youtube_daily_replies: int = 160
    youtube_daily_reads: int = 1000

    @classmethod
    def from_env(cls):
        fields = {
            "cloud_url": "CLOUD_API_URL", "cloud_key": "CLOUD_API_KEY",
            "youtube_key": "YOUTUBE_API_KEY", "youtube_video": "YOUTUBE_VIDEO_ID",
            "youtube_chat": "YOUTUBE_LIVE_CHAT_ID", "twitch_client": "TWITCH_CLIENT_ID",
            "twitch_user": "TWITCH_BOT_USER_ID", "twitch_channel": "TWITCH_BROADCASTER_ID",
            "twitch_token": "TWITCH_ACCESS_TOKEN", "twitch_secret": "TWITCH_CLIENT_SECRET",
            "twitch_refresh": "TWITCH_REFRESH_TOKEN", "twitch_token_file": "TWITCH_TOKEN_FILE",
            "youtube_token": "YOUTUBE_ACCESS_TOKEN", "youtube_client": "YOUTUBE_CLIENT_ID",
            "youtube_secret": "YOUTUBE_CLIENT_SECRET", "youtube_refresh": "YOUTUBE_REFRESH_TOKEN",
        }
        values = {key: os.getenv(env, "").strip() for key, env in fields.items()}
        values["youtube_budget_file"] = os.getenv("YOUTUBE_BUDGET_FILE", "/data/youtube-budget.sqlite3").strip()
        for field, env, default, maximum in (
            ("youtube_daily_replies", "YOUTUBE_DAILY_REPLIES", 160, 160),
            ("youtube_daily_reads", "YOUTUBE_DAILY_READS", 1000, 1000),
        ):
            try:
                value = int(os.getenv(env, str(default)))
            except ValueError:
                raise ValueError(f"{env} must be an integer") from None
            if not 0 <= value <= maximum:
                raise ValueError(f"{env} must be between 0 and {maximum}")
            values[field] = value
        config = cls(**values)
        url = urlparse(config.cloud_url)
        if url.scheme not in ("http", "https") or not url.hostname or url.query or url.fragment or url.username:
            raise ValueError("CLOUD_API_URL must be an HTTP(S) base URL without credentials or query")
        if not config.cloud_key:
            raise ValueError("CLOUD_API_KEY is required")
        youtube = bool(config.youtube_video or config.youtube_chat)
        twitch = bool(config.twitch_channel)
        if not youtube and not twitch:
            raise ValueError("Configure a YouTube video/chat ID or TWITCH_BROADCASTER_ID")
        if youtube and config.youtube_budget_file in ("", ":memory:"):
            raise ValueError("YOUTUBE_BUDGET_FILE must be a persistent file path")
        if youtube and not config.youtube_key:
            raise ValueError("YOUTUBE_API_KEY is required for YouTube")
        if youtube and not (config.youtube_token or config.youtube_refresh):
            raise ValueError("YouTube chat replies require YOUTUBE_ACCESS_TOKEN or YOUTUBE_REFRESH_TOKEN")
        if config.youtube_refresh and not all((config.youtube_client, config.youtube_secret)):
            raise ValueError("YouTube refresh requires YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET")
        if any((config.twitch_client, config.twitch_user, config.twitch_token)) and not twitch:
            raise ValueError("TWITCH_BROADCASTER_ID is required for Twitch")
        if twitch and not all((config.twitch_client, config.twitch_user, config.twitch_token)):
            raise ValueError("Twitch requires client ID, bot user ID, and user access token")
        if twitch and (not config.twitch_user.isdigit() or not config.twitch_channel.isdigit()):
            raise ValueError("Twitch user and broadcaster IDs must be numeric IDs")
        if config.twitch_refresh and not all((config.twitch_secret, config.twitch_token_file)):
            raise ValueError("Twitch refresh requires TWITCH_CLIENT_SECRET and writable TWITCH_TOKEN_FILE")
        return config

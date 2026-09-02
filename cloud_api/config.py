import os

# Load .env from the repo root for local development. Real environment
# variables always win, and in Cloud Run there is no .env, so this is a no-op
# in production. See docs/local-setup.md.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # dotenv is a dev convenience, not a hard dependency
    pass


class Config:
    """Configuration for the Cloud Run API, read from environment variables."""

    # Shared secret the Cloudflare Worker sends as X-Api-Key.
    API_KEY = os.getenv('API_KEY')

    # Cloud Run injects PORT automatically; default matches its convention.
    PORT = int(os.getenv('PORT', 8080))

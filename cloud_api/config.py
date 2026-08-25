import os


class Config:
    """Configuration for the Cloud Run API, read from environment variables."""

    # Shared secret the Cloudflare Worker sends as X-Api-Key. Set via
    # `gcloud run deploy --set-env-vars API_KEY=...` (Phase 4).
    API_KEY = os.getenv('API_KEY')

    # Cloud Run injects PORT automatically; default matches its convention.
    PORT = int(os.getenv('PORT', 8080))

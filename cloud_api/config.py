import os


class Config:
    """Configuration for the Cloud Run API, read from environment variables."""

    # Shared secret the Cloudflare Worker sends as X-Api-Key.
    API_KEY = os.getenv('API_KEY')

    # Higher-privilege secret for /admin/*. Not API_KEY: the Worker sends that
    # on everything it proxies, so it identifies the Worker, not a person.
    # Set from Secret Manager -- see docs/admin-clear-current.md.
    ADMIN_KEY = os.getenv('ADMIN_KEY')

    # Cloud Run injects PORT automatically; default matches its convention.
    PORT = int(os.getenv('PORT', 8080))

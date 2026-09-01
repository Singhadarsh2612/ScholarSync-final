"""MCP tool server configuration.

The Tavily client is built on first use: constructing it eagerly raised
MissingAPIKeyError without a key, taking down calendar and email too.
"""

import os

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")

# Account the send_email tool sends as. Was hardcoded in send_email.py.
GMAIL_SENDER = os.getenv("GMAIL_SENDER") or os.getenv("ADMIN_EMAIL") or ""

_tavily_client = None


def get_tavily_client():
    """A Tavily client, or None when no key is configured. Callers must handle
    None so web search degrades without breaking unrelated tools."""
    global _tavily_client

    if _tavily_client is None:
        if not TAVILY_API_KEY:
            return None
        _tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

    return _tavily_client

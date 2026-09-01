"""
chatbot/mcp_server/config.py
─────────────────────────────────────────────────────────────────────────────
Configuration for the MCP tool server.

The Tavily client is created on first use, not at import. Constructing it
eagerly raised MissingAPIKeyError when TAVILY_API_KEY was unset, which took
down the whole MCP server at startup — so one missing optional key disabled
calendar, email and every other tool as well.
"""

import os

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")

_tavily_client = None


def get_tavily_client():
    """Return a Tavily client, or None when no API key is configured.

    Callers must handle None so web search degrades on its own instead of
    breaking unrelated tools.
    """
    global _tavily_client

    if _tavily_client is None:
        if not TAVILY_API_KEY:
            return None
        _tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

    return _tavily_client

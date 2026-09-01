from langchain_core.tools import tool
from datetime import datetime
import numexpr as ne
from tavily import TavilyClient
import os

_client = None


def _get_client():
    """Create the Tavily client on first use; None when no key is configured."""
    global _client
    if _client is None:
        key = os.getenv("TAVILY_API_KEY")
        if not key:
            return None
        _client = TavilyClient(api_key=key)
    return _client

@tool
def calculator(expression: str) -> str:
    """Evaluate mathematical expressions safely"""

    try:
        result = ne.evaluate(expression)
        return str(result)

    except Exception as e:
        return f"Calculation error: {str(e)}"


@tool
def current_time() -> str:
    """Returns current system time"""

    try:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    except Exception as e:
        return f"Time error: {str(e)}"



@tool
def web_search(query: str) -> str:
    """Search the web for latest information"""

    client = _get_client()
    if client is None:
        return "Web search is unavailable: TAVILY_API_KEY is not set."

    try:
        response = client.search(
            query=query,
            max_results=3
        )

        results = response.get("results", [])

        if not results:
            return "No results found."

        output = ""

        for r in results:
            output += f"{r['title']}: {r['content']}\n\n"

        return output

    except Exception as e:
        return f"Search error: {str(e)}"
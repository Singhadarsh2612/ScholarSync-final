from langchain_core.tools import tool
from datetime import datetime
import numexpr as ne
from tavily import TavilyClient
import os

client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

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
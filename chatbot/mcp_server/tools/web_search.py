# pyrefly: ignore [missing-import]
from ..config import get_tavily_client

def web_search(data):

    query = data["query"]

    print("[MCP] web_search ->", query)

    tavily_client = get_tavily_client()
    if tavily_client is None:
        return {"result": "Web search is unavailable: TAVILY_API_KEY is not set."}

    try:

        response = tavily_client.search(
            query=query,
            max_results=3
        )

        results = response.get("results", [])

        if not results:
            return {"result": "No results found."}

        output = ""

        for r in results:

            output += f"""
Title: {r['title']}
Content: {r['content']}
Source: {r['url']}
"""

        return {"result": output}

    except Exception as e:
        return {"result": f"Search error: {str(e)}"}
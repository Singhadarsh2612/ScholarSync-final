# pyrefly: ignore [missing-import]
from ..config import tavily_client

def web_search(data):

    query = data["query"]

    print("[MCP] web_search ->", query)

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
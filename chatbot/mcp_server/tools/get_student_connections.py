import requests

from endpoints import CHAT_API_URL, CHAT_STUDENT_ID

API_URL = f"{CHAT_API_URL}/api/connect/all?studentId={CHAT_STUDENT_ID}"

def get_student_connections():
    print("[MCP] get_student_connections")
    try:
        r = requests.get(API_URL, timeout=15)
        r.raise_for_status()
        data = r.json()

        cleaned = []
        for item in data:
            expert = item.get("expert", {})
            cleaned.append({
                "name": expert.get("name"),
                "subject": expert.get("subject"),
                "description": expert.get("description"),
                "chat_url": item.get("fullUrl")
            })

        return {
            "status": "success",
            "connections": cleaned
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

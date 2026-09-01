from langchain_core.tools import tool
import requests

from chatbot.mcp_server.tools.get_subject_professors import get_subject_professors

from endpoints import MCP_URL


def call_mcp(endpoint, payload=None):

    try:

        r = requests.post(
            f"{MCP_URL}{endpoint}",
            json=payload,
            timeout=10
        )

        r.raise_for_status()

        data = r.json()

        if data.get("status") == "success":

            if "event_url" in data:
                return (
                    "✅ Your reminder has been scheduled.\n\n"
                    f"Open event:\n{data['event_url']}"
                )

            return data.get("message", "Success")

        if "result" in data:
            return data["result"]

        return "Tool executed successfully."

    except requests.exceptions.ConnectionError:
        return "❌ MCP server is not running."

    except Exception as e:
        return f"MCP tool error: {str(e)}"


@tool
def calculator(expression: str) -> str:
    """Calculate mathematical expressions."""

    return call_mcp(
        "/tools/calculator",
        {"expression": expression}
    )


@tool
def web_search(query: str) -> str:
    """Search the web."""

    return call_mcp(
        "/tools/web_search",
        {"query": query}
    )


@tool
def current_time() -> str:
    """Get system time."""

    return call_mcp("/tools/current_time")


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send email using SendGrid."""

    return call_mcp(
        "/tools/send_email",
        {
            "to": to,
            "subject": subject,
            "body": body
        }
    )


@tool
def create_calendar_event(title: str, start_time: str, end_time: str, reminder_minutes: int | None = None) -> str:
    """Create a Google Calendar event. start_time and end_time are heavily REQUIRED in ISO 8601 format. If user didn't provide time, return an error asking them."""

    if not start_time or not end_time:
        return "Error: start_time and end_time are REQUIRED. Ask the user for the missing date/time."

    payload: dict[str, str | int] = {
        "title": title,
        "start_time": start_time,
        "end_time": end_time
    }
    if reminder_minutes is not None:
        payload["reminder_minutes"] = reminder_minutes

    return call_mcp("/tools/create_calendar_event", payload)


@tool
def delete_calendar_event(event_id: str) -> str:
    """Delete a calendar event by event ID."""

    return call_mcp(
        "/tools/delete_calendar_event",
        {
            "event_id": event_id
        }
    )


@tool
def find_event_by_title(title: str) -> str:
    """Find calendar events matching a title."""

    return call_mcp(
        "/tools/find_event_by_title",
        {
            "title": title
        }
    )


@tool
def check_calendar_free(start_time: str, end_time: str) -> str:
    """Check if a calendar time slot is free."""

    return call_mcp(
        "/tools/check_calendar_free",
        {
            "start_time": start_time,
            "end_time": end_time
        }
    )


@tool
def list_calendar_events(date: str) -> str:
    """List all calendar events on a given date (YYYY-MM-DD)."""

    return call_mcp(
        "/tools/list_calendar_events",
        {
            "date": date
        }
    )

@tool
def delete_event_by_title(title: str) -> str:
    """Delete a calendar event by title."""

    return call_mcp(
        "/tools/delete_event_by_title",
        {
            "title": title
        }
    )


@tool
def update_event_by_title(title: str, start_time: str, end_time: str) -> str:
    """Update a calendar event using its title."""

    return call_mcp(
        "/tools/update_event_by_title",
        {
            "title": title,
            "start_time": start_time,
            "end_time": end_time
        }
    )
@tool
def get_subject_professors():
    """Fetch all subjects and professor emails from the student portal."""

    r = requests.post(
        f"{MCP_URL}/tools/get_subject_professors"
    )

    return r.json()


from .tools_integration import get_assignments_tool, get_materials_tool, student_performance_tool, get_marks_tool, get_deadlines_tool

def get_mcp_tools():

    return [
    calculator,
    web_search,
    current_time,
    send_email,
    get_subject_professors,
    create_calendar_event,
    update_event_by_title,
    delete_event_by_title,
    check_calendar_free,
    list_calendar_events,
    get_assignments_tool,
    get_materials_tool,
    student_performance_tool,
    get_marks_tool,
    get_deadlines_tool,
]
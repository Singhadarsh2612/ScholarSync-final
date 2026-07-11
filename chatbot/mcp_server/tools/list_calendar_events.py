# pyrefly: ignore [missing-import]
from ..calendar_auth import get_calendar_service, CALENDAR_ID


def list_calendar_events(data):

    date = data["date"]

    print("[MCP] list_calendar_events ->", date)

    try:
        service = get_calendar_service()

        start = f"{date}T00:00:00+05:30"
        end = f"{date}T23:59:59+05:30"

        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=start,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime"
        ).execute()

        events = events_result.get("items", [])

        if not events:
            return {"result": "No events scheduled for this day."}

        output = ""

        for event in events:

            start_time = event["start"].get(
                "dateTime",
                event["start"].get("date")
            )

            output += f"""
Title: {event['summary']}
Start: {start_time}
"""

        return {"result": output}

    except Exception as e:
        return {"result": f"Calendar error: {str(e)}"}

# pyrefly: ignore [missing-import]
from ..calendar_auth import get_calendar_service, CALENDAR_ID
from datetime import datetime
import pytz
IST = pytz.timezone("Asia/Kolkata")


def update_event_by_title(data):

    title = data["title"]
    new_start_time = data["start_time"]
    new_end_time = data["end_time"]

    print("[MCP] update_event_by_title ->", title)

    try:

        service = get_calendar_service()

        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            maxResults=250,
            singleEvents=True,
            orderBy="startTime"
        ).execute()

        events = events_result.get("items", [])

        for event in events:

            summary = event.get("summary", "")

            print("Checking event:", summary)

            if title.lower().strip() in summary.lower().strip():

                event_id = event["id"]

                start_dt = datetime.fromisoformat(new_start_time)
                end_dt = datetime.fromisoformat(new_end_time)

                if start_dt.tzinfo is None:
                    start_dt = IST.localize(start_dt)

                if end_dt.tzinfo is None:
                    end_dt = IST.localize(end_dt)

                updated_event = {
                    "summary": event["summary"],
                    "start": {
                        "dateTime": start_dt.isoformat(),
                        "timeZone": "Asia/Kolkata"
                    },
                    "end": {
                        "dateTime": end_dt.isoformat(),
                        "timeZone": "Asia/Kolkata"
                    }
                }

                service.events().update(
                    calendarId=CALENDAR_ID,
                    eventId=event_id,
                    body=updated_event
                ).execute()

                return {
                    "status": "success",
                    "message": f"Event '{event['summary']}' updated successfully"
                }

        return {
            "status": "not_found",
            "message": "No matching event found"
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }
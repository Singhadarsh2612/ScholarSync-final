from datetime import datetime
import pytz
# pyrefly: ignore [missing-import]
from ..calendar_auth import get_calendar_service, CALENDAR_ID

IST = pytz.timezone("Asia/Kolkata")


def check_calendar_free(data):

    start_time = data["start_time"]
    end_time = data["end_time"]

    print("[MCP] check_calendar_free")

    try:
        service = get_calendar_service()

        start_dt = datetime.fromisoformat(start_time)
        end_dt = datetime.fromisoformat(end_time)

        if start_dt.tzinfo is None:
            start_dt = IST.localize(start_dt)

        if end_dt.tzinfo is None:
            end_dt = IST.localize(end_dt)

        body = {
            "timeMin": start_dt.isoformat(),
            "timeMax": end_dt.isoformat(),
            "timeZone": "Asia/Kolkata",
            "items": [{"id": "primary"}]
        }

        result = service.freebusy().query(body=body).execute()

        busy = result["calendars"]["primary"]["busy"]

        if not busy:
            return {"result": "You are free during this time."}

        return {"result": "You already have an event during this time."}

    except Exception as e:
        return {"result": f"Calendar error: {str(e)}"}

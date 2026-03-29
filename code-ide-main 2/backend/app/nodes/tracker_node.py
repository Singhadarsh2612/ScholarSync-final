import time
from app.state import InterviewState


PAUSE_LIMIT = 120


def track_progress_node(state: InterviewState):

    now = time.time()

    start_time = state.get("start_time")
    if start_time is None:
        start_time = now

    last_activity = state.get("last_activity")
    if last_activity is None:
        last_activity = now

    pause_detected = (now - last_activity) > PAUSE_LIMIT
    ping_count = state.get("ping_count", 0) + 1
    time_up = (now - start_time) >= 900

    return {

        "ping_count": ping_count,
        "start_time": start_time,
        "last_activity": now,
        "pause_detected": pause_detected,
        "time_up": time_up
    }

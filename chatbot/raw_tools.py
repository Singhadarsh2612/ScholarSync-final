"""
chatbot/raw_tools.py
─────────────────────────────────────────────────────────────────────────────
Pure data-access functions — return Python objects (list/dict), never
formatted strings or UI blocks.  LLMs treat these results as grounding data;
the backend converts them to UI when required.

All functions are synchronous.  The Executor wraps them in asyncio.to_thread.
"""

import json
import requests

from endpoints import (
    ASSIGNMENTS_URL as _ASSIGNMENTS_URL,
    MATERIALS_URL as _MATERIALS_URL,
    EXAMS_URL as _EXAMS_URL,
    MARKS_URL as _MARKS_URL,
    ATTENDANCE_URL as _ATTEND_URL,
    EXAM_SCHED_URL as _EXAM_SCHED_URL,
    INTERVIEW_UI_URL as _FRONTEND_BASE,
)


def _load_interview_data():
    """Fetch interview routing from the merged interview service, in-process.

    This used to be an HTTP GET to a separate deployment, executed at import
    time — so a slow or dead host blocked every import of this module. The
    interview service now lives in the same process, so it is a direct call,
    made on demand and cached.
    """
    from interview.main import get_interview_routing

    return get_interview_routing()


_interview_cache = None


def _interview_state():
    """Return (data, mapping), loading and caching on first use."""
    global _interview_cache
    if _interview_cache is None:
        try:
            data = _load_interview_data()
            mapping = {item["question_tag"]: item for item in data}
        except Exception as e:
            print(f"[raw_tools] Interview routing unavailable: {e}")
            data, mapping = [], {}
        _interview_cache = (data, mapping)
    return _interview_cache



def _get(url: str, timeout: int = 55, retries: int = 1):
    """GET with retry — Render free-tier services cold-start in 30-50s."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
    raise last_err




def get_assignments_raw() -> list:
    """Return the student's outstanding assignments as plain dicts.

    Reads the overdue bucket as well as upcoming. Reading only "upcoming" made
    this return [] whenever every assignment was past its due date, so the
    agent reported "no assignments" while the portal listed several.
    """
    try:
        data = _get(_ASSIGNMENTS_URL)
        buckets = data.get("data", {}).get("assignments", {})
        items = [(a, "overdue") for a in buckets.get("overdue", [])]
        items += [(a, "upcoming") for a in buckets.get("upcoming", [])]
        return [
            {
                "title":         a.get("title", "Untitled"),
                "subject":       (a["subject"]["name"] if isinstance(a.get("subject"), dict)
                                  else a.get("subject", "Unknown")),
                "description":   a.get("description", ""),
                "deadline":      a.get("dueDate", ""),
                "status":        status,
                "assignmentDoc": a.get("assignmentDoc", ""),
            }
            for a, status in items
        ]
    except Exception as e:
        return [{"error": str(e)}]


def get_materials_raw() -> list:
    """Return list of study materials as plain dicts."""
    try:
        data = _get(_MATERIALS_URL)
        items = data.get("data", [])
        return [
            {
                "title":        m.get("title", "Untitled"),
                "subject":      m.get("subject", "Unknown"),
                "description":  m.get("description", ""),
                "materialLink": m.get("materialLink", ""),
            }
            for m in items
        ]
    except Exception as e:
        return [{"error": str(e)}]


def get_marks_raw() -> list:
    """Return subject-wise marks and attendance as plain dicts."""
    try:
        marks_data      = _get(_MARKS_URL).get("data", [])
        attendance_data = _get(_ATTEND_URL).get("data", [])

        result = []
        for m in marks_data:
            subject = m.get("subjectId", {}).get("subjectName", "Unknown")
            quizzes = {f"quiz{i}": m.get(f"quiz{i}", 0) for i in range(1, 7)}
            att     = next((a for a in attendance_data if a.get("subjectName") == subject), {})
            result.append({
                "subject":             subject,
                "average_marks":       m.get("average", 0),
                "attendance_percent":  att.get("attendancePercentage", "N/A"),
                "quizzes":             quizzes,
            })
        return result
    except Exception as e:
        return [{"error": str(e)}]


def get_deadlines_raw() -> list:
    """Return upcoming deadlines sorted by urgency."""
    from datetime import datetime
    try:
        res = _get(_EXAM_SCHED_URL)
        if not res.get("success"):
            return [{"error": "Failed to fetch exam schedule"}]
        schedules = res.get("data", {}).get("examSchedules", [])
        now    = datetime.utcnow()
        result = []
        for sched in schedules:
            subject_name = sched.get("subject", {}).get("name", "Unknown")
            for exam_name, details in sched.get("exams", {}).items():
                if not details or not details.get("startTime"):
                    continue
                raw_ts = details["startTime"].replace("Z", "").split(".")[0]
                try:
                    dt = datetime.strptime(raw_ts, "%Y-%m-%dT%H:%M:%S")
                    if dt >= now:
                        result.append({
                            "title":         f"{subject_name} — {exam_name}",
                            "subject":       subject_name,
                            "due_date":      details["startTime"],
                            "days_until_due": (dt - now).days + 1,
                            "priority":      "high" if exam_name.startswith(("mid", "end")) else "medium",
                        })
                except ValueError:
                    pass
        result.sort(key=lambda x: x.get("days_until_due", 9999))
        return result
    except Exception as e:
        return [{"error": str(e)}]


def get_exams_raw() -> list:
    """Return full exam schedule as plain dicts."""
    try:
        res = _get(_EXAM_SCHED_URL)
        if not res.get("success"):
            return [{"error": "Failed to fetch exam schedule"}]
        schedules = res.get("data", {}).get("examSchedules", [])
        result = []
        for sched in schedules:
            subject_name = sched.get("subject", {}).get("name", "Unknown")
            for exam_name, details in sched.get("exams", {}).items():
                if details and details.get("startTime"):
                    result.append({
                        "title":    f"{subject_name} — {exam_name}",
                        "subject":  subject_name,
                        "type":     exam_name,
                        "time":     details.get("startTime", ""),
                        "venue":    details.get("location", "TBA"),
                        "duration": details.get("duration", ""),
                    })
        return result
    except Exception as e:
        return [{"error": str(e)}]


def get_interview_info_raw() -> list:
    """Return coding interview practice scores for all topics."""
    _interview_data, _ = _interview_state()
    if not _interview_data:
        return [{"error": "Interview data unavailable"}]
    return [
        {
            "topic":               item.get("question_tag", "unknown"),
            "attempts":            item.get("number_of_attempts", 0),
            "performance_score":   item.get("performance_score", 0),
            "performance_summary": item.get("description_of_performance", ""),
            "frontend_url":        _FRONTEND_BASE.rstrip("/") + "/"
                                   + item.get("endpoint_redirect", "").lstrip("/"),
        }
        for item in _interview_data
    ]


def _normalise_topic(text: str) -> str:
    """Fold spaces, hyphens and underscores together and lowercase."""
    import re
    return re.sub(r"[\s\-_]+", "_", (text or "").strip().lower())


def _resolve_topic(topic: str, mapping: dict):
    """Best-effort match of a user's phrasing to a stored topic key.

    Exact keys are inconsistent across the system -- Mongo stores
    "two_pointer" while the topics API serves "two-pointers" -- and users type
    plurals. Without this, "graphs" and "two pointers" both failed even though
    both topics exist.
    """
    wanted = _normalise_topic(topic)
    if not wanted:
        return None

    candidates = {_normalise_topic(k): k for k in mapping}

    if wanted in candidates:
        return candidates[wanted]

    # Singular/plural on the final word, in both directions.
    variants = set()
    if wanted.endswith("s"):
        variants.add(wanted[:-1])
    else:
        variants.add(wanted + "s")
    parts = wanted.split("_")
    if parts[-1].endswith("s"):
        variants.add("_".join(parts[:-1] + [parts[-1][:-1]]))
    else:
        variants.add("_".join(parts[:-1] + [parts[-1] + "s"]))
    for variant in variants:
        if variant in candidates:
            return candidates[variant]

    # Containment on de-pluralised word sets, so "graph theory" and "pointers"
    # both land on their topic.
    def stems(value):
        return {w[:-1] if w.endswith("s") and len(w) > 3 else w
                for w in value.split("_") if w}

    wanted_stems = stems(wanted)
    for norm, original in candidates.items():
        if norm in wanted or wanted in norm:
            return original
        if wanted_stems & stems(norm):
            return original

    return None


def prepare_interview_session_raw(topic: str = "") -> dict:
    """Return interview URL + performance stats for a given topic."""
    _, _interview_mapping = _interview_state()
    tag = _resolve_topic(topic, _interview_mapping)
    if tag is None:
        available = ", ".join(sorted(_interview_mapping.keys()))
        return {"error": f"Topic '{topic}' not found. Available: {available}"}
    item     = _interview_mapping[tag]
    endpoint = item.get("endpoint_redirect", "")
    url      = (_FRONTEND_BASE.rstrip("/") + "/" + endpoint.lstrip("/")) if endpoint else ""
    return {
        "topic":               tag,
        "url":                 url,
        "performance_score":   item.get("performance_score", 0),
        "attempts":            item.get("number_of_attempts", 0),
        "performance_summary": item.get("description_of_performance", ""),
    }


def solve_assignment_raw(question: str = "", assignment_url: str = "",
                         material_urls: list = None) -> dict:
    """Provide hints or conceptual help for a question by RAG over a PDF assignment/material."""
    try:
        from assignment_solver import solve_assignment
        result = solve_assignment(question, [], assignment_url, material_urls or [])
        if isinstance(result, dict):
            return result
        return {"answer": str(result)}
    except Exception as e:
        return {"error": str(e)}



import requests as _req

from endpoints import MCP_URL as _MCP_BASE


def _mcp_post(endpoint: str, payload: dict = None) -> str:
    try:
        r = _req.post(f"{_MCP_BASE}{endpoint}", json=payload or {}, timeout=35)
        r.raise_for_status()
        data = r.json()
        if "result" in data:
            return data["result"]
        if data.get("status") == "success":
            if "message" in data:
                return data["message"]
            return json.dumps(data)
        return json.dumps(data)
    except Exception as e:
        return f"MCP error: {e}"


def current_time_raw(**_) -> str:
    return _mcp_post("/tools/current_time")

def calculator_raw(expression: str = "", **_) -> str:
    return _mcp_post("/tools/calculator", {"expression": expression})

def web_search_raw(query: str = "", **_) -> str:
    return _mcp_post("/tools/web_search", {"query": query})

def send_email_raw(to: str = "", subject: str = "", body: str = "", **_) -> str:
    return _mcp_post("/tools/send_email", {"to": to, "subject": subject, "body": body})

def get_subject_professors_raw(**_) -> str:
    return _mcp_post("/tools/get_subject_professors")

def get_student_connections_raw(**_) -> str:
    """Return a list of institute students/mentors/experts available for chat, guidance, and help on subjects like CN, OS, algorithms, etc."""
    return _mcp_post("/tools/get_student_connections")

def create_calendar_event_raw(title: str = "", start_time: str = "",
                               end_time: str = "", reminder_minutes=None, **_) -> str:
    if not start_time or not end_time:
        return "Error: start_time and end_time are REQUIRED. Please ask the user for the missing date or time to schedule the event."
    payload = {"title": title, "start_time": start_time, "end_time": end_time}
    if reminder_minutes is not None:
        payload["reminder_minutes"] = reminder_minutes
    return _mcp_post("/tools/create_calendar_event", payload)

def list_calendar_events_raw(date: str = "", **_) -> str:
    return _mcp_post("/tools/list_calendar_events", {"date": date})

def check_calendar_free_raw(start_time: str = "", end_time: str = "", **_) -> str:
    return _mcp_post("/tools/check_calendar_free",
                     {"start_time": start_time, "end_time": end_time})

def update_event_by_title_raw(title: str = "", start_time: str = "",
                               end_time: str = "", **_) -> str:
    return _mcp_post("/tools/update_event_by_title",
                     {"title": title, "start_time": start_time, "end_time": end_time})

def delete_event_by_title_raw(title: str = "", **_) -> str:
    return _mcp_post("/tools/delete_event_by_title", {"title": title})

def open_interview_in_browser_raw(topic: str = "", **_) -> str:
    """Return the interview URL for the topic (browser-opening handled by frontend card)."""
    result = prepare_interview_session_raw(topic)
    if "error" in result:
        return result["error"]
    return f"Interview session ready. URL: {result['url']}"



TOOL_MAP: dict = {
    "get_assignments_raw":            get_assignments_raw,
    "get_materials_raw":              get_materials_raw,
    "get_marks_raw":                  get_marks_raw,
    "get_deadlines_raw":              get_deadlines_raw,
    "get_exams_raw":                  get_exams_raw,
    "get_interview_info_raw":         get_interview_info_raw,
    "prepare_interview_session_raw":  prepare_interview_session_raw,
    "solve_assignment_raw":           solve_assignment_raw,
    "current_time":                   current_time_raw,
    "calculator":                     calculator_raw,
    "web_search":                     web_search_raw,
    "send_email":                     send_email_raw,
    "get_subject_professors":         get_subject_professors_raw,
    "get_student_connections":        get_student_connections_raw,
    "create_calendar_event":          create_calendar_event_raw,
    "list_calendar_events":           list_calendar_events_raw,
    "check_calendar_free":            check_calendar_free_raw,
    "update_event_by_title":          update_event_by_title_raw,
    "delete_event_by_title":          delete_event_by_title_raw,
    "open_interview_in_browser":      open_interview_in_browser_raw,
}

KNOWN_TOOL_NAMES: set = set(TOOL_MAP.keys())

CONFIRMATION_TOOLS: set = {"send_email", "open_interview_in_browser"}

ONCE_ONLY_TOOLS: set = {
    "send_email", "get_assignments_raw", "get_materials_raw",
    "open_interview_in_browser",
}

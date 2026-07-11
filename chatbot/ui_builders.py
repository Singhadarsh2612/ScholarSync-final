"""
chatbot/ui_builders.py
─────────────────────────────────────────────────────────────────────────────
Backend-only UI block builders.  NEVER called by any LLM.
Takes raw Python objects from raw_tools.py → returns fenced ui_* strings
that postprocess.js knows how to render.
"""

import json

def build_ui_assignments(data) -> str:
    """Convert raw assignments list → ```ui_assignments block."""
    if not data or (isinstance(data, list) and data and "error" in data[0]):
        return ""
    rows = []
    for a in (data if isinstance(data, list) else []):
        rows.append({
            "title":         a.get("title", "Untitled"),
            "subject":       a.get("subject", ""),
            "description":   a.get("description", ""),
            "deadline":      a.get("deadline", a.get("due_date", a.get("dueDate", ""))),
            "assignmentDoc": a.get("assignmentDoc", a.get("document_url", "")),
        })
    if not rows:
        return ""
    return "```ui_assignments\n" + json.dumps(rows, indent=2) + "\n```"


def build_ui_materials(data) -> str:
    """Convert raw materials list → ```ui_materials block."""
    if not data or (isinstance(data, list) and data and "error" in data[0]):
        return ""
    rows = []
    for m in (data if isinstance(data, list) else []):
        rows.append({
            "title":       m.get("title", "Untitled"),
            "subject":     m.get("subject", ""),
            "description": m.get("description", ""),
            "link":        m.get("materialLink", m.get("link", m.get("document_url", ""))),
        })
    if not rows:
        return ""
    return "```ui_materials\n" + json.dumps(rows, indent=2) + "\n```"


def build_ui_interview_confirm(data) -> str:
    """Convert raw interview session dict → ```ui_interview_confirm block."""
    if not data or (isinstance(data, dict) and "error" in data):
        return ""
    payload = {
        "topic":    data.get("topic", ""),
        "url":      data.get("url", ""),
        "score":    data.get("performance_score", 0),
        "attempts": data.get("attempts", 0),
    }
    return "```ui_interview_confirm\n" + json.dumps(payload) + "\n```"


def build_ui_marks(data) -> str:
    """Convert raw marks list → formatted Markdown table (no custom block needed)."""
    if not data or (isinstance(data, list) and data and "error" in data[0]):
        return ""
    lines = ["| Subject | Avg Marks | Attendance |", "|---|---|---|"]
    for m in (data if isinstance(data, list) else []):
        lines.append(
            f"| {m.get('subject', '')} "
            f"| {m.get('average_marks', 0)} "
            f"| {m.get('attendance_percent', 'N/A')} |"
        )
    return "\n".join(lines)


def build_ui_exams(data) -> str:
    """Convert raw exams list → Markdown table."""
    if not data or (isinstance(data, list) and data and "error" in data[0]):
        return ""
    lines = ["| Subject | Type | Date/Time | Venue |", "|---|---|---|---|"]
    for e in (data if isinstance(data, list) else []):
        lines.append(
            f"| {e.get('subject', '')} "
            f"| {e.get('type', '')} "
            f"| {e.get('time', '')} "
            f"| {e.get('venue', 'TBA')} |"
        )
    return "\n".join(lines)


def build_ui_deadlines(data) -> str:
    """Convert raw deadlines list → Markdown table."""
    if not data or (isinstance(data, list) and data and "error" in data[0]):
        return ""
    lines = ["| Title | Days Until Due | Priority |", "|---|---|---|"]
    for d in (data if isinstance(data, list) else []):
        priority_emoji = "⚠️" if d.get("priority") == "high" else ""
        lines.append(
            f"| {d.get('title', '')} "
            f"| {d.get('days_until_due', '?')} "
            f"| {priority_emoji} {d.get('priority', 'medium')} |"
        )
    return "\n".join(lines)



_BUILDER_MAP: dict = {
    "assignments":       (build_ui_assignments,       "get_assignments_raw"),
    "materials":         (build_ui_materials,          "get_materials_raw"),
    "interview_confirm": (build_ui_interview_confirm,  "prepare_interview_session_raw"),
    "marks":             (build_ui_marks,              "get_marks_raw"),
    "exams":             (build_ui_exams,              "get_exams_raw"),
    "deadlines":         (build_ui_deadlines,          "get_deadlines_raw"),
}


def get_ui_tool_name(ui_type: str) -> str:
    """Return the raw tool name that produces data for this ui_type."""
    entry = _BUILDER_MAP.get(ui_type)
    return entry[1] if entry else ""


def build_ui_block(ui_type: str, data) -> str:
    """
    Main entry point called by service.py.
    ui_type  — value from planner/retriever ui_requirement.type
    data     — raw Python object returned by the corresponding raw tool
    Returns  — fenced block string, or "" if nothing to render.
    """
    if not ui_type or ui_type == "none":
        return ""
    entry = _BUILDER_MAP.get(ui_type)
    if not entry:
        return ""
    builder_fn, _ = entry
    try:
        return builder_fn(data)
    except Exception:
        return ""

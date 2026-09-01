"""
endpoints.py
─────────────────────────────────────────────────────────────────────────────
Single source of truth for every external endpoint and identifier the hub
talks to.

Previously these were hardcoded across a dozen modules, which is how the
project ended up pinned to deleted Azure hosts. Everything here is
environment-overridable; the defaults are the known-good public values.

No side effects beyond reading the environment — safe to import anywhere.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str) -> str:
    """Read an env var, falling back to the default when unset or blank."""
    return (os.getenv(name) or "").strip() or default


# ── Student portals (the project's data layer — both live) ──
STUDENT_PORTAL_2_URL = _env(
    "STUDENT_PORTAL_2_URL", "https://student-portal-2-gh1j.onrender.com"
).rstrip("/")
STUDENT_PORTAL_3_URL = _env(
    "STUDENT_PORTAL_3_URL", "https://student-portal-3-tos6.onrender.com"
).rstrip("/")

# Two portals, two different student records.
STUDENT_ID   = _env("STUDENT_ID", "69ad240e7352e15b1e37b844")    # portal 3
STUDENT_ID_2 = _env("STUDENT_ID_2", "69abdbea843e1db183a2b20f")  # portal 2

# ── Portal 3: assignments, materials, exams ──
ASSIGNMENTS_URL = f"{STUDENT_PORTAL_3_URL}/api/student/{STUDENT_ID}/assignments"
MATERIALS_URL   = f"{STUDENT_PORTAL_3_URL}/materials"
EXAMS_URL       = f"{STUDENT_PORTAL_3_URL}/api/student/{STUDENT_ID}/exams"

# ── Portal 2: marks, attendance, exam schedule, subjects ──
MARKS_URL      = f"{STUDENT_PORTAL_2_URL}/api/student/{STUDENT_ID_2}/marks"
ATTENDANCE_URL = f"{STUDENT_PORTAL_2_URL}/api/student/{STUDENT_ID_2}/attendance"
EXAM_SCHED_URL = f"{STUDENT_PORTAL_2_URL}/api/student/{STUDENT_ID_2}/exam-schedule"
SUBJECTS_URL   = f"{STUDENT_PORTAL_2_URL}/api/student/{STUDENT_ID_2}/subjects"

# Portal 2 also serves an assignments feed, used by the sync worker.
PORTAL_2_ASSIGNMENTS_URL = f"{STUDENT_PORTAL_2_URL}/api/student/{STUDENT_ID_2}/assignments"

# ── MCP tool server ──
# Not localhost under Docker Compose, where it is a separate container.
MCP_URL = _env("MCP_URL", "http://127.0.0.1:8002").rstrip("/")

# ── Expert chat service (MERN) ──
CHAT_API_URL = _env("CHAT_API_URL", "http://localhost:5000").rstrip("/")
CHAT_STUDENT_ID = _env("CHAT_STUDENT_ID", "test-user-123")

# ── This deployment's own public base URL ──
# Used only to build user-facing links (e.g. "open your interview here").
# The interview UI is a separate origin from the API.
PUBLIC_BASE_URL   = _env("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
INTERVIEW_UI_URL  = _env("INTERVIEW_UI_URL", "http://localhost:3001").rstrip("/")

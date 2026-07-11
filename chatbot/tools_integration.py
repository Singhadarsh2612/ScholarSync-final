from langchain_core.tools import tool
import json
import requests
import webbrowser
from assignment_solver import solve_assignment
from analysis_api import fetch_student_data

INTERVIEW_ROUTING_API = "https://scholarsync-aps-backend.azurewebsites.net/api/interview_routing"
FRONTEND_BASE          = "https://scholarsync-aps-client.azurewebsites.net"

try:
    _interview_response = requests.get(INTERVIEW_ROUTING_API, timeout=15)
    _interview_response.raise_for_status()
    _interview_data    = _interview_response.json()
    _interview_mapping = {item["question_tag"]: item for item in _interview_data}
except Exception as _e:
    print(f"[Interview] Warning: could not pre-fetch routing data: {_e}")
    _interview_data    = []
    _interview_mapping = {}

ASSIGNMENTS_API = "https://student-portal-3-tos6.onrender.com/api/student/69ad240e7352e15b1e37b844/assignments"
MATERIALS_API  = "https://student-portal-3-tos6.onrender.com/materials"
EXAMS_API      = "https://student-portal-3-tos6.onrender.com/api/student/69ad240e7352e15b1e37b844/exams"
MARKS_API      = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/marks"
ATTENDANCE_API = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/attendance"


@tool
def solve_assignment_tool(question: str, assignment_url: str = "", material_urls: list[str] = None) -> str:
    """
    Answers a specific question by reading the content of a PDF assignment or material.
    Pass the document URL to assignment_url, and optionally supplementary material URLs to material_urls.
    Use this AFTER getting URLs from get_assignments_tool or get_materials_tool.
    Returns the generated answer based on document content.
    """
    print("[Tool] solve_assignment_tool called")
    if material_urls is None:
        material_urls = []

    try:
        res = solve_assignment(question, assignment_url, material_urls)
        return res.get("answer", "No answer could be generated.")
    except Exception as e:
        return f"Error analyzing assignment: {str(e)}"


@tool
def get_assignments_tool() -> str:
    """
    Fetches the student's upcoming assignments from the student portal.
    Returns a list of assignments with their titles, due dates, subjects, and document URLs.
    Use this when the user asks about their assignments, what is due, or wants to answer questions about an assignment.
    """
    print("[Tool] get_assignments_tool called")
    try:
        r = requests.get(ASSIGNMENTS_API, timeout=15)
        if r.status_code != 200:
            return "Failed to fetch assignments from the student portal."
        res = r.json()
        assignments = res.get("data", {}).get("assignments", {}).get("upcoming", [])
        if not assignments:
            return "No upcoming assignments found."
        result = []
        for a in assignments:
            result.append({
                "title": a.get("title", "Untitled"),
                "subject": a.get("subject", {}).get("name", "Unknown") if isinstance(a.get("subject"), dict) else a.get("subject", "Unknown"),
                "description": a.get("description", "No description provided"),
                "due_date": a.get("dueDate", "No due date"),
                "document_url": a.get("assignmentDoc", "")
            })
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error fetching assignments: {str(e)}"


@tool
def get_materials_tool() -> str:
    """
    Fetches the student's uploaded course study materials from the student portal.
    Returns a list of materials with their titles, subjects, descriptions, and document URLs.
    Use this when the user asks about their course materials, notes, or wants to learn from a specific material.
    """
    print("[Tool] get_materials_tool called")
    try:
        r = requests.get(MATERIALS_API, timeout=15)
        if r.status_code != 200:
            return "Failed to fetch materials from the student portal."
        res = r.json()
        materials = res.get("data", [])
        if not materials:
            return "No course materials found."
        result = []
        for m in materials:
            result.append({
                "title": m.get("title", "Untitled"),
                "subject": m.get("subject", "Unknown"),
                "description": m.get("description", "No description provided"),
                "document_url": m.get("materialLink", "")
            })
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error fetching materials: {str(e)}"


@tool
def student_performance_tool() -> str:
    """
    Fetches the student's live marks, attendance, and grades from the university portal.
    Use this to see how the student is performing academically or if they have low attendance.
    Returns JSON raw data.
    """
    print("[Tool] student_performance_tool called")
    try:
        data = fetch_student_data()
        return json.dumps(data, indent=2)
    except Exception as e:
        return f"Error fetching student data: {str(e)}"


@tool
def get_marks_tool() -> str:
    """
    Fetches the student's subject-wise marks and quiz scores from the university marks portal.
    Use this when the user asks about their marks, scores, grades, quiz results, or academic performance.
    Returns each subject's quiz scores and average.
    """
    print("[Tool] get_marks_tool called")
    try:
        marks_res = requests.get(MARKS_API, timeout=15).json()
        attendance_res = requests.get(ATTENDANCE_API, timeout=15).json()

        marks_data = marks_res.get("data", [])
        attendance_data = attendance_res.get("data", [])

        result = []
        for m in marks_data:
            subject = m.get("subjectId", {}).get("subjectName", "Unknown")
            quizzes = {
                f"quiz{i}": m.get(f"quiz{i}", 0) for i in range(1, 7)
            }
            attendance_info = next(
                (a for a in attendance_data if a.get("subjectName") == subject), {}
            )
            result.append({
                "subject": subject,
                "average_marks": m.get("average", 0),
                "attendance_percent": attendance_info.get("attendancePercentage", "N/A"),
                "quizzes": quizzes
            })
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error fetching marks: {str(e)}"


EXAM_SCHEDULE_API = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/exam-schedule"


@tool
def get_deadlines_tool() -> str:
    """
    Fetches all upcoming assignment deadlines or exam/quiz dates for the student from the portal.
    Use this when the user asks about upcoming deadlines, exam times, due dates, what's due soon, or time remaining.
    """
    print("[Tool] get_deadlines_tool called")
    try:
        from datetime import datetime
        r = requests.get(EXAM_SCHEDULE_API, timeout=15)
        if r.status_code != 200:
            return "Failed to fetch deadlines from the student portal."
        res = r.json()
        
        if not res.get("success"):
            return "Failed to fetch item data from students dashboard."

        schedules = res.get("data", {}).get("examSchedules", [])

        result = []
        now = datetime.utcnow()

        for sched in schedules:
            subject = sched.get("subject", {})
            subject_name = subject.get("name", "Unknown Subject")
            exams = sched.get("exams", {})

            for exam_name, details in exams.items():
                if not details or not details.get("startTime"):
                    continue

                start_time_str = details.get("startTime")
                try:
                    clean_str = start_time_str.replace("Z", "")
                    if "." in clean_str:
                        clean_str = clean_str.split(".")[0]
                    exam_dt = datetime.strptime(clean_str, "%Y-%m-%dT%H:%M:%S")
                    
                    if exam_dt >= now:
                        days_until = (exam_dt - now).days + 1
                        result.append({
                            "title": f"{subject_name} - {exam_name}",
                            "subject": subject_name,
                            "due_date": start_time_str,
                            "days_until_due": days_until,
                            "status": "upcoming",
                            "priority": "high" if exam_name.startswith("mid") or exam_name.startswith("end") else "medium"
                        })
                except Exception:
                    pass

        result.sort(key=lambda x: x.get("days_until_due") if isinstance(x.get("days_until_due"), (int, float)) else 9999)
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error fetching deadlines from schedule: {str(e)}"






@tool
def get_exams_tool() -> str:
    """
    Fetches the student's scheduled exams, quizzes, and tests from the student portal.
    Use this ALWAYS when the user asks about:
      - "when is my quiz" / "when is the exam" / "what is the exam date"
      - "do I have any tests" / "upcoming exams"
      - ANY question about the schedule of a quiz, mid-term, final, or test
    Returns exam details including subject, type (quiz/mid/final), date, time, and venue.
    NEVER guess exam dates — always call this tool first.
    """
    print("[Tool] get_exams_tool called")
    try:
        r = requests.get(EXAM_SCHEDULE_API, timeout=15)
        if r.status_code != 200:
            return "Failed to fetch exam schedule from the portal."
            
        res = r.json()
        if not res.get("success"):
            return "Failed to fetch item data from students dashboard."

        schedules = res.get("data", {}).get("examSchedules", [])
        if not schedules:
            return "No upcoming exams found in the student portal."

        result = []
        for sched in schedules:
            subject = sched.get("subject", {})
            subject_name = subject.get("name", "Unknown Subject")
            exams = sched.get("exams", {})

            for exam_name, details in exams.items():
                if not details or not details.get("startTime"):
                    continue

                result.append({
                    "title": f"{subject_name} - {exam_name}",
                    "subject": subject_name,
                    "type": exam_name,
                    "time": details.get("startTime", ""),
                    "venue": details.get("location", "TBA"),
                    "duration": details.get("duration", "")
                })
        
        if not result:
            return "No valid exam dates found in the schedule."
            
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error fetching exam schedule: {str(e)}"



@tool
def get_interview_info_tool() -> str:
    """
    Returns the student's coding interview practice performance for ALL topics
    from the ScholarSync interview routing system.
    Topics include: binary_search, graph, greedy, math, two_pointer (and more).
    Each entry includes: question_tag, number_of_attempts, performance_score (0-100),
    and a description_of_performance summarising past attempts.

    USE THIS TOOL (not marks tools) when the user asks ANY of:
    - "how am I doing on binary search / graph / greedy / math / two pointer"
    - "what is my score / performance on [coding topic]"
    - "show my interview practice results"
    - "how many attempts have I done on [topic]"
    - any question about coding interview practice progress or scores
    NEVER use the marks or attendance tools for these questions.
    """
    print("[Tool] get_interview_info_tool called")
    if not _interview_data:
        return "Interview routing data is currently unavailable."
    result = []
    for item in _interview_data:
        result.append({
            "topic":                  item.get("question_tag", "unknown"),
            "attempts":               item.get("number_of_attempts", 0),
            "performance_score":      item.get("performance_score", 0),
            "performance_summary":    item.get("description_of_performance", ""),
            "frontend_url":           FRONTEND_BASE.rstrip("/") + "/" + item.get("endpoint_redirect", "").lstrip("/")
        })
    return json.dumps(result, indent=2)


@tool
def prepare_interview_session_tool(topic: str) -> str:
    """
    Looks up the ScholarSync interview practice page for the given coding topic
    and returns the URL + the student's current performance stats.
    Does NOT open the browser - it is used to CONFIRM with the user first.

    'topic' must be one of: 'graph', 'binary_search', 'greedy', 'math', 'two_pointer'.
    Spaces and mixed case are fine (e.g. 'binary search', 'Binary Search').

    USE THIS TOOL (not calendar or task tools) when the user says any of:
    - "schedule / start / book a [topic] interview"
    - "I want to do a graph / greedy / math / two pointer / binary search interview"
    - "practice [topic]" (e.g. "practice binary search", "practice graphs")
    
    CRITICAL INSTRUCTION: You MUST output the exact `ui_interview_confirm` JSON block shown in your system prompt using the returned data. DO NOT describe the interview details in text.
    """
    print(f"[Tool] prepare_interview_session_tool called with topic={topic!r}")
    tag = topic.strip().lower().replace(" ", "_")
    if tag not in _interview_mapping:
        available = ", ".join(sorted(_interview_mapping.keys()))
        return (
            f"Topic '{topic}' not found. Available topics: {available}."
        )
    endpoint = _interview_mapping[tag].get("endpoint_redirect", "")
    if not endpoint:
        return f"No interview page configured for '{topic}'."
    url = FRONTEND_BASE.rstrip("/") + "/" + endpoint.lstrip("/")
    perf  = _interview_mapping[tag].get("performance_score", 0)
    tries = _interview_mapping[tag].get("number_of_attempts", 0)
    summary = _interview_mapping[tag].get("description_of_performance", "")
    return json.dumps({
        "topic": tag,
        "url": url,
        "full_interview_link": url,
        "performance_score": perf,
        "attempts": tries,
        "performance_summary": summary,
        "IMPORTANT": f"The interview link is: {url} — ALWAYS use this FULL URL when mentioning the interview link. NEVER use a relative path."
    }, indent=2)


@tool
def open_interview_in_browser_tool(topic: str) -> str:
    """
    Opens the ScholarSync coding interview page for the given topic in the user's
    browser. ONLY call this tool AFTER the user has explicitly confirmed they want
    to be redirected (e.g. they replied 'yes', 'open it', 'go ahead', 'redirect me').

    'topic' must be one of: 'graph', 'binary_search', 'greedy', 'math', 'two_pointer'.
    Returns a confirmation message with the URL that was opened.
    """
    print(f"[Tool] open_interview_in_browser_tool called with topic={topic!r}")
    tag = topic.strip().lower().replace(" ", "_")
    if tag not in _interview_mapping:
        available = ", ".join(sorted(_interview_mapping.keys()))
        return f"Topic '{topic}' not found. Available: {available}."
    endpoint = _interview_mapping[tag].get("endpoint_redirect", "")
    if not endpoint:
        return f"No interview page configured for '{topic}'."
    url = FRONTEND_BASE.rstrip("/") + "/" + endpoint.lstrip("/")
    try:
        webbrowser.open(url)
        opened = True
    except Exception:
        opened = False
    perf  = _interview_mapping[tag].get("performance_score", 0)
    tries = _interview_mapping[tag].get("number_of_attempts", 0)
    status = "opened in your browser" if opened else "ready (could not auto-open browser)"
    return (
        f"✅ Interview session for **{tag}** {status}.\n"
        f"URL: {url}\n"
        f"Current performance: {perf}/100 over {tries} attempt(s)."
    )

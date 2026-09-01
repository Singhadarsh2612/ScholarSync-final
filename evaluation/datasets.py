"""Golden cases. Data only — the runner supplies the behaviour.

Cases marked `regression` reproduce bugs that shipped, so a future change that
reintroduces one fails here instead of in front of a student:

  assignments-overdue-os  get_assignments_raw read only the "upcoming" bucket,
                          so the agent denied assignments the portal listed.
  interview-graphs        topic lookup was an exact dict hit, so the plural
                          "graphs" missed the stored key "graph".
  interview-two-pointers  Mongo stored "two_pointer" while the topics API
                          served "two-pointers"; the natural phrasing failed.
"""

AGENT_CASES = [
    {
        "id": "assignments-overdue-os",
        "regression": True,
        "question": "List only my overdue Operating Systems assignments.",
        "expected": (
            "There is exactly one overdue Operating Systems assignment: "
            "'Process Scheduling Algorithms', about comparing FCFS, SJF and "
            "Round Robin, due 2026-04-15. The answer must NOT claim there are "
            "no overdue Operating Systems assignments."
        ),
        "expected_tools": ["get_assignments_raw"],
    },
    {
        "id": "assignments-upcoming-empty",
        "question": "Do I have any assignments that are not yet past their due date?",
        "expected": (
            "The portal's 'upcoming' bucket is empty — every assignment is "
            "either overdue or completed. Saying there are none upcoming is "
            "correct; inventing upcoming ones is wrong."
        ),
        "expected_tools": ["get_assignments_raw"],
    },
    {
        "id": "marks-weakest-subject",
        "question": "Which subject am I weakest in based on my marks? One line.",
        "expected": (
            "Data Structures and Algorithms is the weakest subject, average "
            "around 52."
        ),
        "expected_tools": ["get_marks_raw"],
    },
    {
        "id": "no-such-subject",
        "question": "What was my score in Quantum Cryptography?",
        "expected": (
            "There is no Quantum Cryptography subject. The five real subjects "
            "are Data Structures and Algorithms, Database Management Systems, "
            "Operating Systems, Computer Networks and Software Engineering. "
            "The answer must say it has no such record rather than invent a score."
        ),
    },
    {
        "id": "interview-graphs",
        "regression": True,
        "question": "I want to practise graphs",
        "expected": (
            "Offers the 'graph' practice topic with a session link, without "
            "asking the student to rename their request or claiming no graph "
            "topic exists."
        ),
        "expected_tools": ["prepare_interview_session_raw"],
    },
    {
        "id": "interview-two-pointers",
        "regression": True,
        "question": "set up a two pointers interview for me",
        "expected": (
            "Offers the two-pointer practice topic with a session link. Must "
            "not claim the topic does not exist."
        ),
        "expected_tools": ["prepare_interview_session_raw"],
    },
    {
        "id": "exams-schedule",
        "question": "When is my Operating Systems mid-semester exam?",
        "expected": "The Operating Systems mid-semester exam is on 2026-03-29.",
    },
    {
        "id": "multi-tool-priority",
        "question": (
            "List my overdue assignments and cross-check them against my exam "
            "schedule, then tell me what to do first. Be brief."
        ),
        "expected": (
            "Names real overdue assignments (Process Scheduling Algorithms, "
            "Socket Programming, REST API Development, Unit Testing Project, "
            "SQL Query Optimization, Frontend Development Challenge) AND real "
            "exam dates, then gives a priority order. Must not claim it has no "
            "assignment data."
        ),
    },
]

# Set of PDFs the RAG cases run against. Sourced from the live student portal.
OS_ASSIGNMENT_PDF = (
    "https://drive.google.com/file/d/1XzpGp7BN1RMZ7XrDFN7hW_u_fpalGNJF/view"
)

RAG_CASES = [
    {
        "id": "rag-scheduling-algorithms",
        "doc": OS_ASSIGNMENT_PDF,
        "question": "Name two CPU scheduling algorithms this assignment mentions.",
    },
    {
        "id": "rag-round-robin-detail",
        "doc": OS_ASSIGNMENT_PDF,
        "question": "What does this assignment ask about Round Robin scheduling?",
    },
    {
        "id": "rag-absent-topic",
        "doc": OS_ASSIGNMENT_PDF,
        "question": "What does this assignment say about blockchain consensus?",
        "expect_refusal": True,
        "note": (
            "Not in the document. A faithful answer says so; inventing "
            "blockchain content is the failure this case exists to catch."
        ),
    },
    {
        "id": "rag-out-of-scope-but-related",
        "doc": OS_ASSIGNMENT_PDF,
        "question": "What grade will I get for this assignment?",
        "expect_refusal": True,
        "note": "Unknowable from the document; must decline rather than guess.",
    },
]

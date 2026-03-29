from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class InterviewState(TypedDict):

    messages: Annotated[list[AnyMessage], add_messages]
    problem_statement: str
    current_code: str
    compiler_output: str

    code_analysis: str
    ping_count: int
    start_time: float
    last_activity: float

    time_up: bool
    pause_detected: bool
    audio: str
    session_id: str

    hint_level: int
    resume_data: dict

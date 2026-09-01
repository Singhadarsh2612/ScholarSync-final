from pydantic import BaseModel
from typing import List, Optional


class CodeUpdatePayload(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    problem_statement: str
    current_code: str
    compiler_output: str


class RunCodePayload(BaseModel):
    code: str
    input: str = ""


class AIRequestPayload(BaseModel):
    code: str
    problemId: int
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    time_taken: Optional[int] = 0


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequestPayload(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    code: str
    problemId: int
    history: List[ChatMessage] = []   # conversation history for multi-turn context

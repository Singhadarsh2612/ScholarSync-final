from langchain_core.messages import SystemMessage
from app.services.llm import get_llm
from app.state import InterviewState

def wrapup_node(state: InterviewState):
    llm = get_llm("interview")

    sys = SystemMessage(content="""
Interview time finished.

Give encouraging feedback.
2 sentences only.
""")

    response = llm.invoke(
        [sys] + state.get("messages", [])
    )

    return {
        "messages": [response]
    }

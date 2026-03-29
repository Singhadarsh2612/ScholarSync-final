from langchain_core.messages import SystemMessage
from app.services.llm import get_llm
from app.state import InterviewState

def feedback_node(state: InterviewState):
    llm = get_llm("interview")

    sys = SystemMessage(content="""
You are a friendly technical interviewer. 
Provide a very short (1-2 sentences) spoken feedback about the candidate's current approach.
Use an encouraging and supportive tone.
Do not reveal the solution.
Focus on guiding them gently if they are off-track or cheering them on if they are doing well.
""")

    try:
        response = llm.invoke(
            [sys] + state.get("messages", [])
        )
    except Exception as e:
        print(f"Feedback Error: {e}", flush=True)
        raise e

    return {
        "messages": [response]
    }

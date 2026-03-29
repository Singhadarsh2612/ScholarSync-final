from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm import get_llm
from app.state import InterviewState
from app.services.session_store import save_session
from app.services.speech_service import text_to_speech_base64

def interviewer_node(state: InterviewState):
    llm = get_llm("interview")
    
    context = f"""
Problem:
{state.get("problem_statement")}

Code:
{state.get("current_code")}

Analysis:
{state.get("code_analysis")}
"""

    sys = SystemMessage(content="""
You are a technical interviewer.

Ask one conceptual question.
Do not reveal the answer.
Keep it short.
""")

    try:
        response = llm.invoke(
            [sys] +
            state.get("messages", []) +
            [HumanMessage(content=context)]
        )
    except Exception as e:
        print(f"LLM Error in interviewer_node: {e}", flush=True)
        raise e

    question_text = response.content

    # generate speech
    try:
        audio_base64 = text_to_speech_base64(question_text)
    except Exception as e:
        print(f"Speech Error in interviewer_node: {e}", flush=True)
        audio_base64 = None

    # update state
    state["messages"].append(response)

    # save to cosmos
    save_session(state)

    return {
        "messages": [response],
        "audio": audio_base64
    }
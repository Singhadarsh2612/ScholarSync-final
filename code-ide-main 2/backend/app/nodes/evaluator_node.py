from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm import get_llm
from app.state import InterviewState
from app.services.session_store import save_session

def evaluator_node(state: InterviewState):
    llm = get_llm("analysis")

    context = f"""
Problem:
{state.get("problem_statement")}

Code:
{state.get("current_code")}

Compiler Output:
{state.get("compiler_output")}
"""

    sys = SystemMessage(content="""
You are a senior engineer reviewing candidate code.

Provide bullet points about:
- bugs
- algorithm issues
- complexity concerns
""")

    try:
        response = llm.invoke([
            sys,
            HumanMessage(content=context)
        ])
    except Exception as e:
        print(f"Evaluator Error: {e}", flush=True)
        raise e

    analysis = response.content
    state["code_analysis"] = analysis
    
    save_session(state)

    return {"code_analysis": analysis}

from langchain_core.messages import SystemMessage
from app.services.llm import get_llm
from app.state import InterviewState

def hint_node(state: InterviewState):
    llm = get_llm("hint")
    
    # Get and increment hint level
    current_level = state.get("hint_level", 0) + 1
    if current_level > 5:
        current_level = 5
    
    level_instructions = {
        1: "Level 1: Provide a very subtle conceptual hint. Do not mention specific data structures or algorithms.",
        2: "Level 2: Mention the specific data structure or technique involved (e.g., 'Have you considered using a Hash Map?').",
        3: "Level 3: Explain the reasoning behind the approach without giving away the full logic.",
        4: "Level 4: Describe the algorithm at a high level, explaining the steps.",
        5: "Level 5: Provide the complete technical hint or solution direction."
    }
    
    instruction = level_instructions.get(current_level, level_instructions[5])

    sys = SystemMessage(content=f"""
You are a warm, encouraging senior technical interviewer. 
The candidate is stuck and asked for a hint.

Your goal is to provide a {instruction}

Constraints:
- Use a supportive and friendly tone (e.g., 'No worries, you're doing well!', 'Let's rethink this slightly').
- 1-2 sentences only.
- Do not provide code.
- Be a mentor, not just an evaluator.
""")

    try:
        response = llm.invoke(
            [sys] + state.get("messages", [])
        )
    except Exception as e:
        print(f"Hint Error: {e}", flush=True)
        raise e

    return {
        "messages": [response],
        "hint_level": current_level
    }

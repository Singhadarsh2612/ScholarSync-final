"""
chatbot/agents.py
─────────────────────────────────────────────────────────────────────────────
In the new architecture, agents.py owns only the Critic node.
All other agents (Planner, Explorers, Executor, Exploiter, PresentationAgent,
SimpleRetriever) live in swarm_agents.py.
"""

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from chatbot.llm import llm_mini_2
from chatbot.prompts import CRITIC_SYSTEM


async def critic_node(state: dict) -> dict:
    """
    Critic — reviews the conversation and decides APPROVE or RETRY.
    Short-circuits to APPROVE for redirects and interview confirm cards.
    Uses llm_mini_2 (key2) — lightweight check.
    """
    for m in reversed(state.get("messages", [])):
        if getattr(m, "type", "") == "ai" and m.content:
            if "[REDIRECT:" in m.content or "ui_interview_confirm" in m.content:
                return {
                    "critic_feedback":   "APPROVE",
                    "critic_iterations": state.get("critic_iterations", 0),
                    "messages":          [],
                }

    clean = []
    for m in state.get("messages", [])[-8:]:
        if getattr(m, "type", "") == "human":
            clean.append(HumanMessage(content=m.content))
        elif getattr(m, "type", "") == "ai" and m.content:
            clean.append(AIMessage(content=m.content))

    res = await llm_mini_2.ainvoke(
        [SystemMessage(content=CRITIC_SYSTEM)] + clean
    )
    feedback = res.content or "APPROVE"
    iterations = state.get("critic_iterations", 0) + 1

    extra_msgs = []
    if "APPROVE" not in feedback.upper():
        extra_msgs = [HumanMessage(
            content=f"CRITIC FEEDBACK: {feedback}\n\nPlease revise your response."
        )]

    return {
        "critic_feedback":   feedback,
        "critic_iterations": iterations,
        "messages":          extra_msgs,
    }
"""
chatbot/graph.py
─────────────────────────────────────────────────────────────────────────────
Dual-path LangGraph StateGraph — production multi-LLM architecture.

SIMPLE PATH:
  START → ComplexityAnalyzer → SimpleRetriever → ExecutorNode
        → ExploiterNode → PresentationAgent → Critic → END

COMPLEX PATH:
  START → ComplexityAnalyzer → Planner(GPT-4o)
        → ToolHeavyExplorer → MinimalExplorer → BalancedExplorer
        → FitnessEvaluator → ExecutorNode
        → ExploiterNode → PresentationAgent → Critic → END

Critic RETRY routes back to ExploiterNode (tools NOT re-run).
"""

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END

from chatbot.agents import critic_node
from chatbot.swarm_agents import (
    complexity_analyzer_node,
    simple_retriever_node,
    planner_node,
    run_tool_heavy_explorer,
    run_minimal_explorer,
    run_balanced_explorer,
    fitness_evaluator_node,
    executor_node,
    exploiter_node,
    presentation_agent_node,
)



class MultiAgentState(TypedDict):
    messages:           Annotated[list[BaseMessage], operator.add]

    complexity:         str       # "simple" | "complex"
    complexity_reason:  str

    simple_tool_call:   dict      # raw output from SimpleRetriever

    planner_goal:       str
    planner_steps:      list      # structured steps from Planner

    execution_plan:     list      # [{tool, parameters, order, requires_confirmation, use_output_as}]

    ui_requirement:     dict      # {required: bool, type: str}

    pending_email:          dict      # {to, subject, body} — set when draft shown; cleared after send
    pending_interview_topic: str      # set when interview card shown; cleared after open

    explorer_outputs:   list      # 3 explorer dicts [{plan: [...], explorer: name}]

    execution_results:  list      # [{tool, skipped, result, result_str, use_output_as}]

    exploiter_text:     str       # logical text from ExploiterNode
    final_response:     str       # formatted text from PresentationAgent

    critic_feedback:    str
    critic_iterations:  int



def route_complexity(state: MultiAgentState):
    if state.get("complexity") == "complex":
        return "Planner"
    return "SimpleRetriever"


def route_critic(state: MultiAgentState):
    feedback:   str = state.get("critic_feedback", "") or ""  # type: ignore[assignment]
    iterations: int = state.get("critic_iterations", 0) or 0  # type: ignore[assignment]
    approved   = iterations >= 2 or "APPROVE" in feedback.upper()
    return END if approved else "ExploiterNode"



builder = StateGraph(MultiAgentState)

builder.add_node("ComplexityAnalyzer",   complexity_analyzer_node)
builder.add_node("SimpleRetriever",      simple_retriever_node)
builder.add_node("Planner",              planner_node)
builder.add_node("ToolHeavyExplorer",    run_tool_heavy_explorer)
builder.add_node("MinimalExplorer",      run_minimal_explorer)
builder.add_node("BalancedExplorer",     run_balanced_explorer)
builder.add_node("FitnessEvaluator",     fitness_evaluator_node)
builder.add_node("ExecutorNode",         executor_node)
builder.add_node("ExploiterNode",        exploiter_node)
builder.add_node("PresentationAgent",    presentation_agent_node)
builder.add_node("Critic",               critic_node)

builder.add_edge(START, "ComplexityAnalyzer")

builder.add_conditional_edges(
    "ComplexityAnalyzer",
    route_complexity,
    {"SimpleRetriever": "SimpleRetriever", "Planner": "Planner"},
)

builder.add_edge("SimpleRetriever", "ExecutorNode")

builder.add_edge("Planner",            "ToolHeavyExplorer")
builder.add_edge("ToolHeavyExplorer",  "MinimalExplorer")
builder.add_edge("MinimalExplorer",    "BalancedExplorer")
builder.add_edge("BalancedExplorer",   "FitnessEvaluator")
builder.add_edge("FitnessEvaluator",   "ExecutorNode")

builder.add_edge("ExecutorNode",       "ExploiterNode")
builder.add_edge("ExploiterNode",      "PresentationAgent")
builder.add_edge("PresentationAgent",  "Critic")

builder.add_conditional_edges(
    "Critic",
    route_critic,
    {"ExploiterNode": "ExploiterNode", END: END},
)

graph = builder.compile()
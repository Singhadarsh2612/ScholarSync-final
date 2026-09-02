"""
chatbot/graph.py
─────────────────────────────────────────────────────────────────────────────
Dual-path LangGraph StateGraph — production multi-LLM architecture.

SIMPLE PATH:
  START → ComplexityAnalyzer → SimpleRetriever → ExecutorNode
        → ExploiterNode → PresentationAgent → Critic → END

COMPLEX PATH:
  START → ComplexityAnalyzer → Planner(GPT-4o)
        → ToolHeavyExplorer ┐
          MinimalExplorer   ├→ FitnessEvaluator → ExecutorNode
          BalancedExplorer  ┘
        → ExploiterNode → PresentationAgent → Critic → END

The three explorers run concurrently in one superstep; FitnessEvaluator waits
for all three.

Critic RETRY routes back to ExploiterNode (tools NOT re-run).
"""

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END

import observability
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



def merge_explorer_outputs(existing: list, incoming: list) -> list:
    """Reducer for the parallel explorer fan-out.

    The three explorers write this key in the same superstep, so it needs a
    reducer rather than last-write-wins. It cannot be plain `operator.add`:
    ComplexityAnalyzer clears the key with `[]` at the start of every turn, and
    under a concatenating reducer that reset becomes a no-op, leaking each
    turn's plans into the next one for the life of the thread. An empty write
    therefore resets.
    """
    if not incoming:
        return []
    return (existing or []) + list(incoming)


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

    # 3 explorer dicts [{plan: [...], explorer: name}], written concurrently.
    explorer_outputs:   Annotated[list, merge_explorer_outputs]

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


def _add_node(name, fn):
    """Register a node wrapped in a tracing span.

    Wrapping here rather than decorating each node keeps instrumentation out of
    the agent code, and observe_node is a pass-through when tracing is off.
    """
    builder.add_node(name, observability.observe_node(name)(fn))


_add_node("ComplexityAnalyzer",   complexity_analyzer_node)
_add_node("SimpleRetriever",      simple_retriever_node)
_add_node("Planner",              planner_node)
_add_node("ToolHeavyExplorer",    run_tool_heavy_explorer)
_add_node("MinimalExplorer",      run_minimal_explorer)
_add_node("BalancedExplorer",     run_balanced_explorer)
_add_node("FitnessEvaluator",     fitness_evaluator_node)
_add_node("ExecutorNode",         executor_node)
_add_node("ExploiterNode",        exploiter_node)
_add_node("PresentationAgent",    presentation_agent_node)
_add_node("Critic",               critic_node)

builder.add_edge(START, "ComplexityAnalyzer")

builder.add_conditional_edges(
    "ComplexityAnalyzer",
    route_complexity,
    {"SimpleRetriever": "SimpleRetriever", "Planner": "Planner"},
)

builder.add_edge("SimpleRetriever", "ExecutorNode")

# The explorers are independent: each reads the same planner_steps and emits
# its own candidate plan, none reads another's output. Fanning them out runs
# all three in one superstep, so the stage costs one explorer's latency
# instead of the sum of three. FitnessEvaluator fans back in and waits for
# all of them. Token cost is unchanged -- this buys wall-clock only.
EXPLORERS = ("ToolHeavyExplorer", "MinimalExplorer", "BalancedExplorer")

for _explorer in EXPLORERS:
    builder.add_edge("Planner", _explorer)
    builder.add_edge(_explorer, "FitnessEvaluator")

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
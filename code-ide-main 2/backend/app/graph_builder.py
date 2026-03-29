from langgraph.graph import StateGraph, START, END

from app.state import InterviewState

from app.nodes.tracker_node import track_progress_node
from app.nodes.evaluator_node import evaluator_node
from app.nodes.interviewer_node import interviewer_node
from app.nodes.hint_node import hint_node
from app.nodes.feedback_node import feedback_node
from app.nodes.wrapup_node import wrapup_node


def route_next(state: InterviewState):

    if state.get("time_up"):
        return "wrap_up"

    if state.get("pause_detected"):
        return "hint"

    if state.get("ping_count") % 3 == 0:
        return "evaluate"

    return END


def build_graph(checkpointer):

    builder = StateGraph(InterviewState)

    builder.add_node("tracker", track_progress_node)

    builder.add_node("evaluate", evaluator_node)

    builder.add_node("interviewer", interviewer_node)

    builder.add_node("hint", hint_node)

    builder.add_node("feedback", feedback_node)

    builder.add_node("wrap_up", wrapup_node)

    builder.add_edge(START, "tracker")

    builder.add_conditional_edges(
        "tracker",
        route_next
    )

    builder.add_edge("evaluate", "interviewer")

    builder.add_edge("interviewer", "feedback")

    builder.add_edge("feedback", END)

    builder.add_edge("hint", END)

    builder.add_edge("wrap_up", END)

    return builder.compile(
        checkpointer=checkpointer
    )

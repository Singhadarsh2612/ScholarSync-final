"""Observability for the ScholarSync agent.

    from observability import observe_node, observe_llm, observe_tool, request_trace

Every helper is a pass-through when no LangSmith key is configured, so
importing or decorating never requires tracing to be set up.

    python -m observability.status     # what is configured
"""

from .config import PROJECT, enabled, summary
from .tracing import (
    init,
    observe_llm,
    observe_node,
    observe_tool,
    record_llm_usage,
    request_trace,
)

__all__ = [
    "PROJECT",
    "enabled",
    "summary",
    "init",
    "observe_llm",
    "observe_node",
    "observe_tool",
    "record_llm_usage",
    "request_trace",
]

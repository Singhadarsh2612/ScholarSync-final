"""Make arbitrary node/tool payloads safe and small enough to ship as a trace."""

import re

from . import config

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Never ship a value stored under one of these, whatever it looks like.
_SECRET_HINTS = ("api_key", "apikey", "password", "secret", "token",
                 "authorization", "jwt", "credential")

# State keys worth seeing in a trace. The full LangGraph state carries the
# whole message history on every node, which would bloat each span.
_STATE_KEYS = ("complexity", "complexity_reason", "planner_goal",
               "ui_requirement", "critic_feedback", "critic_iterations",
               "final_response", "exploiter_text", "simple_tool_call",
               "pending_interview_topic")


def _clip(text: str) -> str:
    limit = config.MAX_FIELD_CHARS
    if len(text) <= limit:
        return text
    return f"{text[:limit]}… [{len(text) - limit} chars truncated]"


def scrub(text: str) -> str:
    """Redact emails, then clip. Drops content entirely when capture is off."""
    if not isinstance(text, str):
        text = str(text)
    if not config.CAPTURE_CONTENT:
        return f"<content capture disabled, {len(text)} chars>"
    return _clip(_EMAIL_RE.sub("<email>", text))


def value(obj, _depth: int = 0):
    """Recursively sanitize a payload for tracing."""
    if _depth > 4:
        return "<max depth>"
    if obj is None or isinstance(obj, (bool, int, float)):
        return obj
    if isinstance(obj, str):
        return scrub(obj)
    if isinstance(obj, dict):
        out = {}
        for key, val in obj.items():
            name = str(key)
            if any(hint in name.lower() for hint in _SECRET_HINTS):
                out[name] = "<redacted>"
            else:
                out[name] = value(val, _depth + 1)
        return out
    if isinstance(obj, (list, tuple, set)):
        items = list(obj)
        trimmed = [value(v, _depth + 1) for v in items[:25]]
        if len(items) > 25:
            trimmed.append(f"<{len(items) - 25} more items>")
        return trimmed
    return scrub(repr(obj))


def state_snapshot(state: dict) -> dict:
    """The decision-relevant slice of the graph state, plus message count."""
    if not isinstance(state, dict):
        return {"state": value(state)}

    snapshot = {k: value(state[k]) for k in _STATE_KEYS if k in state}
    messages = state.get("messages") or []
    snapshot["message_count"] = len(messages)

    for key in ("execution_plan", "execution_results", "explorer_outputs",
                "planner_steps"):
        if key in state and isinstance(state[key], list):
            snapshot[f"{key}_count"] = len(state[key])
    return snapshot

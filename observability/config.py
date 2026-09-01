"""Observability settings, resolved from the environment once.

Tracing is off unless a LangSmith key is present. Nothing here imports
langsmith, so this module is safe to read from anywhere.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# Accept either spelling; LangSmith renamed LANGCHAIN_* to LANGSMITH_*.
API_KEY = os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY") or ""
PROJECT = (os.getenv("LANGSMITH_PROJECT")
           or os.getenv("LANGCHAIN_PROJECT")
           or "ScholarSync")

# LangGraph and LangChain auto-instrument graph nodes and LLM calls as soon as
# LANGCHAIN_TRACING_V2 is on, so wrapping them again nests a duplicate span
# around every one. Off by default; turn on to get the trimmed state snapshots
# and normalised token metadata instead of the SDK's native spans.
WRAP_NODES = os.getenv("OBS_WRAP_NODES", "").lower() in ("1", "true", "yes")
WRAP_LLM = os.getenv("OBS_WRAP_LLM", "").lower() in ("1", "true", "yes")

# Truncation guard: prompts and tool payloads can be large, and a trace is a
# diagnostic, not an archive.
MAX_FIELD_CHARS = int(os.getenv("OBS_MAX_FIELD_CHARS", "4000"))

# Record prompt/response text. Turn off to keep student data out of the SaaS
# while still getting latency, token counts and errors.
CAPTURE_CONTENT = os.getenv("OBS_CAPTURE_CONTENT", "true").lower() not in (
    "0", "false", "no",
)


def enabled() -> bool:
    """True when traces can actually be delivered.

    Every decorator degrades to a pass-through when this is False, so no code
    path depends on tracing being configured.
    """
    return bool(API_KEY)


def summary() -> dict:
    return {
        "enabled": enabled(),
        "project": PROJECT if enabled() else None,
        "wrap_nodes": WRAP_NODES,
        "wrap_llm": WRAP_LLM,
        "capture_content": CAPTURE_CONTENT,
        "max_field_chars": MAX_FIELD_CHARS,
        "key_source": (
            "LANGSMITH_API_KEY" if os.getenv("LANGSMITH_API_KEY")
            else "LANGCHAIN_API_KEY" if os.getenv("LANGCHAIN_API_KEY")
            else None
        ),
    }

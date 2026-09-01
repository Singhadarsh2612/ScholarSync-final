"""The only module that imports langsmith.

Everything is a no-op pass-through when config.enabled() is False, so callers
never branch on whether tracing is configured, and an observability failure
can never fail a request.
"""

import functools
import os
import time
from contextlib import contextmanager

from . import config, sanitize

_READY = False


def init() -> bool:
    """Point the langsmith SDK at the project. Idempotent."""
    global _READY
    if _READY:
        return config.enabled()

    if config.enabled():
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = config.API_KEY
        os.environ["LANGCHAIN_PROJECT"] = config.PROJECT
    else:
        # Without a key, force tracing off: the SDK otherwise attempts uploads
        # that 401 on every request.
        os.environ["LANGCHAIN_TRACING_V2"] = "false"

    _READY = True
    return config.enabled()


@contextmanager
def _span(name, run_type, inputs, metadata, tags):
    """One langsmith span, or a no-op. Never raises into the caller."""
    if not config.enabled():
        yield None
        return

    try:
        from langsmith.run_helpers import trace
    except Exception:
        yield None
        return

    try:
        with trace(name=name, run_type=run_type, inputs=inputs,
                   metadata=metadata, tags=tags,
                   project_name=config.PROJECT) as run:
            yield run
    except Exception:
        # A tracing backend problem must not surface as a request failure.
        yield None


def _finish(run, outputs=None, error=None, metadata=None):
    if run is None:
        return
    try:
        if metadata:
            run.add_metadata(metadata)
        if error is not None:
            run.end(error=str(error)[:2000])
        else:
            run.end(outputs=outputs or {})
    except Exception:
        pass


def observe_node(name):
    """Wrap a LangGraph node as a `chain` span.

    Returns the function untouched unless OBS_WRAP_NODES is set: LangGraph
    already emits a span per node, so wrapping duplicates it.
    """
    def decorator(fn):
        if not config.WRAP_NODES:
            return fn

        @functools.wraps(fn)
        async def wrapper(state, *args, **kwargs):
            inputs = {"state": sanitize.state_snapshot(state)}
            meta = {"node": name}
            thread = (state or {}).get("__thread_id__")
            if thread:
                meta["thread_id"] = thread

            started = time.perf_counter()
            with _span(name, "chain", inputs, meta, ["node"]) as run:
                try:
                    result = await fn(state, *args, **kwargs)
                except Exception as exc:
                    _finish(run, error=exc, metadata={
                        "latency_ms": round((time.perf_counter() - started) * 1000)
                    })
                    raise
                _finish(run,
                        outputs={"update": sanitize.value(result)},
                        metadata={
                            "latency_ms": round((time.perf_counter() - started) * 1000),
                            "updated_keys": sorted(result.keys())
                            if isinstance(result, dict) else None,
                        })
                return result
        return wrapper
    return decorator


def record_llm_usage(response):
    """Attach token counts from a LangChain response to the active span.

    `_llm_call` returns `res.content`, so the response object — and its usage
    metadata — is gone by the time observe_llm sees a plain string. Call this
    with the response while it is still in scope.
    """
    if not config.enabled():
        return
    usage = _token_usage(response)
    if not usage:
        return
    try:
        from langsmith.run_helpers import get_current_run_tree
        run = get_current_run_tree()
        if run is not None:
            run.add_metadata(usage)
    except Exception:
        pass


def _token_usage(response):
    """Pull token counts off a LangChain response, whatever shape it uses."""
    for attr in ("usage_metadata", "response_metadata"):
        data = getattr(response, attr, None)
        if not isinstance(data, dict):
            continue
        usage = data.get("token_usage") or data.get("usage") or data
        got = {
            "input_tokens": usage.get("input_tokens") or usage.get("prompt_tokens"),
            "output_tokens": usage.get("output_tokens") or usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
        }
        if any(v is not None for v in got.values()):
            return {k: v for k, v in got.items() if v is not None}
    return {}


def observe_llm(fn):
    """Wrap the single funnel every LLM call passes through.

    Returns the function untouched unless OBS_WRAP_LLM is set: LangChain
    already emits an `llm` span per call, with its own token accounting.

    Expects (llm, system, human) -> str, matching swarm_agents._llm_call.
    """
    if not config.WRAP_LLM:
        return fn

    @functools.wraps(fn)
    async def wrapper(llm, system, human, *args, **kwargs):
        model = getattr(llm, "_deployment_fn", None)
        model_name = None
        try:
            model_name = model() if callable(model) else getattr(
                llm, "deployment_name", None)
        except Exception:
            pass

        inputs = {"system": sanitize.scrub(system),
                  "human": sanitize.scrub(human)}
        meta = {"model": model_name or "unknown",
                "llm_name": getattr(llm, "_name", type(llm).__name__)}

        started = time.perf_counter()
        with _span(f"llm:{model_name or 'azure'}", "llm", inputs, meta,
                   ["llm"]) as run:
            try:
                result = await fn(llm, system, human, *args, **kwargs)
            except Exception as exc:
                _finish(run, error=exc, metadata={
                    "latency_ms": round((time.perf_counter() - started) * 1000)
                })
                raise
            _finish(run,
                    outputs={"output": sanitize.scrub(result)},
                    metadata={
                        "latency_ms": round((time.perf_counter() - started) * 1000),
                        "output_chars": len(result or ""),
                    })
            return result
    return wrapper


def observe_tool(fn):
    """Wrap the single funnel every tool call passes through.

    Expects (tool_name, params) -> Any, matching swarm_agents._call_tool.
    """
    @functools.wraps(fn)
    async def wrapper(tool_name, params, *args, **kwargs):
        inputs = {"tool": tool_name, "parameters": sanitize.value(params)}

        started = time.perf_counter()
        with _span(f"tool:{tool_name}", "tool", inputs, {"tool": tool_name},
                   ["tool"]) as run:
            try:
                result = await fn(tool_name, params, *args, **kwargs)
            except Exception as exc:
                _finish(run, error=exc, metadata={
                    "latency_ms": round((time.perf_counter() - started) * 1000)
                })
                raise

            meta = {"latency_ms": round((time.perf_counter() - started) * 1000)}
            # An empty list is what the assignments bug looked like from the
            # outside, so make emptiness explicit rather than inferable.
            if isinstance(result, (list, dict, str)):
                meta["result_size"] = len(result)
                meta["result_empty"] = len(result) == 0
            _finish(run, outputs={"result": sanitize.value(result)},
                    metadata=meta)
            return result
    return wrapper


@contextmanager
def request_trace(question, thread_id, name="ScholarSync Chat"):
    """Root span for one agent response. Yields a handle for the outcome."""
    inputs = {"question": sanitize.scrub(question), "thread_id": thread_id}
    meta = {"thread_id": thread_id, "session_id": thread_id}

    started = time.perf_counter()
    with _span(name, "chain", inputs, meta, ["request"]) as run:
        handle = _RequestHandle(run, started)
        try:
            yield handle
        except Exception as exc:
            _finish(run, error=exc, metadata=handle.metadata())
            raise
        _finish(run, outputs=handle.outputs, metadata=handle.metadata())


class _RequestHandle:
    """Lets the caller attach the final answer and outcome to the root span."""

    def __init__(self, run, started):
        self.run = run
        self._started = started
        self.outputs = {}
        self.extra = {}

    def set_response(self, text, **extra):
        self.outputs = {"response": sanitize.scrub(text or "")}
        self.extra.update(extra)

    def set_status(self, status):
        self.extra["status"] = status

    def metadata(self):
        meta = dict(self.extra)
        meta["latency_ms"] = round((time.perf_counter() - self._started) * 1000)
        return meta

    @property
    def trace_id(self):
        try:
            return str(self.run.trace_id) if self.run is not None else None
        except Exception:
            return None

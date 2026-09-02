"""
chatbot/swarm_agents.py
─────────────────────────────────────────────────────────────────────────────
Full swarm pipeline — all nodes for both simple and complex paths.

SIMPLE PATH:
  ComplexityAnalyzer → SimpleRetriever → ExecutorNode
  → ExploiterNode → PresentationAgent → (Critic)

COMPLEX PATH:
  ComplexityAnalyzer → Planner(GPT-4o)
  → ToolHeavyExplorer → MinimalExplorer → BalancedExplorer
  → FitnessEvaluator → ExecutorNode
  → ExploiterNode → PresentationAgent → (Critic)

Key feature: pending_email / pending_interview_topic stored in state
so confirmations ("yes, send it") bypass the LLM entirely.
"""

import asyncio
import json
import re
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from chatbot.llm import llm_mini_1, llm_mini_2, llm_4o
import observability
from chatbot.raw_tools import TOOL_MAP, KNOWN_TOOL_NAMES, CONFIRMATION_TOOLS, ONCE_ONLY_TOOLS
from chatbot.prompts import (
    COMPLEXITY_ANALYZER_SYSTEM,
    SIMPLE_RETRIEVER_SYSTEM,
    PLANNER_SYSTEM,
    EXPLORER_TOOL_HEAVY_SYSTEM,
    EXPLORER_MINIMAL_SYSTEM,
    EXPLORER_BALANCED_SYSTEM,
    FITNESS_EVALUATOR_SYSTEM,
    EXPLOITER_SYSTEM,
    PRESENTATION_AGENT_SYSTEM,
)



def _last_human(state: dict) -> str:
    for m in reversed(state.get("messages", [])):
        if getattr(m, "type", "") == "human":
            return m.content or ""
    return ""



_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


def _mask_emails(text: str) -> tuple[str, dict[str, str]]:
    """Replace every email address in text with __EMAIL_N__ placeholder.
    Returns (masked_text, {placeholder: original_email})."""
    mapping: dict[str, str] = {}
    counter = 0

    def replacer(m: re.Match) -> str:
        nonlocal counter
        email = m.group(0)
        for k, v in mapping.items():
            if v == email:
                return k
        placeholder = f"__EMAIL_{counter}__"
        mapping[placeholder] = email
        counter += 1
        return placeholder

    masked = _EMAIL_RE.sub(replacer, text)
    return masked, mapping


def _unmask(text: str, mapping: dict[str, str]) -> str:
    """Restore email placeholders back to real addresses."""
    for placeholder, original in mapping.items():
        text = text.replace(placeholder, original)
    return text


def _last_human_masked(state: dict) -> tuple[str, dict[str, str]]:
    """Return (masked_query, email_mapping) for LLM-safe input."""
    raw = _last_human(state)
    return _mask_emails(raw)


def _parse_json(text: str) -> dict:
    """Robustly extract the first JSON object from an LLM response."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    if start == -1:
        return {}
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start: i + 1])
                except Exception:
                    return {}
    return {}


@observability.observe_llm
async def _llm_call(llm, system: str, human: str) -> str:
    res = await llm.ainvoke([SystemMessage(content=system),
                              HumanMessage(content=human)])
    # Token counts live on the response, which is discarded below.
    observability.record_llm_usage(res)
    return res.content or ""


@observability.observe_tool
async def _call_tool(tool_name: str, params: dict) -> Any:
    fn = TOOL_MAP.get(tool_name)
    if fn is None:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        if asyncio.iscoroutinefunction(fn):
            return await fn(**params)
        return await asyncio.to_thread(fn, **params)
    except Exception as e:
        return {"error": str(e)}


def _result_to_str(result: Any) -> str:
    if isinstance(result, (dict, list)):
        return json.dumps(result, indent=2)
    return str(result)


_CONFIRM_PHRASES = {
    "yes", "send", "send it", "yes send it", "go ahead", "ok", "okay",
    "confirm", "proceed", "sure", "yep", "yeah", "do it", "go", "approved",
}

def _is_confirmation(query: str) -> bool:
    q = query.lower().strip().strip('"\',.!')
    return any(phrase in q for phrase in _CONFIRM_PHRASES)


def _parse_email_draft(text: str) -> dict:
    """
    Extract {to, subject, body} from the line-based ===EMAIL_DRAFT=== block.

    Expected format (no JSON — just plain text fields):
        ===EMAIL_DRAFT===
        TO: recipient@example.com
        SUBJECT: Subject line
        BODY:
        Full body text here
        (can span multiple lines)
        ===END_EMAIL_DRAFT===
    """
    m = re.search(
        r"===EMAIL_DRAFT===\s*([\s\S]*?)\s*===END_EMAIL_DRAFT===",
        text, re.IGNORECASE
    )
    if m:
        block = m.group(1).strip()

        to_m      = re.search(r"^TO:\s*(.+)$",      block, re.MULTILINE | re.IGNORECASE)
        subject_m = re.search(r"^SUBJECT:\s*(.+)$", block, re.MULTILINE | re.IGNORECASE)
        body_m    = re.search(r"^BODY:\s*\n([\s\S]+)$", block, re.MULTILINE | re.IGNORECASE)

        if to_m and subject_m and body_m:
            return {
                "to":      to_m.group(1).strip(),
                "subject": subject_m.group(1).strip(),
                "body":    body_m.group(1).strip(),
            }

        if to_m and subject_m:
            subject_end = subject_m.end()
            leftover = block[subject_end:].strip()
            if leftover:
                return {
                    "to":      to_m.group(1).strip(),
                    "subject": subject_m.group(1).strip(),
                    "body":    leftover,
                }

    return {}


def _parse_interview_ready(text: str) -> str:
    """Extract topic from 'INTERVIEW READY: topic=X | ...'"""
    m = re.search(r"INTERVIEW READY:\s*topic=([^|\n]+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else ""



async def complexity_analyzer_node(state: dict) -> dict:
    query         = _last_human(state)
    pending_email = state.get("pending_email") or {}
    pending_iv    = state.get("pending_interview_topic") or ""

    base_reset = {
        "simple_tool_call":  {},
        "execution_plan":    [],
        "planner_goal":      "",
        "planner_steps":     [],
        "ui_requirement":    {"required": False, "type": "none"},
        "explorer_outputs":  [],
        "execution_results": [],
        "exploiter_text":    "",
        "final_response":    "",
        "critic_iterations": 0,
        "critic_feedback":   "",
    }

    if _is_confirmation(query) and (pending_email or pending_iv):
        return {
            "complexity":        "simple",
            "complexity_reason": "Confirmation of pending action — LLM bypassed",
            **base_reset,
            "pending_email":           pending_email,
            "pending_interview_topic": pending_iv,
        }

    masked_query, _em = _mask_emails(query)
    raw    = await _llm_call(llm_mini_1, COMPLEXITY_ANALYZER_SYSTEM,
                             f"User query: {masked_query}")
    parsed = _parse_json(raw)
    complexity = parsed.get("complexity", "simple")
    if complexity not in ("simple", "complex"):
        complexity = "simple"

    return {
        "complexity":              complexity,
        "complexity_reason":       parsed.get("reason", ""),
        **base_reset,
        "pending_email":           {},
        "pending_interview_topic": "",
    }



async def simple_retriever_node(state: dict) -> dict:
    query         = _last_human(state)
    pending_email = state.get("pending_email") or {}
    pending_iv    = state.get("pending_interview_topic") or ""

    if pending_email and _is_confirmation(query):
        return {
            "simple_tool_call": {"tool": "send_email"},
            "execution_plan": [{
                "tool":                  "send_email",
                "parameters":            pending_email,
                "order":                 1,
                "requires_confirmation": False,  # already confirmed by user
                "use_output_as":         "send confirmation",
            }],
            "ui_requirement": {"required": False, "type": "none"},
            "pending_email":  {},  # clear after consuming
        }

    if pending_iv and _is_confirmation(query):
        return {
            "simple_tool_call": {"tool": "open_interview_in_browser"},
            "execution_plan": [{
                "tool":                  "open_interview_in_browser",
                "parameters":            {"topic": pending_iv},
                "order":                 1,
                "requires_confirmation": False,
                "use_output_as":         "open interview for user",
            }],
            "ui_requirement":          {"required": False, "type": "none"},
            "pending_interview_topic": "",  # clear after consuming
        }

    history_lines = []
    for m in state.get("messages", [])[-6:]:
        role = getattr(m, "type", "")
        masked_content, _ = _mask_emails(m.content or "")
        history_lines.append(f"{role.upper()}: {masked_content}")
    context = "\n".join(history_lines)

    masked_query, em_map = _mask_emails(query)
    raw    = await _llm_call(llm_mini_1, SIMPLE_RETRIEVER_SYSTEM,
                              f"Conversation history:\n{context}\n\nLatest message: {masked_query}")
    parsed = _parse_json(raw)

    tool_name  = parsed.get("tool", "none")
    parameters = parsed.get("parameters") or {}
    ui_req     = parsed.get("ui_requirement", {"required": False, "type": "none"})

    if em_map:
        for k, v in parameters.items():
            if isinstance(v, str):
                parameters[k] = _unmask(v, em_map)

    if tool_name not in KNOWN_TOOL_NAMES and tool_name != "none":
        tool_name = "none"

    execution_plan = [] if tool_name == "none" else [
        {
            "tool":                  tool_name,
            "parameters":            parameters,
            "order":                 1,
            "requires_confirmation": tool_name in CONFIRMATION_TOOLS,
            "use_output_as":         "primary result",
        }
    ]

    return {
        "simple_tool_call": parsed,
        "execution_plan":   execution_plan,
        "ui_requirement":   ui_req,
    }



async def planner_node(state: dict) -> dict:
    query = _last_human(state)
    masked_query, em_map = _mask_emails(query)
    raw   = await _llm_call(llm_4o, PLANNER_SYSTEM,
                             f"User query: {masked_query}")
    parsed = _parse_json(raw)

    steps  = parsed.get("steps", [])
    ui_req = parsed.get("ui_requirement", {"required": False, "type": "none"})

    for s in steps:
        params = s.get("parameters") or {}
        for k, v in params.items():
            if isinstance(v, str) and em_map:
                params[k] = _unmask(v, em_map)

    clean_steps = [s for s in steps if s.get("tool") in KNOWN_TOOL_NAMES]

    return {
        "planner_goal":   parsed.get("goal", query),
        "planner_steps":  clean_steps,
        "ui_requirement": ui_req,
    }



async def _run_explorer(state: dict, system_prompt: str, name: str) -> dict:
    query         = _last_human(state)
    planner_steps = state.get("planner_steps", [])
    raw  = await _llm_call(
        llm_mini_2, system_prompt,
        f"User query: {query}\n\nPlanner steps:\n{json.dumps(planner_steps, indent=2)}"
    )
    parsed = _parse_json(raw)
    plan   = parsed.get("execution_plan", [])
    clean  = [s for s in plan if isinstance(s, dict) and s.get("tool") in KNOWN_TOOL_NAMES]
    return {"plan": clean, "explorer": name}


# The three run concurrently, so each returns only its own result and the
# merge_explorer_outputs reducer in graph.py collects them. Reading the key
# and appending here would race: all three see the same pre-fan-out value.
async def run_tool_heavy_explorer(state: dict) -> dict:
    out = await _run_explorer(state, EXPLORER_TOOL_HEAVY_SYSTEM, "ToolHeavy")
    return {"explorer_outputs": [out]}


async def run_minimal_explorer(state: dict) -> dict:
    out = await _run_explorer(state, EXPLORER_MINIMAL_SYSTEM, "Minimal")
    return {"explorer_outputs": [out]}


async def run_balanced_explorer(state: dict) -> dict:
    out = await _run_explorer(state, EXPLORER_BALANCED_SYSTEM, "Balanced")
    return {"explorer_outputs": [out]}



async def fitness_evaluator_node(state: dict) -> dict:
    query   = _last_human(state)
    outputs = state.get("explorer_outputs", [])

    if not outputs:
        return {"execution_plan": state.get("planner_steps", [])}

    def _fallback():
        best = max(outputs, key=lambda x: len(x.get("plan", [])), default=outputs[0])
        return best.get("plan", [])

    try:
        raw    = await _llm_call(
            llm_mini_2, FITNESS_EVALUATOR_SYSTEM,
            f"User query: {query}\n\nPlans:\n{json.dumps(outputs, indent=2)}"
        )
        parsed = _parse_json(raw)
        plan   = parsed.get("selected_plan", [])
        plan   = [s for s in plan if s.get("tool") in KNOWN_TOOL_NAMES]
        if not plan:
            plan = _fallback()
    except Exception:
        plan = _fallback()

    return {"execution_plan": plan}



async def executor_node(state: dict) -> dict:
    plan     = state.get("execution_plan", [])
    is_retry = (state.get("critic_iterations") or 0) > 0

    if is_retry:
        return {"execution_results": list(state.get("execution_results") or [])}

    results: list     = []
    once_called: set  = set()
    sorted_plan       = sorted(plan, key=lambda s: s.get("order", 99))

    for step in sorted_plan:
        tool_name = step.get("tool", "")
        params    = step.get("parameters") or {}
        requires_confirmation = step.get(
            "requires_confirmation",
            tool_name in CONFIRMATION_TOOLS   # default: require confirmation
        )

        if not tool_name or tool_name == "none":
            continue

        if requires_confirmation:
            results.append({
                "tool":          tool_name,
                "skipped":       True,
                "reason":        "requires_confirmation",
                "parameters":    params,
                "use_output_as": step.get("use_output_as", ""),
            })
            continue

        if tool_name in ONCE_ONLY_TOOLS and tool_name in once_called:
            continue

        result = await _call_tool(tool_name, params)
        results.append({
            "tool":          tool_name,
            "skipped":       False,
            "result":        result,
            "result_str":    _result_to_str(result),
            "use_output_as": step.get("use_output_as", ""),
        })

        if tool_name in ONCE_ONLY_TOOLS:
            once_called.add(tool_name)

    return {"execution_results": results}



async def exploiter_node(state: dict) -> dict:
    query           = _last_human(state)
    results         = state.get("execution_results", [])
    goal            = state.get("planner_goal", "") or query
    critic_feedback = state.get("critic_feedback", "")
    is_retry        = (state.get("critic_iterations") or 0) > 0

    ctx_parts = []
    for r in results:
        tool = r.get("tool", "unknown")
        if r.get("skipped"):
            ctx_parts.append(
                f"[SKIPPED — requires_confirmation]: {tool}"
                f"\nParameters: {json.dumps(r.get('parameters', {}))}"
            )
        else:
            use_as = r.get("use_output_as", "")
            header = f"[{tool}]" + (f" (use as: {use_as})" if use_as else "") + ":"
            ctx_parts.append(header + "\n" + r.get("result_str", ""))

    context   = "\n\n".join(ctx_parts) if ctx_parts else "No tool data available."
    human_msg = f"Goal: {goal}\n\nTool Results:\n{context}\n\nUser query: {query}"

    if is_retry and critic_feedback:
        human_msg += f"\n\nCritic feedback to address: {critic_feedback}"

    raw = await _llm_call(llm_mini_2, EXPLOITER_SYSTEM, human_msg)

    updates: dict = {"exploiter_text": raw}

    new_pending_email = _parse_email_draft(raw)
    if new_pending_email:
        updates["pending_email"] = new_pending_email
    else:
        skipped_email = next(
            (r for r in results if r.get("tool") == "send_email" and r.get("skipped")),
            None
        )
        if skipped_email:
            params = skipped_email.get("parameters") or {}
            to_addr = params.get("to", "")
            subject  = params.get("subject", "") or "Information from ScholarSync"
            body = params.get("body", "") or raw.strip()
            if to_addr:
                updates["pending_email"] = {
                    "to":      to_addr,
                    "subject": subject,
                    "body":    body,
                }

    new_pending_iv = _parse_interview_ready(raw)
    if new_pending_iv:
        updates["pending_interview_topic"] = new_pending_iv

    return updates



async def presentation_agent_node(state: dict) -> dict:
    query          = _last_human(state)
    exploiter_text = state.get("exploiter_text", "")

    if not exploiter_text:
        exploiter_text = f"The user asked: {query}. No specific data was retrieved."

    raw = await _llm_call(
        llm_mini_2, PRESENTATION_AGENT_SYSTEM,
        f"User query: {query}\n\nLogical synthesis to format:\n{exploiter_text}"
    )

    return {
        "final_response": raw,
        "messages":       [AIMessage(content=raw)],
    }
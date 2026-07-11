"""
chatbot/service.py
─────────────────────────────────────────────────────────────────────────────
Streaming chat service — planner-driven UI injection.

Changes from previous version:
  - Response read from state["final_response"] (set by PresentationAgent)
    instead of scanning messages for the last AI message.
  - UI blocks injected deterministically from state["ui_requirement"]
    + state["execution_results"] via ui_builders.py.
  - Old _inject_ui_blocks / _extract_tool_result helpers removed.
"""

import asyncio
import json

from langchain_core.messages import HumanMessage
from langsmith import traceable
from langchain_core.tracers.context import tracing_v2_enabled

from . import memory
from .config import threads
from .ui_builders import build_ui_block, get_ui_tool_name


@traceable(name="ScholarSync Chat")
async def chat_stream(user_message: str, thread_id: str):
    if thread_id not in threads:
        threads[thread_id] = user_message[:30]

    state  = {"messages": [HumanMessage(content=user_message)]}
    config = {"configurable": {"thread_id": thread_id}}

    with tracing_v2_enabled(project_name="ScholarSync"):

        try:
            final_state = await asyncio.wait_for(
                memory.chatbot.ainvoke(state, config=config),
                timeout=200,
            )
        except asyncio.TimeoutError:
            yield "⚠️ The agent took too long to respond. Please try again."
            return
        except Exception as e:
            yield f"⚠️ An error occurred: {str(e)[:200]}"
            return

        final_response: str = final_state.get("final_response", "")

        if not final_response:
            yield "⚠️ The agent was unable to produce a response. Please try again."
            return

        ui_req  = final_state.get("ui_requirement") or {}
        ui_block = ""

        print(f"[UI] ui_requirement: {ui_req}")
        print(f"[UI] execution_results count: {len(final_state.get('execution_results', []))}")
        for r in final_state.get("execution_results", []):
            print(f"[UI]   result: tool={r.get('tool')}, skipped={r.get('skipped')}")

        if ui_req.get("required", False):
            ui_type   = ui_req.get("type", "none")
            tool_name = get_ui_tool_name(ui_type)
            print(f"[UI] Looking for tool_name={tool_name} in execution_results")

            raw_data = None
            for r in final_state.get("execution_results", []):
                if r.get("tool") == tool_name and not r.get("skipped"):
                    raw_data = r.get("result")
                    break

            if raw_data is None and ui_type == "interview_confirm":
                for r in final_state.get("execution_results", []):
                    if r.get("tool") == "open_interview_in_browser" and r.get("skipped"):
                        topic = (r.get("parameters") or {}).get("topic", "")
                        if topic:
                            from .raw_tools import prepare_interview_session_raw
                            raw_data = prepare_interview_session_raw(topic)
                            print(f"[UI] Fallback: called prepare_interview_session_raw('{topic}')")
                        break

            if raw_data is not None:
                ui_block = build_ui_block(ui_type, raw_data)
                print(f"[UI] Built ui_block, length={len(ui_block)}")
            else:
                print(f"[UI] WARNING: No raw_data found for {tool_name}")

        output_text = (ui_block + "\n\n" + final_response).strip() if ui_block else final_response

        yield "\n\n**Agent Network**:\n"
        chunk_size = 15
        for i in range(0, len(output_text), chunk_size):
            yield output_text[i: i + chunk_size]
            await asyncio.sleep(0.01)
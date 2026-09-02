"""Run the evaluation suites.

    python -m evaluation.runner              # both suites
    python -m evaluation.runner --agent      # agent responses only
    python -m evaluation.runner --rag        # RAG triad only
    python -m evaluation.runner --case rag-absent-topic
    python -m evaluation.runner --json reports/eval-report.json

Runs in-process so tool calls are visible in the graph state; scores are
therefore for the code in this container, not a remote deployment.
"""

import argparse
import asyncio

from . import agent_metrics, datasets, rag_metrics
from . import report as report_io

PASS_THRESHOLD = 0.7

# Per-tool evidence budget for the fabrication judge. The first version clipped
# at 4000, which cut get_exams_raw (~7.3 KB) mid-record and severed the link
# between a subject, its exam type and its date -- the judge then read a real
# date as invented. Being generous is cheap: the judge's context is far larger
# than the whole payload.
EVIDENCE_CHARS_PER_TOOL = 20000
EVIDENCE_CHARS_TOTAL = 60000


def _evidence(results):
    """Assemble the tool output that no_fabrication scores against.

    Any clip is marked inline, because a judge that cannot distinguish
    truncation from absence will call a real value a fabrication.
    """
    parts = []
    budget = EVIDENCE_CHARS_TOTAL
    for r in results:
        body = r.get("result_str") or str(r.get("result", ""))
        allowed = min(EVIDENCE_CHARS_PER_TOOL, budget)
        if len(body) > allowed:
            dropped = len(body) - allowed
            body = f"{body[:allowed]}\n...[TRUNCATED HERE -- {dropped} more " \
                   "chars of this tool's output were not shown]"
        budget -= min(len(body), allowed)
        parts.append(f"[{r['tool']}]\n{body}")
        if budget <= 0:
            break
    return "\n\n".join(parts) or None


async def _run_agent_case(case):
    from langchain_core.messages import HumanMessage

    from chatbot import memory

    thread = f"eval-{case['id']}"
    state = {"messages": [HumanMessage(content=case["question"])]}
    config = {"configurable": {"thread_id": thread}}

    try:
        final = await asyncio.wait_for(
            memory.chatbot.ainvoke(state, config=config), timeout=240)
    except Exception as exc:
        return {"id": case["id"], "error": f"{type(exc).__name__}: {exc}"[:200]}

    answer = final.get("final_response", "") or ""
    results = [r for r in final.get("execution_results", [])
               if r.get("tool") and not r.get("skipped")]
    tools_used = [r["tool"] for r in results]

    # What the agent actually had in hand. no_fabrication is judged against
    # this, not against the answer alone.
    evidence = _evidence(results)

    metrics = await agent_metrics.evaluate(
        case["question"], answer,
        expected=case.get("expected"),
        expected_tools=case.get("expected_tools"),
        tools_used=tools_used,
        evidence=evidence,
    )
    return {"id": case["id"], "regression": case.get("regression", False),
            "question": case["question"], "answer": answer,
            "tools_used": tools_used, "metrics": metrics,
            "mean": metrics.get("_mean")}


async def _run_rag_case(case):
    from assignment_solver import solve_assignment

    contexts, error = await asyncio.to_thread(
        rag_metrics.retrieve, case["question"], case["doc"])
    if error:
        return {"id": case["id"], "error": error}

    try:
        answer = await asyncio.to_thread(
            solve_assignment, case["question"], [], case["doc"], [])
    except Exception as exc:
        return {"id": case["id"], "error": f"{type(exc).__name__}: {exc}"[:200]}

    if isinstance(answer, dict):
        answer = answer.get("answer", str(answer))

    metrics = await rag_metrics.evaluate(
        case["question"], answer, contexts,
        expect_refusal=case.get("expect_refusal", False))
    return {"id": case["id"], "question": case["question"], "answer": answer,
            "contexts": len(contexts or []), "metrics": metrics,
            "mean": metrics.get("_mean")}


def _print_result(result):
    if result.get("error"):
        print(f"  ERROR   {result['id']:30} {result['error']}")
        return

    mean = result.get("mean")
    verdict = ("n/a  " if mean is None
               else "PASS " if mean >= PASS_THRESHOLD else "FAIL ")
    flag = " [regression]" if result.get("regression") else ""
    shown = "  n/a" if mean is None else f"{mean:5.2f}"
    print(f"  {verdict} {result['id']:30} mean={shown}{flag}")

    for name, value in result["metrics"].items():
        if name.startswith("_") or not isinstance(value, dict):
            continue
        s = "  n/a" if value["score"] is None else f"{value['score']:5.2f}"
        detail = value.get("error") or value.get("reason", "")
        print(f"          {name:20} {s}  {detail[:96]}")

    if result.get("tools_used") is not None:
        print(f"          {'tools_called':20} {', '.join(result['tools_used']) or '(none)'}")
    if result.get("contexts") is not None:
        print(f"          {'chunks_retrieved':20} {result['contexts']}")


def _summarise(label, results):
    scored = [r["mean"] for r in results
              if not r.get("error") and r.get("mean") is not None]
    errors = [r for r in results if r.get("error")]
    failed = [r for r in results
              if not r.get("error") and r.get("mean") is not None
              and r["mean"] < PASS_THRESHOLD]

    print(f"\n  {label}: {len(scored) - len(failed)}/{len(scored)} passed"
          f" (threshold {PASS_THRESHOLD})"
          + (f", {len(errors)} error(s)" if errors else ""))
    if scored:
        print(f"  mean score: {sum(scored) / len(scored):.3f}")
    for r in failed:
        regression = " [REGRESSION]" if r.get("regression") else ""
        print(f"    FAIL {r['id']}{regression}")
    return failed, errors


async def main_async(args):
    selected = args.case
    report = {"agent": [], "rag": []}

    run_agent = args.agent or not (args.agent or args.rag)
    run_rag = args.rag or not (args.agent or args.rag)

    if run_agent:
        cases = [c for c in datasets.AGENT_CASES
                 if not selected or c["id"] in selected]
        if cases:
            from chatbot.memory import init_chatbot
            saver_cm = await init_chatbot()
            print(f"\nAgent responses ({len(cases)} cases)\n" + "-" * 72)
            try:
                for case in cases:
                    result = await _run_agent_case(case)
                    report["agent"].append(result)
                    _print_result(result)
            finally:
                try:
                    await saver_cm.__aexit__(None, None, None)
                except Exception:
                    pass
            _summarise("agent", report["agent"])

    if run_rag:
        cases = [c for c in datasets.RAG_CASES
                 if not selected or c["id"] in selected]
        if cases:
            print(f"\nRAG triad ({len(cases)} cases)\n" + "-" * 72)
            for case in cases:
                result = await _run_rag_case(case)
                report["rag"].append(result)
                _print_result(result)
            _summarise("rag", report["rag"])

    if args.json:
        print(f"\n  wrote {report_io.write(args.json, report)}")

    all_results = report["agent"] + report["rag"]
    bad = [r for r in all_results
           if r.get("error") or (r.get("mean") is not None
                                 and r["mean"] < PASS_THRESHOLD)]
    return 1 if bad else 0


def main():
    parser = argparse.ArgumentParser(description="ScholarSync evaluation.")
    parser.add_argument("--agent", action="store_true", help="agent suite only")
    parser.add_argument("--rag", action="store_true", help="RAG suite only")
    parser.add_argument("--case", action="append", help="run only this case id")
    parser.add_argument("--json", help="write the full report here")
    args = parser.parse_args()

    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()

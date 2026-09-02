"""Latency and token benchmark for the agent graph.

    python -m evaluation.benchmark --json reports/bench-before.json
    python -m evaluation.benchmark --reps 5 --case multi-tool-priority
    python -m evaluation.benchmark --compare reports/bench-before.json reports/bench-after.json

Separate from runner.py because the question is different: the runner asks
whether an answer is right, this asks what it cost. Both graph paths are
measured -- a change aimed at the complex path has to leave the simple path
alone, and the simple cases are here to show that it did.
"""

import argparse
import asyncio
import json
import statistics
import time

from . import report as report_io

# Two complex cases (multi-step, so the explorer stage runs) and two simple
# ones (single tool, bypassing the explorers) as a control group.
BENCH_CASES = [
    {
        "id": "multi-tool-priority",
        "expect_path": "complex",
        "question": (
            "List my overdue assignments and cross-check them against my exam "
            "schedule, then tell me what to do first. Be brief."
        ),
    },
    {
        "id": "marks-then-exam-plan",
        "expect_path": "complex",
        "question": (
            "Find my weakest subject from my marks, then tell me when its exam "
            "is and how to prepare. Be brief."
        ),
    },
    {
        "id": "assignments-list",
        "expect_path": "simple",
        "question": "List my overdue assignments.",
    },
    {
        "id": "current-time",
        "expect_path": "simple",
        "question": "What time is it right now?",
    },
]


def _instrument_llm_calls():
    """Count LLM round-trips without adding a counter to production code.

    The nodes resolve `_llm_call` from module globals at call time, so
    replacing the module attribute is enough to observe every call.
    """
    from chatbot import swarm_agents

    original = swarm_agents._llm_call
    counter = {"calls": 0}

    async def counted(*args, **kwargs):
        counter["calls"] += 1
        return await original(*args, **kwargs)

    swarm_agents._llm_call = counted

    def restore():
        swarm_agents._llm_call = original

    return counter, restore


async def _one_run(case, rep):
    """One end-to-end agent response, timed.

    A fresh thread each rep, so no checkpoint from a previous rep shortens the
    work being measured.
    """
    from langchain_core.callbacks import get_usage_metadata_callback
    from langchain_core.messages import HumanMessage

    from chatbot import memory

    counter, restore = _instrument_llm_calls()
    state = {"messages": [HumanMessage(content=case["question"])]}
    thread = f"bench-{case['id']}-{rep}-{time.time()}"
    config = {"configurable": {"thread_id": thread}}

    started = time.perf_counter()
    try:
        with get_usage_metadata_callback() as usage:
            final = await asyncio.wait_for(
                memory.chatbot.ainvoke(state, config=config), timeout=300)
        elapsed = time.perf_counter() - started
    except Exception as exc:
        return {"rep": rep, "error": f"{type(exc).__name__}: {exc}"[:200],
                "latency_s": round(time.perf_counter() - started, 2)}
    finally:
        restore()

    per_model = usage.usage_metadata.values()
    tokens = sum(m.get("total_tokens") or 0 for m in per_model)
    inp = sum(m.get("input_tokens") or 0 for m in per_model)
    out = sum(m.get("output_tokens") or 0 for m in per_model)
    tools = [r["tool"] for r in final.get("execution_results", [])
             if r.get("tool") and not r.get("skipped")]

    return {
        "rep": rep,
        "latency_s": round(elapsed, 2),
        "total_tokens": tokens,
        "input_tokens": inp,
        "output_tokens": out,
        "llm_calls": counter["calls"],
        # The analyser decides the path, so record what actually happened
        # rather than trusting expect_path.
        "path": final.get("complexity") or "unknown",
        "explorers": len(final.get("explorer_outputs") or []),
        "critic_iterations": final.get("critic_iterations") or 0,
        "tools": tools,
        "response_chars": len(final.get("final_response") or ""),
    }


def _stats(values):
    if not values:
        return None
    return {
        "n": len(values),
        "mean": round(statistics.mean(values), 2),
        "median": round(statistics.median(values), 2),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        # Only meaningful with more than one sample; None says so rather than
        # implying a spread of zero.
        "stdev": round(statistics.stdev(values), 2) if len(values) > 1 else None,
    }


def _summarise_case(case, runs):
    ok = [r for r in runs if not r.get("error")]
    return {
        "id": case["id"],
        "expect_path": case["expect_path"],
        "path": ok[0]["path"] if ok else "unknown",
        "runs": runs,
        "errors": len(runs) - len(ok),
        "latency_s": _stats([r["latency_s"] for r in ok]),
        "total_tokens": _stats([r["total_tokens"] for r in ok]),
        "llm_calls": _stats([r["llm_calls"] for r in ok]),
        "explorers": _stats([r["explorers"] for r in ok]),
    }


def _print_case(summary):
    lat = summary["latency_s"]
    tok = summary["total_tokens"]
    calls = summary["llm_calls"]

    if not lat:
        print(f"  {summary['id']:24} all {summary['errors']} run(s) errored")
        for run in summary["runs"]:
            if run.get("error"):
                print(f"      {run['error']}")
        return

    routed = summary["path"]
    flag = "" if routed == summary["expect_path"] else \
        f"  (routed {routed}, expected {summary['expect_path']})"
    sd = f" sd={lat['stdev']:.2f}" if lat["stdev"] is not None else ""

    print(f"  {summary['id']:24} path={routed:8}{flag}")
    print(f"      latency_s   mean={lat['mean']:7.2f} median={lat['median']:7.2f}"
          f" min={lat['min']:7.2f} max={lat['max']:7.2f}{sd}")
    print(f"      tokens      mean={tok['mean']:7.0f} median={tok['median']:7.0f}"
          f" min={tok['min']:7.0f} max={tok['max']:7.0f}")
    print(f"      llm_calls   mean={calls['mean']:7.1f}"
          f"   explorers={summary['explorers']['median']:.0f}")
    if summary["errors"]:
        print(f"      {summary['errors']} errored run(s)")


def _aggregate(summaries, path):
    """Pooled stats over every successful run that took one path."""
    runs = [run for s in summaries if s["path"] == path
            for run in s["runs"] if not run.get("error")]
    if not runs:
        return None
    return {"latency_s": _stats([r["latency_s"] for r in runs]),
            "total_tokens": _stats([r["total_tokens"] for r in runs]),
            "llm_calls": _stats([r["llm_calls"] for r in runs])}


async def main_async(args):
    from chatbot.memory import init_chatbot

    cases = [c for c in BENCH_CASES if not args.case or c["id"] in args.case]
    if not cases:
        print("no cases matched")
        return 1

    saver_cm = await init_chatbot()
    report = {"reps": args.reps, "cases": []}
    print(f"\nBenchmark: {len(cases)} case(s) x {args.reps} rep(s)\n" + "-" * 72)
    try:
        for case in cases:
            runs = [await _one_run(case, rep) for rep in range(args.reps)]
            summary = _summarise_case(case, runs)
            report["cases"].append(summary)
            _print_case(summary)
    finally:
        try:
            await saver_cm.__aexit__(None, None, None)
        except Exception:
            pass

    report["by_path"] = {p: _aggregate(report["cases"], p)
                         for p in ("complex", "simple")}
    print("\n  pooled by path\n" + "-" * 72)
    for path, agg in report["by_path"].items():
        if agg:
            print(f"  {path:8} latency mean={agg['latency_s']['mean']:6.2f}s"
                  f" median={agg['latency_s']['median']:6.2f}s"
                  f" (n={agg['latency_s']['n']})"
                  f"  tokens mean={agg['total_tokens']['mean']:.0f}")

    if args.json:
        print(f"\n  wrote {report_io.write(args.json, report)}")
    return 0


def _delta(before, after):
    if not before or after is None:
        return ""
    return f"{(after - before) / before * 100:+.1f}%"


def compare(before_path, after_path):
    """Diff two reports.

    Latency is the point; tokens are reported alongside because a latency win
    paid for with extra tokens is not a win.
    """
    with open(before_path, encoding="utf-8") as fh:
        before = json.load(fh)
    with open(after_path, encoding="utf-8") as fh:
        after = json.load(fh)

    after_by_id = {c["id"]: c for c in after["cases"]}
    print(f"\n{before_path} -> {after_path}\n" + "=" * 72)
    for b in before["cases"]:
        a = after_by_id.get(b["id"])
        # Each stat block on a case is built from the same list of successful
        # runs, so a case whose runs all errored is None throughout and cannot
        # be compared at all.
        keys = ("latency_s", "total_tokens", "llm_calls")
        if a is None or not all(b.get(k) and a.get(k) for k in keys):
            print(f"  {b['id']:24} not comparable")
            continue
        bl, al = b["latency_s"]["median"], a["latency_s"]["median"]
        bt, at = b["total_tokens"]["median"], a["total_tokens"]["median"]
        bc, ac = b["llm_calls"]["median"], a["llm_calls"]["median"]
        print(f"  {b['id']:24} path={a['path']}")
        print(f"      latency median  {bl:7.2f}s -> {al:7.2f}s  {_delta(bl, al)}")
        print(f"      tokens  median  {bt:7.0f}  -> {at:7.0f}   {_delta(bt, at)}")
        print(f"      llm calls       {bc:7.0f}  -> {ac:7.0f}   {_delta(bc, ac)}")

    print("\n  pooled by path\n" + "-" * 72)
    for path in ("complex", "simple"):
        bagg = (before.get("by_path") or {}).get(path)
        aagg = (after.get("by_path") or {}).get(path)
        if not bagg or not aagg:
            continue
        bl, al = bagg["latency_s"]["median"], aagg["latency_s"]["median"]
        bt, at = bagg["total_tokens"]["median"], aagg["total_tokens"]["median"]
        print(f"  {path:8} latency median {bl:6.2f}s -> {al:6.2f}s"
              f"  {_delta(bl, al)}"
              f"   tokens {bt:.0f} -> {at:.0f}  {_delta(bt, at)}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="ScholarSync agent benchmark.")
    parser.add_argument("--reps", type=int, default=3, help="runs per case")
    parser.add_argument("--case", action="append", help="run only this case id")
    parser.add_argument("--json", help="write the report here")
    parser.add_argument("--compare", nargs=2, metavar=("BEFORE", "AFTER"),
                        help="diff two reports instead of running")
    args = parser.parse_args()

    if args.compare:
        raise SystemExit(compare(*args.compare))
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()

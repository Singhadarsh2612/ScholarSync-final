"""Tests for the concurrent explorer stage.

    python -m unittest discover -s tests -t . -v

Offline by design: the single LLM funnel (`swarm_agents._llm_call`) is stubbed,
so nothing here spends a token or needs a credential, and the suite is safe to
run on every commit.

The topology tests exist because the parallelism is a property of the graph's
edges, not of any function body -- re-chaining the explorers sequentially would
still produce correct answers, just slowly, and nothing else would catch it.
"""

import asyncio
import json
import time
import unittest

from chatbot import swarm_agents
from chatbot.graph import EXPLORERS, builder, merge_explorer_outputs

# Long enough to time reliably on a loaded machine, short enough to keep the
# suite fast. Three sequential calls would cost 3x this.
STUB_LATENCY_S = 0.2


class MergeExplorerOutputs(unittest.TestCase):
    """The reducer that collects the concurrent writes."""

    def test_concatenates_concurrent_writes(self):
        state = merge_explorer_outputs([{"explorer": "ToolHeavy"}],
                                       [{"explorer": "Minimal"}])
        self.assertEqual([o["explorer"] for o in state],
                         ["ToolHeavy", "Minimal"])

    def test_tolerates_missing_existing_value(self):
        self.assertEqual(merge_explorer_outputs(None, [{"explorer": "A"}]),
                         [{"explorer": "A"}])

    def test_empty_write_resets(self):
        """ComplexityAnalyzer clears this key with [] at the start of a turn.

        Under plain operator.add that reset would be a no-op, which is the
        whole reason this reducer is hand-written.
        """
        self.assertEqual(merge_explorer_outputs([{"explorer": "stale"}], []), [])

    def test_consecutive_turns_do_not_accumulate(self):
        """Two turns on one thread must leave three plans, not six."""
        state = []
        for _turn in range(2):
            state = merge_explorer_outputs(state, [])  # base_reset
            for name in ("ToolHeavy", "Minimal", "Balanced"):
                state = merge_explorer_outputs(state, [{"explorer": name}])
            self.assertEqual(
                len(state), 3,
                "explorer plans leaked across turns on the same thread")


class GraphTopology(unittest.TestCase):
    """Parallelism lives in the edge set, so assert on the edge set."""

    def test_planner_fans_out_to_every_explorer(self):
        for explorer in EXPLORERS:
            self.assertIn(("Planner", explorer), builder.edges)

    def test_every_explorer_feeds_fitness_evaluator(self):
        for explorer in EXPLORERS:
            self.assertIn((explorer, "FitnessEvaluator"), builder.edges)

    def test_explorers_are_not_chained_to_each_other(self):
        """The regression guard: a chain still works, it is just 3x slower."""
        chained = [(a, b) for a in EXPLORERS for b in EXPLORERS
                   if (a, b) in builder.edges]
        self.assertEqual(chained, [],
                         f"explorers run sequentially again via {chained}")

    def test_fitness_evaluator_still_leads_to_execution(self):
        self.assertIn(("FitnessEvaluator", "ExecutorNode"), builder.edges)


class ExplorerBehaviour(unittest.IsolatedAsyncioTestCase):
    """The explorer coroutines themselves, with the LLM stubbed out."""

    def setUp(self):
        self._real_llm_call = swarm_agents._llm_call
        self.calls = []

        async def stub(llm, system, human):
            started = time.perf_counter()
            await asyncio.sleep(STUB_LATENCY_S)
            self.calls.append((started, time.perf_counter()))
            return json.dumps({
                "execution_plan": [
                    {"tool": "get_marks_raw", "parameters": {}, "order": 1}
                ]
            })

        swarm_agents._llm_call = stub

    def tearDown(self):
        swarm_agents._llm_call = self._real_llm_call

    async def test_explorer_returns_only_its_own_output(self):
        """Appending to the existing value would double-count under the
        reducer, and would race anyway: all three see the pre-fan-out state."""
        state = {"messages": [], "planner_steps": [],
                 "explorer_outputs": [{"explorer": "stale"}]}
        update = await swarm_agents.run_minimal_explorer(state)

        self.assertEqual(len(update["explorer_outputs"]), 1)
        self.assertEqual(update["explorer_outputs"][0]["explorer"], "Minimal")

    async def test_explorer_keeps_only_known_tools(self):
        async def bad_plan(llm, system, human):
            return json.dumps({"execution_plan": [
                {"tool": "get_marks_raw"}, {"tool": "definitely_not_a_tool"}]})

        swarm_agents._llm_call = bad_plan
        update = await swarm_agents.run_balanced_explorer(
            {"messages": [], "planner_steps": []})
        plan = update["explorer_outputs"][0]["plan"]
        self.assertEqual([s["tool"] for s in plan], ["get_marks_raw"])

    async def test_explorers_overlap_in_time(self):
        """What the fan-out actually buys: one explorer's latency, not three."""
        state = {"messages": [], "planner_steps": []}
        started = time.perf_counter()
        updates = await asyncio.gather(
            swarm_agents.run_tool_heavy_explorer(state),
            swarm_agents.run_minimal_explorer(state),
            swarm_agents.run_balanced_explorer(state),
        )
        elapsed = time.perf_counter() - started

        self.assertLess(
            elapsed, STUB_LATENCY_S * 2,
            f"three explorers took {elapsed:.2f}s; they ran sequentially")

        # Stronger than wall-clock alone: all three were in flight at once.
        starts = [c[0] for c in self.calls]
        ends = [c[1] for c in self.calls]
        self.assertLess(max(starts), min(ends),
                        "no instant had all three explorers in flight")

        collected = []
        for update in updates:
            collected = merge_explorer_outputs(collected,
                                               update["explorer_outputs"])
        self.assertEqual(
            sorted(o["explorer"] for o in collected),
            ["Balanced", "Minimal", "ToolHeavy"])


if __name__ == "__main__":
    unittest.main()

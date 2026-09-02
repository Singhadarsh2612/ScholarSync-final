"""Tests for the evidence the fabrication judge scores against.

    python -m unittest discover -s tests -t . -v

Offline: no judge is called, only the string assembly is exercised.

This exists because the first version silently clipped every tool at 4000
chars. get_exams_raw returns ~7.3 KB, so it was cut mid-record, and the judge
-- shown a subject with no date attached -- scored a correct answer 0.00 for
fabrication while correctness scored the same answer 1.00. A metric that
disagrees with itself is worse than no metric, and nothing in the report said
the input had been truncated.
"""

import unittest

from evaluation.runner import (EVIDENCE_CHARS_PER_TOOL, EVIDENCE_CHARS_TOTAL,
                               _evidence)


def _result(tool, body):
    return {"tool": tool, "result_str": body}


class EvidenceBudget(unittest.TestCase):

    def test_no_results_abstains(self):
        """None makes no_fabrication return n/a rather than guess."""
        self.assertIsNone(_evidence([]))

    def test_small_payload_is_passed_whole(self):
        evidence = _evidence([_result("get_marks_raw", "marks payload")])
        self.assertIn("[get_marks_raw]", evidence)
        self.assertIn("marks payload", evidence)
        self.assertNotIn("TRUNCATED", evidence)

    def test_real_exam_payload_is_not_clipped(self):
        """The 7.3 KB payload that caused the original false verdict."""
        evidence = _evidence([_result("get_exams_raw", "e" * 7286)])
        self.assertNotIn("TRUNCATED", evidence)

    def test_oversized_payload_is_marked_not_silently_cut(self):
        body = "x" * (EVIDENCE_CHARS_PER_TOOL + 5000)
        evidence = _evidence([_result("big", body)])
        self.assertIn("TRUNCATED HERE", evidence)
        self.assertIn("5000 more", evidence,
                      "the judge should be told how much it cannot see")

    def test_every_tool_is_represented(self):
        evidence = _evidence([_result("a", "aaa"), _result("b", "bbb"),
                              _result("c", "ccc")])
        for tool in ("[a]", "[b]", "[c]"):
            self.assertIn(tool, evidence)

    def test_total_budget_is_enforced(self):
        """Many large tools must not produce an unbounded judge prompt."""
        results = [_result(f"t{i}", "y" * EVIDENCE_CHARS_PER_TOOL)
                   for i in range(10)]
        evidence = _evidence(results)
        overhead = 200 * len(results)  # headers and truncation markers
        self.assertLessEqual(len(evidence), EVIDENCE_CHARS_TOTAL + overhead)

    def test_falls_back_to_result_when_no_result_str(self):
        evidence = _evidence([{"tool": "t", "result": ["a", "b"]}])
        self.assertIn("'a'", evidence)


if __name__ == "__main__":
    unittest.main()

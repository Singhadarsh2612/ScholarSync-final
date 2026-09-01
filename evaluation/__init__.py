"""Evaluation for the ScholarSync agent and its RAG pipeline.

    python -m evaluation.runner --agent
    python -m evaluation.runner --rag

Metrics live in agent_metrics.py and rag_metrics.py; judged scoring is shared
via judge.py; cases are data in datasets.py.
"""

from . import agent_metrics, datasets, judge, rag_metrics

__all__ = ["agent_metrics", "rag_metrics", "judge", "datasets"]

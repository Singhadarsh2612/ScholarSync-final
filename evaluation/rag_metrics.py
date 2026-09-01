"""RAG metrics for the assignment solver.

The RAG triad, each isolating a different failure:

  context_relevance  did retrieval fetch the right chunks?      (retriever)
  faithfulness       is the answer supported by those chunks?   (generator)
  answer_relevance   does the answer address the question?      (generator)

A low faithfulness score with high context relevance means the model is
inventing despite good retrieval; the reverse means retrieval is the problem.
"""

import asyncio

from .judge import score

MAX_CONTEXT_CHARS = 12000


def _format_contexts(contexts):
    if not contexts:
        return ""
    joined, total = [], 0
    for i, chunk in enumerate(contexts, 1):
        piece = f"[chunk {i}]\n{chunk}"
        if total + len(piece) > MAX_CONTEXT_CHARS:
            joined.append(f"[{len(contexts) - i + 1} further chunks omitted]")
            break
        joined.append(piece)
        total += len(piece)
    return "\n\n".join(joined)


async def context_relevance(question, contexts):
    return await score(
        "context_relevance",
        "Judge whether the retrieved chunks contain information needed to "
        "answer the question. Score the proportion that is on-topic and "
        "useful. Ignore whether an answer was produced.",
        {"Question": question, "Retrieved chunks": _format_contexts(contexts)},
    )


async def faithfulness(answer, contexts):
    return await score(
        "faithfulness",
        "Judge whether EVERY factual claim in the answer is supported by the "
        "retrieved chunks. Any claim not derivable from them is a "
        "hallucination and must lower the score sharply. Generic "
        "encouragement or offers to help are not factual claims and should be "
        "ignored. Do not use outside knowledge.",
        {"Retrieved chunks": _format_contexts(contexts), "Answer": answer},
    )


async def answer_relevance(question, answer):
    return await score(
        "answer_relevance",
        "Judge whether the answer actually addresses the question asked. "
        "Penalise evasion, padding, and answers to a different question. A "
        "correct refusal for information genuinely absent from the source "
        "scores high.",
        {"Question": question, "Answer": answer},
    )


async def evaluate(question, answer, contexts, expect_refusal=False):
    """Run the triad concurrently and return {metric: result} plus a mean.

    `expect_refusal` marks a case where the document genuinely lacks the
    answer. context_relevance is then still reported but excluded from the
    mean: scoring 0.0 is the correct outcome for retrieval when nothing
    relevant exists, so averaging it in would fail a system that behaved
    perfectly by declining.
    """
    results = await asyncio.gather(
        context_relevance(question, contexts),
        faithfulness(answer, contexts),
        answer_relevance(question, answer),
    )
    by_name: dict = {r["metric"]: r for r in results}

    counted = [r for r in results
               if not (expect_refusal and r["metric"] == "context_relevance")]
    scored = [r["score"] for r in counted if r["score"] is not None]
    by_name["_mean"] = round(sum(scored) / len(scored), 3) if scored else None
    by_name["_context_count"] = len(contexts or [])
    by_name["_expect_refusal"] = expect_refusal
    return by_name


def retrieve(question, assignment_url):
    """Index if needed, then fetch the chunks the solver would use.

    Mirrors solve_assignment's retrieval so metrics score the same context the
    answer was generated from.
    """
    from assignment_solver import index_document, _vector_search

    # index_document raises outright when Azure AI Search is unconfigured, so
    # it has to be inside the guard: a missing credential should fail this one
    # case, not abort the whole suite with a traceback.
    try:
        doc_key = index_document(assignment_url)
    except Exception as exc:
        return None, f"indexing failed -- {type(exc).__name__}: {exc}"[:220]

    if not doc_key:
        return None, "indexing failed (check embeddings and Azure AI Search)"
    try:
        return _vector_search(question, [doc_key]), None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"[:200]

"""Metrics for agent responses.

`grounding` is the one that matters most here: the assignments bug produced a
fluent, helpful-sounding answer that contradicted the portal. Correctness
against expected facts is what catches that class of failure — a generic
quality score rates it highly.
"""

import asyncio

from .judge import score


async def correctness(question, answer, expected):
    return await score(
        "correctness",
        "Judge whether the answer is consistent with the expected facts. "
        "Wording may differ freely. Any statement that contradicts an expected "
        "fact, or denies the existence of something listed there, is a "
        "failure and must score below 0.3.",
        {"Question": question, "Expected facts": expected, "Answer": answer},
    )


async def no_fabrication(question, answer):
    return await score(
        "no_fabrication",
        "Judge whether the answer invents specifics it could not know — "
        "scores, dates, titles or names presented as the student's real data. "
        "Explicitly saying data is unavailable scores 1.0. Inventing "
        "plausible-looking records scores 0.0.",
        {"Question": question, "Answer": answer},
    )


async def helpfulness(question, answer):
    return await score(
        "helpfulness",
        "Judge whether a student could act on this answer: is it direct, "
        "concrete, and free of filler? Penalise asking for information the "
        "system already has, and internal artefacts leaking into the reply "
        "(for example 'here is a revised version of your feedback').",
        {"Question": question, "Answer": answer},
    )


async def tool_choice(question, tools_used, expected_tools):
    used = ", ".join(tools_used) or "(none)"
    want = ", ".join(expected_tools) or "(none)"
    return await score(
        "tool_choice",
        "Judge whether the tools called were the right ones for the question. "
        "Missing a required tool is a serious failure. Extra harmless calls "
        "are a minor deduction.",
        {"Question": question, "Tools expected": want, "Tools called": used},
        allow_na=not expected_tools,
    )


async def evaluate(question, answer, *, expected=None, expected_tools=None,
                   tools_used=None):
    """Run the applicable agent metrics concurrently."""
    jobs = [no_fabrication(question, answer), helpfulness(question, answer)]
    if expected:
        jobs.append(correctness(question, answer, expected))
    if expected_tools is not None:
        jobs.append(tool_choice(question, tools_used or [], expected_tools))

    results = await asyncio.gather(*jobs)
    by_name: dict = {r["metric"]: r for r in results}
    scored = [r["score"] for r in results if r["score"] is not None]
    by_name["_mean"] = round(sum(scored) / len(scored), 3) if scored else None
    return by_name

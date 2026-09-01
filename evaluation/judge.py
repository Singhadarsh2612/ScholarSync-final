"""LLM-as-judge primitive shared by every metric.

Scoring runs on its own client rather than the agent's, so a judge call never
consumes the agent's rate limit budget and can be pointed at a stronger model.
"""

import json
import os
import re

import azure_env


def _judge_deployment():
    """Deployment used for scoring. Defaults to the strongest one available."""
    return azure_env.env_any("EVAL_JUDGE_DEPLOYMENT",
                             default=azure_env.gpt4o_deployment())


_client = None


def _get_client():
    global _client
    if _client is None:
        from langchain_openai import AzureChatOpenAI
        endpoint = azure_env.openai_endpoint()
        api_key = azure_env.openai_key()
        if not endpoint or not api_key:
            raise RuntimeError(
                "Evaluation needs AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY."
            )
        _client = AzureChatOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            azure_deployment=_judge_deployment(),
            api_version=azure_env.api_version(),
            temperature=0,
            max_tokens=800,
        )
    return _client


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse(text):
    try:
        return json.loads(text)
    except Exception:
        pass
    match = _JSON_RE.search(text or "")
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None


async def score(name, instructions, payload, *, allow_na=False):
    """Run one judged metric.

    Returns {metric, score (0..1 or None), verdict, reason, error}. Never
    raises: a judge failure is reported as a result, not an exception, so one
    bad metric cannot abandon a whole evaluation run.
    """
    na_clause = (
        '\n- If the question cannot be judged from what you were given, use '
        '{"score": null, "verdict": "n/a"}.' if allow_na else ""
    )
    system = (
        f"You are a strict evaluator for the metric '{name}'.\n"
        f"{instructions}\n\n"
        "Reply with ONLY a JSON object:\n"
        '{"score": <float 0.0-1.0>, "verdict": "<pass|fail|partial>", '
        '"reason": "<one sentence>"}\n'
        "- 1.0 is perfect, 0.0 is a total failure. Be sparing with 1.0."
        f"{na_clause}"
    )

    body = "\n\n".join(f"### {k}\n{v}" for k, v in payload.items() if v)

    try:
        response = await _get_client().ainvoke(
            [{"role": "system", "content": system},
             {"role": "user", "content": body}]
        )
    except Exception as exc:
        return {"metric": name, "score": None, "verdict": "error",
                "reason": "", "error": f"{type(exc).__name__}: {exc}"[:200]}

    parsed = _parse(response.content or "")
    if parsed is None:
        return {"metric": name, "score": None, "verdict": "error",
                "reason": (response.content or "")[:160],
                "error": "judge did not return JSON"}

    raw = parsed.get("score")
    value = None
    if isinstance(raw, (int, float)):
        value = max(0.0, min(1.0, float(raw)))

    return {"metric": name, "score": value,
            "verdict": parsed.get("verdict", "unknown"),
            "reason": (parsed.get("reason") or "")[:300], "error": None}

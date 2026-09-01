"""
azure_env.py
─────────────────────────────────────────────────────────────────────────────
Single source of truth for Azure credentials, mirroring what endpoints.py does
for service URLs.

Why this exists
---------------
The same credential was being read under different names in different files,
and a real .env in the wild does not always use the name the code happens to
expect. Rather than force one spelling, every value here resolves through an
ordered list of aliases: the first name that holds a non-empty value wins.

Two consequences worth knowing:

1.  **One Azure OpenAI resource is enough.** The role-specific chains
    (mini_2, gpt-4o, embeddings) fall back to AZURE_OPENAI_ENDPOINT /
    AZURE_OPENAI_API_KEY. Set only those two and everything works; override a
    role's own variables when you genuinely want it on a separate resource.

2.  **Renaming a variable does not break the app.** Add the old name to the
    relevant chain instead of editing call sites.

No side effects beyond load_dotenv(), so importing this never needs
credentials to be present.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# Fallback used when no *_API_VERSION is set. Azure requires an explicit
# api-version on every request; this is the value the project was built on.
DEFAULT_API_VERSION = "2024-02-15-preview"
DEFAULT_EMBEDDING_API_VERSION = "2024-02-01"


def env_any(*names, default=None):
    """Return the first non-empty value among `names`, else `default`.

    Blank ("KEY=") counts as unset, which matters because .env files are
    routinely left with empty placeholders rather than having lines deleted.
    """
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return default


# ── Alias chains ────────────────────────────────────────────────────────────
# Order is precedence. Keep the role-specific name first and the shared
# AZURE_OPENAI_* fallback last.

_ENDPOINT = ("AZURE_OPENAI_ENDPOINT",)
_KEY = ("AZURE_OPENAI_API_KEY",)

_MINI_2_ENDPOINT = ("MINI_2_ENDPOINT", "GPT41MINI_ENDPOINT") + _ENDPOINT
_MINI_2_KEY = ("MINI_2_API_KEY", "GPT41MINI_API_KEY") + _KEY
_MINI_2_DEPLOYMENT = ("MINI_2_DEPLOYMENT", "GPT41MINI_DEPLOYMENT",
                      "GPT4O_MINI_DEPLOYMENT", "DEPLOYMENT_NAME")

_GPT4O_ENDPOINT = ("GPT4O_ENDPOINT",) + _ENDPOINT
_GPT4O_KEY = ("GPT4O_API_KEY",) + _KEY
_GPT4O_DEPLOYMENT = ("GPT4O_DEPLOYMENT",)

_CHAT_DEPLOYMENT = ("DEPLOYMENT_NAME", "GPT4O_MINI_DEPLOYMENT")

_EMB_ENDPOINT = ("AZURE_EMBEDDING_ENDPOINT", "EMBEDDING_ENDPOINT") + _ENDPOINT
_EMB_KEY = ("AZURE_EMBEDDING_API_KEY", "EMBEDDING_API_KEY") + _KEY
_EMB_DEPLOYMENT = ("AZURE_EMBEDDING_DEPLOYMENT", "EMBEDDING_DEPLOYMENT")

_SEARCH_KEY = ("AZURE_SEARCH_ADMIN_KEY", "AZURE_SEARCH_API_KEY",
               "AZURE_SEARCH_KEY")


# ── Chat models ─────────────────────────────────────────────────────────────

def api_version():
    return env_any("AZURE_OPENAI_API_VERSION", default=DEFAULT_API_VERSION)


def openai_endpoint():
    return env_any(*_ENDPOINT)


def openai_key():
    return env_any(*_KEY)


def chat_deployment():
    """The gpt-4o-mini-class deployment used by most callers."""
    return env_any(*_CHAT_DEPLOYMENT, default="gpt-4o-mini")


def mini_2_endpoint():
    return env_any(*_MINI_2_ENDPOINT)


def mini_2_key():
    return env_any(*_MINI_2_KEY)


def mini_2_deployment():
    return env_any(*_MINI_2_DEPLOYMENT, default="gpt-4o-mini")


def gpt4o_endpoint():
    return env_any(*_GPT4O_ENDPOINT)


def gpt4o_key():
    return env_any(*_GPT4O_KEY)


def gpt4o_deployment():
    return env_any(*_GPT4O_DEPLOYMENT, default="gpt-4o")


# ── Embeddings ──────────────────────────────────────────────────────────────

def embedding_endpoint():
    return env_any(*_EMB_ENDPOINT)


def embedding_key():
    return env_any(*_EMB_KEY)


def embedding_deployment():
    return env_any(*_EMB_DEPLOYMENT, default="text-embedding-3-small")


def embedding_api_version():
    return env_any("AZURE_EMBEDDING_API_VERSION", "AZURE_OPENAI_API_VERSION",
                   default=DEFAULT_EMBEDDING_API_VERSION)


# ── Azure AI Search ─────────────────────────────────────────────────────────

def search_endpoint():
    return env_any("AZURE_SEARCH_ENDPOINT")


def search_key():
    return env_any(*_SEARCH_KEY)


def search_index():
    return env_any("AZURE_SEARCH_INDEX_NAME", default="scholarsync-docs")


# ── Speech ──────────────────────────────────────────────────────────────────

def speech_key():
    return env_any("AZURE_SPEECH_KEY")


def speech_region():
    return env_any("AZURE_SPEECH_REGION", default="eastus")


# ── Diagnostics ─────────────────────────────────────────────────────────────

def credential_report():
    """Which capabilities have an endpoint and key resolved.

    Returns {capability: (ok, detail)} — safe to log, since it never includes
    a secret's value.

    This checks only that credentials RESOLVE. It cannot tell you whether a
    deployment name exists in your Azure resource; a wrong name passes here and
    then fails at request time with `DeploymentNotFound`. Use
    `python azure_env.py --live` for that.
    """
    return {
        "chat (llm_mini_1)": (
            bool(openai_endpoint() and openai_key()),
            f"deployment={chat_deployment()}",
        ),
        "chat (llm_mini_2)": (
            bool(mini_2_endpoint() and mini_2_key()),
            f"deployment={mini_2_deployment()}",
        ),
        "chat (llm_4o)": (
            bool(gpt4o_endpoint() and gpt4o_key()),
            f"deployment={gpt4o_deployment()}",
        ),
        "embeddings": (
            bool(embedding_endpoint() and embedding_key()),
            f"deployment={embedding_deployment()}",
        ),
        "azure ai search": (
            bool(search_endpoint() and search_key()),
            f"index={search_index()}",
        ),
        "speech (TTS/STT)": (
            bool(speech_key()),
            f"region={speech_region()}",
        ),
    }


def list_deployments():
    """Names actually deployed in the Azure OpenAI resource.

    Returns a list of (name, model) or raises. Uses the data-plane listing
    endpoint, so the same api-key the app uses is enough — no ARM credentials.
    """
    import json
    import urllib.request

    endpoint = (openai_endpoint() or "").rstrip("/")
    key = openai_key()
    if not endpoint or not key:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY unset.")

    url = f"{endpoint}/openai/deployments?api-version=2023-03-15-preview"
    req = urllib.request.Request(url, headers={"api-key": key})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)
    return [(d.get("id"), d.get("model")) for d in data.get("data", [])]


def _live_report():
    """Check each configured deployment against what Azure really has."""
    print("\nDeployments in the Azure OpenAI resource")
    print("-" * 52)
    try:
        deployed = list_deployments()
    except Exception as exc:
        print(f"  could not list deployments: {type(exc).__name__}: {exc}")
        return

    for name, model in deployed:
        print(f"  {name:28} model={model}")

    names = {n for n, _ in deployed}
    print("\nConfigured names vs. what exists")
    print("-" * 52)
    configured = [
        ("llm_mini_1 / interview", chat_deployment()),
        ("llm_mini_2", mini_2_deployment()),
        ("llm_4o", gpt4o_deployment()),
        ("embeddings", embedding_deployment()),
    ]
    for role, name in configured:
        ok = name in names
        note = "" if ok else "   <- not deployed; will 404 at request time"
        print(f"  {'OK     ' if ok else 'MISSING'} {role:24} {name}{note}")


if __name__ == "__main__":
    import sys

    # ASCII only: a redirected Windows console is cp1252 and cannot encode
    # box-drawing characters.
    print("Azure credential resolution\n" + "-" * 52)
    for name, (ok, detail) in credential_report().items():
        print(f"  {'OK     ' if ok else 'MISSING'} {name:20} {detail}")

    if "--live" in sys.argv:
        _live_report()
    else:
        print("\n(credentials only — run with --live to check that each "
              "deployment name exists in Azure)")

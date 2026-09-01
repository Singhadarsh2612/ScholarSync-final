"""Azure credential resolution.

Every value resolves through an ordered list of aliases; the first non-empty
one wins. The role-specific chains end at AZURE_OPENAI_*, so one Azure OpenAI
resource can serve all roles.

    python azure_env.py           # what resolves
    python azure_env.py --live    # also check each deployment exists in Azure
"""

import os

from dotenv import load_dotenv

load_dotenv()

DEFAULT_API_VERSION = "2024-02-15-preview"
DEFAULT_EMBEDDING_API_VERSION = "2024-02-01"


def env_any(*names, default=None):
    """First non-empty value among `names`. Blank counts as unset."""
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return default


_ENDPOINT = ("AZURE_OPENAI_ENDPOINT",)
_KEY = ("AZURE_OPENAI_API_KEY",)

_MINI_2_ENDPOINT = ("MINI_2_ENDPOINT", "GPT41MINI_ENDPOINT") + _ENDPOINT
_MINI_2_KEY = ("MINI_2_API_KEY", "GPT41MINI_API_KEY") + _KEY
_MINI_2_DEPLOYMENT = ("MINI_2_DEPLOYMENT", "GPT41MINI_DEPLOYMENT",
                      "GPT4O_MINI_DEPLOYMENT", "DEPLOYMENT_NAME")

_GPT4O_ENDPOINT = ("GPT4O_ENDPOINT",) + _ENDPOINT
_GPT4O_KEY = ("GPT4O_API_KEY",) + _KEY

_CHAT_DEPLOYMENT = ("DEPLOYMENT_NAME", "GPT4O_MINI_DEPLOYMENT")

_EMB_ENDPOINT = ("AZURE_EMBEDDING_ENDPOINT", "EMBEDDING_ENDPOINT") + _ENDPOINT
_EMB_KEY = ("AZURE_EMBEDDING_API_KEY", "EMBEDDING_API_KEY") + _KEY
_EMB_DEPLOYMENT = ("AZURE_EMBEDDING_DEPLOYMENT", "EMBEDDING_DEPLOYMENT")

_SEARCH_KEY = ("AZURE_SEARCH_ADMIN_KEY", "AZURE_SEARCH_API_KEY",
               "AZURE_SEARCH_KEY")


def api_version():
    return env_any("AZURE_OPENAI_API_VERSION", default=DEFAULT_API_VERSION)


def openai_endpoint():
    return env_any(*_ENDPOINT)


def openai_key():
    return env_any(*_KEY)


def chat_deployment():
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
    return env_any("GPT4O_DEPLOYMENT", default="gpt-4o")


def embedding_endpoint():
    return env_any(*_EMB_ENDPOINT)


def embedding_key():
    return env_any(*_EMB_KEY)


def embedding_deployment():
    return env_any(*_EMB_DEPLOYMENT, default="text-embedding-3-small")


def embedding_api_version():
    return env_any("AZURE_EMBEDDING_API_VERSION", "AZURE_OPENAI_API_VERSION",
                   default=DEFAULT_EMBEDDING_API_VERSION)


def search_endpoint():
    return env_any("AZURE_SEARCH_ENDPOINT")


def search_key():
    return env_any(*_SEARCH_KEY)


def search_index():
    return env_any("AZURE_SEARCH_INDEX_NAME", default="scholarsync-docs")


def speech_key():
    return env_any("AZURE_SPEECH_KEY")


def speech_region():
    return env_any("AZURE_SPEECH_REGION", default="eastus")


def credential_report():
    """{capability: (has_endpoint_and_key, detail)}. Never includes a secret.

    Only checks that credentials resolve — a deployment name that does not
    exist in Azure passes here and fails at request time. Use --live for that.
    """
    return {
        "chat (llm_mini_1)": (bool(openai_endpoint() and openai_key()),
                              f"deployment={chat_deployment()}"),
        "chat (llm_mini_2)": (bool(mini_2_endpoint() and mini_2_key()),
                              f"deployment={mini_2_deployment()}"),
        "chat (llm_4o)": (bool(gpt4o_endpoint() and gpt4o_key()),
                          f"deployment={gpt4o_deployment()}"),
        "embeddings": (bool(embedding_endpoint() and embedding_key()),
                       f"deployment={embedding_deployment()}"),
        "azure ai search": (bool(search_endpoint() and search_key()),
                            f"index={search_index()}"),
        "speech (TTS/STT)": (bool(speech_key()), f"region={speech_region()}"),
    }


def list_deployments():
    """[(name, model)] actually deployed. Uses the data-plane listing endpoint,
    so the app's api-key is enough — no ARM credentials."""
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
    print("\nDeployments in the Azure OpenAI resource\n" + "-" * 52)
    try:
        deployed = list_deployments()
    except Exception as exc:
        print(f"  could not list deployments: {type(exc).__name__}: {exc}")
        return

    for name, model in deployed:
        print(f"  {name:28} model={model}")

    names = {n for n, _ in deployed}
    print("\nConfigured names vs. what exists\n" + "-" * 52)
    for role, name in [("llm_mini_1 / interview", chat_deployment()),
                       ("llm_mini_2", mini_2_deployment()),
                       ("llm_4o", gpt4o_deployment()),
                       ("embeddings", embedding_deployment())]:
        ok = name in names
        note = "" if ok else "   <- not deployed; will 404 at request time"
        print(f"  {'OK     ' if ok else 'MISSING'} {role:24} {name}{note}")


if __name__ == "__main__":
    import sys

    # ASCII only: a redirected Windows console is cp1252.
    print("Azure credential resolution\n" + "-" * 52)
    for name, (ok, detail) in credential_report().items():
        print(f"  {'OK     ' if ok else 'MISSING'} {name:20} {detail}")

    if "--live" in sys.argv:
        _live_report()
    else:
        print("\n(credentials only — run with --live to check deployment names)")

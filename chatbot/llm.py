"""
chatbot/llm.py
─────────────────────────────────────────────────────────────────────────────
Three named Azure OpenAI instances — strict role/key separation.

  llm_mini_1  key1 → gpt-4o-mini  (ComplexityAnalyzer, SimpleRetriever)
  llm_mini_2  key2 → gpt-4o-mini  (Explorers, FitnessEval, Exploiter,
                                    PresentationAgent, Critic)
  llm_4o      key3 → gpt-4o       (Planner ONLY)

Clients are built lazily on first use so that importing this module — and
therefore importing `server` — never requires credentials to be present.
Aliases llm / tool_llm kept for any legacy imports.

Credentials are resolved through azure_env, so each role falls back to the
shared AZURE_OPENAI_* pair when it has no endpoint/key of its own. One Azure
OpenAI resource therefore serves all three.
"""

from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI

import azure_env

load_dotenv()

# Kept as a module attribute for any caller that imported it.
API_VERSION = azure_env.api_version()


class _LazyLLM:
    """Builds its AzureChatOpenAI client on first attribute access.

    Every call site only ever reaches through to the underlying client
    (``.ainvoke`` today), so forwarding attribute lookups is enough to keep
    this a drop-in replacement for a module-level instance.

    The endpoint/key/deployment arguments are *callables* rather than variable
    names, because each one resolves through a chain of accepted aliases and
    is read at build time — not at import time.
    """

    def __init__(self, name, endpoint_fn, key_fn, deployment_fn, max_tokens,
                 hint):
        self._name = name
        self._endpoint_fn = endpoint_fn
        self._key_fn = key_fn
        self._deployment_fn = deployment_fn
        self._max_tokens = max_tokens
        self._hint = hint
        self._client = None

    def _build(self):
        endpoint = self._endpoint_fn()
        api_key = self._key_fn()

        if not endpoint or not api_key:
            missing = "endpoint" if not endpoint else "API key"
            raise RuntimeError(
                f"Cannot build LLM '{self._name}': no {missing} resolved. "
                f"Set {self._hint} (or the shared AZURE_OPENAI_ENDPOINT / "
                f"AZURE_OPENAI_API_KEY) in .env. Run "
                f"`python azure_env.py` to see what resolves."
            )

        return AzureChatOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            azure_deployment=self._deployment_fn(),
            api_version=azure_env.api_version(),
            temperature=0,
            max_tokens=self._max_tokens,
            streaming=False,
        )

    @property
    def client(self):
        if self._client is None:
            self._client = self._build()
        return self._client

    def __getattr__(self, item):
        # Only reached for names not found on the proxy itself.
        return getattr(self.client, item)

    def __repr__(self):
        state = "built" if self._client is not None else "not built"
        return f"<_LazyLLM {self._name} ({state})>"


llm_mini_1 = _LazyLLM(
    "llm_mini_1",
    azure_env.openai_endpoint, azure_env.openai_key,
    azure_env.chat_deployment, 1024,
    hint="AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY",
)

llm_mini_2 = _LazyLLM(
    "llm_mini_2",
    azure_env.mini_2_endpoint, azure_env.mini_2_key,
    azure_env.mini_2_deployment, 4096,
    hint="MINI_2_ENDPOINT / MINI_2_API_KEY (or GPT41MINI_*)",
)

llm_4o = _LazyLLM(
    "llm_4o",
    azure_env.gpt4o_endpoint, azure_env.gpt4o_key,
    azure_env.gpt4o_deployment, 4096,
    hint="GPT4O_ENDPOINT / GPT4O_API_KEY",
)


def get_llm(role: str):
    """Fetch one of the three role-scoped clients by name."""
    try:
        return {
            "mini_1": llm_mini_1,
            "mini_2": llm_mini_2,
            "4o": llm_4o,
        }[role]
    except KeyError:
        raise ValueError(
            f"Unknown LLM role '{role}'. Expected one of: mini_1, mini_2, 4o."
        ) from None


llm      = llm_mini_1   # general-purpose fallback
tool_llm = llm_mini_2   # tool-calling fallback

print(f"[LLM] Configured (lazy): llm_mini_1={azure_env.chat_deployment()} | "
      f"llm_mini_2={azure_env.mini_2_deployment()} | "
      f"llm_4o={azure_env.gpt4o_deployment()}")

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
"""

import os
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI

load_dotenv()

API_VERSION = "2024-02-15-preview"


class _LazyLLM:
    """Builds its AzureChatOpenAI client on first attribute access.

    Every call site only ever reaches through to the underlying client
    (``.ainvoke`` today), so forwarding attribute lookups is enough to keep
    this a drop-in replacement for a module-level instance.
    """

    def __init__(self, name, endpoint_var, key_var, deployment_var,
                 deployment_default, max_tokens):
        self._name = name
        self._endpoint_var = endpoint_var
        self._key_var = key_var
        self._deployment_var = deployment_var
        self._deployment_default = deployment_default
        self._max_tokens = max_tokens
        self._client = None

    def _build(self):
        endpoint = os.getenv(self._endpoint_var)
        api_key = os.getenv(self._key_var)

        missing = [v for v, val in ((self._endpoint_var, endpoint),
                                    (self._key_var, api_key)) if not val]
        if missing:
            raise RuntimeError(
                f"Cannot build LLM '{self._name}': missing environment "
                f"variable(s) {', '.join(missing)}. See .env.example."
            )

        return AzureChatOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            azure_deployment=os.getenv(self._deployment_var,
                                       self._deployment_default),
            api_version=API_VERSION,
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
    "llm_mini_1", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
    "DEPLOYMENT_NAME", "gpt-4o-mini", 1024,
)

llm_mini_2 = _LazyLLM(
    "llm_mini_2", "MINI_2_ENDPOINT", "MINI_2_API_KEY",
    "MINI_2_DEPLOYMENT", "gpt-4o-mini", 4096,
)

llm_4o = _LazyLLM(
    "llm_4o", "GPT4O_ENDPOINT", "GPT4O_API_KEY",
    "GPT4O_DEPLOYMENT", "gpt-4o", 4096,
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

print(f"[LLM] Configured (lazy): llm_mini_1={os.getenv('DEPLOYMENT_NAME', 'gpt-4o-mini')} | "
      f"llm_mini_2={os.getenv('MINI_2_DEPLOYMENT', 'gpt-4o-mini')} | "
      f"llm_4o={os.getenv('GPT4O_DEPLOYMENT', 'gpt-4o')}")

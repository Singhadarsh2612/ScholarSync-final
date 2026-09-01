"""Three named Azure OpenAI clients with strict role separation.

  llm_mini_1  ComplexityAnalyzer, SimpleRetriever
  llm_mini_2  Explorers, FitnessEval, Exploiter, PresentationAgent, Critic
  llm_4o      Planner only

Built lazily on first use, so importing this (and therefore `server`) never
requires credentials. Credentials resolve via azure_env, so each role falls
back to the shared AZURE_OPENAI_* pair.
"""

from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI

import azure_env

load_dotenv()

API_VERSION = azure_env.api_version()


class _LazyLLM:
    """Builds its AzureChatOpenAI client on first attribute access.

    Endpoint/key/deployment are callables, not variable names, because each
    resolves through a chain of aliases and is read at build time.
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
                f"Cannot build LLM '{self._name}': no {missing} resolved. Set "
                f"{self._hint} (or AZURE_OPENAI_ENDPOINT / "
                f"AZURE_OPENAI_API_KEY) in .env. Run `python azure_env.py`."
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
        return getattr(self.client, item)

    def __repr__(self):
        state = "built" if self._client is not None else "not built"
        return f"<_LazyLLM {self._name} ({state})>"


llm_mini_1 = _LazyLLM(
    "llm_mini_1", azure_env.openai_endpoint, azure_env.openai_key,
    azure_env.chat_deployment, 1024,
    hint="AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY",
)

llm_mini_2 = _LazyLLM(
    "llm_mini_2", azure_env.mini_2_endpoint, azure_env.mini_2_key,
    azure_env.mini_2_deployment, 4096,
    hint="MINI_2_ENDPOINT / MINI_2_API_KEY (or GPT41MINI_*)",
)

llm_4o = _LazyLLM(
    "llm_4o", azure_env.gpt4o_endpoint, azure_env.gpt4o_key,
    azure_env.gpt4o_deployment, 4096,
    hint="GPT4O_ENDPOINT / GPT4O_API_KEY",
)


def get_llm(role: str):
    try:
        return {"mini_1": llm_mini_1, "mini_2": llm_mini_2, "4o": llm_4o}[role]
    except KeyError:
        raise ValueError(
            f"Unknown LLM role '{role}'. Expected: mini_1, mini_2, 4o."
        ) from None


llm = llm_mini_1
tool_llm = llm_mini_2

print(f"[LLM] Configured (lazy): llm_mini_1={azure_env.chat_deployment()} | "
      f"llm_mini_2={azure_env.mini_2_deployment()} | "
      f"llm_4o={azure_env.gpt4o_deployment()}")

"""
interview/app/services/llm.py
─────────────────────────────────────────────────────────────────────────────
The interviewer's chat model.

Credentials resolve through azure_env, so this shares whatever the hub is
configured with instead of requiring its own variable names.
"""

from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI

import azure_env

load_dotenv()


def get_llm(agent_type: str):
    """Build a chat client for one of the interview agents.

    Raises a clear error rather than returning a client that will fail later
    with an opaque authentication message.
    """
    endpoint = azure_env.openai_endpoint()
    api_key = azure_env.openai_key()

    if not endpoint or not api_key:
        raise RuntimeError(
            "The interview service needs AZURE_OPENAI_ENDPOINT and "
            "AZURE_OPENAI_API_KEY. Run `python azure_env.py` to see what "
            f"currently resolves. (requested agent: {agent_type})"
        )

    return AzureChatOpenAI(
        azure_deployment=azure_env.chat_deployment(),
        api_version=azure_env.api_version(),
        azure_endpoint=endpoint,
        api_key=api_key,
        temperature=0.7,
    )

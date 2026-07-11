"""
chatbot/llm.py
─────────────────────────────────────────────────────────────────────────────
Three named Azure OpenAI instances — strict role/key separation.

  llm_mini_1  key1 → gpt-4o-mini  (ComplexityAnalyzer, SimpleRetriever)
  llm_mini_2  key2 → gpt-4o-mini  (Explorers, FitnessEval, Exploiter,
                                    PresentationAgent, Critic)
  llm_4o      key3 → gpt-4o       (Planner ONLY)

Aliases llm / tool_llm kept for any legacy imports.
"""

import os
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI

load_dotenv()

llm_mini_1 = AzureChatOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
    api_key=os.getenv("AZURE_OPENAI_API_KEY", ""),
    azure_deployment=os.getenv("DEPLOYMENT_NAME", "gpt-4o-mini"),
    api_version="2024-02-15-preview",
    temperature=0,
    max_tokens=1024,
    streaming=False,
)

llm_mini_2 = AzureChatOpenAI(
    azure_endpoint=os.getenv("MINI_2_ENDPOINT", ""),
    api_key=os.getenv("MINI_2_API_KEY", ""),
    azure_deployment=os.getenv("MINI_2_DEPLOYMENT", "gpt-4o-mini"),
    api_version="2024-02-15-preview",
    temperature=0,
    max_tokens=4096,
    streaming=False,
)

llm_4o = AzureChatOpenAI(
    azure_endpoint=os.getenv("GPT4O_ENDPOINT", ""),
    api_key=os.getenv("GPT4O_API_KEY", ""),
    azure_deployment=os.getenv("GPT4O_DEPLOYMENT", "gpt-4o"),
    api_version="2024-02-15-preview",
    temperature=0,
    max_tokens=4096,
    streaming=False,
)

llm      = llm_mini_1   # general-purpose fallback
tool_llm = llm_mini_2   # tool-calling fallback

print(f"[LLM] Loaded: llm_mini_1={os.getenv('DEPLOYMENT_NAME')} | "
      f"llm_mini_2={os.getenv('MINI_2_DEPLOYMENT')} | "
      f"llm_4o={os.getenv('GPT4O_DEPLOYMENT')}")
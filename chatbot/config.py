import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Only enable LangSmith tracing when an API key is actually configured;
# otherwise every run retries failed trace uploads in the background.
if os.getenv("LANGCHAIN_API_KEY"):
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT", "ScholarSync")
else:
    os.environ["LANGCHAIN_TRACING_V2"] = "false"

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

DATABASE_URL = os.getenv("DATABASE_URL")

threads = {}

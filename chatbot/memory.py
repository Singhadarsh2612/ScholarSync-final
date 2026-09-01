"""
chatbot/memory.py
─────────────────────────────────────────────────────────────────────────────
Conversation checkpointing for the LangGraph agent.

Postgres is the real store. When it is unreachable the app still starts, using
an in-memory checkpointer, so the rest of the hub (and the merged interview
service) stays usable during local development — threads just do not survive a
restart.
"""

from contextlib import asynccontextmanager

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from .config import DATABASE_URL
from .graph import builder

chatbot = None

# True when the process fell back to non-persistent memory.
using_memory_saver = False


@asynccontextmanager
async def _memory_saver_cm():
    """Match the async-context-manager shape the Postgres saver provides."""
    yield MemorySaver()


async def init_chatbot():
    """Compile the agent graph against the best available checkpointer.

    Returns the saver's context manager so the caller can close it on
    shutdown, mirroring the previous contract.
    """
    global chatbot, using_memory_saver

    if DATABASE_URL:
        saver_cm = AsyncPostgresSaver.from_conn_string(DATABASE_URL)
        try:
            saver = await saver_cm.__aenter__()
            await saver.setup()
            chatbot = builder.compile(checkpointer=saver)
            using_memory_saver = False
            print("✅ AsyncPostgresSaver initialized")
            return saver_cm
        except Exception as e:
            print(f"⚠️  Postgres checkpointer unavailable: {e}")
    else:
        print("⚠️  DATABASE_URL is not set.")

    print("⚠️  Falling back to in-memory checkpointer — "
          "conversation threads will NOT survive a restart.")

    saver_cm = _memory_saver_cm()
    saver = await saver_cm.__aenter__()
    chatbot = builder.compile(checkpointer=saver)
    using_memory_saver = True
    return saver_cm

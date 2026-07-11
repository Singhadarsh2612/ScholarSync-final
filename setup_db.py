import os
import asyncio
import selectors
from dotenv import load_dotenv
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def main():
    async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as saver:
        await saver.setup()

if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector())
    )

print("Database setup complete")

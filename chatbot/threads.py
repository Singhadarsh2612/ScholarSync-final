
from . import memory
from .config import DATABASE_URL
import psycopg
import psycopg.rows


async def get_all_threads():

    if memory.chatbot is None:
        return {}

    threads = {}

    try:
        async with await psycopg.AsyncConnection.connect(
            DATABASE_URL, row_factory=psycopg.rows.dict_row
        ) as conn:

            async with conn.cursor() as cur:

                await cur.execute("""
                    SELECT DISTINCT thread_id
                    FROM checkpoints
                    ORDER BY thread_id DESC
                """)

                rows = await cur.fetchall()

                for row in rows:

                    thread_id = row["thread_id"]

                    try:
                        state = await memory.chatbot.aget_state({
                            "configurable": {
                                "thread_id": thread_id
                            }
                        })

                        if (
                            state
                            and state.values
                            and "messages" in state.values
                            and len(state.values["messages"]) > 0
                        ):
                            first_msg = state.values["messages"][0].content
                            threads[thread_id] = first_msg[:40]
                        else:
                            threads[thread_id] = "New Chat"

                    except Exception as e:
                        print("Thread load error:", e)
                        threads[thread_id] = "New Chat"

    except Exception as e:
        print("DB connection error in get_all_threads:", e)

    return threads


async def delete_thread(thread_id: str):

    if memory.chatbot is None:
        return False

    try:
        async with await psycopg.AsyncConnection.connect(
            DATABASE_URL, row_factory=psycopg.rows.dict_row
        ) as conn:

            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM checkpoints WHERE thread_id = %s",
                    (thread_id,)
                )

            await conn.commit()

    except Exception as e:
        print("DB connection error on delete:", e)
        return False

    return True

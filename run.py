"""
run.py
─────────────────────────────────────────────────────────────────────────────
Development entrypoint for the ScholarSync hub (including the merged
interview service) and the MCP tool server.

Why this file exists
--------------------
psycopg refuses to run in async mode on Windows' ProactorEventLoop, which is
what LangGraph's Postgres checkpointer needs:

    psycopg.InterfaceError: Psycopg cannot use the 'ProactorEventLoop'

Setting `asyncio.set_event_loop_policy(WindowsSelectorEventLoopPolicy())` does
not help, because uvicorn does not consult the event loop policy at all. As of
uvicorn 0.41 it builds the loop from its own factory:

    # uvicorn/loops/asyncio.py
    def asyncio_loop_factory(use_subprocess: bool = False):
        if sys.platform == "win32" and not use_subprocess:
            return asyncio.ProactorEventLoop
        return asyncio.SelectorEventLoop

So the only reliable fix is to take the loop out of uvicorn's hands: configure
it with `loop="none"` and drive `Server.serve()` inside a SelectorEventLoop we
create ourselves. That is what this script does.

On Linux (and therefore in Docker) the default loop is already a selector loop,
so `uvicorn server:app` works directly and this shim is unnecessary.

Usage:
    python run.py                 # hub on :8000
    python run.py --port 9000
    python run.py --mcp           # MCP tool server on :8002
    python run.py --reload        # auto-reload (see the note below)
"""

import argparse
import asyncio
import sys

import uvicorn

WINDOWS = sys.platform == "win32"

if WINDOWS:
    # The default console codepage (cp1252) cannot encode the emoji this
    # project logs, which crashes on a redirected stdout. Force UTF-8 so log
    # output never takes the app down.
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass


def serve_with_selector_loop(config: uvicorn.Config) -> None:
    """Run a uvicorn server on a SelectorEventLoop we own.

    Required on Windows for the async Postgres checkpointer to work.
    """
    server = uvicorn.Server(config)

    loop = asyncio.SelectorEventLoop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(server.serve())
    except KeyboardInterrupt:
        pass
    finally:
        try:
            loop.close()
        finally:
            asyncio.set_event_loop(None)


def main():
    parser = argparse.ArgumentParser(description="Run a ScholarSync service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=None,
                        help="Defaults to 8000 for the hub, 8002 for --mcp.")
    parser.add_argument("--reload", action="store_true",
                        help="Auto-reload on file changes.")
    parser.add_argument("--mcp", action="store_true",
                        help="Run the MCP tool server instead of the hub.")
    args = parser.parse_args()

    if args.mcp:
        app_path = "chatbot.mcp_server.mcp_server:app"
        port = args.port or 8002
        label = "MCP tool server"
    else:
        app_path = "server:app"
        port = args.port or 8000
        label = "ScholarSync hub (+ /interview)"

    print(f"Starting {label} on http://{args.host}:{port}")

    # Reload needs uvicorn's own supervisor process, which rebuilds the loop
    # from its factory in the child — so we cannot install our own loop there.
    if args.reload:
        if WINDOWS and not args.mcp:
            print("NOTE: --reload on Windows forces uvicorn's ProactorEventLoop, "
                  "so the Postgres checkpointer will fall back to in-memory. "
                  "Restart without --reload for persistent chat threads.")
        uvicorn.run(app_path, host=args.host, port=port, reload=True)
        return

    config = uvicorn.Config(
        app_path,
        host=args.host,
        port=port,
        # We create the loop ourselves; see serve_with_selector_loop.
        loop="none" if WINDOWS else "auto",
    )

    if WINDOWS:
        serve_with_selector_loop(config)
    else:
        uvicorn.Server(config).run()


if __name__ == "__main__":
    main()

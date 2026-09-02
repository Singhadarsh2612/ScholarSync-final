import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from analysis_api import get_analysis_report
from chatbot import chat_stream, get_all_threads, delete_thread, init_chatbot
from chatbot import memory
from typing import List,Optional
from assignment_solver import solve_assignment
from fastapi.responses import FileResponse


import os
from pathlib import Path

_AUTH_EMAIL    = os.getenv("ADMIN_EMAIL", "scholarsync26@gmail.com")
_AUTH_PASSWORD = os.getenv("ADMIN_PASSWORD", "scholarsync26")
_session_authenticated = False   # single shared flag



@asynccontextmanager
async def lifespan(app: FastAPI):

    saver_cm = await init_chatbot()
    yield
    await saver_cm.__aexit__(None, None, None)

app = FastAPI(lifespan=lifespan)

# In production, set CORS_ALLOWED_ORIGINS to a comma-separated list of the
# real frontend origins (chat-ui, interview-ui). Wildcard is only safe here
# because it's the local-dev default, not because "*" + credentials is
# actually meaningful per the CORS spec.
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── AI coding-interviewer service, merged in as a mounted router ──
# Serves /interview/api/*. Previously a separate FastAPI app that the hub
# reached over HTTP; it is now called in-process.
from interview.main import router as interview_router
from endpoints import INTERVIEW_UI_URL

app.include_router(interview_router, prefix="/interview", tags=["interview"])


@app.get("/config")
def public_config():
    """Runtime config for static pages (web/) that need cross-origin links
    built from the deployment's actual URLs instead of a hardcoded literal."""
    return {"interview_ui_url": INTERVIEW_UI_URL}

class ChatRequest(BaseModel):
    message: str
    thread_id: str

class HistoryRequest(BaseModel):
    thread_id: str

class DeleteThreadRequest(BaseModel):
    thread_id: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.get("/auth/status")
def auth_status():
    """Returns whether the user has already authenticated this server session."""
    return {"authenticated": _session_authenticated}

@app.post("/auth/login")
def auth_login(req: LoginRequest):
    """Validates credentials and sets the in-memory session flag."""
    global _session_authenticated
    if req.email == _AUTH_EMAIL and req.password == _AUTH_PASSWORD:
        _session_authenticated = True
        return {"success": True}
    return {"success": False, "error": "Invalid email or password."}



# ── Web assets ──────────────────────────────────────────────────────────────
# Resolved against this file so the pages load whatever the working directory
# is. The URL paths are unchanged, so the HTML's own "js/main.js" still works.
WEB_DIR = Path(__file__).resolve().parent / "web"
PAGES_DIR = WEB_DIR / "pages"


def _page(filename: str) -> str:
    return str(PAGES_DIR / filename)


@app.get("/")
def serve_ui():
    return FileResponse(_page("scholar_sync.html"))

@app.get("/assignment-solver")
def serve_assignment_solver():
    return FileResponse(_page("assignment_solver.html"))

@app.get("/material-view")
def serve_material_view():
    return FileResponse(_page("material_view.html"))

@app.get("/deadlines")
def serve_deadlines():
    return FileResponse(_page("index.html"))

@app.get("/sync-db")
def serve_sync_db():
    return FileResponse("chatbot/sync/sync_db.json", media_type="application/json")

app.mount("/js", StaticFiles(directory=str(WEB_DIR / "js")), name="js")

@app.get("/logo.png")
def serve_logo():
    return FileResponse("logo.png", media_type="image/png")

@app.get("/favicon.ico")
def serve_favicon():
    return FileResponse("logo.png", media_type="image/png")


@app.post("/chat-stream")
async def chat_stream_endpoint(req: ChatRequest):

    async def event_generator():

        async for chunk in chat_stream(
            req.message,
            req.thread_id
        ):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )



@app.post("/history")
async def get_history_endpoint(req: HistoryRequest):

    if memory.chatbot is None:
        return {"history": []}

    state = await memory.chatbot.aget_state({
        "configurable": {
            "thread_id": req.thread_id
        }
    })

    if not state or "messages" not in state.values:
        return {"history": []}

    filtered_history = []
    for msg in state.values["messages"]:
        content = getattr(msg, "content", "")
        if content and "CRITIC FEEDBACK" in content:
            continue
        filtered_history.append({
            "type": msg.type,
            "content": content
        })

    return {
        "history": filtered_history
    }



@app.get("/threads")
async def threads_endpoint():

    threads = await get_all_threads()

    return {
        "threads": threads
    }



@app.delete("/thread")
async def delete_thread_endpoint(req: DeleteThreadRequest):

    success = await delete_thread(req.thread_id)

    return {
        "success": success,
        "thread_id": req.thread_id
    }

from chatbot.sync.sync_worker import run_sync
@app.post("/quicksync")
def quicksync():

    run_sync()

    return {"status": "success", "message": "Calendars synced"}


@app.get("/analysis")
def analysis():

    return get_analysis_report()

@app.get("/analysis-dashboard")
def analysis_dashboard():
    return FileResponse(_page("analysis.html"))



import requests

from endpoints import ASSIGNMENTS_URL, MATERIALS_URL, EXAMS_URL

@app.get("/proxy/assignments")
def proxy_assignments():
    url = ASSIGNMENTS_URL
    return requests.get(url).json()


@app.get("/proxy/materials")
def proxy_materials():
    url = MATERIALS_URL
    return requests.get(url).json()


@app.get("/proxy/exams")
def proxy_exams():
    url = EXAMS_URL
    try:
        r = requests.get(url, timeout=15)
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

from fastapi import Response
import re

@app.get("/proxy-pdf")
def proxy_pdf(url: str):
    try:
        match = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
        if match:
            file_id = match.group(1)
            direct_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            r = requests.get(direct_url)
            return Response(content=r.content, media_type="application/pdf")
        else:
            r = requests.get(url)
            return Response(content=r.content, media_type="application/pdf")
    except Exception as e:
        return {"success": False, "error": str(e)}

class AssignmentRequest(BaseModel):

    question:str

    history: list = []

    assignment_doc:Optional[str]=None

    material_links:List[str]=[]


@app.post("/solve-assignment")

async def solve_assignment_api(req:AssignmentRequest):

    answer=solve_assignment(
        req.question,
        req.history,
        req.assignment_doc,
        req.material_links
    )

    return {"answer":answer}

from fastapi.responses import FileResponse
from assignment_solver import solve_entire_assignment, generate_solution_pdf


class FullAssignmentRequest(BaseModel):
    assignment_doc: str
    material_links: list = []
    assignment_id: str


@app.post("/generate-assignment-pdf")
def generate_assignment_pdf(req: FullAssignmentRequest):

    solution = solve_entire_assignment(
        req.assignment_doc,
        req.material_links
    )

    pdf_path = generate_solution_pdf(solution, req.assignment_id)

    return FileResponse(
        pdf_path,
        filename=f"Solved_{req.assignment_id}.pdf",
        media_type="application/pdf"
    )
<div align="center">
  <img src="logo.png" alt="ScholarSync Logo" width="150"/>
  <h1>🎓 ScholarSync</h1>
  <p><strong>An Intelligent, Multi-Agent Academic & Career Assistant</strong></p>
  <p>Seamlessly bridging academic management, expert human assistance, and AI-driven technical interview preparation.</p>
</div>

---

## 🚀 Demo & Deployment

Watch the YouTube demo:

- [ScholarSync Demo](https://www.youtube.com/watch?v=kXB_OnIIRGQ)

---

## 📖 Project Overview

**ScholarSync** is an advanced, multi-agent AI framework designed specifically for students and academics. It acts as a centralized "second brain," automating mundane tasks and supercharging learning through cooperating AI agents.

Rather than a simple chatbot, ScholarSync is powered by a **LangGraph orchestration layer** where specialized agents collaborate to analyze academic materials, solve assignments proactively, schedule calendar events, fetch emails, and provide rigorous AI-driven coding interviews. To top it off, it features a real-time, peer-to-peer MERN chat platform enabling students to connect with verified human domain experts instantly.

---

## 🧩 Core Architecture & Modules

The platform is divided into three major autonomous subsystems:

### 1. 🧠 Multi-Agent Conversational Hub (LangGraph Core)

- **Role:** The brain of ScholarSync. Analyzes complex user intents and routes them to specialized agents (Planner, Retriever, Tool Explorer, Executer).
- **Features:**
  - Automated assignment solving with detailed PDF generation.
  - Document Question & Answering (RAG) directly from uploaded academic materials.
  - MCP Tool Server integration for real-world interactions (Google Calendar API, Email dispatch, Web search).
  - Background syncing workers that monitor student portals for new deadlines.
- **Tech Stack:** Python, FastAPI, LangGraph, LangChain, Azure OpenAI (gpt-4o / gpt-4o-mini).

### 2. 💬 Real-Time Expert Support Chat (MERN Stack)

- **Role:** Bridges the gap between AI limitations and human expertise by letting students connect instantly to subject matter experts.
- **Features:**
  - Real-time text chat via **Socket.IO**.
  - Peer-to-peer **WebRTC** Video Calling (no third-party software needed).
  - Subject-based intelligent routing (e.g., automatically matching a "Graph algorithms" query to the designated Graph expert).
  - JWT Authentication for Experts and file-sharing capabilities.
- **Tech Stack:** React 18, Node.js, Express, MongoDB.

### 3. 👨‍💻 AI Interviewer & Coding IDE

- **Role:** Prepares students for technical interviews with a voice-driven AI interviewer and a code execution environment.
- **Features:**
  - Fully functional web-based code compilation for Python and C++.
  - **Azure Speech** for real-time Text-to-Speech and Speech-to-Text, simulating a real human interviewer.
  - Granular grading breakdown: Correctness, Communication, Problem Solving, and Efficiency.
  - Parses Candidate CVs on the fly to tailor interview difficulty.
- **Tech Stack:** FastAPI, LangChain, Azure Speech Services, Subprocess Code Execution, React Frontend.
- **Deployment:** runs *inside* the hub process as a mounted `APIRouter`, served
  under `/interview` — not as a separate service. See **Design notes** below.

---

## 🧭 Design notes

Short answers to the questions this layout tends to raise.

**Why is the interviewer a mounted router rather than its own service?**
It was a separate deployment, and the coupling was the problem: the hub reached
it over HTTP at a hardcoded URL, so when that host went away the agent's
interview tools broke with it. The two share the same Azure OpenAI
configuration and are always deployed together, so a network hop bought
nothing and cost a hard dependency. Mounting it keeps one process, one
dependency set, and one API surface (`/docs` documents both), and the agent now
calls the routing logic as a function. The MCP tool server stays separate,
because it genuinely is optional and restarts independently.

**Why two databases?**
They serve different shapes. Postgres backs LangGraph's checkpointer — the
official `langgraph-checkpoint-postgres` saver, which wants relational
transactions for conversation state. MongoDB holds interview sessions and
expert-chat messages, which are append-heavy, schema-loose documents. Neither
is a good fit for the other's workload, and both degrade independently: if
Postgres is down the hub falls back to an in-memory checkpointer; if Mongo is
down interview topics still list, they just stop recording scores.

**Why three Azure OpenAI deployments instead of one?**
Rate limits. The planner (`gpt-4o`) and the parallel explorer agents
(`gpt-4o-mini`) run concurrently on one request, so sharing a single deployment
made the swarm throttle itself. Splitting them across three gives each role its
own quota. `chatbot/llm.py` documents which agent uses which. If you only have
one resource, pointing all three at it still works.

**Why is the hub's own UI plain HTML while the other two are React?**
The hub is server-rendered dashboards with a streaming chat box — it needs no
client-side router or build step, so `server.py` serves the HTML directly. The
interview and chat clients are stateful single-page apps (Monaco editor,
WebRTC, Socket.IO), which is what React earns its build step for.

**Why is `chatbot/` not the chat feature?**
`chatbot/` is the LangGraph agent — the "second brain". The human expert chat
is `expert-chat/`. The names are deliberately distinct for this reason.

---

### Readability

The codebase is organised so each concern lives in one place and can be read
without tracing through the rest.

**One source of truth per concern.** `endpoints.py` holds every external URL and
ID; `azure_env.py` resolves every Azure credential; `observability/config.py`
holds every tracing setting. Previously the same student-portal URL was written
out in six files and the same Azure key was read under four different names.

**Credentials resolve through alias chains.** `azure_env.py` accepts several
spellings per value and falls back to the shared `AZURE_OPENAI_*` pair, so one
Azure resource serves all three model roles and renaming a variable does not
mean editing call sites.

**Instrumentation stays out of the agent code.** Nodes are wrapped at
registration in `chatbot/graph.py`, and the two funnels every LLM and tool call
passes through (`_llm_call`, `_call_tool`) carry a decorator each. No node body
contains tracing logic, and `observability` never imports agent code — the
dependency runs one way.

**Failures degrade instead of cascading.** Missing Postgres falls back to an
in-memory checkpointer; unreachable Mongo returns `None` from `get_db()`; a
missing Tavily key disables web search alone rather than the whole MCP server;
tracing errors are swallowed so observability can never fail a request. Each is
logged at startup so you know which mode you are in.

**Comments explain why, not what.** Where a line looks odd it says what breaks
without it — the Windows selector-loop shim in `run.py`, the route ordering in
`interview/main.py`, the `--quiet` flag on the mongo service.

---

## 🛠 Tech Stack

| Domain | Technologies |
|---|---|
| **AI Integration** | LangGraph, LangChain, Azure OpenAI (gpt-4o, gpt-4o-mini, text-embedding-3-small), Azure AI Search (RAG), Azure Speech (TTS/STT) |
| **Backend** | Python 3.12, Node.js, Express.js, FastAPI |
| **Frontend** | Vanilla JS/HTML/CSS (Main Hub), React.js (Chat & IDE) |
| **Databases** | MongoDB (Chat Auth & Logs), JSON local DB (Syncing state) |
| **Realtime** | Socket.IO, WebRTC |
| **Tools** | MCP Tool Server, Google Calendar API |

---

## 📁 Repository Structure

```text
scholarsync/
├── server.py                # Hub FastAPI app; mounts the interview router
├── run.py                   # Dev entrypoint (sets the Windows event-loop policy)
├── endpoints.py             # Single source of truth for external URLs/IDs
├── assignment_solver.py     # Assignment RAG + solution PDF generation
├── analysis_api.py          # Marks/attendance analytics
│
├── chatbot/                 # LangGraph multi-agent logic
│   ├── graph.py             # Agent routing and state graph
│   ├── llm.py               # Three role-scoped Azure OpenAI clients (lazy)
│   ├── mcp_server/          # MCP tools (Calendar, Web Search, Mail)
│   └── sync/                # Background deadline sync workers
│
├── interview/               # AI coding interviewer (merged into the hub)
│   ├── main.py              # APIRouter mounted at /interview
│   ├── app/nodes/           # LangGraph interview nodes
│   ├── app/services/        # Azure Speech, Mongo, LLM
│   └── cv_parser.py         # Resume parsing + FAISS index
│
├── interview-ui/            # React client for the interviewer
│   └── src/
│       ├── config.js        # API base URL (one place)
│       ├── api/             # Every backend call
│       ├── theme/           # Palette + app-wide theme context
│       ├── audio/           # Shared TTS playback element
│       ├── hooks/           # Speech recognition
│       └── components/      # ui/ primitives + interview/ panels
│
├── expert-chat/             # Expert chat API (Express + Socket.IO + WebRTC)
│   ├── config/              # env, Mongo connection, socket handlers
│   ├── controllers/         # auth, chat, connect, experts
│   ├── models/              # Expert, ChatRoom, Message
│   └── scripts/             # seedExperts.js
│
├── expert-chat-ui/          # React chat & video client
│   └── src/
│       ├── components/      # Chat/ and Video/ panels (CSS modules)
│       ├── context/         # Auth + Socket providers
│       └── hooks/           # useWebRTC
│
├── observability/           # Tracing for every agent response
│   ├── config.py            # Env-resolved settings; no SDK import
│   ├── tracing.py           # The only module that imports langsmith
│   ├── sanitize.py          # Redaction + truncation before upload
│   └── status.py            # python -m observability.status
│
├── evaluation/              # RAG + LLM-as-judge metrics
│   ├── judge.py             # Shared scoring primitive
│   ├── rag_metrics.py       # The RAG triad
│   ├── agent_metrics.py     # Correctness, fabrication, helpfulness, tools
│   ├── datasets.py          # Golden cases (data only)
│   └── runner.py            # python -m evaluation.runner
│
├── web/                     # The hub's own dashboards
│   ├── pages/               # scholar_sync, assignment_solver, analysis, …
│   └── js/                  # Dashboard scripts, served at /js
│
├── azure_env.py             # Azure credential resolution (alias chains)
├── Dockerfile               # Shared image for the hub and MCP server
├── docker-compose.yml       # Full stack (mongo is behind a `local-db` profile)
├── package.json             # Convenience scripts for the three JS apps
└── .env.example             # Every credential, annotated
```

---

## 🚀 Installation & Local Development

The AI interviewer now runs **inside** the hub process as a mounted router, so
there are four processes rather than five: the hub (which serves
`/interview/api/*`), the MCP tool server, the chat API, and the two React apps.

### Prerequisites

- **Python 3.12**
- **Node.js v18+**
- **PostgreSQL** (agent conversation history) and **MongoDB** (interview sessions, chat)
- **g++** on `PATH` — compiles candidate C++ submissions
- Azure credentials — see **`.env.example`**, which lists every variable, the
  file that reads it, and where to obtain it.

### Option A — Docker Compose (recommended)

Brings up all seven services, including both databases:

```bash
cp .env.example .env      # fill in your Azure keys and set JWT_SECRET
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:8000 | Hub dashboard |
| http://localhost:8000/docs | API reference (hub + interview) |
| http://localhost:3001 | Interview UI |
| http://localhost:3000 | Expert-chat UI |
| http://localhost:5000 | Chat API |

Seed the expert accounts once Mongo is up (default password `expert@123`):

```bash
docker compose exec chat-api node scripts/seedExperts.js
```

### Option B — Run locally

The repository root has a `package.json` with convenience scripts for the three
JavaScript apps:

```bash
npm install                  # installs concurrently
npm run install:all          # deps for expert-chat, expert-chat-ui, interview-ui
npm run dev:chat             # expert-chat API + UI together
npm run seed:experts         # seed the 10 expert accounts
```


**1. Hub + interview service**

```bash
python -m venv venv
venv\Scripts\activate            # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env             # then fill it in

python run.py                    # hub on http://localhost:8000
python run.py --mcp              # MCP tool server on :8002 (second terminal)
```

> **Windows:** use `python run.py`, not `uvicorn server:app`. Uvicorn creates its
> event loop before importing the app, so the selector-loop policy `server.py`
> sets arrives too late and psycopg aborts with
> `cannot use the 'ProactorEventLoop'`. `run.py` sets the policy first.
> On Linux and in Docker, `uvicorn server:app` is fine.

**2. Interview UI**

```bash
cd interview-ui
npm install
# Must include the /interview mount AND the /api segment:
echo "REACT_APP_API_URL=http://localhost:8000/interview/api" > .env
npm start                        # http://localhost:3001
```

**3. Expert chat**

```bash
cd expert-chat
npm install
cp .env.example .env             # set JWT_SECRET — the server refuses to boot without it
node scripts/seedExperts.js
npm run dev                      # http://localhost:5000

cd ../expert-chat-ui
npm install
cp .env.example .env
npm start                        # http://localhost:3000
```

### Graceful degradation

Missing credentials disable features rather than blocking startup:

| Missing | Effect |
|---|---|
| `DATABASE_URL` / Postgres down | In-memory checkpointer; chat threads lost on restart |
| `MONGO_URI` / Mongo down | Interview topics still listed; scores not recorded |
| `AZURE_SPEECH_*` | Interviews run text-only, no voice |
| Azure OpenAI keys | LLM calls fail at request time, not at import |

---

## 🔬 Observability & Evaluation

Every agent response is traced, and both the agent and the RAG pipeline can be
scored against golden cases.

### Credentials

**One credential enables tracing:**

```bash
LANGSMITH_API_KEY=lsv2_pt_...      # smith.langchain.com -> Settings -> API keys
LANGSMITH_PROJECT=ScholarSync      # optional, defaults to ScholarSync
```

The older `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` names are also accepted.
Evaluation needs no new credential — it reuses the Azure OpenAI key already in
`.env` and judges with `GPT4O_DEPLOYMENT` (override via `EVAL_JUDGE_DEPLOYMENT`).

```bash
python -m observability.status      # is the key set, and does it work?
```

**With no key set, tracing is a no-op.** Every decorator is a pass-through and
nothing is uploaded, so the stack runs unchanged without an account.

### What gets traced

One root span per `/chat-stream` request, with children:

```text
ScholarSync Chat            thread_id, status, latency, tools_called
├── ComplexityAnalyzer      chain   state snapshot -> update
│   └── llm:gpt-4.1-mini    llm     prompt, tokens, latency
├── ExecutorNode            chain
│   └── tool:get_…_raw      tool    args, result, result_empty
└── PresentationAgent       chain
```

LangGraph and LangChain emit their own `chain` and `llm` spans as soon as a key
is set, so `observability` deliberately does **not** wrap nodes and LLM calls by
default — doing so nests a duplicate span around every one. The root request
span and the tool spans are always emitted, because LangChain cannot see the
plain Python functions behind `_call_tool`. Set `OBS_WRAP_NODES=true` /
`OBS_WRAP_LLM=true` to add the trimmed state snapshots and normalised token
metadata as extra layers.

`result_empty` exists because a tool returning `[]` is how a real bug presented:
the agent stated there were no assignments while the portal listed six. An empty
tool result is now visible in the trace rather than inferred from the answer.

Two settings limit what leaves your infrastructure — `OBS_CAPTURE_CONTENT=false`
keeps latency, tokens and errors but drops prompt/response text, and
`OBS_MAX_FIELD_CHARS` truncates. Emails are redacted and any field whose name
looks like a secret is replaced before upload.

### Evaluation

Against the running stack (recommended — same code the containers serve):

```bash
npm run eval            # both suites
npm run eval:agent      # agent responses
npm run eval:rag        # RAG triad
npm run eval:report     # writes eval-report.json
npm run obs:status      # is tracing configured and reachable?
```

Or directly, if you are inside the container or running the hub locally:

```bash
python -m evaluation.runner                          # both suites
python -m evaluation.runner --agent                   # agent responses
python -m evaluation.runner --rag                     # RAG triad
python -m evaluation.runner --case rag-absent-topic    # one case, repeatable
python -m evaluation.runner --json report.json         # machine-readable
```

`--case` is the one to reach for while fixing something: it reruns a single case
in seconds instead of the whole suite.

### Automated triggers

`.github/workflows/evaluate.yml` runs the suites on four triggers:

| Trigger | When | Why |
|---|---|---|
| `push` to `main` | changes under `chatbot/`, `interview/`, `assignment_solver.py`, `evaluation/`, `observability/` | catch a regression at the commit that caused it |
| `pull_request` | same paths | review sees the scores before merge |
| `schedule` | 04:00 UTC Mondays | scores drift when the model or the upstream portal changes, not only when this repo does |
| `workflow_dispatch` | manual, with a suite picker | rerun one suite on demand |

The workflow needs the Azure, Atlas and LangSmith values as **repository secrets**
(Settings → Secrets and variables → Actions), because both suites make real API
calls. It traces into a separate `ScholarSync-CI` project so CI runs do not mix
with local ones, prints `azure_env.py --live` first so a credential problem is
obvious rather than looking like a quality regression, and uploads
`eval-report.json` as an artifact even on failure — the report is what explains
the failure. The runner exits non-zero below the threshold, so the job fails on
its own.

**RAG triad** — each metric isolates a different component, so a failure points
at one place:

| Metric | Question it answers | Blames |
|---|---|---|
| `context_relevance` | Did retrieval fetch the right chunks? | Retriever |
| `faithfulness` | Is every claim supported by those chunks? | Generator |
| `answer_relevance` | Does the answer address the question? | Generator |

High context relevance with low faithfulness means the model is inventing
despite good retrieval; the reverse means retrieval is at fault.

**Agent metrics** — `correctness` (against expected facts), `no_fabrication`,
`helpfulness`, `tool_choice`. Correctness is the one that catches a confident,
fluent, wrong answer; a generic quality score rates those highly.

Cases live in `evaluation/datasets.py` as data. Three are marked `regression`
and reproduce bugs that shipped, so a change that reintroduces one fails here:

- `assignments-overdue-os` — the tool read only the `upcoming` bucket
- `interview-graphs` — exact-match topic lookup missed the plural "graphs"
- `interview-two-pointers` — Mongo said `two_pointer`, the API said `two-pointers`

The runner exits non-zero when any case scores below `0.7`, so it works as a CI
gate. Scoring is LLM-as-judge, so treat small differences as noise and watch the
trend.

---

## 🌟 Usage Flows

1. **Student Querying:** Open `index.html` (served via `server.py`). The student can ask questions. The LangGraph backend classifies the intent: "Is this simple retrieval, or a complex multi-step plan needed?"
2. **Proactive Solving:** If the request is `Solve assignment X`, the `assignment_solver.py` kicks in, fetches material context via RAG, and generates a formatted PDF.
3. **Getting Stuck?**: If the student needs human help on "Graphs", the MCP server queries the Chat Service `GET /api/connect?subject=graph` and seamlessly drops the user into a WebRTC video chat room with the Graph Expert.
4. **Interview Practice:** Code is compiled and run in a subprocess. Azure STT listens to the candidate's microphone and the LLM replies aloud via TTS, scoring correctness, efficiency, problem solving and communication.

---

---

## 🛡 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">Built with ❤️ by Team It'sWinTime - Aditya Pratap Singh, Aditya Kumar Singh, Adarsh Kumar Singh, Aditya Jain.</p>

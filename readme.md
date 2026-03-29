<div align="center">
  <img src="logo.png" alt="ScholarSync Logo" width="150"/>
  <h1>🎓 ScholarSync</h1>
  <p><strong>An Intelligent, Multi-Agent Academic & Career Assistant</strong></p>
  <p>Seamlessly bridging academic management, expert human assistance, and AI-driven technical interview preparation.</p>
</div>

---

## 🚀 Live Deployment

Here is the link to our website:

- **ScholarSync** `[https://scholarsync-pso.azurewebsites.net/]`


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
- **Tech Stack:** Python, FastAPI, LangGraph, LangChain, Groq API (LLaMA-3).

### 2. 💬 Real-Time Expert Support Chat (MERN Stack)
- **Role:** Bridges the gap between AI limitations and human expertise by letting students connect instantly to subject matter experts.
- **Features:**
  - Real-time text chat via **Socket.IO**.
  - Peer-to-peer **WebRTC** Video Calling (no third-party software needed).
  - Subject-based intelligent routing (e.g., automatically matching a "Graph algorithms" query to the designated Graph expert).
  - JWT Authentication for Experts and file-sharing capabilities.
- **Tech Stack:** React 18, Node.js, Express, MongoDB.

### 3. 👨‍💻 AI Interviewer & Coding IDE
- **Role:** Prepares students for technical interviews using a state-of-the-art AI proctor and coding execution environment.
- **Features:**
  - Fully functional web-based code compilation for Python and C++.
  - **Azure Cognitive Services** integration for real-time Text-to-Speech (TTS) and Speech-to-Text (STT), simulating a real human interviewer.
  - Granular grading breakdown: Correctness, Communication, Problem Solving, and Efficiency.
  - Parses Candidate CVs on the fly to tailor interview difficulty.
- **Tech Stack:** FastAPI, LangChain, Azure Speech Services, Subprocess Code Execution, React Frontend.

---

## 🛠 Tech Stack

| Domain | Technologies |
|---|---|
| **AI Integration** | LangGraph, LangChain, Groq/OpenAI, RAG, Azure Cognitive Services (Speech) |
| **Backend** | Python 3.12, Node.js, Express.js, FastAPI |
| **Frontend** | Vanilla JS/HTML/CSS (Main Hub), React.js (Chat & IDE) |
| **Databases** | MongoDB (Chat Auth & Logs), JSON local DB (Syncing state) |
| **Realtime** | Socket.IO, WebRTC |
| **Tools** | MCP Tool Server, Google Calendar API |

---

## 📁 Repository Structure

```text
scholarsync/
├── chatbot/                 # LangGraph Multi-Agent logic
│   ├── graph.py             # Agent routing and state graph
│   ├── mcp_server/          # Model Context Protocol tools (Calendar, Web Search, Mail)
│   └── sync/                # Background deadline sync workers
├── ScholarSync_Chat-main/   # MERN Stack Expert Chat Application
│   ├── backend/             # Node.js Express server + Socket.IO + WebRTC signaling
│   └── frontend/            # React App for Chat and Video UI
├── code-ide-main 2/         # AI Coding Interviewer Environment
│   ├── backend/             # FastAPI IDE compiler, Resume Parser, Azure TTS/STT
│   └── client/              # React Interface for coding tests
├── nstyle.css & styles.css  # Core styling for the main HTML dashboards
├── server.py                # Main backend server for the Conversational Hub
├── assignment_solver.py     # PDF generation and specific assignment query logic
├── Dockerfile               # Production multi-service Docker configuration
└── ...
```

---

## 🚀 Installation & Local Development

Because ScholarSync is a microservice architecture, you will need to start the different services on different ports.

### Prerequisites
- **Python 3.10+**
- **Node.js v18+**
- **MongoDB** running locally or via Atlas.
- API Keys: Groq API Key, OpenAI API Key (optional fallback), Azure Speech Services Key, Google Cloud Credentials (`service-account.json` or OAuth tokens).

### 1. Setup Main Conversational Hub & Agents

```bash
# 1. Clone & Enter Directory
git clone https://github.com/your-username/scholarsync.git
cd scholarsync

# 2. Create Python Virtual Environment
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows

# 3. Install Requirements
pip install -r requirements.txt

# 4. Set Environment Variables
# Create a .env file in the root
echo "GROQ_API_KEY=your_key_here" >> .env
# (Ensure your tool API keys/credentials like calendar_auth.json are configured)

# 5. Run the MCP Tool Server in one terminal
python chatbot/mcp_server/mcp_server.py

# 6. Run the Main Backend in another terminal
python server.py
# The main server runs on http://localhost:8000
```

### 2. Setup Real-Time Expert Chat

```bash
cd ScholarSync_Chat-main

# 1. Install Backend Dependencies
cd backend
npm install
cp .env.example .env # Configure your MONGO_URI and JWT_SECRET here

# 2. Seed Expert Accounts (Default password: expert@123)
node scripts/seedExperts.js

# 3. Start Backend server
npm run dev
# Chat API runs on http://localhost:5000

# 4. Install & Start Frontend
cd ../frontend
npm install
npm start
# Chat Frontend runs on http://localhost:3000
```

### 3. Setup AI Interviewer IDE

```bash
cd "code-ide-main 2"

# 1. Install Backend Dependencies
cd backend
pip install -r requirements.txt
cp .env.example .env # Add your AZURE_SPEECH_KEY and OPENAI_API_KEY here

# 2. Start IDE Backend
uvicorn main:app --reload --port 8080

# 3. Start IDE Client
cd ../client
npm install
npm start
# IDE Client runs on its designated React port (usually http://localhost:3001)
```

*(Note: In production environments, rely on the provided `Dockerfile` via Docker Compose to unify port mapping and ease deployments).*

---

## 🌟 Usage Flows

1. **Student Querying:** Open `index.html` (served via `server.py`). The student can ask questions. The LangGraph backend classifies the intent: "Is this simple retrieval, or a complex multi-step plan needed?"
2. **Proactive Solving:** If the request is `Solve assignment X`, the `assignment_solver.py` kicks in, fetches material context via RAG, and generates a formatted PDF.
3. **Getting Stuck?**: If the student needs human help on "Graphs", the MCP server queries the Chat Service `GET /api/connect?subject=graph` and seamlessly drops the user into a WebRTC video chat room with the Graph Expert.
4. **Interview Practice:** The `proctoring` system evaluates code compiled in a subprocess. Azure STT listens to the user's microphone, and the LLM responds verbally via TTS, assessing correctness, efficiency, and communication skills.

---

## 🤝 Contributing

We welcome contributions! Please open an issue first to discuss what you would like to change. 

1. Fork the repo.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 🛡 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">Built with ❤️ by Team It'sWinTime - Aditya Kumar Singh, Adarsh Kumar Singh, Aditya Jain, Aditya Pratap Singh.</p>

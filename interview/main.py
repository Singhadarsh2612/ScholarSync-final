import os
import uuid
import hashlib
import subprocess
import tempfile
import azure.cognitiveservices.speech as speechsdk

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.graph_builder import build_graph
from app.schemas import CodeUpdatePayload, RunCodePayload, AIRequestPayload, ChatRequestPayload
from app.problems import problems
from app.services.llm import get_llm
from cv_parser import *

from langchain_core.messages import SystemMessage, HumanMessage

app = FastAPI()

from app.proctoring.router import router as proctoring_router

app.include_router(proctoring_router, prefix="/api/ai", tags=["proctoring"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = build_graph(checkpointer=None)

_resume_cache: dict = {}


@app.get("/api/problem/{problem_id}")
def get_problem(problem_id: int):
    problem = problems.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    return {k: v for k, v in problem.items() if k != "solution"}


@app.get("/api/questions/topics")
def get_topics():
    topics_list = []
    for pid, p in problems.items():
        tags = p.get("tags", {})
        topic = tags.get("topics", ["General"])[0]
        slug = topic.lower().replace(" ", "-")
        topics_list.append({
            "slug": slug,
            "name": topic,
            "difficulty": tags.get("difficulty", "Medium"),
            "problem_ids": [pid],
            "problem_count": 1,
            "skills": tags.get("skills", []),
            "time_complexity": p.get("time_complexity", "O(N)"),
            "companies": p.get("companies", ["Google", "Amazon"]),
        })
    return {"topics": topics_list}


@app.get("/api/questions/{topic}")
def get_questions_by_topic(topic: str):
    slug = topic.lower().replace(" ", "-")
    matched = []
    for pid, p in problems.items():
        tags = p.get("tags", {})
        topic_slugs = [t.lower().replace(" ", "-") for t in tags.get("topics", [])]
        if slug in topic_slugs:
            matched.append({k: v for k, v in p.items() if k != "solution"})
    if not matched:
        raise HTTPException(status_code=404, detail=f"No questions found for topic: {topic}")
    return {"topic": slug, "questions": matched, "count": len(matched)}


@app.get("/api/topic/{topic_name}")
def get_topic_info(topic_name: str):
    slug = topic_name.lower().replace(" ", "-")
    from app.services.mongo_services import get_collection
    
    coll = get_collection("interview_sessions")
    if coll is not None:
        doc = coll.find_one({"question_tag": slug})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
            
    prob_title = slug.replace("-", " ").title()
    return {
        "question_tag": slug,
        "title": prob_title,
        "problem_description": "Coding problem practice.",
        "number_of_attempts": 0,
        "attempts": [],
        "performance_score": 0,
        "average_score": 0.0,
        "description_of_performance": "User has not attempted yet",
        "recent_performance_analysis": "No attempts made yet",
        "overall_performance": "No data available",
        "improvement_trend": "Not Enough Data"
    }

@app.get("/api/interview_routing")
def get_interview_routing():
    try:
        from app.services.mongo_services import get_collection
        coll = get_collection("interview_sessions")
        
        topic_mappings = [
            {"requested_tag": "greedy", "mongo_slug": "greedy", "prompt_name": "Greedy", "prob_id": 4},
            {"requested_tag": "binary_search", "mongo_slug": "binary-search", "prompt_name": "Binary Search", "prob_id": 5},
            {"requested_tag": "math", "mongo_slug": "math", "prompt_name": "Math", "prob_id": 2},
            {"requested_tag": "graph", "mongo_slug": "graph", "prompt_name": "Graph", "prob_id": 3},
            {"requested_tag": "two_pointer", "mongo_slug": "two-pointers", "prompt_name": "Two Pointer", "prob_id": 1}
        ]
        
        results = []
        
        for mapping in topic_mappings:
            req_tag = mapping["requested_tag"]
            slug = mapping["mongo_slug"]
            prompt_name = mapping["prompt_name"]
            
            doc = coll.find_one({"question_tag": slug}) if coll is not None else None
            
            att_count = 0
            perf_score = 0
            desc_perf = "User has not attempted yet, direct practice requested"
            
            if doc:
                att_count = doc.get("number_of_attempts", 0)
                
                attempts_list = doc.get("attempts", [])
                last_5 = attempts_list[-5:] if attempts_list else []
                if last_5:
                    avg_last_5 = sum(a.get("score", 0) for a in last_5) / len(last_5)
                    perf_score = int(round(avg_last_5))
                    
                    feedbacks = []
                    for a in last_5:
                        score = a.get("score", 0)
                        fb = a.get("feedback", "No feedback")
                        feedbacks.append(f"[Score {score}]: {fb}")
                    
                    combined_insights = " | ".join(feedbacks)
                    desc_perf = f"Combined Insight of last {len(last_5)} attempts: {combined_insights}"
                else:
                    perf_score = 0
                    recent_analysis = doc.get("recent_performance_analysis", "")
                    if recent_analysis:
                        desc_perf = f"Insight: {recent_analysis}"
                
            prob_id = mapping.get("prob_id")
            
            results.append({
                "question_tag": req_tag,
                "user_intent_description": f"I want to practice {prompt_name.lower()} interview questions",
                "number_of_attempts": att_count,
                "performance_score": perf_score,
                "description_of_performance": desc_perf,
                "endpoint_redirect": f"/interview/{prob_id}",
                "redirect_logic_prompt": f"User explicitly requested {prompt_name.lower()} practice -> immediate redirect. Avoid duplicate redirects."
            })
            
        return results
    except Exception as e:
        import traceback
        print(f"[interview_routing ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/run")
def run_code(payload: RunCodePayload):
    unique_id = uuid.uuid4().hex[:8]

    tmp_dir = tempfile.gettempdir()
    cpp_path = os.path.join(tmp_dir, f"temp_{unique_id}.cpp")
    exe_path = os.path.join(tmp_dir, f"temp_{unique_id}.exe")
    input_path = os.path.join(tmp_dir, f"input_{unique_id}.txt")

    try:
        with open(cpp_path, "w") as f:
            f.write(payload.code)
        with open(input_path, "w") as f:
            f.write(payload.input)

        if "def " in payload.code or "print(" in payload.code or "import " in payload.code:
            py_path = os.path.join(tmp_dir, f"temp_{unique_id}.py")
            with open(py_path, "w") as f:
                f.write(payload.code)
            
            with open(input_path, "r") as inp:
                run_result = subprocess.run(
                    ["python", py_path],
                    stdin=inp,
                    capture_output=True, text=True, timeout=10
                )
            if os.path.exists(py_path): os.remove(py_path)
            
            if run_result.returncode != 0:
                return {"success": False, "output": run_result.stderr or "Python Runtime Error"}
            return {"success": True, "output": run_result.stdout}
            
        else:
            compile_result = subprocess.run(
                ["g++", cpp_path, "-o", exe_path],
                capture_output=True, text=True, timeout=15
            )

            if compile_result.returncode != 0:
                return {"success": False, "output": compile_result.stderr}

            with open(input_path, "r") as inp:
                run_result = subprocess.run(
                    [exe_path],
                    stdin=inp,
                    capture_output=True, text=True, timeout=10
                )

            if run_result.returncode != 0:
                return {"success": False, "output": run_result.stderr or "Runtime error"}

            return {"success": True, "output": run_result.stdout}

    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Time Limit Exceeded"}
    except FileNotFoundError as fnfe:
        return {"success": False, "output": f"Execution Error: Missing compiler/interpreter ({fnfe}). Please ensure g++ (or python) is installed."}
    except Exception as e:
        return {"success": False, "output": str(e)}
    finally:
        for path in [cpp_path, exe_path, input_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


@app.post("/api/ai/parse_resume")
async def parse_resume(file: UploadFile = File(...), session_id: str = None, user_id: str = None):
    file_bytes = await file.read()
    file_hash = hashlib.md5(file_bytes).hexdigest()

    cache_dir = os.path.join(os.path.dirname(__file__), "resume_cache")
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f"cache_{file_hash}.json")
    
    if os.path.exists(cache_file):
        print(f"[RESUME CACHE HIT] {file.filename} ({file_hash[:8]}...) loaded from file")
        with open(cache_file, "r") as f:
            import json
            cached_data = json.load(f)
            
        if session_id:
            from app.services.session_store import load_session, save_session
            sessions = load_session(session_id)
            if sessions:
                state = sessions[0]
                state["resume_data"] = cached_data
                if user_id: state["user_id"] = user_id
                save_session(state)
        return {"success": True, "data": cached_data, "cached": True}

    unique_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"resume_{unique_id}_{file.filename}")
    try:
        with open(tmp_path, "wb") as f:
            f.write(file_bytes)

        parser = CVParser()
        data = parser.parse_cv(tmp_path)

        with open(cache_file, "w") as f:
            import json
            json.dump(data, f)
        print(f"[RESUME CACHE STORE] {file.filename} ({file_hash[:8]}...) saved to {cache_file}")

        if session_id:
            from app.services.session_store import load_session, save_session
            sessions = load_session(session_id)
            if sessions:
                state = sessions[0]
                state["resume_data"] = data
                if user_id: state["user_id"] = user_id
                save_session(state)

        return {"success": True, "data": data, "cached": False}
    except Exception as e:
        print(f"[CV ERROR] {e}")
        return {"success": False, "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/api/ai/welcome")
def ai_welcome(payload: AIRequestPayload):
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    welcome_text = f"Hi, I'm your interviewer. Let's solve {problem['title']}. Start when you're ready."
    
    from app.services.speech_service import text_to_speech_base64
    audio_base64 = None
    try:
        audio_base64 = text_to_speech_base64(welcome_text)
    except Exception as se:
        print(f"[SPEECH ERROR] Welcome voice failed: {se}")

    return {
        "feedback": welcome_text,
        "audio": audio_base64
    }


@app.post("/api/ai/chat")
def ai_chat(payload: ChatRequestPayload):
    from langchain_core.messages import AIMessage as LCAIMessage
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    from app.services.session_store import load_session
    session_data = {}
    if payload.session_id:
        sessions = load_session(payload.session_id)
        if sessions:
            session_data = sessions[0]

    concept_keywords = [
        "what is", "what are", "explain", "how does", "how do",
        "difference between", "define", "what's", "can you explain",
        "tell me about", "describe", "meaning of", "what does",
        "when to use", "why do we use", "how is", "how are"
    ]
    msg_lower = payload.message.lower()
    is_concept_question = any(kw in msg_lower for kw in concept_keywords)

    system_role = (
        "You are an expert computer science professor and technical mentor during a coding interview.\n\n"
        "## MOST IMPORTANT RULE:\n"
        "If the candidate asks about a CS concept, data structure, algorithm, or technology, "
        "you MUST answer ONLY about that specific concept. DO NOT mention the coding problem.\n\n"
        "## For concept questions use this structure:\n"
        "1. DEFINITION: Precise and very Crisp , simple definition with a real-world analogy.\n"
        "2. WHY IT MATTERS: When and why it is used.\n"
        "3. EXAMPLE: Short code snippet or step-by-step trace.\n\n"
        "## For code/problem-specific questions:\n"
        "- Analyze their code and give targeted guidance.\n"
        "- Never reveal the full solution unless hint_level is 5.\n\n"
        "## SPEECH FORMATTING:\n"
        "Your response will be read aloud by a Text-To-Speech engine. "
        "DO NOT use ANY Markdown formatting like **bold**, *italics*, or `code blocks`. "
        "DO NOT use coding symbols like ||, &&, ==, {}, or //. "
        "Write pure, natural english text. Instead of '||', say 'or'. Instead of '==', say 'equals'. "
        "Keep your explanations extremely crisp and conversational.\n\n"
        "Remember prior messages in this conversation and build on them."
    )

    try:
        llm = get_llm("chat")

        messages = [SystemMessage(content=system_role)]

        if not is_concept_question:
            background_context = (
                f"Problem the candidate is solving: {problem['description']}\n"
                f"Candidate current code:\n{payload.code}\n"
                f"Hint level: {session_data.get('hint_level', 0)} / 5"
            )
            messages.append(HumanMessage(content=background_context))
            messages.append(LCAIMessage(content="Understood, I have the context. I'm ready to help!"))

        for turn in payload.history:
            if turn.role == "user":
                messages.append(HumanMessage(content=turn.content))
            elif turn.role == "assistant":
                messages.append(LCAIMessage(content=turn.content))

        messages.append(HumanMessage(content=payload.message))

        response = llm.invoke(messages)

        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(response.content)
        except Exception as se:
            print(f"[SPEECH ERROR] chat voice failed: {se}")

        return {"feedback": response.content, "audio": audio_base64}
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        return {"feedback": "I'm sorry, I'm having trouble processing that.", "audio": None}


@app.post("/api/ai/{ai_type}")
def ai_endpoint(ai_type: str, payload: AIRequestPayload):
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    from app.services.session_store import load_session, save_session
    session_data = {}
    if payload.session_id:
        sessions = load_session(payload.session_id)
        if sessions:
            session_data = sessions[0]

    if ai_type == "periodic":
        system_role = (
            "You are a friendly technical and consise interviewer observing the candidate. "
            "Analyze their code. "
            "Give them a quick, supportive nudge if they're moving in the right direction or suggest a very brief, small conceptual hint if they look stuck. "
            "Do NOT give away the solution. Keep your hint extremely small and concise (just 1 or 2 short sentences). "
            "Your output will be spoken aloud. DO NOT use markdown, asterisks, or code symbols. Speak in pure natural english. "
            "AT THE VERY END of your response, you MUST include a score tag reflecting their progress out of 100, formatted exactly like: SCORE: 75"
        )
    elif ai_type == "hint":
        hint_level = session_data.get("hint_level", 0) + 1
        if hint_level > 5: hint_level = 5
        
        level_instructions = {
            1: "very subtle, small, and crisp conceptual hint (1 short sentence)",
            2: "gentle mention of the data structure or technique (brief)",
            3: "short explanation of the reasoning like a mentor",
            4: "friendly high-level algorithm description",
            5: "complete solution direction with encouraging words (still keep it concise)"
        }
        instr = level_instructions.get(hint_level, level_instructions[5])
        system_role = (
            f"The user asked for a hint. Provide a {instr}. Use a warm, supportive tone. Do not provide code. Keep the hint small and easy to digest. "
            "Your output will be spoken aloud. DO NOT use markdown formatting (**), backticks, or code symbols (like ||, &&, //). Write pure spoken english."
        )
    else:
        system_role = (
            "Evaluate the final code. Provide a VERY MINIMALIST 1 or 2 sentence conclusion. "
            "Your output will be spoken aloud. DO NOT use markdown formatting, code symbols, or backticks. Speak in pure natural english. "
            "CRITICAL INSTRUCTION: If the code is missing, contains only headers, or is completely non-functional pseudo-code, you MUST evaluate it as a 0 and explicitly state the solution is invalid or missing in your sentences. Do not provide undeserved praise.\n"
            "AT THE VERY END of your response, you MUST exactly include these four tags representing their specific performance out of 100:\n"
            "CODING SCORE: X\n"
            "COMMUNICATION SCORE: X\n"
            "PROBLEM SOLVING SCORE: X\n"
            "EFFICIENCY SCORE: X\n"
            "Replace X with a number from 0 to 100. Coding is correctness, Communication is clarity/naming, Problem Solving is logic/edge-cases, Efficiency is algorithmic speed."
        )

    context = (
        f"Problem: {problem['description']}\n"
        f"User Code: {payload.code}\n"
        f"Context: {problem.get('aiContext', 'None')}\n"
        f"Previous Analysis: {session_data.get('analysis', 'None')}"
    )

    try:
        llm = get_llm("analysis")
        response = llm.invoke([
            SystemMessage(content=f"{system_role}\n\nInstruction: Provide a concise response in plain text (1-3 sentences max)."),
            HumanMessage(content=context)
        ])
        final_feedback = response.content
        extracted_score = 50
        if ai_type == "periodic":
            import re
            match = re.search(r"(?i)SCORE\D*(\d+)", final_feedback)
            if match:
                extracted_score = int(match.group(1))
                final_feedback = re.sub(r"(?i)\[?SCORE\D*\d+\]?", "", final_feedback).strip()
            
            if payload.session_id:
                scores = session_data.get("progress_scores", [])
                scores.append({"minute": len(scores) + 1, "score": extracted_score})
                session_data["progress_scores"] = scores
                state_to_save = {
                    "session_id": payload.session_id,
                    "user_id": payload.user_id,
                    "problem_statement": problem['description'],
                    "current_code": payload.code,
                    "compiler_output": "",
                    "progress_scores": scores
                }
                save_session(state_to_save)

        if ai_type == "hint" and payload.session_id:
            session_data["hint_level"] = session_data.get("hint_level", 0) + 1
            if session_data["hint_level"] > 5: session_data["hint_level"] = 5
            
            state_to_save = {
                "session_id": payload.session_id,
                "user_id": payload.user_id,
                "problem_statement": problem['description'],
                "current_code": payload.code,
                "compiler_output": "",
                "hint_level": session_data["hint_level"]
            }
            save_session(state_to_save)
            
            
        if ai_type == "evaluation" and payload.session_id:
            import re
            
            coding_score = 50
            comm_score = 50
            ps_score = 50
            eff_score = 50
            
            m_code = re.search(r"(?i)CODING\s*SCORE\D*(\d+)", final_feedback)
            if m_code: coding_score = int(m_code.group(1))
            
            m_comm = re.search(r"(?i)COMMUNICATION\s*SCORE\D*(\d+)", final_feedback)
            if m_comm: comm_score = int(m_comm.group(1))
            
            m_ps = re.search(r"(?i)PROBLEM\s*SOLVING\s*SCORE\D*(\d+)", final_feedback)
            if m_ps: ps_score = int(m_ps.group(1))
            
            m_eff = re.search(r"(?i)EFFICIENCY\s*SCORE\D*(\d+)", final_feedback)
            if m_eff: eff_score = int(m_eff.group(1))
            
            final_feedback = re.sub(r"(?i)\[?CODING\s*SCORE\D*\d+\]?", "", final_feedback)
            final_feedback = re.sub(r"(?i)\[?COMMUNICATION\s*SCORE\D*\d+\]?", "", final_feedback)
            final_feedback = re.sub(r"(?i)\[?PROBLEM\s*SOLVING\s*SCORE\D*\d+\]?", "", final_feedback)
            final_feedback = re.sub(r"(?i)\[?EFFICIENCY\s*SCORE\D*\d+\]?", "", final_feedback).strip()
            
            overall_score = sum([coding_score, comm_score, ps_score, eff_score]) // 4
            
            import time
            eval_history = session_data.get("eval_history", [])
            attempt = {
                "evaluation": final_feedback,
                "coding_score": coding_score,
                "communication_score": comm_score,
                "problem_solving_score": ps_score,
                "efficiency_score": eff_score,
                "overall_score": overall_score,
                "time_taken": payload.time_taken,
                "hint_level": session_data.get("hint_level", 0),
                "topic": problem.get("tags", {}).get("topics", ["General"])[0] if problem.get("tags", {}).get("topics") else "General",
                "_ts": int(time.time())
            }
            eval_history.append(attempt)
            
            state_to_save = {
                "session_id": payload.session_id,
                "user_id": payload.user_id,
                "problem_statement": problem['description'],
                "current_code": payload.code,
                "compiler_output": "",
                "evaluation": final_feedback,
                "coding_score": coding_score,
                "communication_score": comm_score,
                "problem_solving_score": ps_score,
                "efficiency_score": eff_score,
                "overall_score": overall_score,
                "time_taken": payload.time_taken,
                "hint_level": session_data.get("hint_level", 0),
                "eval_history": eval_history
            }
            save_session(state_to_save)
        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(final_feedback)
        except Exception as se:
            print(f"[SPEECH ERROR] voice failed: {se}")

        return {
            "feedback": final_feedback,
            "audio": audio_base64,
            "level": session_data.get("hint_level", 0) if ai_type == "hint" else None
        }
    except Exception as e:
        print(f"[AI ERROR] /ai/{ai_type} failed: {type(e).__name__}: {e}")
        return {"feedback": "Tutor is thinking... try again.", "audio": None}



@app.post("/api/ai/stt")
async def speech_to_text_endpoint(file: UploadFile = File(...)):
   
    unique_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"audio_{unique_id}.wav")
    
    try:
        with open(tmp_path, "wb") as f:
            f.write(await file.read())
            
        from app.services.speech_service import get_speech_config
        speech_config = get_speech_config()
        if not speech_config:
            return {"text": "", "error": "Azure Speech disabled: missing credentials."}
            
        audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)
        recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        
        result = recognizer.recognize_once_async().get()
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return {"text": result.text}
        else:
            return {"text": "", "error": str(result.reason)}
            
    except Exception as e:
        return {"text": "", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/api/ai/warning_tts")
def ai_warning_tts(payload: dict):
    from app.services.speech_service import text_to_speech_base64
    audio_base64 = None
    try:
        text = payload.get("text", "")
        audio_base64 = text_to_speech_base64(text)
    except Exception as e:
        print(f"[SPEECH ERROR] Warning TTS failed: {e}")
    return {"audio": audio_base64}


from app.services.session_store import load_session

@app.post("/api/update_code")
def update_code(payload: CodeUpdatePayload):
    past_sessions = load_session(payload.session_id)
    
    if past_sessions:
        session_data = past_sessions[0]
        state = {
            "session_id": payload.session_id,
            "user_id": payload.user_id,
            "problem_statement": payload.problem_statement,
            "current_code": payload.current_code,
            "compiler_output": payload.compiler_output,
            "code_analysis": session_data.get("analysis", ""),
            "messages": session_data.get("messages", []),
            "ping_count": session_data.get("ping_count", 0),
            "start_time": session_data.get("start_time", None),
            "last_activity": session_data.get("last_activity", None),
        }
    else:
        state = {
            "session_id": payload.session_id,
            "user_id": payload.user_id,
            "problem_statement": payload.problem_statement,
            "current_code": payload.current_code,
            "compiler_output": payload.compiler_output,
        }

    result = graph.invoke(state)
    
    from app.services.session_store import save_session
    save_session(result)
    
    serializable_messages = []
    for msg in result.get("messages", []):
        if hasattr(msg, "content"):
            role = "AI" if getattr(msg, "type", "") == "ai" else "USER" if getattr(msg, "type", "") == "human" else "SYSTEM"
            serializable_messages.append({"role": role, "text": msg.content})
        elif isinstance(msg, dict):
            serializable_messages.append(msg)
            
    return {
        "analysis": result.get("code_analysis", ""),
        "messages": serializable_messages,
        "audio": result.get("audio", None),
        "ping_count": result.get("ping_count")
    }


@app.get("/api/session/{session_id}/analysis")
def get_session_analysis(session_id: str):
    from app.services.session_store import load_session
    past_sessions = load_session(session_id)
    if not past_sessions:
        return {"analysis": "Session not found.", "progress_scores": []}
    
    session_data = past_sessions[-1] if isinstance(past_sessions, list) else past_sessions
    analysis = session_data.get("evaluation", session_data.get("code_analysis", "No final analysis available yet."))
    candidate_name = session_data.get("resume_data", {}).get("name", "")
    
    return {
        "analysis": analysis,
        "progress_scores": session_data.get("progress_scores", []),
        "candidate_name": candidate_name
    }


@app.get("/api/candidate/history")
def get_candidate_history(user_id: str):
    from app.services.session_store import load_candidate_history
    from app.services.llm import get_llm
    from langchain_core.messages import SystemMessage, HumanMessage
    
    history = load_candidate_history(user_id)
    if not history:
        return {"success": False, "message": "No history found for this candidate.", "attempts": []}
        
    insights = {
        "summary": "First attempt recorded! Keep practicing to see your personalized growth insights.",
        "strengths": ["Completed first session"],
        "weaknesses": ["Need more data to find patterns"]
    }

    if len(history) > 1:
        try:
            summary_data = []
            for i, att in enumerate(history[::-1]):
                summary_data.append(
                    f"Attempt {len(history)-i} (Latest)" if i == 0 else f"Attempt {len(history)-i}"
                )
                summary_data[-1] += (
                    f": Coding={att.get('coding_score',0)}, Communication={att.get('communication_score',0)}, "
                    f"Problem Solving={att.get('problem_solving_score',0)}, Efficiency={att.get('efficiency_score',0)}, "
                    f"Overall={att.get('overall_score',0)}, Time Taken={att.get('time_taken',600)}s"
                )
            
            prompt = "\n".join(summary_data)
            llm = get_llm("analysis")
            response = llm.invoke([
                SystemMessage(content=(
                    "You are an expert technical interviewer evaluating a candidate's progress. "
                    "You will receive multiple recent interview attempts (listed newest to oldest). "
                    "CRITICAL INSTRUCTION: "
                    "1. The 'summary' should describe the overall trend across all attempts. "
                    "2. The 'strengths' and 'weaknesses' MUST reflect ONLY the LATEST (newest) attempt. DO NOT reference past attempts or 'inconsistency' in strengths/weaknesses. "
                    "3. If their LATEST attempt has a high score (>70), you MUST provide genuine, positive strengths. "
                    "4. If their LATEST attempt is 0, explicitly state 'None observed' under strengths. "
                    "Provide your output EXACTLY as a JSON object with this shape, and nothing else:\n"
                    "{\n"
                    '  "summary": "2 sentences summarizing overall growth",\n'
                    '  "strengths": ["string", "string"],\n'
                    '  "weaknesses": ["string", "string"]\n'
                    "}\n"
                    "Make the strings concise."
                )),
                HumanMessage(content=prompt)
            ])
            import json
            raw_text = response.content.strip()
            if raw_text.startswith("```json"): raw_text = raw_text[7:]
            if raw_text.endswith("```"): raw_text = raw_text[:-3]
            insights = json.loads(raw_text.strip())
        except Exception as e:
            print(f"Insight Generation Error: {e}")
            insights["summary"] = "Historical growth tracked successfully, but detailed AI insights are temporarily unavailable."
            
    return {
        "success": True, 
        "attempts": history,
        "insights": insights
    }


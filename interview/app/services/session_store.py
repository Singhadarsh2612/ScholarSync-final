from interview.app.services.mongo_services import get_collection
from interview.app.problems import problems
import datetime
import uuid

def save_session(state):
    chat_coll = get_collection("chat_sessions")
    if chat_coll is None:
        return

    session_id = state.get("session_id", state.get("id"))
    if not session_id:
        return

    existing = chat_coll.find_one({"session_id": session_id})
    if existing:
        for k, v in state.items():
            existing[k] = v
        chat_coll.replace_one({"session_id": session_id}, existing)
    else:
        item = dict(state)
        item["session_id"] = session_id
        chat_coll.insert_one(item)

    eval_history = state.get("eval_history", [])
    if eval_history and len(eval_history) > 0:
        latest_eval = eval_history[-1]
        topic_slug = latest_eval.get("topic", "general").lower().replace(" ", "-")
        record_interview_attempt_schema(topic_slug, latest_eval)

def record_interview_attempt_schema(topic_slug, eval_data):
    """ Record the attempt into the strict 'interview_sessions' topic document """
    coll = get_collection("interview_sessions")
    if coll is None: return
    
    doc = coll.find_one({"question_tag": topic_slug})
    now_str = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    prob_title = topic_slug.replace("-", " ").title()
    prob_desc = "Coding problem practice."
    for pid, p in problems.items():
        if p.get("tags", {}).get("topics", [""])[0].lower().replace(" ", "-") == topic_slug:
            prob_title = p.get("title", prob_title)
            prob_desc = p.get("description", prob_desc)
            break
            
    if not doc:
        doc = {
            "_id": str(uuid.uuid4()),
            "question_tag": topic_slug,
            "title": prob_title,
            "problem_description": prob_desc,
            "endpoint_redirect": f"https://yourdomain.com/interview/{topic_slug}",
            "redirect_logic_prompt": f"User explicitly requested {prob_title} practice -> immediate redirect.",
            "number_of_attempts": 0,
            "attempts": [],
            "performance_score": 0,
            "average_score": 0.0,
            "description_of_performance": "No data available",
            "recent_performance_analysis": "No attempts made yet",
            "overall_performance": "No data available",
            "improvement_trend": "Not Enough Data",
            "created_at": now_str,
            "updated_at": now_str
        }
        coll.insert_one(doc)
    
    if "attempts" not in doc:
        doc["attempts"] = []
        
    attempt_id = len(doc["attempts"]) + 1
    new_attempt = {
        "attempt_id": attempt_id,
        "attempted_at": now_str,
        "score": eval_data.get("overall_score", 0),
        "verdict": "Attempted" if eval_data.get("overall_score", 0) > 0 else "Not Attempted",
        "feedback": eval_data.get("evaluation", "No feedback")
    }
    
    doc["attempts"].append(new_attempt)
    doc["number_of_attempts"] = len(doc["attempts"])
    
    total_score = sum(a.get("score", 0) for a in doc["attempts"])
    doc["average_score"] = float(total_score) / doc["number_of_attempts"] if doc["number_of_attempts"] > 0 else 0.0
    doc["performance_score"] = doc["average_score"]
    doc["description_of_performance"] = f"Average score across {doc['number_of_attempts']} attempts is {doc['average_score']:.1f}."
    
    doc["recent_performance_analysis"] = new_attempt["feedback"]
    
    avg = doc["average_score"]
    if avg >= 80:
        doc["overall_performance"] = "Excellent"
        doc["improvement_trend"] = "Stable mastery"
    elif avg >= 50:
        doc["overall_performance"] = "Improving"
        doc["improvement_trend"] = "Progressing steadily"
    else:
        doc["overall_performance"] = "Needs Practice"
        doc["improvement_trend"] = "Requires more focus on fundamentals"
        
    doc["updated_at"] = now_str
    
    coll.replace_one({"_id": doc["_id"]}, doc)

def load_session(session_id):
    chat_coll = get_collection("chat_sessions")
    if chat_coll is None: return []
    doc = chat_coll.find_one({"session_id": session_id})
    if doc:
        doc.pop("_id", None)
        return [doc]
    return []

def load_candidate_history(user_id: str):
    chat_coll = get_collection("chat_sessions")
    if chat_coll is None: return []
    
    cursor = chat_coll.find({"user_id": user_id})
    merged_history = []
    for doc in cursor:
        eval_history = doc.get("eval_history", [])
        if not eval_history and doc.get("evaluation"):
            eval_history.append({
                "evaluation": doc.get("evaluation"),
                "coding_score": doc.get("coding_score", 0),
                "communication_score": doc.get("communication_score", 0),
                "problem_solving_score": doc.get("problem_solving_score", 0),
                "efficiency_score": doc.get("efficiency_score", 0),
                "overall_score": doc.get("overall_score", 0),
                "time_taken": doc.get("time_taken", 0),
                "hint_level": doc.get("hint_level", 0),
                "topic": "General", 
                "_ts": 0
            })
        merged_history.extend(eval_history)
        
    merged_history.sort(key=lambda x: x.get("_ts", 0))
    return merged_history[-5:]
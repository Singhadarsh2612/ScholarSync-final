import requests

from endpoints import SUBJECTS_URL as API_URL


def get_subject_professors():

    print("[MCP] get_subject_professors")

    try:

        r = requests.get(API_URL)
        res = r.json()

        subjects = res["data"]["subjects"]

        cleaned = []

        for s in subjects:

            cleaned.append({
                "subject_name": s["subjectName"],
                "subject_code": s["subjectCode"],
                "professor_name": s["professorName"],
                "professor_email": s["professorEmail"]
            })

        return {
            "status": "success",
            "subjects": cleaned
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }
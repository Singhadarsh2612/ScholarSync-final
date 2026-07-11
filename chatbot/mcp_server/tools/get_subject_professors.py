import requests

API_URL = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/subjects"


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
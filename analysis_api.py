import requests
from langchain_openai import AzureChatOpenAI
import os
from dotenv import load_dotenv
load_dotenv()


MARKS_API = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/marks"
ATTENDANCE_API = "https://student-portal-2-gh1j.onrender.com/api/student/69abdbea843e1db183a2b20f/attendance"


def fetch_student_data():

    marks_res = requests.get(MARKS_API).json()
    attendance_res = requests.get(ATTENDANCE_API).json()

    marks_data = marks_res["data"]
    attendance_data = attendance_res["data"]

    combined = []

    for m in marks_data:

        subject = m["subjectId"]["subjectName"]
        avg = m["average"]

        quizzes = [
            m["quiz1"],
            m["quiz2"],
            m["quiz3"],
            m["quiz4"],
            m["quiz5"],
            m["quiz6"]
        ]

        attendance_info = next(
            (a for a in attendance_data if a["subjectName"] == subject),
            None
        )

        combined.append({
            "subject": subject,
            "average_marks": avg,
            "attendance": attendance_info["attendancePercentage"],
            "quizzes": quizzes
        })

    return combined


def generate_analysis(data):

    llm = AzureChatOpenAI(
        azure_deployment=os.getenv("DEPLOYMENT_NAME", "gpt-4o-mini"),
        temperature=0,
        api_version="2024-02-15-preview"
    )

    prompt = f"""
You are an academic performance advisor.

Analyze this student data:

{data}

Provide:
do not give the student data in list or json format
1. strengths
2. weak subjects
3. attendance risks
4. study strategy
5. weekly study planner
"""

    response = llm.invoke(prompt)

    return response.content


def get_analysis_report():

    data = fetch_student_data()

    report = generate_analysis(data)

    return {
        "data": data,
        "analysis": report
    }
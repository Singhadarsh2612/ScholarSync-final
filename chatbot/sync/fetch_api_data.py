import requests

from endpoints import (
    EXAM_SCHED_URL as EXAMS_API,
    PORTAL_2_ASSIGNMENTS_URL as ASSIGNMENTS_API,
)


def fetch_exam_schedule():

    r = requests.get(EXAMS_API)
    data = r.json()

    return data["data"]["examSchedules"]


def fetch_assignments():

    r = requests.get(ASSIGNMENTS_API)
    data = r.json()

    return data["data"]["assignments"]["upcoming"]
from fastapi import FastAPI
from .tools.calculator import calculator
from .tools.current_time import current_time
from .tools.web_search import web_search
from .tools.send_email import send_email
from .tools.delete_event_by_title import delete_event_by_title
from .tools.create_calendar_event import create_calendar_event
from .tools.check_calendar_free import check_calendar_free
from .tools.list_calendar_events import list_calendar_events
from .tools.update_event_by_title import update_event_by_title
from .tools.get_subject_professors import get_subject_professors
from .tools.get_student_connections import get_student_connections
app = FastAPI()


@app.post("/tools/calculator")
def calculator_tool(data: dict):
    return calculator(data)


@app.post("/tools/current_time")
def time_tool():
    return current_time()


@app.post("/tools/web_search")
def search_tool(data: dict):
    return web_search(data)


@app.post("/tools/send_email")
def email_tool(data: dict):
    return send_email(data)


@app.post("/tools/create_calendar_event")
def calendar_tool(data: dict):
    return create_calendar_event(data)


@app.post("/tools/check_calendar_free")
def free_tool(data: dict):
    return check_calendar_free(data)


@app.post("/tools/list_calendar_events")
def list_tool(data: dict):
    return list_calendar_events(data)


@app.post("/tools/delete_event_by_title")
def delete_event_title(data: dict):
    return delete_event_by_title(data)

@app.post("/tools/update_event_by_title")
def update_event_title(data: dict):
    return update_event_by_title(data)

@app.post("/tools/get_subject_professors")
def run_get_subject_professors():

    return get_subject_professors()

@app.post("/tools/get_student_connections")
def run_get_student_connections():

    return get_student_connections()

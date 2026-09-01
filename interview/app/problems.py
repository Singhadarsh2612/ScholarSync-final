import json
import os

_problems_path = os.path.join(os.path.dirname(__file__), "problems.json")

# The statements contain ≤, ·, — and other non-ASCII maths characters. Without
# an explicit encoding Python falls back to the locale codec (cp1252 on
# Windows), which turns every one of them into mojibake by the time it reaches
# the browser.
with open(_problems_path, "r", encoding="utf-8") as f:
    _data = json.load(f)

problems = {p["id"]: p for p in _data["problems"]}

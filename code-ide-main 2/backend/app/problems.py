import json
import os

_problems_path = os.path.join(os.path.dirname(__file__), "problems.json")

with open(_problems_path, "r") as f:
    _data = json.load(f)

problems = {p["id"]: p for p in _data["problems"]}

import json
import os

# Get the path to problems.json relative to this file
_problems_path = os.path.join(os.path.dirname(__file__), "problems.json")

with open(_problems_path, "r") as f:
    _data = json.load(f)

# Create a dictionary of problems indexed by their ID for easy lookup
problems = {p["id"]: p for p in _data["problems"]}

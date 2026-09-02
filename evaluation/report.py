"""Where suite output goes.

Both CLIs write here, and the directory is gitignored, so it does not exist in
a fresh clone or on a CI runner -- `open(path, "w")` would fail on the missing
parent. Creating it on write keeps `--json` working anywhere.
"""

import json
import os

REPORTS_DIR = "reports"


def default_path(name):
    """A report name resolved inside the reports directory."""
    return os.path.join(REPORTS_DIR, name)


def write(path, payload):
    """Write a report as JSON, creating its directory if needed."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    return path

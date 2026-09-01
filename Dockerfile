FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── OS-level deps ──
#   g++      : compiles candidate C++ submissions (/interview/api/run)
#   libpq-dev: psycopg build requirement for the Postgres checkpointer
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# ── Python deps (own layer so source edits don't reinstall) ──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Project source ──
COPY . .

# 8000 = hub (+ mounted /interview routes), 8002 = MCP tool server.
# One image, two services: docker-compose overrides the command for each.
EXPOSE 8000 8002

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]


FROM python:3.12-slim

# Prevent Python from writing .pyc / buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Install OS-level deps ──
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# ── Install Python deps ──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy project source ──
COPY . .

# ── Expose both service ports ──
EXPOSE 8000 8002

# ── Start both servers with a lightweight shell wrapper ──
COPY start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]

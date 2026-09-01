import os

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "scholar_sync")

# Fail fast when Mongo is unreachable. The driver's 30s default meant every
# call against a down database blocked for half a minute before erroring.
SERVER_SELECTION_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "3000"))

# Only needed for clusters presenting a cert this host cannot verify.
# Off by default — enabling it disables TLS certificate validation.
ALLOW_INVALID_CERTS = os.getenv("MONGO_ALLOW_INVALID_CERTS", "").lower() in (
    "1", "true", "yes",
)

_client = None
_db = None
_failed = False


def get_db():
    """Return the database handle, or None if Mongo is unreachable.

    A failed connection leaves nothing assigned and is remembered, so callers
    degrade gracefully instead of retrying a dead host on every request.
    """
    global _client, _db, _failed

    if _db is not None:
        return _db
    if _failed:
        return None

    try:
        kwargs = {"serverSelectionTimeoutMS": SERVER_SELECTION_TIMEOUT_MS}
        if ALLOW_INVALID_CERTS:
            kwargs["tlsAllowInvalidCertificates"] = True

        client = MongoClient(MONGO_URI, **kwargs)
        client.admin.command("ping")          # must succeed before we publish _db
    except Exception as e:
        _failed = True
        print(f"[MongoDB] Connection failed ({DB_NAME}): {e}")
        return None

    _client = client
    _db = client[DB_NAME]
    print(f"[MongoDB] Connected successfully to database: {DB_NAME}")
    return _db


def get_collection(collection_name: str):
    """Return a collection handle, or None when the database is unavailable."""
    database = get_db()
    if database is None:
        return None
    return database[collection_name]


def reset_connection():
    """Forget a cached failure so the next call retries. Used by tests/tools."""
    global _client, _db, _failed
    _client = _db = None
    _failed = False

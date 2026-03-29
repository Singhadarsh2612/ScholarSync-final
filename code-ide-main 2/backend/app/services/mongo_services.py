import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "scholar_sync")

client = None
db = None

def get_db():
    global client, db
    if db is None:
        try:
            # Singleton pattern: Maintain a single connection pool
            client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True)
            db = client[DB_NAME]
            # Verify connection
            client.admin.command('ping')
            print(f"[MongoDB] Connected successfully to database: {DB_NAME}")
        except Exception as e:
            print(f"[MongoDB] Connection failed: {e}")
    return db

def get_collection(collection_name: str):
    database = get_db()
    if database is not None:
        return database[collection_name]
    return None

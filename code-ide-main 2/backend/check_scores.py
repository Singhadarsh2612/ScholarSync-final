import os
import json
from dotenv import load_dotenv
load_dotenv('.env')

from azure.cosmos import CosmosClient
ENDPOINT = os.getenv('COSMOS_ENDPOINT')
KEY = os.getenv('COSMOS_KEY')
DB_NAME = os.getenv('COSMOS_DATABASE')
CONTAINER_NAME = os.getenv('COSMOS_CONTAINER')

client = CosmosClient(ENDPOINT, credential=KEY)
database = client.get_database_client(DB_NAME)
container = database.get_container_client(CONTAINER_NAME)

query = "SELECT c.session_id, c.overall_score, c.resume_data FROM c WHERE IS_DEFINED(c.evaluation)"
items = list(container.query_items(query=query, enable_cross_partition_query=True))
print(f"Found {len(items)} items")
with open('scores.json', 'w') as f:
    json.dump(items, f, indent=2)

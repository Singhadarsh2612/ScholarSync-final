from app.services.cosmos_services import get_container
import json

def test_query():
    container = get_container()
    if not container:
        print("No container found")
        return
        
    user_id = "user_nsa40inmmj9kmk7"
    
    query = "SELECT * FROM c WHERE c.user_id=@user_id"
    items = list(container.query_items(
        query=query,
        parameters=[{"name": "@user_id", "value": user_id}],
        enable_cross_partition_query=True
    ))
    
    if items:
        print(f"Items found by user_id: {len(items)}")
        print("Sample keys from item 1:", list(items[0].keys()))
        print("Session IDs for this user:")
        for item in items:
            print(f"- id: {item.get('id')}, session_id: {item.get('session_id')}")
    else:
        print("No items found by user_id")

if __name__ == "__main__":
    test_query()

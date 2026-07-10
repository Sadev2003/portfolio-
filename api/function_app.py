import os
import logging
import azure.functions as func
from azure.cosmos import CosmosClient

app = func.FunctionApp()

@app.route(route="visitor_counter", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def visitor_counter(req: func.HttpRequest) -> func.HttpResponse:
    document_id = "1"
    
    # Lazy load environment variables inside the execution scope
    endpoint = os.environ.get("COSMOS_ENDPOINT")
    key = os.environ.get("COSMOS_KEY")

    if not endpoint or not key:
        logging.error("Database connection configuration missing from app settings.")
        return func.HttpResponse(
            "Server configuration error.", 
            status_code=500
        )
        
    try:
        # Initialize client cleanly on invocation
        client = CosmosClient(endpoint, key)
        database = client.get_database_client("portfolio")
        container = database.get_container_client("counter")

        # Read the item
        item = container.read_item(item=document_id, partition_key=document_id)
        
        # Increment count
        current_count = item.get("count", 0)
        item["count"] = current_count + 1
        
        # Upsert the updated item
        container.upsert_item(item)
        
        return func.HttpResponse(
            f"Visitor count updated to: {item['count']}", 
            status_code=200
        )
        
    except Exception as e:
        logging.error(f"Cosmos DB Operation failure: {str(e)}")
        return func.HttpResponse(
            "An error occurred while updating the visitor count.", 
            status_code=500
        )
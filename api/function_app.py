import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Retrieve the secure connection string injected via App Settings (Never hardcoded)
COSMOS_CONNECTION_STRING = os.environ.get("COSMOS_CONNECTION_STRING")

@app.route(route="GetPortfolioCount", methods=["GET"])
def GetPortfolioCount(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing a request to update the portfolio visitor counter.')

    if not COSMOS_CONNECTION_STRING:
        return func.HttpResponse(
            json.dumps({"error": "Database connection string missing in server environment."}),
            status_code=500,
            mimetype="application/json"
        )

    try:
        # Initialize the Cosmos DB Client database backend
        client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
        database = client.get_database_client("ResumeDB")
        container = database.get_container_client("Counter")

        # Read the unique visitor counter tracker document (id="1")
        try:
            item = container.read_item(item="1", partition_key="1")
        except exceptions.CosmosResourceNotFoundError:
            # Fallback initialization seed if the record isn't provisioned yet
            item = {"id": "1", "count": 0}

        # Increment the running metric counter safely
        item["count"] += 1

        # Save the updated data transaction back to the server cluster
        container.upsert_item(item)

        # Return the counter data as a JSON payload object with clean CORS security clearances
        return func.HttpResponse(
            json.dumps({"count": item["count"]}),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )

    except Exception as e:
        logging.error(f"Critical error executing database transactions: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to sync transaction operations with cloud server database backend."}),
            status_code=500,
            mimetype="application/json"
        )cd .
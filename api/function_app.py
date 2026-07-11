import os
import logging
import time
import uuid
import azure.functions as func
from azure.cosmos import CosmosClient
from azure.communication.email import EmailClient 

app = func.FunctionApp()

# --- GLOBAL RATE LIMITER TRACKER STATE ---
ip_tracker = {}
MAX_REQUESTS_PER_MIN = 3
TIME_WINDOW = 60.0  

def is_rate_limited(client_ip: str) -> bool:
    """Helper utility to calculate sliding window limits across application scopes."""
    if client_ip == "unknown_ip":
        return False # Graceful fallback if proxy header is absent
        
    current_time = time.time()
    if client_ip not in ip_tracker:
        ip_tracker[client_ip] = []
    
    # Prune historical timestamps older than the evaluation window
    ip_tracker[client_ip] = [t for t in ip_tracker[client_ip] if current_time - t < TIME_WINDOW]
    
    if len(ip_tracker[client_ip]) >= MAX_REQUESTS_PER_MIN:
        return True
        
    ip_tracker[client_ip].append(current_time)
    
    # Periodic sweep to prevent dictionary memory leak
    if len(ip_tracker) > 1000:
        ip_tracker.clear()
        
    return False

# --- ROUTE 1: VISITOR COUNTER ---
@app.route(route="visitor_counter", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def visitor_counter(req: func.HttpRequest) -> func.HttpResponse:
    document_id = "1"
    
    forwarded_for = req.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(',')[0].strip() if forwarded_for else "unknown_ip"

    if is_rate_limited(client_ip):
        logging.warning(f"Counter rate limit tripped by IP: {client_ip}")
        return func.HttpResponse("Too Many Requests. Rate limit exceeded.", status_code=429)
        
    endpoint = os.environ.get("COSMOS_ENDPOINT")
    key = os.environ.get("COSMOS_KEY")

    if not endpoint or not key:
        logging.error("Telemetry DB connection configs are unmapped.")
        return func.HttpResponse("Server configuration error.", status_code=500)
        
    try:
        client = CosmosClient(endpoint, key)
        database = client.get_database_client("portfolio")
        container = database.get_container_client("counter")

        patch_operations = [{"op": "incr", "path": "/count", "value": 1}]
        updated_item = container.patch_item(
            item=document_id, 
            partition_key=document_id, 
            patch_operations=patch_operations
        )
        return func.HttpResponse(f"Visitor count updated to: {updated_item.get('count', 0)}", status_code=200)
    except Exception as e:
        logging.error(f"Cosmos DB Operation failure: {str(e)}")
        return func.HttpResponse("An error occurred while updating the visitor count.", status_code=500)

# --- ROUTE 2: SECURE MESSAGE TICKET & EMAIL FORWARDER ---    
@app.route(route="send_message", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def send_message(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing a new message ticket.')

    forwarded_for = req.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(',')[0].strip() if forwarded_for else "unknown_ip"

    # Fix 3: Enforce identical rate limiting boundaries on contact submissions
    if is_rate_limited(client_ip):
        logging.warning(f"Contact form entry blocked via rate limiter: {client_ip}")
        return func.HttpResponse("Too many messages submitted. Please wait before trying again.", status_code=429)

    try:
        req_body = req.get_json()
        name = req_body.get('name')
        email = req_body.get('email')
        message = req_body.get('message')

        if not name or not email or not message:
            return func.HttpResponse("Missing required fields.", status_code=400)

        # Fix 2: Applied explicit environment guards before database connection strings are parsed
        endpoint = os.environ.get("COSMOS_ENDPOINT")
        key = os.environ.get("COSMOS_KEY")
        connection_string = os.environ.get("COMMUNICATION_SERVICES_CONNECTION_STRING")
        sender_email = os.environ.get("SENDER_EMAIL")

        if not endpoint or not key or not connection_string or not sender_email:
            logging.error("Critical server configuration variables are absent from settings context.")
            return func.HttpResponse("Server configuration error.", status_code=500)
        
        # Connect and update Backup database logs
        client = CosmosClient(endpoint, key)
        database = client.get_database_client("portfolio")
        container = database.get_container_client("messages")

        ticket_document = {
            "id": str(uuid.uuid4()),  
            "name": name,
            "email": email,
            "message": message,
            "timestamp": time.time()
        }
        container.create_item(body=ticket_document)

        # Execute downstream SMTP transmission to Gmail
        recipient_email = "YOUR_PERSONAL_GMAIL@gmail.com" 
        email_client = EmailClient.from_connection_string(connection_string)
        
        email_message = {
            "senderAddress": sender_email,
            "recipientAddress": recipient_email,
            "content": {
                "subject": f"💼 Portfolio Message from {name}",
                "plainText": f"Name: {name}\nSender: {email}\n\nMessage:\n{message}"
            }
        }
        email_client.begin_send(email_message)
        return func.HttpResponse("Ticket sent successfully!", status_code=201)

    except ValueError:
        return func.HttpResponse("Invalid JSON payload.", status_code=400)
    except Exception as e:
        logging.error(f"Failed to process ticket: {str(e)}")
        return func.HttpResponse("Internal server error.", status_code=500)
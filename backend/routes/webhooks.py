from flask import Blueprint, current_app, jsonify, request

from email.utils import parseaddr

from ..services.email_service import retrieve_received_email
from ..services.enquiry_service import EnquiryStorageError, record_delivery_event, record_incoming_communication

webhooks_bp = Blueprint("webhooks", __name__)


@webhooks_bp.post("/webhooks/resend")
def resend_webhook():
    secret = current_app.config.get("RESEND_WEBHOOK_SECRET", "")
    if not secret:
        return jsonify({"error": "Webhook is not configured."}), 404

    raw_payload = request.get_data(as_text=True)
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    try:
        from svix.webhooks import Webhook
        event = Webhook(secret).verify(raw_payload, headers)
    except Exception:
        current_app.logger.warning("Rejected invalid Resend webhook signature")
        return jsonify({"error": "Invalid webhook signature."}), 400

    event_type = str(event.get("type", ""))
    data = event.get("data", {}) if isinstance(event.get("data"), dict) else {}
    email_id = str(data.get("email_id", ""))
    event_id = headers["svix-id"]
    details = data.get("bounce") or data.get("failed") or {}
    try:
        if event_type == "email.received":
            received = retrieve_received_email(email_id)
            sender = parseaddr(str(received.get("from", data.get("from", ""))))[1].lower()
            record_incoming_communication(
                sender,
                str(received.get("subject", data.get("subject", "Customer reply"))),
                str(received.get("text") or "Email received without a plain-text body."),
                email_id,
                str(received.get("created_at", event.get("created_at", ""))),
            )
            return jsonify({"received": True})
        record_delivery_event(
            email_id,
            event_id,
            event_type,
            str(event.get("created_at", "")),
            details if isinstance(details, dict) else {},
        )
    except EnquiryStorageError:
        current_app.logger.exception("Resend webhook event could not be stored")
        return jsonify({"error": "Event storage failed."}), 503

    return jsonify({"received": True})

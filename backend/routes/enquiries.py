from flask import Blueprint, current_app, jsonify, request

from ..schemas.enquiry import EnquiryValidationError, validate_enquiry_payload
from ..services.email_service import send_enquiry_notification
from ..services.enquiry_service import EnquiryStorageError, save_enquiry
from ..utils.rate_limit import email_key, enquiry_rate_limit_exceeded, request_ip_key
from ..utils.security import origin_is_allowed

enquiries_bp = Blueprint("enquiries", __name__)


@enquiries_bp.post("/enquiries")
def create_enquiry():
    if not origin_is_allowed(current_app, request.headers.get("Origin")):
        return jsonify({"error": "Origin not allowed."}), 403

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    try:
        enquiry = validate_enquiry_payload(request.get_json(silent=True))
    except EnquiryValidationError as error:
        return jsonify({"error": str(error)}), 400

    if enquiry_rate_limit_exceeded([request_ip_key(), email_key(enquiry["email"])]):
        return jsonify({"error": "Too many submissions. Please try again later."}), 429

    try:
        saved = save_enquiry(enquiry)
    except EnquiryStorageError as error:
        current_app.logger.warning(
            "Enquiry storage failed: %s",
            error,
            exc_info=True,
        )
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    try:
        send_enquiry_notification(enquiry, saved)
    except Exception:
        current_app.logger.exception("Enquiry email notification failed")

    return jsonify({"status": "received", **saved}), 201

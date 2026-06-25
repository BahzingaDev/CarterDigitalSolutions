from flask import Blueprint, current_app, jsonify, request

from ..schemas.enquiry import EnquiryValidationError, validate_enquiry_payload
from ..services.enquiry_service import EnquiryStorageError, save_enquiry
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

    try:
        saved = save_enquiry(enquiry)
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    return jsonify({"status": "received", **saved}), 201

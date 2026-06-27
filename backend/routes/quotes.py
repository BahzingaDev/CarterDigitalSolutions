from flask import Blueprint, current_app, jsonify, request

from ..services.enquiry_service import EnquiryStorageError, approve_public_quote, get_public_quote
from ..services.email_service import send_quote_approval_notification
from ..utils.security import origin_is_allowed

quotes_bp = Blueprint("quotes", __name__)


@quotes_bp.get("/quotes/<quote_id>")
def public_quote(quote_id: str):
    token = request.headers.get("X-Quote-Token", "")
    if not token:
        return jsonify({"error": "Quote not found."}), 404
    try:
        quote = get_public_quote(quote_id, token)
    except EnquiryStorageError:
        return jsonify({"error": "Quote storage is unavailable."}), 503
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    return jsonify(quote)


@quotes_bp.post("/quotes/<quote_id>/approve")
def approve_quote(quote_id: str):
    if not origin_is_allowed(current_app, request.headers.get("Origin")):
        return jsonify({"error": "Origin is not allowed."}), 403
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    payload = request.get_json(silent=True) or {}
    try:
        quote = approve_public_quote(
            quote_id,
            str(payload.get("token", "")),
            str(payload.get("name", "")),
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        return jsonify({"error": "Quote storage is unavailable."}), 503
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    try:
        send_quote_approval_notification(quote)
    except Exception:
        current_app.logger.exception("Quote approval notification failed")
    return jsonify(quote)

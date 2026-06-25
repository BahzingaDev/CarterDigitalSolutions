import hmac

from flask import Blueprint, current_app, jsonify, request

from ..services.enquiry_service import EnquiryStorageError, list_enquiries

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/admin/enquiries")
def export_enquiries():
    configured_token = current_app.config.get("ADMIN_EXPORT_TOKEN")
    if not configured_token:
        return jsonify({"error": "Admin export is not configured."}), 404

    provided_token = _bearer_token()
    if not provided_token or not hmac.compare_digest(provided_token, configured_token):
        return jsonify({"error": "Unauthorized."}), 401

    try:
        requested_limit = int(request.args.get("limit", current_app.config["ADMIN_EXPORT_LIMIT"]))
    except ValueError:
        return jsonify({"error": "limit must be a number."}), 400

    try:
        enquiries = list_enquiries(requested_limit)
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    return jsonify({"count": len(enquiries), "enquiries": enquiries})


def _bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if not header.startswith(prefix):
        return ""

    return header[len(prefix) :].strip()

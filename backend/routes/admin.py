import hmac

from flask import Blueprint, current_app, jsonify, request

from ..services.enquiry_service import EnquiryStorageError, list_enquiries, update_enquiry

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/admin/enquiries")
def export_enquiries():
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    try:
        requested_limit = int(request.args.get("limit", current_app.config["ADMIN_EXPORT_LIMIT"]))
    except ValueError:
        return jsonify({"error": "limit must be a number."}), 400

    try:
        enquiries = list_enquiries(requested_limit)
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    return jsonify({"count": len(enquiries), "enquiries": enquiries})


@admin_bp.patch("/admin/enquiries/<enquiry_id>")
def update_admin_enquiry(enquiry_id: str):
    auth_error = _require_admin()
    if auth_error:
        return auth_error

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    try:
        updated = update_enquiry(enquiry_id, request.get_json(silent=True) or {})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    if not updated:
        return jsonify({"error": "Enquiry not found."}), 404

    return jsonify({"enquiry": updated})


def _require_admin():
    configured_token = current_app.config.get("ADMIN_EXPORT_TOKEN")
    if not configured_token:
        return jsonify({"error": "Admin export is not configured."}), 404

    provided_token = _bearer_token()
    if not provided_token or not hmac.compare_digest(provided_token, configured_token):
        return jsonify({"error": "Unauthorized."}), 401

    return None


def _bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if not header.startswith(prefix):
        return ""

    return header[len(prefix) :].strip()

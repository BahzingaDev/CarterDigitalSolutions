from flask import Blueprint, current_app, jsonify, request, session

from ..services.admin_service import (
    AdminStorageError,
    admin_account_exists,
    authenticate_admin_account,
    create_admin_account,
)
from ..services.enquiry_service import EnquiryStorageError, list_enquiries, update_enquiry
from ..utils.admin_auth import (
    admin_login_rate_limited,
    admin_session_payload,
    clear_admin_login_attempts,
    require_admin,
    require_admin_write,
    start_admin_session,
)
from ..utils.rate_limit import request_ip_key
from ..utils.security import origin_is_allowed

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/admin/auth/session")
def admin_auth_session():
    if not current_app.config.get("ADMIN_EMAIL"):
        return jsonify({"authenticated": False, "configured": False}), 503

    try:
        setup_required = not admin_account_exists()
    except AdminStorageError:
        return jsonify({"error": "Admin account storage is unavailable."}), 503

    if setup_required:
        session.clear()
        return jsonify(
            {
                "authenticated": False,
                "configured": True,
                "setup_required": True,
            }
        )

    if not session.get("admin_authenticated"):
        return jsonify(
            {
                "authenticated": False,
                "configured": True,
                "setup_required": False,
            }
        )

    return jsonify(
        {"configured": True, "setup_required": False, **admin_session_payload()}
    )


@admin_bp.post("/admin/auth/setup")
def admin_setup():
    if not current_app.config.get("ADMIN_EMAIL"):
        return jsonify({"error": "Admin setup is not configured."}), 503

    if not origin_is_allowed(current_app, request.headers.get("Origin")):
        return jsonify({"error": "Origin is not allowed."}), 403

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    ip_key = request_ip_key()
    if admin_login_rate_limited(ip_key):
        return jsonify({"error": "Too many setup attempts. Try again later."}), 429

    payload = request.get_json(silent=True) or {}
    try:
        if admin_account_exists():
            return jsonify({"error": "Admin setup has already been completed."}), 409
        account = create_admin_account(
            str(payload.get("name", "")),
            str(payload.get("email", "")),
            str(payload.get("password", "")),
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except AdminStorageError:
        return jsonify({"error": "Admin account storage is unavailable."}), 503

    clear_admin_login_attempts(ip_key)
    csrf_token = start_admin_session(account)
    return jsonify(
        {
            "authenticated": True,
            "name": account["name"],
            "email": account["email"],
            "csrf_token": csrf_token,
            "setup_required": False,
        }
    ), 201


@admin_bp.post("/admin/auth/login")
def admin_login():
    if not current_app.config.get("ADMIN_EMAIL"):
        return jsonify({"error": "Admin authentication is not configured."}), 503

    if not origin_is_allowed(current_app, request.headers.get("Origin")):
        return jsonify({"error": "Origin is not allowed."}), 403

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    ip_key = request_ip_key()

    if admin_login_rate_limited(ip_key):
        return jsonify({"error": "Too many login attempts. Try again later."}), 429

    try:
        if not admin_account_exists():
            return jsonify({"error": "Complete admin account setup first."}), 409
        account = authenticate_admin_account(email, password)
    except AdminStorageError:
        return jsonify({"error": "Admin account storage is unavailable."}), 503

    if not email or not password or not account:
        return jsonify({"error": "Invalid email or password."}), 401

    clear_admin_login_attempts(ip_key)
    csrf_token = start_admin_session(account)
    return jsonify(
        {
            "authenticated": True,
            "name": account["name"],
            "email": account["email"],
            "csrf_token": csrf_token,
            "setup_required": False,
        }
    )


@admin_bp.post("/admin/auth/logout")
@require_admin_write
def admin_logout():
    session.clear()
    return jsonify({"authenticated": False})


@admin_bp.get("/admin/enquiries")
@require_admin
def export_enquiries():
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
@require_admin_write
def update_admin_enquiry(enquiry_id: str):
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

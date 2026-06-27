from flask import Blueprint, current_app, jsonify, request, session

from ..services.admin_service import (
    AdminStorageError,
    admin_account_exists,
    authenticate_admin_account,
    create_admin_account,
)
from ..services.email_service import send_customer_message
from ..services.enquiry_service import (
    EnquiryStorageError,
    create_quote_version,
    create_quote_approval_link,
    get_enquiry,
    list_enquiries,
    record_communication,
    update_enquiry,
    update_quote_status,
)
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
        return jsonify(
            {
                "authenticated": False,
                "configured": False,
                "storage_available": True,
                "configuration_error": "ADMIN_EMAIL is not set on the server.",
            }
        ), 503

    try:
        setup_required = not admin_account_exists()
    except AdminStorageError:
        current_app.logger.exception("Admin account storage check failed")
        return jsonify(
            {
                "authenticated": False,
                "configured": True,
                "storage_available": False,
                "configuration_error": (
                    "MongoDB admin storage is unavailable. Check the server logs "
                    "and MongoDB environment settings."
                ),
            }
        ), 503

    if setup_required:
        session.clear()
        return jsonify(
            {
                "authenticated": False,
                "configured": True,
                "storage_available": True,
                "setup_required": True,
            }
        )

    if not session.get("admin_authenticated"):
        return jsonify(
            {
                "authenticated": False,
                "configured": True,
                "storage_available": True,
                "setup_required": False,
            }
        )

    return jsonify(
        {
            "configured": True,
            "storage_available": True,
            "setup_required": False,
            **admin_session_payload(),
        }
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
        current_app.logger.exception("Admin account creation failed")
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
        current_app.logger.exception("Admin account authentication failed")
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


@admin_bp.post("/admin/enquiries/<enquiry_id>/quotes")
@require_admin_write
def create_admin_quote(enquiry_id: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    try:
        updated = create_quote_version(
            enquiry_id,
            request.get_json(silent=True) or {},
            session.get("admin_email", ""),
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        current_app.logger.exception("Admin quote creation failed")
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    if not updated:
        return jsonify({"error": "Enquiry not found."}), 404
    return jsonify({"enquiry": updated}), 201


@admin_bp.patch("/admin/enquiries/<enquiry_id>/quotes/<quote_id>")
@require_admin_write
def update_admin_quote(enquiry_id: str, quote_id: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    payload = request.get_json(silent=True) or {}
    try:
        updated = update_quote_status(enquiry_id, quote_id, str(payload.get("status", "")))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        current_app.logger.exception("Admin quote update failed")
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    if not updated:
        return jsonify({"error": "Enquiry not found."}), 404
    return jsonify({"enquiry": updated})


@admin_bp.post("/admin/enquiries/<enquiry_id>/quotes/<quote_id>/share")
@require_admin_write
def share_admin_quote(enquiry_id: str, quote_id: str):
    try:
        token = create_quote_approval_link(enquiry_id, quote_id)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        current_app.logger.exception("Admin quote link creation failed")
        return jsonify({"error": "Enquiry storage is unavailable."}), 503
    if not token:
        return jsonify({"error": "Enquiry not found."}), 404
    url = f"{request.host_url.rstrip('/')}/quote-review#quote={quote_id}&token={token}"
    return jsonify({"url": url})


@admin_bp.post("/admin/enquiries/<enquiry_id>/communications")
@require_admin_write
def send_admin_communication(enquiry_id: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    payload = request.get_json(silent=True) or {}
    subject = str(payload.get("subject", "")).strip()
    message = str(payload.get("message", "")).strip()
    quote_id = str(payload.get("quote_id", "")).strip()

    try:
        enquiry = get_enquiry(enquiry_id)
        if not enquiry:
            return jsonify({"error": "Enquiry not found."}), 404
        send_customer_message(enquiry, subject, message)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503
    except Exception:
        current_app.logger.exception("Admin customer email delivery failed")
        try:
            record_communication(
                enquiry_id,
                subject or "Untitled message",
                message or "Message content unavailable",
                "failed",
                session.get("admin_email", ""),
            )
        except Exception:
            current_app.logger.exception("Failed email could not be recorded")
        return jsonify({"error": "Email delivery failed. The attempt was recorded."}), 502

    try:
        updated = record_communication(
            enquiry_id,
            subject,
            message,
            "sent",
            session.get("admin_email", ""),
        )
        if quote_id:
            updated = update_quote_status(enquiry_id, quote_id, "sent")
    except (ValueError, EnquiryStorageError):
        current_app.logger.exception("Delivered email could not be recorded")
        return jsonify(
            {"error": "Email was sent, but its delivery record could not be saved."}
        ), 500

    return jsonify({"enquiry": updated})

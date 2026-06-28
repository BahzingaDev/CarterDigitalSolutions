from datetime import datetime, timedelta, timezone

from flask import Blueprint, Response, current_app, jsonify, request, session

from ..services.admin_service import (
    AdminStorageError,
    admin_account_exists,
    authenticate_admin_account,
    create_admin_account,
)
from ..services.email_service import send_customer_message, send_project_invoice
from ..services.invoice_service import generate_invoice_pdf
from ..services.customer_service import CustomerStorageError, list_customer_profiles, save_customer_profile
from ..services.workspace_service import (
    WorkspaceStorageError,
    delete_project,
    get_project,
    delete_record,
    delete_template,
    delete_service_override,
    delete_service_category,
    ensure_accepted_quote_project,
    list_projects,
    mark_project_invoice_sent,
    list_records,
    list_templates,
    list_service_overrides,
    list_service_categories,
    save_project,
    save_record,
    save_template,
    save_service_override,
    save_service_category,
    get_communication_settings,
    get_commercial_settings,
    save_communication_settings,
    save_commercial_settings,
)
from ..services.enquiry_service import (
    EnquiryStorageError,
    create_quote_version,
    create_quote_approval_link,
    get_enquiry,
    list_enquiries,
    record_communication,
    update_enquiry,
    update_quote_status,
    update_draft_quote,
    update_deposit_invoice_status,
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


@admin_bp.get("/admin/commercial-settings")
@require_admin
def admin_commercial_settings():
    try:
        return jsonify({"settings": get_commercial_settings()})
    except WorkspaceStorageError:
        return jsonify({"error": "Workspace storage is unavailable."}), 503


@admin_bp.put("/admin/commercial-settings")
@require_admin_write
def update_admin_commercial_settings():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    try:
        return jsonify({"settings": save_commercial_settings(request.get_json(silent=True) or {})})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except WorkspaceStorageError:
        return jsonify({"error": "Workspace storage is unavailable."}), 503


@admin_bp.get("/admin/communication-settings")
@require_admin
def admin_communication_settings():
    try:
        return jsonify({"settings": get_communication_settings()})
    except WorkspaceStorageError:
        return jsonify({"error": "Workspace storage is unavailable."}), 503


@admin_bp.put("/admin/communication-settings")
@require_admin_write
def update_admin_communication_settings():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    try:
        return jsonify({"settings": save_communication_settings(request.get_json(silent=True) or {})})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except WorkspaceStorageError:
        return jsonify({"error": "Workspace storage is unavailable."}), 503


@admin_bp.get("/admin/customers")
@require_admin
def admin_customers():
    try:
        return jsonify({"customers": list_customer_profiles()})
    except CustomerStorageError:
        current_app.logger.exception("Admin customer list failed")
        return jsonify({"error": "Customer storage is unavailable."}), 503


@admin_bp.put("/admin/customers/<path:email>")
@require_admin_write
def update_admin_customer(email: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    payload = request.get_json(silent=True) or {}
    payload["email"] = email
    try:
        return jsonify({"customer": save_customer_profile(payload)})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except CustomerStorageError:
        current_app.logger.exception("Admin customer save failed")
        return jsonify({"error": "Customer storage is unavailable."}), 503


@admin_bp.get("/admin/templates")
@require_admin
def admin_templates():
    return _workspace_list("templates", list_templates)


@admin_bp.post("/admin/templates")
@require_admin_write
def create_admin_template():
    return _workspace_save("template", save_template)


@admin_bp.put("/admin/templates/<item_id>")
@require_admin_write
def update_admin_template(item_id: str):
    return _workspace_save("template", save_template, item_id)


@admin_bp.delete("/admin/templates/<item_id>")
@require_admin_write
def remove_admin_template(item_id: str):
    return _workspace_delete(delete_template, item_id)


@admin_bp.get("/admin/records")
@require_admin
def admin_records():
    return _workspace_list("records", list_records)


@admin_bp.post("/admin/records")
@require_admin_write
def create_admin_record():
    return _workspace_save("record", save_record)


@admin_bp.put("/admin/records/<item_id>")
@require_admin_write
def update_admin_record(item_id: str):
    return _workspace_save("record", save_record, item_id)


@admin_bp.delete("/admin/records/<item_id>")
@require_admin_write
def remove_admin_record(item_id: str):
    return _workspace_delete(delete_record, item_id)


@admin_bp.get("/admin/projects")
@require_admin
def admin_projects():
    return _workspace_list("projects", list_projects)


@admin_bp.post("/admin/projects")
@require_admin_write
def create_admin_project():
    return _workspace_save("project", save_project)


@admin_bp.put("/admin/projects/<item_id>")
@require_admin_write
def update_admin_project(item_id: str):
    return _workspace_save("project", save_project, item_id)


@admin_bp.delete("/admin/projects/<item_id>")
@require_admin_write
def remove_admin_project(item_id: str):
    return _workspace_delete(delete_project, item_id)


@admin_bp.get("/admin/projects/<project_id>/invoices/<invoice_id>/pdf")
@require_admin
def download_admin_project_invoice(project_id: str, invoice_id: str):
    try:
        project = get_project(project_id)
        settings = get_commercial_settings()
    except WorkspaceStorageError:
        return jsonify({"error": "Workspace storage is unavailable."}), 503
    if not project:
        return jsonify({"error": "Project not found."}), 404
    invoice = next((item for item in project.get("invoices", []) if item.get("id") == invoice_id), None)
    if not invoice:
        return jsonify({"error": "Invoice not found."}), 404
    pdf = generate_invoice_pdf(project, invoice, settings)
    safe_reference = "".join(character if character.isalnum() or character in {"-", "_"} else "-" for character in invoice["reference"]).strip("-")[:80] or "invoice"
    filename = f"invoice-{safe_reference}.pdf"
    return Response(pdf, mimetype="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@admin_bp.post("/admin/projects/<project_id>/invoices/<invoice_id>/send")
@require_admin_write
def send_admin_project_invoice(project_id: str, invoice_id: str):
    try:
        project = get_project(project_id)
        settings = get_commercial_settings()
        if not project:
            return jsonify({"error": "Project not found."}), 404
        invoice = next((item for item in project.get("invoices", []) if item.get("id") == invoice_id), None)
        if not invoice:
            return jsonify({"error": "Invoice not found."}), 404
        if invoice.get("status") == "void":
            return jsonify({"error": "A void invoice cannot be sent."}), 400
        issue_date = datetime.now(timezone.utc).date()
        due_date = invoice.get("due_date") or (issue_date + timedelta(days=settings["invoice_due_days"])).isoformat()
        invoice = {**invoice, "issue_date": issue_date.isoformat(), "due_date": due_date}
        pdf = generate_invoice_pdf(project, invoice, settings)
        provider_message_id = send_project_invoice(project, invoice, pdf, settings)
        updated = mark_project_invoice_sent(project_id, invoice_id, provider_message_id, due_date, invoice.get("status", "draft"))
        if invoice.get("kind") == "deposit" and project.get("linked_enquiry_id") and project.get("source_quote_id"):
            try:
                update_deposit_invoice_status(
                    project["linked_enquiry_id"],
                    project["source_quote_id"],
                    "sent",
                    invoice["reference"],
                )
            except Exception:
                current_app.logger.exception("Sent deposit invoice could not be synced to its source quote")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except (WorkspaceStorageError, RuntimeError):
        current_app.logger.exception("Project invoice delivery failed")
        return jsonify({"error": "Invoice delivery is unavailable."}), 503
    return jsonify({"project": updated})


@admin_bp.get("/admin/services")
@require_admin
def admin_services():
    return _workspace_list("services", list_service_overrides)


@admin_bp.post("/admin/services")
@require_admin_write
def create_admin_service():
    return _workspace_save("service", save_service_override)


@admin_bp.put("/admin/services/<item_id>")
@require_admin_write
def update_admin_service(item_id: str):
    return _workspace_save("service", save_service_override, item_id)


@admin_bp.delete("/admin/services/<item_id>")
@require_admin_write
def remove_admin_service(item_id: str):
    return _workspace_delete(delete_service_override, item_id)


@admin_bp.get("/admin/service-categories")
@require_admin
def admin_service_categories():
    return _workspace_list("categories", list_service_categories)


@admin_bp.post("/admin/service-categories")
@require_admin_write
def create_admin_service_category():
    return _workspace_save("category", save_service_category)


@admin_bp.put("/admin/service-categories/<item_id>")
@require_admin_write
def update_admin_service_category(item_id: str):
    return _workspace_save("category", save_service_category, item_id)


@admin_bp.delete("/admin/service-categories/<item_id>")
@require_admin_write
def remove_admin_service_category(item_id: str):
    return _workspace_delete(delete_service_category, item_id)


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
    status = str(payload.get("status", "")).strip().lower()
    automation_warning = ""
    try:
        updated = update_quote_status(enquiry_id, quote_id, status)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        current_app.logger.exception("Admin quote update failed")
        return jsonify({"error": "Enquiry storage is unavailable."}), 503

    if not updated:
        return jsonify({"error": "Enquiry not found."}), 404
    if status == "accepted":
        try:
            ensure_accepted_quote_project(enquiry_id, quote_id)
            updated = get_enquiry(enquiry_id) or updated
        except (ValueError, WorkspaceStorageError):
            current_app.logger.exception("Accepted quote project automation failed")
            automation_warning = "The quote was accepted, but its project and deposit invoice need to be created manually."
    response = {"enquiry": updated}
    if automation_warning:
        response["automation_warning"] = automation_warning
    return jsonify(response)


@admin_bp.put("/admin/enquiries/<enquiry_id>/quotes/<quote_id>")
@require_admin_write
def edit_admin_quote(enquiry_id: str, quote_id: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    try:
        updated = update_draft_quote(enquiry_id, quote_id, request.get_json(silent=True) or {})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        return jsonify({"error": "Enquiry storage is unavailable."}), 503
    if not updated:
        return jsonify({"error": "Enquiry not found."}), 404
    return jsonify({"enquiry": updated})


@admin_bp.patch("/admin/enquiries/<enquiry_id>/quotes/<quote_id>/deposit-invoice")
@require_admin_write
def update_admin_deposit_invoice(enquiry_id: str, quote_id: str):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    payload = request.get_json(silent=True) or {}
    try:
        updated = update_deposit_invoice_status(
            enquiry_id,
            quote_id,
            str(payload.get("status", "")),
            str(payload.get("reference", "")),
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except EnquiryStorageError:
        current_app.logger.exception("Deposit invoice update failed")
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
    scheduled_at = str(payload.get("scheduled_at", "")).strip()

    try:
        enquiry = get_enquiry(enquiry_id)
        if not enquiry:
            return jsonify({"error": "Enquiry not found."}), 404
        provider_message_id = send_customer_message(enquiry, subject, message, scheduled_at)
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
            "scheduled" if scheduled_at else "sent",
            session.get("admin_email", ""),
            provider_message_id,
            scheduled_at,
        )
        if quote_id:
            updated = update_quote_status(enquiry_id, quote_id, "sent")
    except (ValueError, EnquiryStorageError):
        current_app.logger.exception("Delivered email could not be recorded")
        return jsonify(
            {"error": "Email was sent, but its delivery record could not be saved."}
        ), 500

    return jsonify({"enquiry": updated})


def _workspace_list(key: str, loader):
    try:
        return jsonify({key: loader()})
    except WorkspaceStorageError as error:
        current_app.logger.exception("Admin workspace list failed: resource=%s reason=%s", error.resource, error.reason)
        return jsonify({"error": f"{key.replace('-', ' ').title()} storage is unavailable ({error.reason}).", "reason": error.reason, "resource": error.resource}), 503


def _workspace_save(key: str, saver, item_id: str | None = None):
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415
    try:
        item = saver(request.get_json(silent=True) or {}, item_id)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except WorkspaceStorageError as error:
        current_app.logger.exception("Admin workspace save failed: resource=%s reason=%s", error.resource, error.reason)
        return jsonify({"error": f"{key.replace('-', ' ').title()} storage is unavailable ({error.reason}).", "reason": error.reason, "resource": error.resource}), 503
    return jsonify({key: item}), 201 if item_id is None else 200


def _workspace_delete(deleter, item_id: str):
    try:
        deleted = deleter(item_id)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except WorkspaceStorageError as error:
        current_app.logger.exception("Admin workspace delete failed: resource=%s reason=%s", error.resource, error.reason)
        return jsonify({"error": f"Workspace storage is unavailable ({error.reason}).", "reason": error.reason, "resource": error.resource}), 503
    if not deleted:
        return jsonify({"error": "Record not found."}), 404
    return "", 204

import uuid
import re
from datetime import datetime, timezone
from typing import Any

from flask import current_app


class WorkspaceStorageError(RuntimeError):
    pass


PROJECT_STAGES = {"lead", "discovery", "quoted", "accepted", "active", "on_hold", "completed"}
MEETING_STATUSES = {"scheduled", "completed", "cancelled"}
INVOICE_STATUSES = {"draft", "sent", "paid", "overdue", "void"}
INVOICE_KINDS = {"deposit", "interim", "final", "consultation", "other"}
_client = None


def list_templates() -> list[dict[str, Any]]:
    return _list("MONGODB_TEMPLATE_COLLECTION", {"name": 1})


def save_template(payload: dict[str, Any], template_id: str | None = None) -> dict[str, Any]:
    document = {
        "name": _text(payload.get("name"), "Template name", 80),
        "subject": _text(payload.get("subject"), "Subject", 180),
        "body": _text(payload.get("body"), "Message", 5000),
    }
    return _save("MONGODB_TEMPLATE_COLLECTION", document, template_id)


def delete_template(template_id: str) -> bool:
    return _delete("MONGODB_TEMPLATE_COLLECTION", template_id)


def list_records() -> list[dict[str, Any]]:
    return _list("MONGODB_RECORD_COLLECTION", {"updated_at": -1})


def save_record(payload: dict[str, Any], record_id: str | None = None) -> dict[str, Any]:
    fields = payload.get("fields", [])
    if not isinstance(fields, list) or len(fields) > 30:
        raise ValueError("Custom fields must be a list containing no more than 30 entries.")
    clean_fields = []
    for field in fields:
        if not isinstance(field, dict):
            raise ValueError("Each custom field must be an object.")
        key = _text(field.get("key"), "Field name", 80)
        value = _optional_text(field.get("value"), 1000)
        clean_fields.append({"key": key, "value": value})

    document = {
        "title": _text(payload.get("title"), "Record title", 120),
        "record_type": _text(payload.get("record_type"), "Record type", 60),
        "tags": _tags(payload.get("tags", [])),
        "notes": _optional_text(payload.get("notes"), 5000),
        "fields": clean_fields,
        "archived": bool(payload.get("archived", False)),
    }
    return _save("MONGODB_RECORD_COLLECTION", document, record_id)


def delete_record(record_id: str) -> bool:
    return _delete("MONGODB_RECORD_COLLECTION", record_id)


def list_projects() -> list[dict[str, Any]]:
    return _list("MONGODB_PROJECT_COLLECTION", {"updated_at": -1})


def get_project(project_id: str) -> dict[str, Any] | None:
    try:
        project = _collection("MONGODB_PROJECT_COLLECTION").find_one({"id": project_id}, {"_id": 0})
        return _serialise(project) if project else None
    except Exception as error:
        raise WorkspaceStorageError("Unable to load project.") from error


def save_project(payload: dict[str, Any], project_id: str | None = None) -> dict[str, Any]:
    stage = str(payload.get("stage", "lead")).strip().lower()
    if stage not in PROJECT_STAGES:
        raise ValueError("Invalid project stage.")
    value = _number(payload.get("value", 0), "Project value", 1_000_000)
    tasks = _project_items(payload.get("tasks", []), "task")
    milestones = _project_items(payload.get("milestones", []), "milestone")
    services = _project_services(payload.get("services", []))
    meetings = _project_meetings(payload.get("meetings", []))
    invoices = _project_invoices(payload.get("invoices", []))
    if stage == "accepted" and any(invoice["kind"] == "deposit" and invoice["status"] == "paid" for invoice in invoices):
        stage = "active"
    completion = round(
        (sum(1 for item in tasks if item["completed"]) / len(tasks) * 100)
        if tasks else _number(payload.get("completion", 0), "Completion", 100)
    )
    source_quote_id = _optional_text(payload.get("source_quote_id"), 80)
    if not project_id and source_quote_id:
        try:
            if _collection("MONGODB_PROJECT_COLLECTION").find_one({"source_quote_id": source_quote_id}, {"_id": 1}):
                raise ValueError("This quote has already been converted to a project.")
        except ValueError:
            raise
        except Exception as error:
            raise WorkspaceStorageError("Unable to check quote conversion.") from error
    document = {
        "name": _text(payload.get("name"), "Project name", 140),
        "client_name": _optional_text(payload.get("client_name"), 120),
        "client_email": _optional_text(payload.get("client_email"), 254),
        "stage": stage,
        "value": value,
        "due_date": _optional_text(payload.get("due_date"), 40),
        "notes": _optional_text(payload.get("notes"), 5000),
        "tags": _tags(payload.get("tags", [])),
        "linked_enquiry_id": _optional_text(payload.get("linked_enquiry_id"), 80),
        "source_quote_id": source_quote_id,
        "services": services,
        "included_consultation_hours": _number(
            payload.get("included_consultation_hours", 8),
            "Included consultation hours",
            1000,
        ),
        "consultation_rate": _number(
            payload.get("consultation_rate", 16.5),
            "Consultation rate",
            1000,
        ),
        "meetings": meetings,
        "invoices": invoices,
        "tasks": tasks,
        "milestones": milestones,
        "completion": completion,
    }
    saved = _save("MONGODB_PROJECT_COLLECTION", document, project_id)
    if not project_id and source_quote_id and document["linked_enquiry_id"]:
        try:
            now = datetime.now(timezone.utc)
            link_result = _collection("MONGODB_ENQUIRY_COLLECTION").update_one(
                {"id": document["linked_enquiry_id"], "quote_versions.id": source_quote_id},
                {
                    "$set": {
                        "quote_versions.$.converted_project_id": saved["id"],
                        "quote_versions.$.converted_at": now,
                        "status": "closed",
                        "status_updated_at": now,
                    },
                    "$push": {"activity": {"id": str(uuid.uuid4()), "type": "project", "description": f"Quote converted to project {saved['name']}", "created_at": now}},
                },
            )
            if not link_result.matched_count:
                raise ValueError("The source quote could not be linked.")
        except Exception as error:
            try:
                _collection("MONGODB_PROJECT_COLLECTION").delete_one({"id": saved["id"]})
            except Exception:
                pass
            raise WorkspaceStorageError("Unable to link the converted project to its quote.") from error
    return saved


def delete_project(project_id: str) -> bool:
    return _delete("MONGODB_PROJECT_COLLECTION", project_id)


def mark_project_invoice_sent(project_id: str, invoice_id: str, provider_message_id: str | None, due_date: str, current_status: str) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    try:
        result = _collection("MONGODB_PROJECT_COLLECTION").update_one(
            {"id": project_id, "invoices.id": invoice_id},
            {"$set": {
                "invoices.$.status": "paid" if current_status == "paid" else "sent",
                "invoices.$.issue_date": now.date().isoformat(),
                "invoices.$.due_date": due_date,
                "invoices.$.sent_at": now,
                "invoices.$.provider_message_id": provider_message_id or "",
                "updated_at": now,
            }},
        )
    except Exception as error:
        raise WorkspaceStorageError("Unable to update invoice delivery status.") from error
    return get_project(project_id) if result.matched_count else None


def list_service_overrides(published_only: bool = False) -> list[dict[str, Any]]:
    services = _list("MONGODB_SERVICE_COLLECTION", {"sort_order": 1, "name": 1})
    return [
        service for service in services
        if service.get("status", "published") == "published" and service.get("active", True)
    ] if published_only else services


def list_service_categories(published_only: bool = False) -> list[dict[str, Any]]:
    categories = _list("MONGODB_SERVICE_CATEGORY_COLLECTION", {"sort_order": 1, "name": 1})
    if not published_only:
        return categories
    return [
        category for category in categories
        if category.get("status", "published") == "published" and category.get("active", True)
    ]


def save_service_category(payload: dict[str, Any], category_id: str | None = None) -> dict[str, Any]:
    status = str(payload.get("status", "draft")).strip().lower()
    if status not in {"draft", "published"}:
        raise ValueError("Category status must be draft or published.")
    slug = _slug(payload.get("slug") or payload.get("name"), "Category slug")
    _ensure_unique_slug("MONGODB_SERVICE_CATEGORY_COLLECTION", slug, category_id)
    document = {
        "slug": slug,
        "name": _text(payload.get("name"), "Category name", 80),
        "audience": _audience(payload.get("audience")),
        "description": _optional_text(payload.get("description"), 500),
        "sort_order": int(_number(payload.get("sort_order", 0), "Sort order", 10000)),
        "status": status,
        "active": bool(payload.get("active", True)),
    }
    return _save("MONGODB_SERVICE_CATEGORY_COLLECTION", document, category_id)


def delete_service_category(category_id: str) -> bool:
    try:
        if _collection("MONGODB_SERVICE_COLLECTION").find_one({"category_id": category_id}, {"_id": 1}):
            raise ValueError("Move or archive services in this category before deleting it.")
    except ValueError:
        raise
    except Exception as error:
        raise WorkspaceStorageError("Unable to check category usage.") from error
    return _delete("MONGODB_SERVICE_CATEGORY_COLLECTION", category_id)


def save_service_override(payload: dict[str, Any], service_id: str | None = None) -> dict[str, Any]:
    status = str(payload.get("status", "draft")).strip().lower()
    if status not in {"draft", "published"}:
        raise ValueError("Service status must be draft or published.")
    slug = _slug(payload.get("slug") or payload.get("name"), "Service slug")
    _ensure_unique_slug("MONGODB_SERVICE_COLLECTION", slug, service_id)
    category_id = _optional_text(payload.get("category_id"), 80)
    category_name = _text(payload.get("category"), "Category", 80)
    audience = _audience(payload.get("audience"))
    if category_id:
        try:
            category = _collection("MONGODB_SERVICE_CATEGORY_COLLECTION").find_one(
                {"id": category_id},
                {"_id": 0, "name": 1, "audience": 1},
            )
        except Exception as error:
            raise WorkspaceStorageError("Unable to validate the service category.") from error
        if not category:
            raise ValueError("The selected service category no longer exists.")
        category_name = category["name"]
        audience = category["audience"]
    document = {
        "slug": slug,
        "name": _text(payload.get("name"), "Service name", 120),
        "audience": audience,
        "category_id": category_id,
        "category": category_name,
        "description": _optional_text(payload.get("description"), 500),
        "best_for": _optional_text(payload.get("best_for"), 500),
        "starting_from": _number(payload.get("starting_from", 0), "Starting price", 1_000_000),
        "hourly_rate": _number(payload.get("hourly_rate", 0), "Hourly rate", 1000),
        "estimated_hours": _number(payload.get("estimated_hours", 0), "Estimated hours", 1000),
        "deposit": _optional_text(payload.get("deposit"), 80),
        "deposit_amount": _number(payload.get("deposit_amount", 0), "Deposit amount", 1_000_000),
        "active": bool(payload.get("active", True)),
        "sort_order": int(_number(payload.get("sort_order", 0), "Sort order", 10000)),
        "status": status,
        "outcomes": _string_list(payload.get("outcomes", []), "outcomes"),
        "process_notes": _string_list(payload.get("process_notes", []), "process notes"),
    }
    return _save("MONGODB_SERVICE_COLLECTION", document, service_id)


def delete_service_override(service_id: str) -> bool:
    return _delete("MONGODB_SERVICE_COLLECTION", service_id)


def get_communication_settings() -> dict[str, Any]:
    try:
        record = _collection("MONGODB_SETTINGS_COLLECTION").find_one({"id": "communications"}, {"_id": 0})
        return _serialise(record or {"id": "communications", "signature": ""})
    except Exception as error:
        raise WorkspaceStorageError("Unable to load communication settings.") from error


def save_communication_settings(payload: dict[str, Any]) -> dict[str, Any]:
    signature = _optional_text(payload.get("signature"), 2000)
    now = datetime.now(timezone.utc)
    try:
        collection = _collection("MONGODB_SETTINGS_COLLECTION")
        collection.update_one({"id": "communications"}, {"$set": {"id": "communications", "signature": signature, "updated_at": now}}, upsert=True)
        return _serialise(collection.find_one({"id": "communications"}, {"_id": 0}))
    except Exception as error:
        raise WorkspaceStorageError("Unable to save communication settings.") from error


def get_commercial_settings() -> dict[str, Any]:
    defaults = {
        "id": "commercial",
        "tax_rate": 0,
        "invoice_business_name": "Carter Digital Solutions",
        "invoice_address": "",
        "payment_details": "",
        "invoice_due_days": 14,
        "invoice_email_subject": "Invoice {{invoice_reference}} from Carter Digital Solutions",
        "invoice_email_message": "Please find invoice {{invoice_reference}} attached as a PDF.",
    }
    try:
        record = _collection("MONGODB_SETTINGS_COLLECTION").find_one({"id": "commercial"}, {"_id": 0})
        return _serialise({**defaults, **(record or {})})
    except Exception as error:
        raise WorkspaceStorageError("Unable to load commercial settings.") from error


def save_commercial_settings(payload: dict[str, Any]) -> dict[str, Any]:
    document = {
        "id": "commercial",
        "tax_rate": _number(payload.get("tax_rate", 0), "Tax rate", 100),
        "invoice_business_name": _text(payload.get("invoice_business_name"), "Business name", 160),
        "invoice_address": _optional_text(payload.get("invoice_address"), 1000),
        "payment_details": _optional_text(payload.get("payment_details"), 2000),
        "invoice_due_days": int(_number(payload.get("invoice_due_days", 14), "Invoice due days", 365)),
        "invoice_email_subject": _text(payload.get("invoice_email_subject"), "Invoice email subject", 180),
        "invoice_email_message": _text(payload.get("invoice_email_message"), "Invoice email message", 5000),
        "updated_at": datetime.now(timezone.utc),
    }
    try:
        collection = _collection("MONGODB_SETTINGS_COLLECTION")
        collection.update_one({"id": "commercial"}, {"$set": document}, upsert=True)
        return _serialise(collection.find_one({"id": "commercial"}, {"_id": 0}))
    except Exception as error:
        raise WorkspaceStorageError("Unable to save commercial settings.") from error


def _save(config_key: str, document: dict[str, Any], item_id: str | None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    try:
        collection = _collection(config_key)
        if item_id:
            document["updated_at"] = now
            result = collection.update_one({"id": item_id}, {"$set": document})
            if not result.matched_count:
                raise ValueError("Record not found.")
        else:
            item_id = str(uuid.uuid4())
            document = {"id": item_id, "created_at": now, "updated_at": now, **document}
            collection.insert_one(document)
        saved = collection.find_one({"id": item_id}, {"_id": 0})
    except ValueError:
        raise
    except Exception as error:
        raise WorkspaceStorageError("Unable to save workspace record.") from error
    if not saved:
        raise WorkspaceStorageError("Saved workspace record could not be loaded.")
    return _serialise(saved)


def _list(config_key: str, sort: dict[str, int]) -> list[dict[str, Any]]:
    try:
        cursor = _collection(config_key).find({}, {"_id": 0})
        for field, direction in sort.items():
            cursor = cursor.sort(field, direction)
        return [_serialise(item) for item in cursor.limit(500)]
    except Exception as error:
        raise WorkspaceStorageError("Unable to load workspace records.") from error


def _delete(config_key: str, item_id: str) -> bool:
    try:
        return bool(_collection(config_key).delete_one({"id": item_id}).deleted_count)
    except Exception as error:
        raise WorkspaceStorageError("Unable to delete workspace record.") from error


def _collection(config_key: str):
    global _client
    if _client is None:
        from pymongo import MongoClient
        _client = MongoClient(current_app.config["MONGODB_URI"], serverSelectionTimeoutMS=current_app.config["MONGODB_SERVER_SELECTION_TIMEOUT_MS"])
    database = _client[current_app.config["MONGODB_DATABASE"]]
    return database[current_app.config[config_key]]


def _text(value: Any, label: str, maximum: int) -> str:
    cleaned = str(value or "").strip()
    if not cleaned or len(cleaned) > maximum:
        raise ValueError(f"{label} must contain between 1 and {maximum} characters.")
    return cleaned


def _optional_text(value: Any, maximum: int) -> str:
    cleaned = str(value or "").strip()
    if len(cleaned) > maximum:
        raise ValueError("A text field is too long.")
    return cleaned


def _tags(value: Any) -> list[str]:
    if not isinstance(value, list) or len(value) > 12:
        raise ValueError("Tags must be a list containing no more than 12 entries.")
    return [tag for tag in dict.fromkeys(str(item).strip() for item in value) if tag and len(tag) <= 30]


def _number(value: Any, label: str, maximum: float) -> float:
    try:
        number = round(float(value or 0), 2)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must be a number.") from error
    if number < 0 or number > maximum:
        raise ValueError(f"{label} is outside the permitted range.")
    return number


def _slug(value: Any, label: str) -> str:
    cleaned = str(value or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", cleaned).strip("-")
    if not cleaned or len(cleaned) > 120:
        raise ValueError(f"{label} must contain between 1 and 120 URL-safe characters.")
    return cleaned


def _audience(value: Any) -> str:
    audience = _text(value, "Audience", 40)
    if audience not in {"For Industry", "For Individuals", "Working With You"}:
        raise ValueError("Audience is not recognised.")
    return audience


def _ensure_unique_slug(config_key: str, slug: str, item_id: str | None) -> None:
    query: dict[str, Any] = {"slug": slug}
    if item_id:
        query["id"] = {"$ne": item_id}
    try:
        if _collection(config_key).find_one(query, {"_id": 1}):
            raise ValueError("That slug is already in use.")
    except ValueError:
        raise
    except Exception as error:
        raise WorkspaceStorageError("Unable to validate the catalogue slug.") from error


def _project_items(value: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError(f"Project {label}s must be a list containing no more than 100 entries.")
    items = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError(f"Each project {label} must be an object.")
        title = _text(item.get("title"), f"{label.title()} title", 160)
        items.append({
            "id": str(item.get("id") or uuid.uuid4()),
            "title": title,
            "completed": bool(item.get("completed", False)),
            "due_date": _optional_text(item.get("due_date"), 40),
        })
    return items


def _project_services(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 50:
        raise ValueError("Project services must contain no more than 50 entries.")
    services = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each project service must be an object.")
        services.append({
            "service": _text(item.get("service"), "Service name", 120),
            "category": _optional_text(item.get("category"), 120),
            "hours": _number(item.get("hours", 0), "Service hours", 1000),
            "rate": _number(item.get("rate", 0), "Service rate", 1000),
            "optional": bool(item.get("optional", False)),
            "included": bool(item.get("included", True)),
        })
    return services


def _project_meetings(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 200:
        raise ValueError("Project meetings must contain no more than 200 entries.")
    meetings = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each meeting must be an object.")
        status = str(item.get("status", "scheduled")).strip().lower()
        if status not in MEETING_STATUSES:
            raise ValueError("Invalid meeting status.")
        duration = int(_number(item.get("duration_minutes", 60), "Meeting duration", 480))
        if duration < 15:
            raise ValueError("Meeting duration must be at least 15 minutes.")
        meetings.append({
            "id": str(item.get("id") or uuid.uuid4()),
            "title": _text(item.get("title"), "Meeting title", 160),
            "start_at": _text(item.get("start_at"), "Meeting date", 50),
            "duration_minutes": duration,
            "status": status,
            "counts_as_consultation": bool(item.get("counts_as_consultation", True)),
            "location": _optional_text(item.get("location"), 240),
            "notes": _optional_text(item.get("notes"), 2000),
            "calendar_provider": _optional_text(item.get("calendar_provider"), 40),
            "external_calendar_id": _optional_text(item.get("external_calendar_id"), 200),
        })
    return meetings


def _project_invoices(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 200:
        raise ValueError("Project invoices must contain no more than 200 entries.")
    invoices = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each invoice must be an object.")
        status = str(item.get("status", "draft")).strip().lower()
        kind = str(item.get("kind", "other")).strip().lower()
        if status not in INVOICE_STATUSES or kind not in INVOICE_KINDS:
            raise ValueError("Invalid invoice status or type.")
        subtotal = _number(item.get("subtotal", item.get("amount", 0)), "Invoice subtotal", 1_000_000)
        tax_rate = _number(item.get("tax_rate", 0), "Invoice tax rate", 100)
        tax_amount = round(subtotal * tax_rate / 100, 2)
        invoices.append({
            "id": str(item.get("id") or uuid.uuid4()),
            "reference": _text(item.get("reference"), "Invoice reference", 80),
            "kind": kind,
            "status": status,
            "subtotal": subtotal,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "amount": round(subtotal + tax_amount, 2),
            "issue_date": _optional_text(item.get("issue_date"), 40),
            "due_date": _optional_text(item.get("due_date"), 40),
            "paid_date": _optional_text(item.get("paid_date"), 40),
            "notes": _optional_text(item.get("notes"), 2000),
            "consultation_hours": _number(item.get("consultation_hours", 0), "Invoiced consultation hours", 1000),
        })
    return invoices


def _string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or len(value) > 20:
        raise ValueError(f"Service {label} must contain no more than 20 entries.")
    return [_text(item, f"Service {label}", 240) for item in value]


def _serialise(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialise(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialise(item) for item in value]
    return value

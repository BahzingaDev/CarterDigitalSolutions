import uuid
from datetime import datetime, timezone
from typing import Any

from flask import current_app


class WorkspaceStorageError(RuntimeError):
    pass


PROJECT_STAGES = {"lead", "discovery", "quoted", "accepted", "active", "on_hold", "completed"}
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


def save_project(payload: dict[str, Any], project_id: str | None = None) -> dict[str, Any]:
    stage = str(payload.get("stage", "lead")).strip().lower()
    if stage not in PROJECT_STAGES:
        raise ValueError("Invalid project stage.")
    value = _number(payload.get("value", 0), "Project value", 1_000_000)
    tasks = _project_items(payload.get("tasks", []), "task")
    milestones = _project_items(payload.get("milestones", []), "milestone")
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
        "tasks": tasks,
        "milestones": milestones,
        "completion": completion,
    }
    return _save("MONGODB_PROJECT_COLLECTION", document, project_id)


def delete_project(project_id: str) -> bool:
    return _delete("MONGODB_PROJECT_COLLECTION", project_id)


def list_service_overrides(published_only: bool = False) -> list[dict[str, Any]]:
    services = _list("MONGODB_SERVICE_COLLECTION", {"sort_order": 1, "name": 1})
    return [service for service in services if service.get("status", "published") == "published"] if published_only else services


def save_service_override(payload: dict[str, Any], service_id: str | None = None) -> dict[str, Any]:
    status = str(payload.get("status", "draft")).strip().lower()
    if status not in {"draft", "published"}:
        raise ValueError("Service status must be draft or published.")
    document = {
        "slug": _text(payload.get("slug"), "Service slug", 120).lower(),
        "name": _text(payload.get("name"), "Service name", 120),
        "audience": _text(payload.get("audience"), "Audience", 40),
        "category": _text(payload.get("category"), "Category", 80),
        "description": _optional_text(payload.get("description"), 500),
        "best_for": _optional_text(payload.get("best_for"), 500),
        "starting_from": _number(payload.get("starting_from", 0), "Starting price", 1_000_000),
        "hourly_rate": _number(payload.get("hourly_rate", 0), "Hourly rate", 1000),
        "estimated_hours": _number(payload.get("estimated_hours", 0), "Estimated hours", 1000),
        "deposit": _optional_text(payload.get("deposit"), 80),
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

import uuid
from datetime import datetime, timezone
from typing import Any

from flask import current_app


class EnquiryStorageError(RuntimeError):
    def __init__(self, message: str, reason: str = "unavailable") -> None:
        super().__init__(message)
        self.reason = reason


_client = None
_indexes_ready = False


def _get_collection():
    global _client

    mongodb_uri = current_app.config.get("MONGODB_URI")
    if not mongodb_uri:
        raise EnquiryStorageError(
            "Enquiry storage is not configured.",
            reason="unconfigured",
        )

    if _client is None:
        try:
            from pymongo import MongoClient
        except ImportError as error:
            raise EnquiryStorageError(
                "MongoDB support is not installed.",
                reason="dependency_missing",
            ) from error

        _client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=current_app.config[
                "MONGODB_SERVER_SELECTION_TIMEOUT_MS"
            ],
        )

    database = _client[current_app.config["MONGODB_DATABASE"]]
    return database[current_app.config["MONGODB_ENQUIRY_COLLECTION"]]


def _ensure_indexes(collection) -> None:
    global _indexes_ready

    if _indexes_ready:
        return

    collection.create_index("created_at")
    collection.create_index("email")
    collection.create_index("type")
    collection.create_index("priority")
    collection.create_index("status")
    _indexes_ready = True


def check_enquiry_storage() -> None:
    try:
        collection = _get_collection()
        collection.database.client.admin.command("ping")
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("MongoDB is unreachable.", reason="unreachable") from error


def save_enquiry(enquiry: dict[str, Any]) -> dict[str, str]:
    enquiry_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)
    record = {
        "id": enquiry_id,
        "created_at": created_at,
        "priority": classify_enquiry_priority(enquiry),
        "status": "new",
        "admin_notes": "",
        "status_updated_at": created_at,
        **enquiry,
    }

    try:
        collection = _get_collection()
        _ensure_indexes(collection)
        collection.insert_one(record)
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to save enquiry.", reason="write_failed") from error

    return {"id": enquiry_id, "created_at": created_at.isoformat()}


def list_enquiries(limit: int | None = None) -> list[dict[str, Any]]:
    collection = _get_collection()
    export_limit = min(limit or current_app.config["ADMIN_EXPORT_LIMIT"], 500)
    records = collection.find({}, {"_id": 0}).sort("created_at", -1).limit(export_limit)
    return [_serialise_record(record) for record in records]


def update_enquiry(enquiry_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    allowed_statuses = {"new", "reviewed", "replied", "closed"}
    update_document: dict[str, Any] = {}

    if "status" in updates:
        status = str(updates["status"]).strip().lower()
        if status not in allowed_statuses:
            raise ValueError("Invalid enquiry status.")
        update_document["status"] = status
        update_document["status_updated_at"] = datetime.now(timezone.utc)

    if "admin_notes" in updates:
        notes = str(updates["admin_notes"]).strip()
        if len(notes) > 4000:
            raise ValueError("Admin notes are too long.")
        update_document["admin_notes"] = notes

    if not update_document:
        raise ValueError("No valid updates supplied.")

    collection = _get_collection()
    collection.update_one({"id": enquiry_id}, {"$set": update_document})
    record = collection.find_one({"id": enquiry_id}, {"_id": 0})
    return _serialise_record(record) if record else None


def classify_enquiry_priority(enquiry: dict[str, Any]) -> str:
    if enquiry.get("type") == "quote":
        estimated_cost = float(enquiry.get("estimated_cost") or 0)
        estimated_hours = float(enquiry.get("estimated_hours") or 0)
        if estimated_cost >= 750 or estimated_hours >= 30:
            return "high"
        return "medium"

    project_type = (enquiry.get("project_type") or "").lower()
    if any(keyword in project_type for keyword in ("maintenance", "fixes", "support")):
        return "high"

    if any(keyword in project_type for keyword in ("app", "cloud", "software", "automation")):
        return "medium"

    return "standard"


def _serialise_record(record: dict[str, Any]) -> dict[str, Any]:
    serialised = dict(record)
    for field in ("created_at", "status_updated_at"):
        value = serialised.get(field)
        if isinstance(value, datetime):
            serialised[field] = value.isoformat()

    serialised.setdefault("status", "new")
    serialised.setdefault("admin_notes", "")

    return serialised

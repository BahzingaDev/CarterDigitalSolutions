from datetime import datetime, timezone
from typing import Any

from flask import current_app


class CustomerStorageError(RuntimeError):
    pass


_client = None


def list_customer_profiles() -> list[dict[str, Any]]:
    try:
        database = _database()
        profiles: dict[str, dict[str, Any]] = {}
        for customer in database[current_app.config["MONGODB_CUSTOMER_COLLECTION"]].find({}, {"_id": 0}):
            profiles[customer["email"]] = _serialise(customer)

        enquiry_fields = {
            "_id": 0, "id": 1, "created_at": 1, "status": 1, "priority": 1, "type": 1,
            "name": 1, "email": 1, "project_type": 1, "message": 1, "quote_items": 1,
            "estimated_hours": 1, "estimated_cost": 1, "admin_notes": 1, "labels": 1,
            "follow_up_at": 1, "archived": 1, "quote_versions": 1, "communications": 1,
            "activity": 1,
        }
        for enquiry in database[current_app.config["MONGODB_ENQUIRY_COLLECTION"]].find({}, enquiry_fields):
            email = str(enquiry.get("email", "")).strip().lower()
            if not email:
                continue
            profile = profiles.setdefault(email, _base_profile(email, enquiry.get("name", "")))
            profile.setdefault("name", enquiry.get("name", ""))
            profile.setdefault("enquiries", []).append(_serialise(enquiry))

        for project in database[current_app.config["MONGODB_PROJECT_COLLECTION"]].find({}, {"_id": 0}):
            email = str(project.get("client_email", "")).strip().lower()
            if not email:
                continue
            profile = profiles.setdefault(email, _base_profile(email, project.get("client_name", "")))
            profile.setdefault("projects", []).append(_serialise(project))

        for profile in profiles.values():
            profile.setdefault("enquiries", [])
            profile.setdefault("projects", [])
            profile.setdefault("phone", "")
            profile.setdefault("organisation", "")
            profile.setdefault("notes", "")
            profile.setdefault("tags", [])
        return sorted(profiles.values(), key=lambda item: item.get("name", item["email"]).lower())
    except Exception as error:
        raise CustomerStorageError("Unable to load customer profiles.") from error


def save_customer_profile(payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload.get("email", "")).strip().lower()
    if not email or "@" not in email or len(email) > 254:
        raise ValueError("A valid customer email is required.")
    tags = payload.get("tags", [])
    if not isinstance(tags, list) or len(tags) > 12:
        raise ValueError("Tags must contain no more than 12 entries.")
    now = datetime.now(timezone.utc)
    document = {
        "email": email,
        "name": _text(payload.get("name"), 120),
        "phone": _text(payload.get("phone"), 60),
        "organisation": _text(payload.get("organisation"), 160),
        "notes": _text(payload.get("notes"), 5000),
        "tags": [str(tag).strip()[:30] for tag in tags if str(tag).strip()],
        "updated_at": now,
    }
    try:
        collection = _database()[current_app.config["MONGODB_CUSTOMER_COLLECTION"]]
        collection.update_one({"email": email}, {"$set": document, "$setOnInsert": {"created_at": now}}, upsert=True)
        saved = collection.find_one({"email": email}, {"_id": 0})
    except Exception as error:
        raise CustomerStorageError("Unable to save customer profile.") from error
    return _serialise(saved)


def delete_customer_profile(email: str, cascade: bool = False) -> dict[str, int]:
    clean_email = str(email or "").strip().lower()
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid customer email is required.")
    try:
        database = _database()
        enquiry_collection = database[current_app.config["MONGODB_ENQUIRY_COLLECTION"]]
        project_collection = database[current_app.config["MONGODB_PROJECT_COLLECTION"]]
        enquiry_count = enquiry_collection.count_documents({"email": clean_email})
        project_count = project_collection.count_documents({"client_email": clean_email})
        if (not cascade) and (enquiry_count or project_count):
            raise ValueError("This customer has linked enquiries or projects. Confirm cascade deletion to remove the complete customer record.")
        profile_count = database[current_app.config["MONGODB_CUSTOMER_COLLECTION"]].delete_many({"email": clean_email}).deleted_count
        if cascade:
            enquiry_collection.delete_many({"email": clean_email})
            project_collection.delete_many({"client_email": clean_email})
        return {"profiles": profile_count, "enquiries": enquiry_count if cascade else 0, "projects": project_count if cascade else 0}
    except ValueError:
        raise
    except Exception as error:
        raise CustomerStorageError("Unable to delete customer profile.") from error


def _base_profile(email: str, name: str) -> dict[str, Any]:
    return {"email": email, "name": name or email, "phone": "", "organisation": "", "notes": "", "tags": [], "enquiries": [], "projects": []}


def _database():
    global _client
    if _client is None:
        from pymongo import MongoClient
        _client = MongoClient(current_app.config["MONGODB_URI"], serverSelectionTimeoutMS=current_app.config["MONGODB_SERVER_SELECTION_TIMEOUT_MS"])
    return _client[current_app.config["MONGODB_DATABASE"]]


def _text(value: Any, maximum: int) -> str:
    text = str(value or "").strip()
    if len(text) > maximum:
        raise ValueError("A customer field is too long.")
    return text


def _serialise(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialise(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialise(item) for item in value]
    return value

import uuid
from datetime import datetime, timezone
from typing import Any

from flask import current_app


class EnquiryStorageError(RuntimeError):
    pass


_client = None
_indexes_ready = False


def _get_collection():
    global _client

    mongodb_uri = current_app.config.get("MONGODB_URI")
    if not mongodb_uri:
        raise EnquiryStorageError("Enquiry storage is not configured.")

    if _client is None:
        try:
            from pymongo import MongoClient
        except ImportError as error:
            raise EnquiryStorageError("MongoDB support is not installed.") from error

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
    _indexes_ready = True


def check_enquiry_storage() -> None:
    try:
        collection = _get_collection()
        collection.database.client.admin.command("ping")
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("MongoDB is unreachable.") from error


def save_enquiry(enquiry: dict[str, Any]) -> dict[str, str]:
    enquiry_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)
    record = {
        "id": enquiry_id,
        "created_at": created_at,
        **enquiry,
    }

    try:
        collection = _get_collection()
        _ensure_indexes(collection)
        collection.insert_one(record)
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to save enquiry.") from error

    return {"id": enquiry_id, "created_at": created_at.isoformat()}

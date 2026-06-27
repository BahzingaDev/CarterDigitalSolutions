import hmac
import uuid
from datetime import datetime, timezone

from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash


class AdminStorageError(RuntimeError):
    pass


_client = None
_dummy_password_hash = generate_password_hash(
    "not-a-real-administrator-password",
    method="scrypt",
)


def admin_account_exists() -> bool:
    email = current_app.config.get("ADMIN_EMAIL", "")
    if not email:
        return False

    try:
        collection = _get_collection()
        return collection.find_one(
            {"email": email, "active": True},
            {"_id": 1},
        ) is not None
    except AdminStorageError:
        raise
    except Exception as error:
        raise AdminStorageError("Unable to check the admin account.") from error


def create_admin_account(name: str, email: str, password: str) -> dict[str, str]:
    configured_email = current_app.config.get("ADMIN_EMAIL", "")
    normalized_email = email.strip().lower()
    clean_name = " ".join(name.split())

    if not configured_email:
        raise ValueError("Admin setup is not enabled.")
    if not hmac.compare_digest(normalized_email, configured_email):
        raise ValueError("This email is not authorised for admin setup.")
    if len(clean_name) < 2 or len(clean_name) > 100:
        raise ValueError("Name must contain between 2 and 100 characters.")
    _validate_password(password, normalized_email)

    try:
        collection = _get_collection()
        if collection.find_one({"email": normalized_email}, {"_id": 1}):
            raise ValueError("An admin account already exists.")

        now = datetime.now(timezone.utc)
        collection.insert_one(
            {
                # MongoDB's default unique _id index safely permits one owner
                # account without relying on custom index creation privileges.
                "_id": "primary-admin",
                "id": str(uuid.uuid4()),
                "name": clean_name,
                "email": normalized_email,
                "password_hash": generate_password_hash(password, method="scrypt"),
                "active": True,
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
            }
        )
    except ValueError:
        raise
    except AdminStorageError:
        raise
    except Exception as error:
        if error.__class__.__name__ == "DuplicateKeyError":
            raise ValueError("An admin account already exists.") from error
        raise AdminStorageError("Unable to create the admin account.") from error

    return {"name": clean_name, "email": normalized_email}


def authenticate_admin_account(email: str, password: str) -> dict[str, str] | None:
    configured_email = current_app.config.get("ADMIN_EMAIL", "")
    normalized_email = email.strip().lower()
    email_allowed = bool(configured_email) and hmac.compare_digest(
        normalized_email,
        configured_email,
    )

    try:
        account = (
            _get_collection().find_one(
                {"email": normalized_email, "active": True},
                {"_id": 0, "name": 1, "email": 1, "password_hash": 1},
            )
            if email_allowed
            else None
        )
        password_hash = account.get("password_hash", "") if account else _dummy_password_hash
        password_matches = check_password_hash(password_hash, password)

        if not account or not password_matches:
            return None

        _get_collection().update_one(
            {"email": normalized_email},
            {"$set": {"last_login_at": datetime.now(timezone.utc)}},
        )
        return {"name": account.get("name", "Administrator"), "email": account["email"]}
    except (TypeError, ValueError):
        current_app.logger.error("Stored admin password hash has an invalid format.")
        return None
    except AdminStorageError:
        raise
    except Exception as error:
        raise AdminStorageError("Unable to authenticate the admin account.") from error


def _validate_password(password: str, email: str) -> None:
    if len(password) < 12 or len(password) > 128:
        raise ValueError("Password must contain between 12 and 128 characters.")
    if password.lower() in email.lower() or email.split("@", 1)[0] in password.lower():
        raise ValueError("Password must not contain your email address.")
    if not any(character.isalpha() for character in password):
        raise ValueError("Password must contain at least one letter.")
    if not any(character.isdigit() for character in password):
        raise ValueError("Password must contain at least one number.")


def _get_collection():
    global _client

    mongodb_uri = current_app.config.get("MONGODB_URI")
    if not mongodb_uri:
        raise AdminStorageError("MongoDB is not configured.")

    if _client is None:
        try:
            from pymongo import MongoClient
        except ImportError as error:
            raise AdminStorageError("MongoDB support is not installed.") from error

        _client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=current_app.config[
                "MONGODB_SERVER_SELECTION_TIMEOUT_MS"
            ],
        )

    database = _client[current_app.config["MONGODB_DATABASE"]]
    return database[current_app.config["MONGODB_ADMIN_COLLECTION"]]

import uuid
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

from flask import current_app

from ..utils.rich_text import rich_text_to_plain, sanitize_rich_text


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
        "labels": [],
        "follow_up_at": None,
        "archived": False,
        "quote_versions": [],
        "communications": [],
        "activity": [
            {
                "id": str(uuid.uuid4()),
                "type": "created",
                "description": "Enquiry received",
                "created_at": created_at,
            }
        ],
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
    try:
        collection.update_many(
            {},
            {"$set": {"quote_versions.$[quote].status": "expired", "quote_versions.$[quote].status_updated_at": datetime.now(timezone.utc)}},
            array_filters=[{"quote.status": {"$in": ["draft", "sent"]}, "quote.valid_until": {"$lt": datetime.now(timezone.utc)}}],
        )
    except Exception:
        current_app.logger.exception("Automatic quote expiry update failed")
    export_limit = min(limit or current_app.config["ADMIN_EXPORT_LIMIT"], 500)
    records = collection.find({}, {"_id": 0}).sort("created_at", -1).limit(export_limit)
    return [_serialise_record(record) for record in records]


def get_enquiry(enquiry_id: str) -> dict[str, Any] | None:
    try:
        record = _get_collection().find_one({"id": enquiry_id}, {"_id": 0})
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to load enquiry.", reason="read_failed") from error
    return _serialise_record(record) if record else None


def get_enquiry_by_quote_id(quote_id: str) -> dict[str, Any] | None:
    try:
        record = _get_collection().find_one({"quote_versions.id": quote_id}, {"_id": 0})
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to load quote enquiry.", reason="read_failed") from error
    return _serialise_record(record) if record else None


def delete_enquiry(enquiry_id: str) -> bool:
    try:
        return bool(_get_collection().delete_one({"id": enquiry_id}).deleted_count)
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to delete enquiry.", reason="write_failed") from error


def delete_quote_version(enquiry_id: str, quote_id: str) -> dict[str, Any] | None:
    record = get_enquiry(enquiry_id)
    if not record:
        return None
    quote = next((item for item in record.get("quote_versions", []) if item.get("id") == quote_id), None)
    if not quote:
        raise ValueError("Quote not found.")
    if quote.get("converted_project_id"):
        raise ValueError("A quote linked to a project cannot be deleted.")
    now = datetime.now(timezone.utc)
    try:
        result = _get_collection().update_one(
            {"id": enquiry_id, "quote_versions.id": quote_id},
            {
                "$pull": {"quote_versions": {"id": quote_id}},
                "$push": {"activity": _activity("quote", f"Quote version {quote.get('version')} deleted", now)},
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to delete quote.", reason="write_failed") from error
    return get_enquiry(enquiry_id) if result.modified_count else None


def update_enquiry(enquiry_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    allowed_statuses = {"new", "reviewed", "replied", "closed"}
    allowed_priorities = {"standard", "medium", "high"}
    update_document: dict[str, Any] = {}
    activity: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    if "status" in updates:
        status = str(updates["status"]).strip().lower()
        if status not in allowed_statuses:
            raise ValueError("Invalid enquiry status.")
        update_document["status"] = status
        update_document["status_updated_at"] = now
        activity.append(_activity("status", f"Status changed to {status}", now))

    if "admin_notes" in updates:
        notes = str(updates["admin_notes"]).strip()
        if len(notes) > 4000:
            raise ValueError("Admin notes are too long.")
        update_document["admin_notes"] = notes

    if "priority" in updates:
        priority = str(updates["priority"]).strip().lower()
        if priority not in allowed_priorities:
            raise ValueError("Invalid enquiry priority.")
        update_document["priority"] = priority
        activity.append(_activity("priority", f"Priority changed to {priority}", now))

    if "labels" in updates:
        labels = updates["labels"]
        if not isinstance(labels, list) or len(labels) > 8:
            raise ValueError("Labels must be a list containing no more than 8 items.")
        clean_labels = []
        for label in labels:
            clean_label = str(label).strip()
            if not clean_label or len(clean_label) > 30:
                raise ValueError("Each label must contain between 1 and 30 characters.")
            if clean_label.lower() not in {item.lower() for item in clean_labels}:
                clean_labels.append(clean_label)
        update_document["labels"] = clean_labels
        activity.append(_activity("labels", "Labels updated", now))

    if "follow_up_at" in updates:
        follow_up_at = _optional_datetime(updates["follow_up_at"], "follow-up date")
        update_document["follow_up_at"] = follow_up_at
        description = "Follow-up cleared" if follow_up_at is None else "Follow-up scheduled"
        activity.append(_activity("follow_up", description, now))

    if "archived" in updates:
        if not isinstance(updates["archived"], bool):
            raise ValueError("Archived must be true or false.")
        update_document["archived"] = updates["archived"]
        description = "Enquiry archived" if updates["archived"] else "Enquiry restored"
        activity.append(_activity("archive", description, now))

    if not update_document:
        raise ValueError("No valid updates supplied.")

    try:
        collection = _get_collection()
        mutation: dict[str, Any] = {"$set": update_document}
        if activity:
            mutation["$push"] = {"activity": {"$each": activity}}
        collection.update_one({"id": enquiry_id}, mutation)
        record = collection.find_one({"id": enquiry_id}, {"_id": 0})
    except EnquiryStorageError:
        raise
    except Exception as error:
        raise EnquiryStorageError("Unable to update enquiry.", reason="write_failed") from error
    return _serialise_record(record) if record else None


def create_quote_version(
    enquiry_id: str,
    payload: dict[str, Any],
    admin_email: str,
) -> dict[str, Any] | None:
    record = get_enquiry(enquiry_id)
    if not record:
        return None

    items = _validate_quote_items(payload.get("items"))
    financials = _quote_financials(items, payload)
    notes = str(payload.get("notes", "")).strip()
    if len(notes) > 2000:
        raise ValueError("Quote notes are too long.")

    valid_until = _optional_datetime(payload.get("valid_until"), "valid-until date")
    now = datetime.now(timezone.utc)
    version = len(record.get("quote_versions", [])) + 1
    quote = {
        "id": str(uuid.uuid4()),
        "version": version,
        "status": "draft",
        "items": items,
        **financials,
        "deposit_invoice_status": "not_required",
        "notes": notes,
        "valid_until": valid_until,
        "created_at": now,
        "created_by": admin_email,
    }

    try:
        _get_collection().update_one(
            {"id": enquiry_id},
            {
                "$push": {
                    "quote_versions": quote,
                    "activity": _activity("quote", f"Quote version {version} created", now),
                }
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to save quote.", reason="write_failed") from error

    updated = get_enquiry(enquiry_id)
    return updated


def update_quote_status(
    enquiry_id: str,
    quote_id: str,
    status: str,
) -> dict[str, Any] | None:
    allowed = {"draft", "sent", "accepted", "declined", "expired"}
    clean_status = status.strip().lower()
    if clean_status not in allowed:
        raise ValueError("Invalid quote status.")

    record = get_enquiry(enquiry_id)
    if not record:
        return None

    quotes = record.get("quote_versions", [])
    quote = next((item for item in quotes if item.get("id") == quote_id), None)
    if not quote:
        raise ValueError("Quote not found.")

    now = datetime.now(timezone.utc)
    invoice_status = quote.get("deposit_invoice_status", "not_required")
    if clean_status == "accepted" and quote.get("deposit", 0) > 0 and invoice_status not in {"sent", "paid"}:
        invoice_status = "pending"
    elif clean_status != "accepted" and invoice_status == "pending":
        invoice_status = "not_required"
    try:
        _get_collection().update_one(
            {"id": enquiry_id, "quote_versions.id": quote_id},
            {
                "$set": {
                    "quote_versions.$.status": clean_status,
                    "quote_versions.$.status_updated_at": now,
                    "quote_versions.$.deposit_invoice_status": invoice_status,
                    "quote_versions.$.deposit_invoice_updated_at": now,
                },
                "$push": {"activity": _activity("quote", f"Quote marked {clean_status}", now)},
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to update quote.", reason="write_failed") from error
    return get_enquiry(enquiry_id)


def update_draft_quote(enquiry_id: str, quote_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    record = get_enquiry(enquiry_id)
    if not record:
        return None
    quote = next((item for item in record.get("quote_versions", []) if item.get("id") == quote_id), None)
    if not quote:
        raise ValueError("Quote not found.")
    if quote.get("status") != "draft":
        raise ValueError("Only draft quotes can be edited in place.")
    items = _validate_quote_items(payload.get("items"))
    financials = _quote_financials(items, payload)
    notes = str(payload.get("notes", "")).strip()
    if len(notes) > 2000:
        raise ValueError("Quote notes cannot exceed 2000 characters.")
    valid_until = _optional_datetime(payload.get("valid_until"), "valid-until date")
    now = datetime.now(timezone.utc)
    fields = {"items": items, **financials, "notes": notes, "valid_until": valid_until, "updated_at": now}
    update = {f"quote_versions.$.{key}": value for key, value in fields.items()}
    try:
        _get_collection().update_one({"id": enquiry_id, "quote_versions.id": quote_id}, {"$set": update, "$push": {"activity": _activity("quote", f"Draft quote version {quote.get('version')} updated", now)}})
    except Exception as error:
        raise EnquiryStorageError("Unable to update quote.", reason="write_failed") from error
    return get_enquiry(enquiry_id)


def update_deposit_invoice_status(
    enquiry_id: str,
    quote_id: str,
    status: str,
    reference: str = "",
) -> dict[str, Any] | None:
    clean_status = status.strip().lower()
    if clean_status not in {"pending", "sent", "paid"}:
        raise ValueError("Invalid deposit invoice status.")
    record = get_enquiry(enquiry_id)
    if not record:
        return None
    quote = next((item for item in record.get("quote_versions", []) if item.get("id") == quote_id), None)
    if not quote:
        raise ValueError("Quote not found.")
    if quote.get("status") != "accepted" or float(quote.get("deposit") or 0) <= 0:
        raise ValueError("A deposit invoice is only available for an accepted quote with a deposit.")
    clean_reference = str(reference or quote.get("deposit_invoice_reference") or "").strip()
    if len(clean_reference) > 80:
        raise ValueError("Invoice reference cannot exceed 80 characters.")
    if clean_status == "sent" and not clean_reference:
        raise ValueError("Add an invoice reference before marking the invoice sent.")

    now = datetime.now(timezone.utc)
    fields: dict[str, Any] = {
        "quote_versions.$.deposit_invoice_status": clean_status,
        "quote_versions.$.deposit_invoice_updated_at": now,
    }
    if clean_reference:
        fields["quote_versions.$.deposit_invoice_reference"] = clean_reference
    if clean_status == "sent":
        fields["quote_versions.$.deposit_invoice_sent_at"] = now
    if clean_status == "paid":
        fields["quote_versions.$.deposit_paid_at"] = now
    try:
        _get_collection().update_one(
            {"id": enquiry_id, "quote_versions.id": quote_id},
            {
                "$set": fields,
                "$push": {"activity": _activity("invoice", f"Deposit invoice marked {clean_status}", now)},
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to update deposit invoice.", reason="write_failed") from error
    return get_enquiry(enquiry_id)


def create_quote_approval_link(enquiry_id: str, quote_id: str) -> str | None:
    record = get_enquiry(enquiry_id)
    if not record:
        return None
    if not any(quote.get("id") == quote_id for quote in record.get("quote_versions", [])):
        raise ValueError("Quote not found.")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    try:
        _get_collection().update_one(
            {"id": enquiry_id, "quote_versions.id": quote_id},
            {
                "$set": {
                    "quote_versions.$.approval_token_hash": token_hash,
                    "quote_versions.$.shared_at": now,
                },
                "$push": {"activity": _activity("quote", "Secure quote link created", now)},
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to create quote link.", reason="write_failed") from error
    return token


def get_public_quote(quote_id: str, token: str) -> dict[str, Any] | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    try:
        record = _get_collection().find_one(
            {"quote_versions": {"$elemMatch": {"id": quote_id, "approval_token_hash": token_hash}}},
            {"_id": 0, "name": 1, "project_type": 1, "quote_versions": 1},
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to load quote.", reason="read_failed") from error
    if not record:
        return None
    quote = next((item for item in record.get("quote_versions", []) if item.get("id") == quote_id), None)
    if not quote or not hmac_compare(token_hash, quote.get("approval_token_hash", "")):
        return None
    public_quote = _serialise_value(dict(quote))
    public_quote.pop("approval_token_hash", None)
    return {"customer_name": record.get("name", ""), "project_type": record.get("project_type", ""), "quote": public_quote}


def approve_public_quote(quote_id: str, token: str, customer_name: str) -> dict[str, Any] | None:
    public_quote = get_public_quote(quote_id, token)
    clean_name = " ".join(customer_name.split())
    if not public_quote:
        return None
    if len(clean_name) < 2 or len(clean_name) > 120:
        raise ValueError("Name must contain between 2 and 120 characters.")
    if public_quote["quote"].get("status") == "accepted":
        raise ValueError("This quote has already been approved.")
    if public_quote["quote"].get("status") in {"declined", "expired"}:
        raise ValueError("This quote can no longer be approved.")
    valid_until = public_quote["quote"].get("valid_until")
    if valid_until and datetime.fromisoformat(str(valid_until).replace("Z", "+00:00")) < datetime.now(timezone.utc):
        update_quote_status_for_public_expiry(quote_id)
        raise ValueError("This quote has expired and can no longer be approved.")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    try:
        result = _get_collection().update_one(
            {"quote_versions": {"$elemMatch": {"id": quote_id, "approval_token_hash": token_hash}}},
            {
                "$set": {
                    "quote_versions.$.status": "accepted",
                    "quote_versions.$.accepted_at": now,
                    "quote_versions.$.accepted_by": clean_name,
                    "quote_versions.$.deposit_invoice_status": "pending" if float(public_quote["quote"].get("deposit") or 0) > 0 else "not_required",
                    "quote_versions.$.deposit_invoice_updated_at": now,
                },
                "$push": {"activity": _activity("quote", f"Quote approved by {clean_name}", now)},
            },
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to approve quote.", reason="write_failed") from error
    return get_public_quote(quote_id, token) if result.matched_count else None


def update_quote_status_for_public_expiry(quote_id: str) -> None:
    try:
        _get_collection().update_one(
            {"quote_versions.id": quote_id},
            {"$set": {"quote_versions.$.status": "expired", "quote_versions.$.status_updated_at": datetime.now(timezone.utc)}},
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to expire quote.", reason="write_failed") from error


def hmac_compare(left: str, right: str) -> bool:
    import hmac
    return hmac.compare_digest(left, right)


def record_communication(
    enquiry_id: str,
    subject: str,
    message: str,
    status: str,
    admin_email: str,
    provider_message_id: str | None = None,
    scheduled_at: str = "",
    attachments: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    clean_subject = subject.strip()
    clean_message = sanitize_rich_text(message)
    if not clean_subject or len(clean_subject) > 180:
        raise ValueError("Subject must contain between 1 and 180 characters.")
    if not rich_text_to_plain(clean_message) or len(clean_message) > 10000:
        raise ValueError("Message must contain between 1 and 10000 characters.")
    if status not in {"sent", "scheduled", "failed"}:
        raise ValueError("Invalid delivery status.")

    now = datetime.now(timezone.utc)
    communication = {
        "id": str(uuid.uuid4()),
        "direction": "outgoing",
        "subject": clean_subject,
        "message": clean_message,
        "status": status,
        "sent_at": now,
        "sent_by": admin_email,
        "provider_message_id": provider_message_id or "",
        "delivery_events": [],
        "scheduled_at": scheduled_at or None,
        "attachments": [
            {key: item.get(key) for key in ("id", "filename", "content_type", "size")}
            for item in (attachments or [])[:10]
        ],
    }
    try:
        mutation: dict[str, Any] = {
            "$push": {
                "communications": communication,
                "activity": _activity(
                    "communication",
                    f"Email delivery {status}: {clean_subject}",
                    now,
                ),
            }
        }
        if status == "sent":
            mutation["$set"] = {"status": "replied", "status_updated_at": now}

        result = _get_collection().update_one(
            {"id": enquiry_id},
            mutation,
        )
    except Exception as error:
        raise EnquiryStorageError("Unable to record communication.", reason="write_failed") from error
    return get_enquiry(enquiry_id) if result.matched_count else None


def record_delivery_event(provider_message_id: str, event_id: str, event_type: str, created_at: str, details: dict[str, Any]) -> bool:
    if not provider_message_id or not event_id:
        return False
    try:
        collection = _get_collection()
        record = collection.find_one(
            {"communications.provider_message_id": provider_message_id},
            {"_id": 0, "id": 1, "communications": 1},
        )
        if not record:
            return False
        communication = next((item for item in record.get("communications", []) if item.get("provider_message_id") == provider_message_id), None)
        if not communication or any(item.get("id") == event_id for item in communication.get("delivery_events", [])):
            return True
        status_map = {
            "email.sent": "sent", "email.delivered": "delivered", "email.opened": "opened",
            "email.clicked": "clicked", "email.delivery_delayed": "delayed",
            "email.bounced": "bounced", "email.complained": "complained",
            "email.failed": "failed", "email.suppressed": "suppressed",
        }
        event = {"id": event_id, "type": event_type, "created_at": created_at, "details": details}
        update: dict[str, Any] = {"$push": {"communications.$.delivery_events": event}}
        if event_type in status_map:
            update["$set"] = {"communications.$.status": status_map[event_type]}
        collection.update_one(
            {"id": record["id"], "communications.provider_message_id": provider_message_id},
            update,
        )
        return True
    except Exception as error:
        raise EnquiryStorageError("Unable to record delivery event.", reason="write_failed") from error


def record_incoming_communication(sender_email: str, subject: str, message: str, provider_message_id: str, received_at: str) -> bool:
    now = _optional_datetime(received_at, "received date") or datetime.now(timezone.utc)
    communication = {
        "id": str(uuid.uuid4()), "direction": "incoming", "subject": subject[:180],
        "message": message[:5000], "status": "received", "sent_at": now,
        "sent_by": sender_email, "provider_message_id": provider_message_id,
        "delivery_events": [],
    }
    try:
        collection = _get_collection()
        if collection.find_one({"communications.provider_message_id": provider_message_id}, {"_id": 1}):
            return True
        enquiry = collection.find_one({"email": sender_email.lower()}, {"_id": 0, "id": 1}, sort=[("created_at", -1)])
        if not enquiry:
            return False
        collection.update_one(
            {"id": enquiry["id"]},
            {"$push": {"communications": communication, "activity": _activity("communication", f"Customer reply received: {subject[:120]}", now)}},
        )
        return True
    except Exception as error:
        raise EnquiryStorageError("Unable to record incoming email.", reason="write_failed") from error


def _activity(activity_type: str, description: str, created_at: datetime) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": activity_type,
        "description": description,
        "created_at": created_at,
    }


def _optional_datetime(value: Any, field: str) -> datetime | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field.title()} must be an ISO date and time.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{field.title()} must be a valid date and time.") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _quote_financials(items: list[dict[str, Any]], payload: dict[str, Any]) -> dict[str, Any]:
    included_items = [item for item in items if not item["optional"] or item["included"]]
    subtotal = round(sum(item["hours"] * item["rate"] for item in included_items), 2)
    discount = _bounded_number(payload.get("discount", 0), "discount", subtotal)
    expenses = _bounded_number(payload.get("expenses", 0), "expenses", 1_000_000)
    tax_rate = _bounded_number(payload.get("tax_rate", 0), "tax rate", 100)
    taxable = round(subtotal - discount + expenses, 2)
    tax_amount = round(taxable * tax_rate / 100, 2)
    total = round(taxable + tax_amount, 2)

    configured_deposit = round(sum(item.get("deposit_amount", 0) for item in included_items), 2)
    if configured_deposit > 0:
        deposit_subtotal = configured_deposit
        deposit_source = "services"
    else:
        requested_deposit = _bounded_number(payload.get("deposit", 0), "deposit", total)
        deposit_subtotal = round(requested_deposit / (1 + tax_rate / 100), 2) if tax_rate else requested_deposit
        deposit_source = "manual" if requested_deposit > 0 else "none"

    deposit_tax_amount = round(deposit_subtotal * tax_rate / 100, 2)
    deposit = round(deposit_subtotal + deposit_tax_amount, 2)
    if deposit > total:
        deposit = total
        deposit_subtotal = round(deposit / (1 + tax_rate / 100), 2) if tax_rate else deposit
        deposit_tax_amount = round(deposit - deposit_subtotal, 2)

    return {
        "subtotal": subtotal,
        "discount": discount,
        "expenses": expenses,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
        "deposit_subtotal": deposit_subtotal,
        "deposit_tax_amount": deposit_tax_amount,
        "deposit": deposit,
        "deposit_source": deposit_source,
    }


def _bounded_number(value: Any, field: str, maximum: float) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, bool):
        raise ValueError(f"{field.title()} must be a number.")
    try:
        number = round(float(value), 2)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field.title()} must be a number.") from error
    if number < 0 or number > maximum:
        raise ValueError(f"{field.title()} must be between 0 and {maximum:.2f}.")
    return number


def _validate_quote_items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not 1 <= len(value) <= 40:
        raise ValueError("A quote must contain between 1 and 40 items.")
    items: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each quote item must be an object.")
        service = str(item.get("service", "")).strip()
        category = str(item.get("category", "")).strip()
        if not service or len(service) > 120 or len(category) > 120:
            raise ValueError("Quote item names or categories are invalid.")
        hours = _bounded_number(item.get("hours"), "hours", 1000)
        rate = _bounded_number(item.get("rate"), "rate", 1000)
        if hours <= 0 or rate <= 0:
            raise ValueError("Quote item hours and rates must be greater than zero.")
        optional = bool(item.get("optional", False))
        items.append({
            "service": service,
            "category": category,
            "hours": hours,
            "rate": rate,
            "optional": optional,
            "included": bool(item.get("included", False)) if optional else True,
            "deposit_amount": _bounded_number(item.get("deposit_amount", 0), "deposit amount", 1_000_000),
        })
    return items


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
    serialised = _serialise_value(dict(record))

    serialised.setdefault("status", "new")
    serialised.setdefault("admin_notes", "")
    serialised.setdefault("labels", [])
    serialised.setdefault("follow_up_at", None)
    serialised.setdefault("archived", False)
    serialised.setdefault("quote_versions", [])
    serialised.setdefault("communications", [])
    serialised.setdefault("activity", [])

    return serialised


def _serialise_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialise_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialise_value(item) for item in value]
    return value

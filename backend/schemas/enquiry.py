import math
import re
from typing import Any


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_TEXT_LENGTH = 4000
MAX_QUOTE_HOURS = 1000
MAX_HOURLY_RATE = 1000
MAX_ESTIMATED_COST = 1_000_000


class EnquiryValidationError(ValueError):
    pass


def _clean_text(value: Any, field: str, max_length: int = MAX_TEXT_LENGTH) -> str:
    if not isinstance(value, str):
        raise EnquiryValidationError(f"{field} must be text.")

    cleaned = value.strip()

    if not cleaned:
        raise EnquiryValidationError(f"{field} is required.")

    if len(cleaned) > max_length:
        raise EnquiryValidationError(f"{field} is too long.")

    return cleaned


def _optional_text(value: Any, max_length: int = MAX_TEXT_LENGTH) -> str:
    if value is None:
        return ""

    if not isinstance(value, str):
        raise EnquiryValidationError("Optional fields must be text.")

    cleaned = value.strip()
    if len(cleaned) > max_length:
        raise EnquiryValidationError("Optional field is too long.")

    return cleaned


def _clean_number(
    value: Any,
    field: str,
    max_value: float,
    *,
    required: bool = False,
) -> float:
    if value in (None, ""):
        if required:
            raise EnquiryValidationError(f"{field} is required.")
        return 0.0

    if isinstance(value, bool):
        raise EnquiryValidationError(f"{field} must be a number.")

    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise EnquiryValidationError(f"{field} must be a number.") from error

    if not math.isfinite(number):
        raise EnquiryValidationError(f"{field} must be a valid number.")

    if number < 0:
        raise EnquiryValidationError(f"{field} cannot be negative.")

    if number > max_value:
        raise EnquiryValidationError(f"{field} is too large.")

    return round(number, 2)


def validate_enquiry_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise EnquiryValidationError("Request body must be a JSON object.")

    if _optional_text(payload.get("website"), 200):
        raise EnquiryValidationError("Submission rejected.")

    enquiry_type = _clean_text(payload.get("type"), "type", 30)
    if enquiry_type not in {"contact", "quote"}:
        raise EnquiryValidationError("type must be contact or quote.")

    email = _clean_text(payload.get("email"), "email", 254)
    if not EMAIL_PATTERN.match(email):
        raise EnquiryValidationError("email must be a valid email address.")

    quote_items = payload.get("quoteItems", [])
    if quote_items is None:
        quote_items = []

    if not isinstance(quote_items, list):
        raise EnquiryValidationError("quoteItems must be a list.")

    if len(quote_items) > 40:
        raise EnquiryValidationError("Too many quote items.")

    cleaned_items: list[dict[str, Any]] = []
    for item in quote_items:
        if not isinstance(item, dict):
            raise EnquiryValidationError("Each quote item must be an object.")

        cleaned_items.append(
            {
                "service": _clean_text(item.get("service"), "quote item service", 120),
                "category": _optional_text(item.get("category"), 120),
                "hours": _clean_number(item.get("hours"), "quote item hours", MAX_QUOTE_HOURS),
                "rate": _clean_number(item.get("rate"), "quote item rate", MAX_HOURLY_RATE),
                "deposit_amount": _clean_number(item.get("deposit_amount", 0), "quote item deposit", MAX_ESTIMATED_COST),
            }
        )

    if enquiry_type == "quote" and not cleaned_items:
        raise EnquiryValidationError("At least one quote item is required.")

    return {
        "type": enquiry_type,
        "name": _clean_text(payload.get("name"), "name", 120),
        "email": email,
        "project_type": _optional_text(payload.get("projectType"), 160),
        "message": _clean_text(payload.get("message"), "message"),
        "quote_items": cleaned_items,
        "estimated_hours": _clean_number(
            payload.get("estimatedHours"),
            "estimated hours",
            MAX_QUOTE_HOURS,
        ),
        "estimated_cost": _clean_number(
            payload.get("estimatedCost"),
            "estimated cost",
            MAX_ESTIMATED_COST,
        ),
    }

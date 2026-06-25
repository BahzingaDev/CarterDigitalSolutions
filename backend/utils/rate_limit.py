import time
from collections import defaultdict, deque
from collections.abc import Iterable

from flask import current_app, request


_attempts: dict[str, deque[float]] = defaultdict(deque)


def enquiry_rate_limit_exceeded(keys: Iterable[str]) -> bool:
    now = time.time()
    window = current_app.config["ENQUIRY_RATE_LIMIT_WINDOW_SECONDS"]
    max_attempts = current_app.config["ENQUIRY_RATE_LIMIT_MAX"]

    cleaned_keys = [key for key in keys if key]
    for key in cleaned_keys:
        attempts = _attempts[key]
        while attempts and attempts[0] <= now - window:
            attempts.popleft()

        if len(attempts) >= max_attempts:
            return True

    for key in cleaned_keys:
        _attempts[key].append(now)

    return False


def request_ip_key() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return f"ip:{forwarded_for.split(',')[0].strip()}"

    return f"ip:{request.remote_addr or 'unknown'}"


def email_key(email: str) -> str:
    return f"email:{email.strip().lower()}"

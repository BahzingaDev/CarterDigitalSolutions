import hmac
import secrets
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, jsonify, request, session
from werkzeug.security import check_password_hash

from .security import origin_is_allowed


_login_attempts: dict[str, deque[float]] = defaultdict(deque)


def admin_is_configured() -> bool:
    return bool(
        current_app.config.get("ADMIN_EMAIL")
        and current_app.config.get("ADMIN_PASSWORD_HASH")
    )


def authenticate_admin(email: str, password: str) -> bool:
    configured_email = current_app.config.get("ADMIN_EMAIL", "")
    password_hash = _normalise_password_hash(
        current_app.config.get("ADMIN_PASSWORD_HASH", "")
    )
    email_matches = hmac.compare_digest(email.strip().lower(), configured_email)

    # Always perform a password check when configured to reduce account discovery signals.
    try:
        password_matches = bool(password_hash) and check_password_hash(
            password_hash,
            password,
        )
    except (TypeError, ValueError):
        current_app.logger.error(
            "ADMIN_PASSWORD_HASH has an invalid format; regenerate the complete hash."
        )
        password_matches = False

    return email_matches and password_matches


def _normalise_password_hash(value: str) -> str:
    password_hash = str(value or "").strip().strip('"').strip("'")
    assignment_prefix = "ADMIN_PASSWORD_HASH="
    if password_hash.startswith(assignment_prefix):
        password_hash = password_hash[len(assignment_prefix) :].strip()

    # Werkzeug scrypt hashes begin with scrypt:32768:8:1. Recover safely when
    # only the algorithm name was omitted while copying the environment value.
    parameters = password_hash.split("$", 1)[0]
    if parameters.count(":") == 2 and all(
        part.isdigit() for part in parameters.split(":")
    ):
        password_hash = f"scrypt:{password_hash}"

    return password_hash


def start_admin_session() -> str:
    session.clear()
    session["admin_authenticated"] = True
    session["admin_email"] = current_app.config["ADMIN_EMAIL"]
    session["csrf_token"] = secrets.token_urlsafe(32)
    session.permanent = True
    return session["csrf_token"]


def admin_session_payload() -> dict[str, str | bool]:
    return {
        "authenticated": True,
        "email": session.get("admin_email", ""),
        "csrf_token": session.get("csrf_token", ""),
    }


def admin_login_rate_limited(key: str) -> bool:
    now = time.time()
    window = current_app.config["ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS"]
    maximum = current_app.config["ADMIN_LOGIN_RATE_LIMIT_MAX"]
    attempts = _login_attempts[key]

    while attempts and attempts[0] <= now - window:
        attempts.popleft()

    if len(attempts) >= maximum:
        return True

    attempts.append(now)
    return False


def clear_admin_login_attempts(key: str) -> None:
    _login_attempts.pop(key, None)


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("admin_authenticated"):
            return jsonify({"error": "Authentication required."}), 401
        return view(*args, **kwargs)

    return wrapped


def require_admin_write(view):
    @wraps(view)
    @require_admin
    def wrapped(*args, **kwargs):
        if not origin_is_allowed(current_app, request.headers.get("Origin")):
            return jsonify({"error": "Origin is not allowed."}), 403

        provided = request.headers.get("X-CSRF-Token", "")
        expected = session.get("csrf_token", "")
        if not provided or not expected or not hmac.compare_digest(provided, expected):
            return jsonify({"error": "Invalid CSRF token."}), 403

        return view(*args, **kwargs)

    return wrapped

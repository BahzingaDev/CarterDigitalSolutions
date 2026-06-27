import hmac
import secrets
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, jsonify, request, session

from .security import origin_is_allowed


_login_attempts: dict[str, deque[float]] = defaultdict(deque)


def start_admin_session(account: dict[str, str]) -> str:
    session.clear()
    session["admin_authenticated"] = True
    session["admin_name"] = account["name"]
    session["admin_email"] = account["email"]
    session["csrf_token"] = secrets.token_urlsafe(32)
    session.permanent = True
    return session["csrf_token"]


def admin_session_payload() -> dict[str, str | bool]:
    return {
        "authenticated": True,
        "name": session.get("admin_name", "Administrator"),
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

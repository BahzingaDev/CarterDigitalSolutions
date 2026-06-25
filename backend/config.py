import os
from pathlib import Path


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    JSON_SORT_KEYS = False
    MAX_CONTENT_LENGTH = 1024 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"
    FORCE_HTTPS = os.environ.get("FORCE_HTTPS") == "1"
    ALLOWED_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]

    API_NAME = "Carter Digital Solutions"
    API_VERSION = "0.1.0"
    MONGODB_URI = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI", "")
    MONGODB_DATABASE = (
        os.environ.get("MONGODB_DATABASE")
        or os.environ.get("MONGO_DATABASE")
        or "carter_digital_solutions"
    )
    MONGODB_ENQUIRY_COLLECTION = os.environ.get(
        "MONGODB_ENQUIRY_COLLECTION",
    ) or os.environ.get("MONGO_ENQUIRY_COLLECTION", "enquiries")
    MONGODB_SERVER_SELECTION_TIMEOUT_MS = int(
        os.environ.get("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000"),
    )
    FRONTEND_DIST_PATH = os.environ.get(
        "FRONTEND_DIST_PATH",
        str(Path(__file__).resolve().parent.parent / "frontend" / "dist"),
    )

    if os.environ.get("FLASK_ENV") == "production" and SECRET_KEY == "dev-only-change-me":
        raise RuntimeError("SECRET_KEY must be set in production.")

    if os.environ.get("FLASK_ENV") == "production" and not MONGODB_URI:
        raise RuntimeError("MONGODB_URI must be set in production.")

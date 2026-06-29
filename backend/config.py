import os
from datetime import timedelta
from pathlib import Path


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    JSON_SORT_KEYS = False
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_NAME = "cds_admin_session"
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"
    PERMANENT_SESSION_LIFETIME = timedelta(
        minutes=int(os.environ.get("ADMIN_SESSION_MINUTES", "60"))
    )
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
    MONGODB_ADMIN_COLLECTION = os.environ.get(
        "MONGODB_ADMIN_COLLECTION",
        "admin_users",
    )
    MONGODB_TEMPLATE_COLLECTION = os.environ.get("MONGODB_TEMPLATE_COLLECTION", "admin_templates")
    MONGODB_RECORD_COLLECTION = os.environ.get("MONGODB_RECORD_COLLECTION", "admin_records")
    MONGODB_PROJECT_COLLECTION = os.environ.get("MONGODB_PROJECT_COLLECTION", "projects")
    MONGODB_SERVICE_COLLECTION = os.environ.get("MONGODB_SERVICE_COLLECTION", "service_catalogue")
    MONGODB_SERVICE_CATEGORY_COLLECTION = os.environ.get(
        "MONGODB_SERVICE_CATEGORY_COLLECTION",
        "service_categories",
    )
    MONGODB_CUSTOMER_COLLECTION = os.environ.get("MONGODB_CUSTOMER_COLLECTION", "customers")
    MONGODB_SETTINGS_COLLECTION = os.environ.get("MONGODB_SETTINGS_COLLECTION", "admin_settings")
    MONGODB_DOCUMENT_COLLECTION = os.environ.get("MONGODB_DOCUMENT_COLLECTION", "documents")
    MONGODB_FILE_BUCKET = os.environ.get("MONGODB_FILE_BUCKET", "admin_files")
    MONGODB_SERVER_SELECTION_TIMEOUT_MS = int(
        os.environ.get("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000"),
    )
    FRONTEND_DIST_PATH = os.environ.get(
        "FRONTEND_DIST_PATH",
        str(Path(__file__).resolve().parent.parent / "frontend" / "dist"),
    )
    EMAIL_NOTIFICATIONS_ENABLED = os.environ.get("EMAIL_NOTIFICATIONS_ENABLED", "1") == "1"
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    RESEND_WEBHOOK_SECRET = os.environ.get("RESEND_WEBHOOK_SECRET", "")
    RESEND_API_URL = os.environ.get("RESEND_API_URL", "https://api.resend.com/emails")
    RESEND_RECEIVING_API_URL = os.environ.get("RESEND_RECEIVING_API_URL", "https://api.resend.com/emails/receiving")
    EMAIL_PROVIDER = os.environ.get(
        "EMAIL_PROVIDER",
        "resend" if RESEND_API_KEY else "smtp",
    ).lower()
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "1") == "1"
    SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "0") == "1"
    SMTP_FORCE_IPV4 = os.environ.get("SMTP_FORCE_IPV4", "1") == "1"
    SMTP_TIMEOUT = int(os.environ.get("SMTP_TIMEOUT", "10"))
    ENQUIRY_EMAIL_TO = os.environ.get("ENQUIRY_EMAIL_TO", "")
    ENQUIRY_EMAIL_FROM = os.environ.get("ENQUIRY_EMAIL_FROM", SMTP_USERNAME)
    ENQUIRY_TIMEZONE = os.environ.get("ENQUIRY_TIMEZONE", "Europe/London")
    CUSTOMER_AUTO_REPLY_ENABLED = os.environ.get("CUSTOMER_AUTO_REPLY_ENABLED", "1") == "1"
    CUSTOMER_EMAIL_FROM = os.environ.get("CUSTOMER_EMAIL_FROM", ENQUIRY_EMAIL_FROM)
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    ADMIN_EXPORT_LIMIT = int(os.environ.get("ADMIN_EXPORT_LIMIT", "100"))
    ADMIN_LOGIN_RATE_LIMIT_MAX = int(os.environ.get("ADMIN_LOGIN_RATE_LIMIT_MAX", "5"))
    ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = int(
        os.environ.get("ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS", "900")
    )
    ENQUIRY_RATE_LIMIT_MAX = int(os.environ.get("ENQUIRY_RATE_LIMIT_MAX", "5"))
    ENQUIRY_RATE_LIMIT_WINDOW_SECONDS = int(
        os.environ.get("ENQUIRY_RATE_LIMIT_WINDOW_SECONDS", "900")
    )

    if os.environ.get("FLASK_ENV") == "production" and SECRET_KEY == "dev-only-change-me":
        raise RuntimeError("SECRET_KEY must be set in production.")

    if os.environ.get("FLASK_ENV") == "production" and not MONGODB_URI:
        raise RuntimeError("MONGODB_URI must be set in production.")

from flask import Blueprint, current_app, jsonify

from ..services.email_service import email_notifications_configured
from ..services.enquiry_service import EnquiryStorageError, check_enquiry_storage
from ..services.workspace_service import WorkspaceStorageError, check_workspace_storage

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": current_app.config["API_NAME"],
            "version": current_app.config["API_VERSION"],
            "mongo_configured": bool(current_app.config.get("MONGODB_URI")),
            "mongo_database": current_app.config["MONGODB_DATABASE"],
            "mongo_collection": current_app.config["MONGODB_ENQUIRY_COLLECTION"],
            "mongo_admin_collection": current_app.config["MONGODB_ADMIN_COLLECTION"],
            "admin_email_configured": bool(current_app.config.get("ADMIN_EMAIL")),
            "email_notifications_configured": email_notifications_configured(),
            "customer_auto_reply_enabled": current_app.config["CUSTOMER_AUTO_REPLY_ENABLED"],
        }
    )


@health_bp.get("/ready")
def readiness_check():
    try:
        check_enquiry_storage()
    except EnquiryStorageError as error:
        current_app.logger.warning("MongoDB readiness check failed: %s", error)
        return jsonify({"status": "unavailable", "database": error.reason}), 503
    except Exception:
        current_app.logger.exception("Unexpected readiness check failure")
        return jsonify({"status": "unavailable", "database": "unreachable"}), 503

    try:
        workspace = check_workspace_storage()
    except WorkspaceStorageError as error:
        current_app.logger.warning(
            "MongoDB workspace readiness failed: resource=%s reason=%s",
            error.resource,
            error.reason,
        )
        return jsonify({
            "status": "unavailable",
            "database": "reachable",
            "workspace": "unavailable",
            "workspace_resource": error.resource,
            "workspace_reason": error.reason,
        }), 503
    except Exception:
        current_app.logger.exception("Unexpected workspace readiness failure")
        return jsonify({"status": "unavailable", "database": "reachable", "workspace": "unavailable", "workspace_reason": "database_error"}), 503

    return jsonify({"status": "ok", "database": "reachable", "workspace": workspace})

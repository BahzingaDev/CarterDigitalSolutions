from flask import Blueprint, current_app, jsonify

from ..services.enquiry_service import EnquiryStorageError, check_enquiry_storage

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

    return jsonify({"status": "ok", "database": "reachable"})

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
        }
    )


@health_bp.get("/ready")
def readiness_check():
    try:
        check_enquiry_storage()
    except EnquiryStorageError:
        return jsonify({"status": "unavailable", "database": "unconfigured"}), 503
    except Exception:
        return jsonify({"status": "unavailable", "database": "unreachable"}), 503

    return jsonify({"status": "ok", "database": "reachable"})

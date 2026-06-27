from flask import Blueprint, jsonify

from ..services.site_service import get_site_summary
from ..services.workspace_service import WorkspaceStorageError, list_service_overrides

site_bp = Blueprint("site", __name__)


@site_bp.get("/site-summary")
def site_summary():
    return jsonify(get_site_summary().to_dict())


@site_bp.get("/services")
def services_catalogue():
    try:
        return jsonify({"services": list_service_overrides()})
    except WorkspaceStorageError:
        return jsonify({"services": []})

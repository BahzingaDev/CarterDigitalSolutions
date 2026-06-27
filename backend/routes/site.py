from flask import Blueprint, jsonify

from ..services.site_service import get_site_summary
from ..services.workspace_service import WorkspaceStorageError, list_service_categories, list_service_overrides

site_bp = Blueprint("site", __name__)


@site_bp.get("/site-summary")
def site_summary():
    return jsonify(get_site_summary().to_dict())


@site_bp.get("/services")
def services_catalogue():
    try:
        categories = list_service_categories(published_only=True)
        visible_category_ids = {category["id"] for category in categories}
        all_services = list_service_overrides()
        services = [
            service for service in all_services
            if service.get("status", "published") == "published"
            and service.get("active", True)
            and (not service.get("category_id") or service["category_id"] in visible_category_ids)
        ]
        visible_slugs = {service["slug"] for service in services}
        return jsonify({
            "categories": categories,
            "services": services,
            "unavailable_slugs": [service["slug"] for service in all_services if service["slug"] not in visible_slugs],
        })
    except WorkspaceStorageError:
        return jsonify({"categories": [], "services": [], "unavailable_slugs": []})

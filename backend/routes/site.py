from flask import Blueprint, jsonify

from ..services.site_service import get_site_summary

site_bp = Blueprint("site", __name__)


@site_bp.get("/site-summary")
def site_summary():
    return jsonify(get_site_summary().to_dict())

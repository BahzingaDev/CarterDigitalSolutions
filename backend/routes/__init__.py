from flask import Flask

from .admin import admin_bp
from .enquiries import enquiries_bp
from .health import health_bp
from .site import site_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(enquiries_bp, url_prefix="/api")
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(site_bp, url_prefix="/api")

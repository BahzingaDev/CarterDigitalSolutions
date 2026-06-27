from flask import Flask

from .admin import admin_bp
from .enquiries import enquiries_bp
from .health import health_bp
from .quotes import quotes_bp
from .site import site_bp
from .webhooks import webhooks_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(enquiries_bp, url_prefix="/api")
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(quotes_bp, url_prefix="/api")
    app.register_blueprint(site_bp, url_prefix="/api")
    app.register_blueprint(webhooks_bp, url_prefix="/api")

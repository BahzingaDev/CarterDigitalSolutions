from pathlib import Path

from flask import Flask, abort, send_from_directory

from .config import Config
from .routes import register_routes
from .utils.security import apply_security_headers


def create_app(config: type[Config] = Config) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config)

    register_routes(app)
    register_frontend_routes(app)
    apply_security_headers(app)

    return app


def register_frontend_routes(app: Flask) -> None:
    frontend_dist = Path(app.config["FRONTEND_DIST_PATH"])

    @app.get("/")
    @app.get("/<path:path>")
    def serve_frontend(path: str = ""):
        if not frontend_dist.exists():
            abort(404)

        requested_path = frontend_dist / path
        if path and requested_path.is_file():
            return send_from_directory(frontend_dist, path)

        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return send_from_directory(frontend_dist, "index.html")

        abort(404)

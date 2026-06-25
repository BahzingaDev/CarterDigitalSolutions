from flask import Flask, request


def origin_is_allowed(app: Flask, origin: str | None) -> bool:
    if not origin:
        return True

    normalized_origin = origin.rstrip("/")
    request_origin = f"{request.scheme}://{request.host}".rstrip("/")
    allowed_origins = set(app.config.get("ALLOWED_ORIGINS", []))
    allowed_origins.add(request_origin)

    return normalized_origin in allowed_origins


def apply_security_headers(app: Flask) -> None:
    @app.after_request
    def add_headers(response):
        is_api_response = request.path.startswith("/api/")

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if is_api_response:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none'; "
                "base-uri 'none'; "
                "form-action 'self'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self'; "
                "img-src 'self' data:; "
                "font-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        if is_api_response:
            response.headers["Cache-Control"] = "no-store"

        if app.config.get("FORCE_HTTPS") or request.is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response

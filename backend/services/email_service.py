import socket
import smtplib
from email.message import EmailMessage
from typing import Any

from flask import current_app


class IPv4SMTP(smtplib.SMTP):
    def _get_socket(self, host: str, port: int, timeout: float):
        return _create_ipv4_connection(host, port, timeout)


class IPv4SMTPSSL(smtplib.SMTP_SSL):
    def _get_socket(self, host: str, port: int, timeout: float):
        return self.context.wrap_socket(
            _create_ipv4_connection(host, port, timeout),
            server_hostname=host,
        )


def email_notifications_configured() -> bool:
    return all(
        [
            current_app.config.get("EMAIL_NOTIFICATIONS_ENABLED"),
            current_app.config.get("SMTP_HOST"),
            current_app.config.get("ENQUIRY_EMAIL_TO"),
            current_app.config.get("ENQUIRY_EMAIL_FROM"),
        ]
    )


def send_enquiry_notification(enquiry: dict[str, Any], saved: dict[str, str]) -> None:
    if not email_notifications_configured():
        return

    message = EmailMessage()
    message["Subject"] = _subject(enquiry)
    message["From"] = current_app.config["ENQUIRY_EMAIL_FROM"]
    message["To"] = current_app.config["ENQUIRY_EMAIL_TO"]
    message["Reply-To"] = enquiry["email"]
    message.set_content(_body(enquiry, saved))

    smtp_class = _smtp_class()

    with smtp_class(
        current_app.config["SMTP_HOST"],
        current_app.config["SMTP_PORT"],
        timeout=current_app.config["SMTP_TIMEOUT"],
    ) as smtp:
        if current_app.config["SMTP_USE_TLS"] and not current_app.config["SMTP_USE_SSL"]:
            smtp.starttls()

        username = current_app.config.get("SMTP_USERNAME")
        password = current_app.config.get("SMTP_PASSWORD")
        if username and password:
            smtp.login(username, password)

        smtp.send_message(message)


def _smtp_class():
    if current_app.config["SMTP_USE_SSL"]:
        return IPv4SMTPSSL if current_app.config["SMTP_FORCE_IPV4"] else smtplib.SMTP_SSL

    return IPv4SMTP if current_app.config["SMTP_FORCE_IPV4"] else smtplib.SMTP


def _create_ipv4_connection(host: str, port: int, timeout: float):
    errors: list[OSError] = []

    for result in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        family, socket_type, proto, _, address = result
        sock = socket.socket(family, socket_type, proto)
        sock.settimeout(timeout)

        try:
            sock.connect(address)
            return sock
        except OSError as error:
            errors.append(error)
            sock.close()

    if errors:
        raise errors[-1]

    raise OSError(f"No IPv4 address found for SMTP host {host}.")


def _subject(enquiry: dict[str, Any]) -> str:
    enquiry_type = enquiry["type"].title()
    project_type = enquiry.get("project_type") or "General enquiry"
    return f"New {enquiry_type}: {project_type}"


def _body(enquiry: dict[str, Any], saved: dict[str, str]) -> str:
    lines = [
        "A new enquiry has been submitted through Carter Digital Solutions.",
        "",
        f"Reference: {saved['id']}",
        f"Received: {saved['created_at']}",
        f"Type: {enquiry['type']}",
        f"Name: {enquiry['name']}",
        f"Email: {enquiry['email']}",
        f"Project type: {enquiry.get('project_type') or 'Not specified'}",
        "",
        "Message:",
        enquiry["message"],
    ]

    quote_items = enquiry.get("quote_items") or []
    if quote_items:
        lines.extend(["", "Selected quote items:"])
        for item in quote_items:
            lines.append(
                f"- {item['service']} ({item.get('category') or 'Uncategorised'}): "
                f"{item['hours']} hours at {item['rate']}"
            )

        lines.extend(
            [
                "",
                f"Estimated hours: {enquiry.get('estimated_hours', 0)}",
                f"Estimated cost: {enquiry.get('estimated_cost', 0)}",
            ]
        )

    return "\n".join(lines)

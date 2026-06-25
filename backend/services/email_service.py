import smtplib
from email.message import EmailMessage
from typing import Any

from flask import current_app


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

    with smtplib.SMTP(
        current_app.config["SMTP_HOST"],
        current_app.config["SMTP_PORT"],
        timeout=10,
    ) as smtp:
        if current_app.config["SMTP_USE_TLS"]:
            smtp.starttls()

        username = current_app.config.get("SMTP_USERNAME")
        password = current_app.config.get("SMTP_PASSWORD")
        if username and password:
            smtp.login(username, password)

        smtp.send_message(message)


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

import json
import socket
import smtplib
from email.message import EmailMessage
from html import escape
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

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
    if not current_app.config.get("EMAIL_NOTIFICATIONS_ENABLED"):
        return False

    if current_app.config.get("EMAIL_PROVIDER") == "resend":
        return all(
            [
                current_app.config.get("RESEND_API_KEY"),
                current_app.config.get("ENQUIRY_EMAIL_TO"),
                current_app.config.get("ENQUIRY_EMAIL_FROM"),
            ]
        )

    return all(
        [
            current_app.config.get("SMTP_HOST"),
            current_app.config.get("ENQUIRY_EMAIL_TO"),
            current_app.config.get("ENQUIRY_EMAIL_FROM"),
        ]
    )


def send_enquiry_notification(enquiry: dict[str, Any], saved: dict[str, str]) -> None:
    if not email_notifications_configured():
        return

    if current_app.config.get("EMAIL_PROVIDER") == "resend":
        _send_resend_email(enquiry, saved)
        return

    message = EmailMessage()
    message["Subject"] = _subject(enquiry)
    message["From"] = current_app.config["ENQUIRY_EMAIL_FROM"]
    message["To"] = current_app.config["ENQUIRY_EMAIL_TO"]
    message["Reply-To"] = enquiry["email"]
    message.set_content(_text_body(enquiry, saved))
    message.add_alternative(_html_body(enquiry, saved), subtype="html")

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


def _send_resend_email(enquiry: dict[str, Any], saved: dict[str, str]) -> None:
    payload = {
        "from": current_app.config["ENQUIRY_EMAIL_FROM"],
        "to": [current_app.config["ENQUIRY_EMAIL_TO"]],
        "subject": _subject(enquiry),
        "text": _text_body(enquiry, saved),
        "html": _html_body(enquiry, saved),
        "reply_to": enquiry["email"],
    }
    data = json.dumps(payload).encode("utf-8")
    request = Request(
        current_app.config["RESEND_API_URL"],
        data=data,
        headers={
            "Authorization": f"Bearer {current_app.config['RESEND_API_KEY']}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "CarterDigitalSolutions/1.0 (+https://carterdigitalsolutions.onrender.com)",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=current_app.config["SMTP_TIMEOUT"]) as response:
            if response.status >= 400:
                raise RuntimeError(f"Resend API returned status {response.status}.")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend API error {error.code}: {detail}") from error


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


def _text_body(enquiry: dict[str, Any], saved: dict[str, str]) -> str:
    lines = [
        "New enquiry received",
        "Carter Digital Solutions",
        "",
        f"Reference: {saved['id']}",
        f"Received: {saved['created_at']}",
        f"Type: {enquiry['type'].title()}",
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
                f"{item['hours']} hours at {_money(item['rate'])}/hr"
            )

        lines.extend(
            [
                "",
                f"Estimated hours: {enquiry.get('estimated_hours', 0)}",
                f"Estimated cost: {_money(enquiry.get('estimated_cost', 0))}",
            ]
        )

    return "\n".join(lines)


def _html_body(enquiry: dict[str, Any], saved: dict[str, str]) -> str:
    project_type = enquiry.get("project_type") or "Not specified"
    quote_items = enquiry.get("quote_items") or []
    message_html = _paragraphs(enquiry["message"])

    quote_section = ""
    if quote_items:
        rows = "\n".join(
            f"""
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eadff3;">{escape(item['service'])}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eadff3;">{escape(item.get('category') or 'Uncategorised')}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eadff3; text-align: right;">{escape(str(item['hours']))}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eadff3; text-align: right;">{escape(_money(item['rate']))}</td>
            </tr>
            """
            for item in quote_items
        )
        quote_section = f"""
        <h2 style="margin: 28px 0 12px; color: #2d173d; font-size: 18px;">Selected quote items</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #eadff3; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #6f2da8; color: #ffffff;">
              <th align="left" style="padding: 10px 12px;">Service</th>
              <th align="left" style="padding: 10px 12px;">Category</th>
              <th align="right" style="padding: 10px 12px;">Hours</th>
              <th align="right" style="padding: 10px 12px;">Rate</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
        <div style="margin-top: 14px; padding: 14px 16px; background: #f6f0fa; border-radius: 8px;">
          <strong>Estimated hours:</strong> {escape(str(enquiry.get('estimated_hours', 0)))}<br>
          <strong>Estimated cost:</strong> {escape(_money(enquiry.get('estimated_cost', 0)))}
        </div>
        """

    return f"""<!doctype html>
<html>
  <body style="margin: 0; padding: 0; background: #f5f3f7; color: #24162d; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f5f3f7; padding: 28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #eadff3;">
            <tr>
              <td style="background: #4b1f70; color: #ffffff; padding: 24px 28px;">
                <div style="font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase;">Carter Digital Solutions</div>
                <h1 style="margin: 8px 0 0; font-size: 26px; line-height: 1.2;">New enquiry received</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 26px 28px;">
                <p style="margin: 0 0 18px; color: #5d5166;">A new enquiry has been submitted through the website.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  {_detail_row("Reference", saved["id"])}
                  {_detail_row("Received", saved["created_at"])}
                  {_detail_row("Type", enquiry["type"].title())}
                  {_detail_row("Project type", project_type)}
                  {_detail_row("Name", enquiry["name"])}
                  {_detail_row("Email", enquiry["email"])}
                </table>

                <h2 style="margin: 28px 0 12px; color: #2d173d; font-size: 18px;">Message</h2>
                <div style="padding: 16px; background: #faf8fc; border-left: 4px solid #6f2da8; border-radius: 8px; line-height: 1.55;">
                  {message_html}
                </div>

                {quote_section}

                <p style="margin: 28px 0 0; color: #6d6175; font-size: 13px;">
                  Reply directly to this email to respond to {escape(enquiry["name"])}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _detail_row(label: str, value: Any) -> str:
    return f"""
    <tr>
      <td style="padding: 8px 0; width: 150px; color: #6d6175; font-size: 13px;">{escape(label)}</td>
      <td style="padding: 8px 0; color: #24162d; font-weight: 600;">{escape(str(value))}</td>
    </tr>
    """


def _paragraphs(text: str) -> str:
    paragraphs = [part.strip() for part in text.splitlines() if part.strip()]
    if not paragraphs:
        return "<p style=\"margin: 0;\">No message provided.</p>"

    return "\n".join(
        f"<p style=\"margin: 0 0 12px;\">{escape(paragraph)}</p>"
        for paragraph in paragraphs
    )


def _money(value: Any) -> str:
    try:
        return f"£{float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value)

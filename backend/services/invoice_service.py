from io import BytesIO
from html import escape
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_invoice_pdf(project: dict[str, Any], invoice: dict[str, Any], settings: dict[str, Any]) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="InvoiceRight", parent=styles["Normal"], alignment=TA_RIGHT, leading=15))
    accent = colors.HexColor("#5b2384")
    story = [
        Table([
            [Paragraph(f"<b>{escape(settings['invoice_business_name'])}</b>", styles["Title"]), Paragraph("<b>INVOICE</b>", styles["InvoiceRight"])],
            [Paragraph(escape(settings.get("invoice_address", "")).replace("\n", "<br/>"), styles["Normal"]), Paragraph(f"Reference: <b>{escape(invoice['reference'])}</b><br/>Issued: {escape(invoice.get('issue_date') or 'On delivery')}<br/>Due: {escape(invoice.get('due_date') or 'As agreed')}", styles["InvoiceRight"])],
        ], colWidths=[105 * mm, 55 * mm]),
        Spacer(1, 12 * mm),
        Paragraph("<b>Bill to</b>", styles["Heading3"]),
        Paragraph(f"{escape(project.get('client_name') or 'Client')}<br/>{escape(project.get('client_email') or '')}", styles["Normal"]),
        Spacer(1, 9 * mm),
    ]
    services = [item.get("service", "") for item in project.get("services", []) if not item.get("optional") or item.get("included")]
    if services:
        story.extend([Paragraph("<b>Confirmed services</b>", styles["Heading3"]), Paragraph(escape(", ".join(filter(None, services))), styles["Normal"]), Spacer(1, 7 * mm)])
    description = invoice.get("notes") or f"{str(invoice.get('kind', 'Project')).title()} invoice for {project.get('name', 'project services')}"
    rows = [["Description", "Net", "Tax", "Total"], [description, money(invoice.get("subtotal", 0)), f"{invoice.get('tax_rate', 0):g}%", money(invoice.get("amount", 0))]]
    table = Table(rows, colWidths=[91 * mm, 23 * mm, 20 * mm, 26 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (1, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8cce0")), ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([table, Spacer(1, 8 * mm)])
    totals = Table([
        ["Subtotal", money(invoice.get("subtotal", 0))],
        [f"Tax ({invoice.get('tax_rate', 0):g}%)", money(invoice.get("tax_amount", 0))],
        [Paragraph("<b>Total due</b>", styles["Normal"]), Paragraph(f"<b>{money(invoice.get('amount', 0))}</b>", styles["InvoiceRight"])],
    ], colWidths=[35 * mm, 35 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([("ALIGN", (1, 0), (1, -1), "RIGHT"), ("LINEABOVE", (0, -1), (-1, -1), 1, accent), ("PADDING", (0, 0), (-1, -1), 6)]))
    story.append(totals)
    if settings.get("payment_details"):
        story.extend([Spacer(1, 12 * mm), Paragraph("<b>Payment details</b>", styles["Heading3"]), Paragraph(escape(settings["payment_details"]).replace("\n", "<br/>"), styles["Normal"])])
    document.build(story)
    return output.getvalue()


def money(value: Any) -> str:
    return f"£{float(value or 0):,.2f}"

import unittest

from flask import Flask

from backend.services.email_service import (
    _enquiry_correspondence_replacements,
    _invoice_correspondence_replacements,
    _replace_placeholders,
)
from backend.utils.rich_text import rich_text_to_plain, sanitize_rich_text


class CorrespondencePlaceholderTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config["ENQUIRY_TIMEZONE"] = "Europe/London"
        self.context = self.app.app_context()
        self.context.push()

    def tearDown(self):
        self.context.pop()

    def test_enquiry_placeholders_include_customer_quote_and_crm_values(self):
        values = _enquiry_correspondence_replacements({
            "id": "enquiry-1",
            "created_at": "2026-06-27T13:30:00+00:00",
            "name": "Alex Morgan",
            "email": "alex@example.com",
            "type": "contact",
            "project_type": "Professional website",
            "message": "Please rebuild our website.",
            "status": "reviewed",
            "priority": "high",
            "labels": ["website", "priority"],
            "estimated_hours": 24,
            "estimated_cost": 540,
            "quote_versions": [{
                "version": 2,
                "status": "sent",
                "items": [{"service": "Website design"}, {"service": "CMS setup"}],
                "subtotal": 500,
                "discount": 25,
                "expenses": 15,
                "tax_amount": 98,
                "total": 588,
                "deposit": 176.4,
                "valid_until": "2026-07-12",
            }],
        })

        self.assertEqual(values["first_name"], "Alex")
        self.assertEqual(values["quote_items"], "Website design, CMS setup")
        self.assertEqual(values["quote_total"], "£588.00")
        self.assertEqual(values["labels"], "website, priority")
        self.assertNotIn("{{", _replace_placeholders("Hello {{first_name}}, total {{quote_total}}", values))

    def test_invoice_placeholders_include_project_tax_and_payment_values(self):
        values = _invoice_correspondence_replacements(
            {"name": "Website rebuild", "client_name": "Alex Morgan", "stage": "active", "value": 1250, "due_date": "2026-07-31"},
            {"reference": "INV-004", "kind": "deposit", "status": "draft", "subtotal": 250, "tax_rate": 20, "tax_amount": 50, "amount": 300, "issue_date": "2026-06-28", "due_date": "2026-07-12", "notes": "Initial deposit"},
            {"invoice_business_name": "Carter Digital Solutions", "invoice_address": "1 Example Street", "payment_details": "Account ending 1234"},
            "alex@example.com",
        )

        self.assertEqual(values["invoice_total"], "£300.00")
        self.assertEqual(values["invoice_tax_rate"], "20%")
        self.assertEqual(values["project_due_date"], "31 July 2026")
        self.assertEqual(values["payment_details"], "Account ending 1234")

    def test_rich_text_preserves_formatting_and_blank_lines_safely(self):
        rich_text = '<p><font face="Georgia" size="5" color="#6f2da8">Hello <strong>Alex</strong></font></p><div><br></div><p><a href="https://example.com" onclick="alert(1)">Review</a></p><script>alert(1)</script>'
        clean = sanitize_rich_text(rich_text)
        plain = rich_text_to_plain(clean)

        self.assertIn("<strong>Alex</strong>", clean)
        self.assertIn('face="Georgia"', clean)
        self.assertIn('href="https://example.com"', clean)
        self.assertNotIn("onclick", clean)
        self.assertNotIn("<script", clean)
        self.assertIn("\n\n", plain)


if __name__ == "__main__":
    unittest.main()

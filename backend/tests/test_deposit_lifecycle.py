import unittest
from unittest.mock import MagicMock, patch

from backend.services.enquiry_service import _quote_financials
from backend.services.workspace_service import (
    _consultation_hour_cap,
    _mongo_error_reason,
    _sync_project_deposit_status,
    ensure_accepted_quote_project,
    save_project,
)


class DepositCalculationTests(unittest.TestCase):
    def test_service_deposits_override_manual_value_and_include_tax(self):
        items = [
            {"hours": 10, "rate": 20, "optional": False, "included": True, "deposit_amount": 50},
            {"hours": 5, "rate": 20, "optional": True, "included": False, "deposit_amount": 25},
        ]

        result = _quote_financials(items, {"tax_rate": 20, "deposit": 1})

        self.assertEqual(result["deposit_subtotal"], 50)
        self.assertEqual(result["deposit_tax_amount"], 10)
        self.assertEqual(result["deposit"], 60)
        self.assertEqual(result["deposit_source"], "services")

    def test_manual_deposit_is_treated_as_tax_inclusive(self):
        items = [{"hours": 10, "rate": 20, "optional": False, "included": True, "deposit_amount": 0}]

        result = _quote_financials(items, {"tax_rate": 20, "deposit": 60})

        self.assertEqual(result["deposit_subtotal"], 50)
        self.assertEqual(result["deposit_tax_amount"], 10)
        self.assertEqual(result["deposit"], 60)
        self.assertEqual(result["deposit_source"], "manual")


class AcceptedQuoteAutomationTests(unittest.TestCase):
    @patch("backend.services.workspace_service.save_project")
    @patch("backend.services.workspace_service._collection")
    @patch("backend.services.enquiry_service.get_enquiry")
    def test_acceptance_creates_taxed_draft_deposit_invoice(self, get_enquiry, collection, save_project):
        get_enquiry.return_value = {
            "id": "enquiry-1",
            "name": "Alex Morgan",
            "email": "alex@example.com",
            "project_type": "Website",
            "quote_versions": [{
                "id": "quote-1",
                "version": 2,
                "status": "accepted",
                "items": [{"service": "Website", "category": "Digital", "hours": 10, "rate": 20, "optional": False, "included": True}],
                "total": 240,
                "deposit": 60,
                "deposit_subtotal": 50,
                "deposit_tax_amount": 10,
                "deposit_invoice_status": "pending",
                "tax_rate": 20,
                "notes": "Scope",
            }],
        }
        collection.return_value.find_one.return_value = None
        save_project.side_effect = lambda payload: {"id": "project-1", **payload}

        project = ensure_accepted_quote_project("enquiry-1", "quote-1")

        invoice = project["invoices"][0]
        self.assertEqual(invoice["status"], "draft")
        self.assertEqual(invoice["subtotal"], 50)
        self.assertEqual(invoice["tax_rate"], 20)
        self.assertEqual(invoice["tax_amount"], 10)
        self.assertEqual(invoice["amount"], 60)
        self.assertEqual(project["stage"], "accepted")
        self.assertEqual(project["included_consultation_hours"], 2)

    @patch("backend.services.workspace_service.get_project")
    @patch("backend.services.enquiry_service.get_enquiry")
    def test_existing_conversion_is_reused(self, get_enquiry, get_project):
        get_enquiry.return_value = {
            "quote_versions": [{"id": "quote-1", "status": "accepted", "converted_project_id": "project-1"}],
        }
        get_project.return_value = {"id": "project-1", "invoices": []}

        project = ensure_accepted_quote_project("enquiry-1", "quote-1")

        self.assertEqual(project["id"], "project-1")


class WorkspaceDiagnosticTests(unittest.TestCase):
    def test_authentication_errors_are_classified_without_exposing_credentials(self):
        error = RuntimeError("bad auth : authentication failed")

        self.assertEqual(_mongo_error_reason(error), "authentication_failed")

    def test_timeouts_are_classified(self):
        TimeoutErrorType = type("ServerSelectionTimeoutError", (RuntimeError,), {})

        self.assertEqual(_mongo_error_reason(TimeoutErrorType("timed out")), "connection_timeout")


class ProjectCommercialRuleTests(unittest.TestCase):
    def test_consultation_cap_is_quarter_of_labour_rounded_down_and_capped_at_eight(self):
        self.assertEqual(_consultation_hour_cap([{"hours": 30, "optional": False, "included": True}]), 7)
        self.assertEqual(_consultation_hour_cap([{"hours": 32, "optional": False, "included": True}]), 8)
        self.assertEqual(_consultation_hour_cap([{"hours": 100, "optional": False, "included": True}]), 8)
        self.assertEqual(_consultation_hour_cap([{"hours": 3, "optional": False, "included": True}]), 0)
        self.assertEqual(_consultation_hour_cap([{"hours": 40, "optional": True, "included": False}]), 0)

    @patch("backend.services.workspace_service._sync_project_deposit_status")
    @patch("backend.services.workspace_service._save")
    def test_project_save_clamps_requested_consultation_hours(self, save_record, sync_deposit):
        save_record.side_effect = lambda _key, document, _item_id: {"id": "project-1", **document}
        project = save_project({
            "name": "Small project",
            "stage": "active",
            "value": 500,
            "services": [{"service": "Website", "category": "Digital", "hours": 20, "rate": 20, "deposit_amount": 100, "optional": False, "included": True}],
            "included_consultation_hours": 8,
            "tasks": [], "milestones": [], "meetings": [], "invoices": [], "tags": [],
        }, "project-1")

        self.assertEqual(project["included_consultation_hours"], 5)
        self.assertEqual(project["services"][0]["deposit_amount"], 100)
        sync_deposit.assert_called_once()

    @patch("backend.services.workspace_service._collection")
    def test_paid_deposit_invoice_syncs_to_quote(self, collection):
        mongo_collection = MagicMock()
        collection.return_value = mongo_collection

        _sync_project_deposit_status({
            "linked_enquiry_id": "enquiry-1",
            "source_quote_id": "quote-1",
            "invoices": [{"kind": "deposit", "status": "paid", "reference": "DEP-1", "paid_date": "2026-06-28"}],
        })

        update = mongo_collection.update_one.call_args.args[1]["$set"]
        self.assertEqual(update["quote_versions.$.deposit_invoice_status"], "paid")
        self.assertEqual(update["quote_versions.$.deposit_invoice_reference"], "DEP-1")
        self.assertEqual(update["quote_versions.$.deposit_paid_at"], "2026-06-28")


if __name__ == "__main__":
    unittest.main()

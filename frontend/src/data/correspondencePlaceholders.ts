import type { AdminEnquiry } from '../api/admin';

export interface CorrespondencePlaceholder {
  key: string;
  label: string;
  description: string;
  group: string;
  sample: string;
}

export const enquiryPlaceholders: CorrespondencePlaceholder[] = [
  placeholder('name', 'Customer name', 'Full customer name.', 'Customer', 'Alex Morgan'),
  placeholder('first_name', 'Customer first name', 'First word of the customer name.', 'Customer', 'Alex'),
  placeholder('email', 'Customer email', 'Customer reply address.', 'Customer', 'alex@example.com'),
  placeholder('business_name', 'Business name', 'Your trading name.', 'Business', 'Carter Digital Solutions'),
  placeholder('today', 'Today', 'Current date in UK format.', 'Business', '28 June 2026'),
  placeholder('project_type', 'Project type', 'Requested project or service type.', 'Enquiry', 'Professional website'),
  placeholder('enquiry_type', 'Enquiry type', 'Contact or quote request.', 'Enquiry', 'quote'),
  placeholder('reference', 'Enquiry reference', 'Unique enquiry identifier.', 'Enquiry', 'ENQ-EXAMPLE'),
  placeholder('enquiry_message', 'Customer message', 'Original message submitted by the customer.', 'Enquiry', 'I need a new website for my consultancy.'),
  placeholder('received_date', 'Received date', 'Date and time the enquiry was submitted.', 'Enquiry', '27 June 2026, 14:30 BST'),
  placeholder('status', 'Enquiry status', 'Current CRM status.', 'Enquiry', 'reviewed'),
  placeholder('priority', 'Priority', 'Current enquiry priority.', 'Enquiry', 'high'),
  placeholder('follow_up_date', 'Follow-up date', 'Scheduled follow-up date and time.', 'Enquiry', '30 June 2026, 10:00 BST'),
  placeholder('labels', 'Labels', 'Comma-separated enquiry labels.', 'Enquiry', 'website, priority'),
  placeholder('estimated_hours', 'Estimated hours', 'Current enquiry labour estimate.', 'Estimate', '24'),
  placeholder('estimated_cost', 'Estimated cost', 'Current enquiry cost estimate.', 'Estimate', '£540.00'),
  placeholder('quote_version', 'Quote version', 'Latest formal quote version.', 'Latest quote', '2'),
  placeholder('quote_status', 'Quote status', 'Latest formal quote status.', 'Latest quote', 'sent'),
  placeholder('quote_items', 'Quote services', 'Comma-separated services on the latest quote.', 'Latest quote', 'Website design, CMS setup'),
  placeholder('quote_subtotal', 'Quote subtotal', 'Latest quote subtotal before adjustments and tax.', 'Latest quote', '£500.00'),
  placeholder('quote_discount', 'Quote discount', 'Discount applied to the latest quote.', 'Latest quote', '£25.00'),
  placeholder('quote_expenses', 'Quote expenses', 'Expenses applied to the latest quote.', 'Latest quote', '£15.00'),
  placeholder('quote_tax', 'Quote tax', 'Tax on the latest quote.', 'Latest quote', '£106.00'),
  placeholder('quote_total', 'Quote total', 'Total value of the latest quote.', 'Latest quote', '£636.00'),
  placeholder('quote_deposit', 'Quote deposit', 'Deposit required by the latest quote.', 'Latest quote', '£190.80'),
  placeholder('quote_valid_until', 'Quote expiry', 'Expiry date of the latest quote.', 'Latest quote', '12 July 2026'),
];

export const invoicePlaceholders: CorrespondencePlaceholder[] = [
  placeholder('client_name', 'Client name', 'Project client name.', 'Client', 'Alex Morgan'),
  placeholder('client_email', 'Client email', 'Project client email address.', 'Client', 'alex@example.com'),
  placeholder('business_name', 'Business name', 'Configured invoice business name.', 'Business', 'Carter Digital Solutions'),
  placeholder('invoice_address', 'Invoice address', 'Configured business invoice address.', 'Business', '1 Example Street, London'),
  placeholder('payment_details', 'Payment details', 'Configured payment instructions.', 'Business', 'Account ending 1234'),
  placeholder('project_name', 'Project name', 'Name of the related project.', 'Project', 'Consultancy website'),
  placeholder('project_stage', 'Project stage', 'Current delivery stage.', 'Project', 'active'),
  placeholder('project_value', 'Project value', 'Current total project value.', 'Project', '£1,250.00'),
  placeholder('project_due_date', 'Project due date', 'Current project delivery due date.', 'Project', '31 July 2026'),
  placeholder('invoice_reference', 'Invoice reference', 'Unique invoice reference.', 'Invoice', 'INV-004'),
  placeholder('invoice_type', 'Invoice type', 'Deposit, interim, final, consultation, or other.', 'Invoice', 'deposit'),
  placeholder('invoice_status', 'Invoice status', 'Current invoice status.', 'Invoice', 'draft'),
  placeholder('invoice_subtotal', 'Invoice subtotal', 'Invoice value before tax.', 'Invoice', '£250.00'),
  placeholder('invoice_tax_rate', 'Invoice tax rate', 'Tax percentage applied to the invoice.', 'Invoice', '20%'),
  placeholder('invoice_tax_amount', 'Invoice tax', 'Tax amount applied to the invoice.', 'Invoice', '£50.00'),
  placeholder('invoice_total', 'Invoice total', 'Total invoice value including tax.', 'Invoice', '£300.00'),
  placeholder('invoice_issue_date', 'Invoice issue date', 'Date the invoice was issued.', 'Invoice', '28 June 2026'),
  placeholder('invoice_due_date', 'Invoice due date', 'Date payment is due.', 'Invoice', '12 July 2026'),
  placeholder('invoice_notes', 'Invoice notes', 'Notes recorded against the invoice.', 'Invoice', 'Deposit for approved website quote'),
];

export function enquiryPlaceholderValues(enquiry: AdminEnquiry): Record<string, string> {
  const latestQuote = enquiry.quote_versions[enquiry.quote_versions.length - 1];
  const quoteItems = latestQuote?.items.length ? latestQuote.items : enquiry.quote_items;
  return {
    name: enquiry.name,
    first_name: enquiry.name.trim().split(/\s+/)[0] || enquiry.name,
    email: enquiry.email,
    business_name: 'Carter Digital Solutions',
    today: formatDate(new Date().toISOString(), 'date'),
    project_type: enquiry.project_type || 'your project',
    enquiry_type: enquiry.type,
    reference: enquiry.id,
    enquiry_message: enquiry.message || 'Not provided',
    received_date: formatDate(enquiry.created_at, 'dateTime'),
    status: enquiry.status,
    priority: enquiry.priority,
    follow_up_date: enquiry.follow_up_at ? formatDate(enquiry.follow_up_at, 'dateTime') : 'Not scheduled',
    labels: enquiry.labels.length ? enquiry.labels.join(', ') : 'None',
    estimated_hours: String(enquiry.estimated_hours || 0),
    estimated_cost: formatMoney(enquiry.estimated_cost),
    quote_version: latestQuote ? String(latestQuote.version) : 'Not available',
    quote_status: latestQuote?.status ?? 'Not available',
    quote_items: quoteItems.length ? quoteItems.map((item) => item.service).filter(Boolean).join(', ') : 'Not available',
    quote_subtotal: formatMoney(latestQuote?.subtotal ?? 0),
    quote_discount: formatMoney(latestQuote?.discount ?? 0),
    quote_expenses: formatMoney(latestQuote?.expenses ?? 0),
    quote_tax: formatMoney(latestQuote?.tax_amount ?? 0),
    quote_total: formatMoney(latestQuote?.total ?? 0),
    quote_deposit: formatMoney(latestQuote?.deposit ?? 0),
    quote_valid_until: latestQuote?.valid_until ? formatDate(latestQuote.valid_until, 'date') : 'Not specified',
  };
}

export function resolveCorrespondence(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.split(`{{${key}}}`).join(replacement),
    value,
  );
}

function placeholder(key: string, label: string, description: string, group: string, sample: string): CorrespondencePlaceholder {
  return { key, label, description, group, sample };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatDate(value: string, style: 'date' | 'dateTime') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', style === 'date' ? { dateStyle: 'long' } : { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

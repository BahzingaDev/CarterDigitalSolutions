import { BriefcaseBusiness, CirclePlus, Link2, Mail, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AdminEnquiry, AdminQuoteItem, AdminQuotePayload, AdminQuoteVersion } from '../../src/api/admin';
import { fetchCommercialSettings } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';
import { fetchServiceCatalogue, mergeServiceCatalogue } from '../../src/api/services';

export function AdminQuoteManager({ enquiry, onConvert, onCreate, onPrepareEmail, onShare, onStatus, onUpdate }: {
  enquiry: AdminEnquiry;
  onCreate: (payload: AdminQuotePayload) => Promise<void>;
  onUpdate: (quoteId: string, payload: AdminQuotePayload) => Promise<void>;
  onConvert: (quote: AdminQuoteVersion) => Promise<void>;
  onPrepareEmail: (quote: AdminQuoteVersion, approvalUrl: string) => void;
  onShare: (quoteId: string) => Promise<string>;
  onStatus: (quoteId: string, status: AdminQuoteVersion['status']) => Promise<void>;
}) {
  const latest = enquiry.quote_versions[enquiry.quote_versions.length - 1];
  const initialItems = latest?.items.length ? latest.items : enquiry.quote_items;
  const [items, setItems] = useState<AdminQuoteItem[]>(initialItems.length ? initialItems : [{ service: '', category: '', hours: 1, rate: 16.5 }]);
  const [discount, setDiscount] = useState(latest?.discount ?? 0);
  const [manualDeposit, setManualDeposit] = useState(latest?.deposit ?? 0);
  const [expenses, setExpenses] = useState(latest?.expenses ?? 0);
  const [taxRate, setTaxRate] = useState(latest?.tax_rate ?? 0);
  const [notes, setNotes] = useState(latest?.notes ?? '');
  const [validUntil, setValidUntil] = useState(latest?.valid_until?.slice(0, 10) ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [catalogueServices, setCatalogueServices] = useState<{ name: string; category: string; hours: number; rate: number; deposit: number }[]>([]);

  useEffect(() => {
    void fetchServiceCatalogue().then((catalogue) => {
      const categories = mergeServiceCatalogue(catalogue.services, catalogue.categories, catalogue.unavailable_slugs);
      setCatalogueServices(categories.flatMap((audience) =>
        audience.groups.flatMap((group) =>
          group.services.map((service) => ({
            name: service.name,
            category: group.subcategory,
            hours: service.estimatedHours,
            rate: service.hourlyRate ?? 0,
            deposit: service.depositAmount ?? 0,
          })),
        ),
      ));
    });
  }, []);
  useEffect(() => { void fetchCommercialSettings().then((settings) => setTaxRate(settings.tax_rate)); }, []);
  useEffect(() => {
    if (!catalogueServices.length) return;
    setItems((current) => current.map((item) => {
      const service = catalogueServices.find((candidate) => candidate.name === item.service);
      return service ? { ...item, deposit_amount: service.deposit } : item;
    }));
  }, [catalogueServices]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (!item.optional || item.included ? Number(item.hours || 0) * Number(item.rate || 0) : 0), 0), [items]);
  const taxable = Math.max(0, subtotal - Number(discount || 0) + Number(expenses || 0));
  const total = taxable + taxable * Number(taxRate || 0) / 100;
  const automaticDepositSubtotal = items.reduce((sum, item) => sum + (!item.optional || item.included ? Number(item.deposit_amount || 0) : 0), 0);
  const hasAutomaticDeposit = automaticDepositSubtotal > 0;
  const deposit = hasAutomaticDeposit
    ? Math.min(total, Number((automaticDepositSubtotal * (1 + Number(taxRate || 0) / 100)).toFixed(2)))
    : Number(manualDeposit || 0);

  const updateItem = (index: number, patch: Partial<AdminQuoteItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeItem = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const saveVersion = async () => {
    setIsSaving(true);
    try {
      await onCreate({ items, discount: Number(discount), expenses: Number(expenses), tax_rate: Number(taxRate), deposit: Number(deposit), notes, valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null });
    } finally { setIsSaving(false); }
  };
  const payload = (): AdminQuotePayload => ({ items, discount: Number(discount), expenses: Number(expenses), tax_rate: Number(taxRate), deposit: Number(deposit), notes, valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null });

  return (
    <div className="admin-workflow-stack">
      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Create quote version</h3><p>Saving creates a new immutable version.</p></div><span>{formatCurrency(total)}</span></div>
        <div className="admin-quote-editor-items">
          {items.map((item, index) => (
            <div className="admin-quote-editor-row" key={index}>
              <input aria-label="Service" className="form-control" list={`quote-service-options-${index}`} onChange={(event) => { const selected = catalogueServices.find((service) => service.name === event.target.value); updateItem(index, selected ? { service: selected.name, category: selected.category, hours: selected.hours, rate: selected.rate, deposit_amount: selected.deposit } : { service: event.target.value, deposit_amount: 0 }); }} placeholder="Search or enter service" value={item.service} />
              <datalist id={`quote-service-options-${index}`}>{catalogueServices.map((service) => <option key={`${service.category}-${service.name}`} value={service.name}>{service.category}</option>)}</datalist>
              <input aria-label="Category" className="form-control" onChange={(event) => updateItem(index, { category: event.target.value })} placeholder="Category" value={item.category} />
              <input aria-label="Hours" className="form-control" min="0.25" onChange={(event) => updateItem(index, { hours: Number(event.target.value) })} step="0.25" type="number" value={item.hours} />
              <input aria-label="Hourly rate" className="form-control" min="0.01" onChange={(event) => updateItem(index, { rate: Number(event.target.value) })} step="0.01" type="number" value={item.rate} />
              <label className="admin-quote-option"><input checked={item.optional ?? false} onChange={(event) => updateItem(index, { optional: event.target.checked, included: event.target.checked ? false : true })} type="checkbox" /> Optional</label>
              {item.optional ? <label className="admin-quote-option"><input checked={item.included ?? false} onChange={(event) => updateItem(index, { included: event.target.checked })} type="checkbox" /> Include</label> : <span />}
              <button className="admin-icon-button" disabled={items.length === 1} onClick={() => removeItem(index)} title="Remove item" type="button"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-link admin-inline-action" onClick={() => setItems((current) => [...current, { service: '', category: '', hours: 1, rate: 16.5 }])} type="button"><CirclePlus size={16} /> Add item</button>
        <div className="admin-quote-terms-grid">
          <label>Discount (£)<input className="form-control" min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label>
          <label>Deposit including tax (£)<input className="form-control" min="0" onChange={(event) => setManualDeposit(Number(event.target.value))} readOnly={hasAutomaticDeposit} step="0.01" type="number" value={deposit} /><small>{hasAutomaticDeposit ? `Automatically calculated from selected services (${formatCurrency(automaticDepositSubtotal)} before tax).` : 'Set manually because the selected items have no configured deposit.'}</small></label>
          <label>Expenses (£)<input className="form-control" min="0" onChange={(event) => setExpenses(Number(event.target.value))} step="0.01" type="number" value={expenses} /></label>
          <label>Tax rate (global)<input className="form-control" readOnly value={`${taxRate}%`} /></label>
          <label>Valid until<input className="form-control" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></label>
        </div>
        <label className="form-label">Quote notes<textarea className="form-control" maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} /></label>
        <div className="admin-quote-summary"><span>Subtotal <strong>{formatCurrency(subtotal)}</strong></span><span>Expenses <strong>{formatCurrency(expenses)}</strong></span><span>Tax <strong>{formatCurrency(taxable * taxRate / 100)}</strong></span><span>Total <strong>{formatCurrency(total)}</strong></span><span>Deposit <strong>{formatCurrency(deposit)}</strong></span></div>
        <div className="admin-management-actions">{latest?.status === 'draft' ? <button className="btn btn-accent" disabled={isSaving} onClick={() => void onUpdate(latest.id, payload())} type="button">Save draft</button> : <button className="btn btn-accent" disabled={isSaving} onClick={() => void saveVersion()} type="button">{isSaving ? 'Saving...' : latest ? 'Create new version' : 'Create draft quote'}</button>}</div>
      </section>

      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Quote history</h3><p>{enquiry.quote_versions.length} saved version{enquiry.quote_versions.length === 1 ? '' : 's'}</p></div></div>
        {[...enquiry.quote_versions].reverse().map((quote) => (
          <article className="admin-quote-version" key={quote.id}>
            <div><strong>Version {quote.version}</strong><small>{formatDate(quote.created_at)} · {formatCurrency(quote.total)}</small></div>
            <span className={`admin-status admin-quote-${quote.status}`}>{quote.status}</span>
            <div className="admin-quote-actions"><button className="admin-icon-button" onClick={() => void onShare(quote.id).then((url) => { setShareLinks((current) => ({ ...current, [quote.id]: url })); onPrepareEmail(quote, url); })} title="Email approval link" type="button"><Mail size={16} /></button><button className="admin-icon-button" onClick={() => void onShare(quote.id).then((url) => { setShareLinks((current) => ({ ...current, [quote.id]: url })); void navigator.clipboard.writeText(url); })} title="Create and copy approval link" type="button"><Link2 size={16} /></button>{shareLinks[quote.id] ? <button className="admin-icon-button" onClick={() => window.open(shareLinks[quote.id], '_blank', 'noopener,noreferrer')} title="Open printable quote" type="button"><Printer size={16} /></button> : null}<button className="admin-icon-button" disabled={quote.status !== 'accepted' || Boolean(quote.converted_project_id)} onClick={() => void onConvert(quote)} title={quote.converted_project_id ? 'Project workspace created' : quote.status === 'accepted' ? 'Convert quote to project' : 'Accept the quote before creating its project'} type="button"><BriefcaseBusiness size={16} /></button></div>
            {quote.id === latest?.id ? <QuoteStageActions onConvert={onConvert} onPrepareEmail={onPrepareEmail} onShare={onShare} onStatus={onStatus} quote={quote} /> : <small className="admin-version-locked">Previous version · read only</small>}
            <DepositInvoiceWorkflow onCreateProject={() => onConvert(quote)} quote={quote} />
          </article>
        ))}
        {enquiry.quote_versions.length === 0 ? <p className="admin-empty">No formal quote versions yet.</p> : null}
      </section>
    </div>
  );
}

function QuoteStageActions({ onConvert, onPrepareEmail, onShare, onStatus, quote }: { quote: AdminQuoteVersion; onConvert: (quote: AdminQuoteVersion) => Promise<void>; onPrepareEmail: (quote: AdminQuoteVersion, url: string) => void; onShare: (quoteId: string) => Promise<string>; onStatus: (quoteId: string, status: AdminQuoteVersion['status']) => Promise<void> }) {
  if (quote.converted_project_id) return <div className="admin-quote-next"><strong>Project created</strong><small>Continue this work from the project workspace.</small></div>;
  if (quote.status === 'accepted') return <button className="btn btn-accent btn-sm" onClick={() => void onConvert(quote)} type="button"><BriefcaseBusiness size={15} /> Create project</button>;
  if (quote.status === 'draft') return <div className="admin-quote-next"><button className="btn btn-accent btn-sm" onClick={() => void onShare(quote.id).then((url) => onPrepareEmail(quote, url))} type="button"><Mail size={15} /> Prepare approval email</button></div>;
  if (quote.status === 'sent') return <div className="admin-quote-next"><strong>Awaiting customer approval</strong><span><button className="btn btn-link btn-sm" onClick={() => void onStatus(quote.id, 'accepted')} type="button">Record acceptance</button><button className="btn btn-link btn-sm" onClick={() => void onStatus(quote.id, 'declined')} type="button">Record decline</button></span></div>;
  return <button className="btn btn-outline-accent btn-sm" onClick={() => void onStatus(quote.id, 'draft')} type="button">Reopen as draft</button>;
}

function DepositInvoiceWorkflow({ onCreateProject, quote }: { onCreateProject: () => Promise<void>; quote: AdminQuoteVersion }) {
  if (quote.status !== 'accepted' || quote.deposit <= 0) return null;
  const status = quote.deposit_invoice_status ?? 'pending';
  const services = quote.items.filter((item) => !item.optional || item.included).map((item) => item.service).join(', ');
  return (
    <div className={`admin-deposit-workflow is-${status}`}>
      <span className="admin-deposit-icon"><ReceiptText size={18} /></span>
      <div><strong>Deposit invoice · {formatCurrency(quote.deposit)}</strong><small>{services}</small></div>
      <span className={`admin-status admin-invoice-${status}`}>{status.replace('_', ' ')}</span>
      <small>{quote.converted_project_id ? 'Manage and send this invoice from the project workspace.' : 'Create the project workspace to issue the PDF invoice.'}</small>
      {!quote.converted_project_id ? <button className="btn btn-accent btn-sm" onClick={() => void onCreateProject()} type="button">Create project & invoice</button> : null}
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }

import { BriefcaseBusiness, CirclePlus, Link2, Mail, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AdminEnquiry, AdminQuoteItem, AdminQuoteVersion } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

export function AdminQuoteManager({ enquiry, onConvert, onCreate, onPrepareEmail, onShare, onStatus }: {
  enquiry: AdminEnquiry;
  onCreate: (payload: { items: AdminQuoteItem[]; discount: number; deposit: number; notes: string; valid_until: string | null }) => Promise<void>;
  onConvert: (quote: AdminQuoteVersion) => Promise<void>;
  onPrepareEmail: (quote: AdminQuoteVersion) => void;
  onShare: (quoteId: string) => Promise<string>;
  onStatus: (quoteId: string, status: AdminQuoteVersion['status']) => Promise<void>;
}) {
  const latest = enquiry.quote_versions[enquiry.quote_versions.length - 1];
  const initialItems = latest?.items.length ? latest.items : enquiry.quote_items;
  const [items, setItems] = useState<AdminQuoteItem[]>(initialItems.length ? initialItems : [{ service: '', category: '', hours: 1, rate: 16.5 }]);
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.hours || 0) * Number(item.rate || 0), 0), [items]);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const updateItem = (index: number, patch: Partial<AdminQuoteItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const saveVersion = async () => {
    setIsSaving(true);
    try {
      await onCreate({ items, discount: Number(discount), deposit: Number(deposit), notes, valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="admin-workflow-stack">
      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Create quote version</h3><p>Saving creates a new immutable version.</p></div><span>{formatCurrency(total)}</span></div>
        <div className="admin-quote-editor-items">
          {items.map((item, index) => (
            <div className="admin-quote-editor-row" key={index}>
              <input aria-label="Service" className="form-control" onChange={(event) => updateItem(index, { service: event.target.value })} placeholder="Service" value={item.service} />
              <input aria-label="Category" className="form-control" onChange={(event) => updateItem(index, { category: event.target.value })} placeholder="Category" value={item.category} />
              <input aria-label="Hours" className="form-control" min="0.25" onChange={(event) => updateItem(index, { hours: Number(event.target.value) })} step="0.25" type="number" value={item.hours} />
              <input aria-label="Hourly rate" className="form-control" min="0.01" onChange={(event) => updateItem(index, { rate: Number(event.target.value) })} step="0.01" type="number" value={item.rate} />
              <button className="admin-icon-button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="Remove item" type="button"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn-link admin-inline-action" onClick={() => setItems((current) => [...current, { service: '', category: '', hours: 1, rate: 16.5 }])} type="button"><CirclePlus size={16} /> Add item</button>
        <div className="admin-quote-terms-grid">
          <label>Discount (£)<input className="form-control" min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label>
          <label>Deposit (£)<input className="form-control" min="0" onChange={(event) => setDeposit(Number(event.target.value))} step="0.01" type="number" value={deposit} /></label>
          <label>Valid until<input className="form-control" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></label>
        </div>
        <label className="form-label">Quote notes<textarea className="form-control" maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} /></label>
        <div className="admin-quote-summary"><span>Subtotal <strong>{formatCurrency(subtotal)}</strong></span><span>Total <strong>{formatCurrency(total)}</strong></span></div>
        <button className="btn btn-accent" disabled={isSaving} onClick={() => void saveVersion()} type="button">{isSaving ? 'Saving...' : 'Save new version'}</button>
      </section>

      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Quote history</h3><p>{enquiry.quote_versions.length} saved version{enquiry.quote_versions.length === 1 ? '' : 's'}</p></div></div>
        {[...enquiry.quote_versions].reverse().map((quote) => (
          <article className="admin-quote-version" key={quote.id}>
            <div><strong>Version {quote.version}</strong><small>{formatDate(quote.created_at)} · {formatCurrency(quote.total)}</small></div>
            <select aria-label={`Version ${quote.version} status`} className="form-select" onChange={(event) => void onStatus(quote.id, event.target.value as AdminQuoteVersion['status'])} value={quote.status}>
              <option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option>
            </select>
            <div className="admin-quote-actions"><button className="admin-icon-button" onClick={() => onPrepareEmail(quote)} title="Email quote" type="button"><Mail size={16} /></button><button className="admin-icon-button" onClick={() => void onShare(quote.id).then((url) => { setShareLinks((current) => ({ ...current, [quote.id]: url })); void navigator.clipboard.writeText(url); })} title="Create and copy approval link" type="button"><Link2 size={16} /></button>{shareLinks[quote.id] ? <button className="admin-icon-button" onClick={() => window.open(shareLinks[quote.id], '_blank', 'noopener,noreferrer')} title="Open printable quote" type="button"><Printer size={16} /></button> : null}<button className="admin-icon-button" onClick={() => void onConvert(quote)} title="Convert quote to project" type="button"><BriefcaseBusiness size={16} /></button></div>
          </article>
        ))}
        {enquiry.quote_versions.length === 0 ? <p className="admin-empty">No formal quote versions yet.</p> : null}
      </section>
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }

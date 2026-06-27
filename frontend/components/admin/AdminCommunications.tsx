import { RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchAdminTemplates, type AdminEnquiry, type AdminTemplate } from '../../src/api/admin';

export interface CommunicationDraft { subject: string; message: string; quoteId?: string; }

export function AdminCommunications({ enquiry, draft, onSend }: { enquiry: AdminEnquiry; draft?: CommunicationDraft; onSend: (subject: string, message: string, quoteId?: string) => Promise<void> }) {
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [message, setMessage] = useState(draft?.message ?? '');
  const [quoteId, setQuoteId] = useState(draft?.quoteId);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);

  useEffect(() => { if (draft) { setSubject(draft.subject); setMessage(draft.message); setQuoteId(draft.quoteId); } }, [draft]);
  useEffect(() => { void fetchAdminTemplates().then(setTemplates); }, []);

  const send = async () => {
    setIsSending(true);
    try { await onSend(subject, message, quoteId); setSubject(''); setMessage(''); setQuoteId(undefined); } finally { setIsSending(false); }
  };

  return (
    <div className="admin-workflow-stack">
      <section className="admin-subpanel admin-compose-panel">
        <div className="admin-subpanel-heading"><div><h3>Send email</h3><p>To {enquiry.name} at {enquiry.email}</p></div></div>
        <label>Template<select className="form-select" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); setSubject(applyTemplate(template?.subject ?? '', enquiry)); setMessage(applyTemplate(template?.body ?? '', enquiry)); setQuoteId(undefined); }}><option value="">Blank message</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <label>Subject<input className="form-control" maxLength={180} onChange={(event) => setSubject(event.target.value)} value={subject} /></label>
        <label>Message<textarea className="form-control" maxLength={5000} onChange={(event) => setMessage(event.target.value)} rows={8} value={message} /></label>
        <button className="btn btn-accent" disabled={isSending || !subject.trim() || !message.trim()} onClick={() => void send()} type="button"><Send size={16} /> {isSending ? 'Sending...' : 'Send email'}</button>
      </section>

      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Communication history</h3><p>Delivery attempts recorded for this enquiry.</p></div></div>
        <div className="admin-communication-list">
          {[...enquiry.communications].reverse().map((item) => <article key={item.id}><span className={`admin-delivery admin-delivery-${item.status}`}>{item.status}</span><div><strong>{item.subject}</strong><p>{item.message}</p><small>{formatDate(item.sent_at)} by {item.sent_by}</small>{(item.delivery_events ?? []).length > 0 ? <div className="admin-delivery-events">{[...(item.delivery_events ?? [])].reverse().map((event) => <small key={event.id}>{event.type.replace('email.', '')} · {formatDate(event.created_at)}</small>)}</div> : null}<button className="btn btn-link admin-reuse-message" onClick={() => { setSubject(item.subject); setMessage(item.message); setQuoteId(undefined); }} type="button"><RotateCcw size={14} /> Use again</button></div></article>)}
          {enquiry.communications.length === 0 ? <p className="admin-empty">No messages have been sent from the dashboard.</p> : null}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function applyTemplate(value: string, enquiry: AdminEnquiry) {
  const latestQuote = enquiry.quote_versions?.[enquiry.quote_versions.length - 1];
  const replacements: Record<string, string> = {
    name: enquiry.name, email: enquiry.email, project_type: enquiry.project_type || 'your project',
    enquiry_type: enquiry.type, reference: enquiry.id,
    received_date: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(enquiry.created_at)),
    estimated_hours: String(enquiry.estimated_hours || 0), estimated_cost: formatMoney(enquiry.estimated_cost),
    quote_total: formatMoney(latestQuote?.total ?? 0), quote_deposit: formatMoney(latestQuote?.deposit ?? 0),
  };
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.split(`{{${key}}}`).join(replacement), value);
}
function formatMoney(value: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value); }

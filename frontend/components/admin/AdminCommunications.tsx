import { RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchAdminTemplates, fetchCommunicationSettings, type AdminEnquiry, type AdminTemplate } from '../../src/api/admin';
import { enquiryPlaceholderValues, enquiryPlaceholders, resolveCorrespondence } from '../../src/data/correspondencePlaceholders';
import { PlaceholderReference, PlaceholderSelect } from './AdminPlaceholderReference';
import { AdminRichTextEditor, normaliseRichText } from './AdminRichTextEditor';

export interface CommunicationDraft { subject: string; message: string; quoteId?: string; }

export function AdminCommunications({ enquiry, draft, onSend }: { enquiry: AdminEnquiry; draft?: CommunicationDraft; onSend: (subject: string, message: string, quoteId?: string, scheduledAt?: string) => Promise<void> }) {
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [message, setMessage] = useState(draft?.message ?? '');
  const [quoteId, setQuoteId] = useState(draft?.quoteId);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [signature, setSignature] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (draft) { setSubject(draft.subject); setMessage(draft.message); setQuoteId(draft.quoteId); } }, [draft]);
  useEffect(() => { void fetchAdminTemplates().then(setTemplates).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load email templates')); }, []);
  useEffect(() => { void fetchCommunicationSettings().then((settings) => setSignature(settings.signature)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the email signature')); }, []);

  const send = async () => {
    setIsSending(true); setError('');
    try { const replacements = enquiryPlaceholderValues(enquiry); const cleanSubject = resolveCorrespondence(subject, replacements).trim(); const cleanMessage = resolveCorrespondence(message, replacements).trim(); const cleanSignature = resolveCorrespondence(signature, replacements).trim(); const finalMessage = cleanSignature && !cleanMessage.endsWith(cleanSignature) ? `${cleanMessage}\n\n${cleanSignature}` : cleanMessage; await onSend(cleanSubject, finalMessage, quoteId, scheduledAt ? new Date(scheduledAt).toISOString() : undefined); setSubject(''); setMessage(''); setQuoteId(undefined); setScheduledAt(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to process the email'); }
    finally { setIsSending(false); }
  };

  return (
    <div className="admin-workflow-stack">
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      <section className="admin-subpanel admin-compose-panel">
        <div className="admin-subpanel-heading"><div><h3>Send email</h3><p>To {enquiry.name} at {enquiry.email}</p></div></div>
        <label>Template<select className="form-select" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); const replacements = enquiryPlaceholderValues(enquiry); setSubject(resolveCorrespondence(template?.subject ?? '', replacements)); setMessage(resolveCorrespondence(template?.body ?? '', replacements)); setQuoteId(undefined); }}><option value="">Blank message</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <div className="admin-template-field"><label>Subject<input className="form-control" maxLength={180} onChange={(event) => setSubject(event.target.value)} value={subject} /></label><PlaceholderSelect definitions={enquiryPlaceholders} label="Insert subject placeholder" onInsert={(key) => setSubject((current) => `${current}{{${key}}}`)} /></div>
        <div className="admin-template-field"><AdminRichTextEditor label="Message" onChange={setMessage} value={message} /><PlaceholderSelect definitions={enquiryPlaceholders} label="Insert message placeholder" onInsert={(key) => setMessage((current) => `${current}{{${key}}}`)} /></div>
        <PlaceholderReference definitions={enquiryPlaceholders} title="Correspondence placeholder reference" />
        {signature ? <div className="admin-signature-preview" dangerouslySetInnerHTML={{ __html: normaliseRichText(signature) }} /> : null}
        <label>Schedule for later<input className="form-control" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} /></label>
        <button className="btn btn-accent" disabled={isSending || !subject.trim() || !message.trim()} onClick={() => void send()} type="button"><Send size={16} /> {isSending ? 'Processing...' : scheduledAt ? 'Schedule email' : 'Send email'}</button>
      </section>

      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Communication history</h3><p>Delivery attempts recorded for this enquiry.</p></div></div>
        <div className="admin-communication-list">
          {[...enquiry.communications].reverse().map((item) => <article className={item.direction === 'incoming' ? 'admin-message-incoming' : undefined} key={item.id}><span className={`admin-delivery admin-delivery-${item.status}`}>{item.direction === 'incoming' ? 'reply' : item.status}</span><div><strong>{item.subject}</strong><div className="admin-rich-message" dangerouslySetInnerHTML={{ __html: normaliseRichText(item.message) }} /><small>{formatDate(item.sent_at)} {item.direction === 'incoming' ? 'from' : 'by'} {item.sent_by}</small>{(item.delivery_events ?? []).length > 0 ? <div className="admin-delivery-events">{[...(item.delivery_events ?? [])].reverse().map((event) => <small key={event.id}>{event.type.replace('email.', '')} · {formatDate(event.created_at)}</small>)}</div> : null}<button className="btn btn-link admin-reuse-message" onClick={() => { setSubject(item.direction === 'incoming' ? `Re: ${item.subject.replace(/^Re:\s*/i, '')}` : item.subject); setMessage(item.direction === 'incoming' ? '' : item.message); setQuoteId(undefined); }} type="button"><RotateCcw size={14} /> {item.direction === 'incoming' ? 'Reply' : 'Use again'}</button></div></article>)}
          {enquiry.communications.length === 0 ? <p className="admin-empty">No communication history yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

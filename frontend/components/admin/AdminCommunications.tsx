import { RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AdminEnquiry } from '../../src/api/admin';

const templates = {
  blank: { label: 'Blank message', subject: '', message: '' },
  follow_up: { label: 'Project follow-up', subject: 'Following up on your enquiry', message: 'I wanted to follow up on your recent enquiry and see whether you would like to discuss the next steps.' },
  clarification: { label: 'Scope clarification', subject: 'A few details about your project', message: 'Thank you for your enquiry. Before I prepare the next steps, I would like to clarify a few details about the scope, intended users, and preferred timeline.' },
  availability: { label: 'Availability update', subject: 'Project availability update', message: 'Thank you for getting in touch. I have reviewed your request and would be happy to discuss availability and a suitable start date.' },
};

export interface CommunicationDraft { subject: string; message: string; quoteId?: string; }

export function AdminCommunications({ enquiry, draft, onSend }: { enquiry: AdminEnquiry; draft?: CommunicationDraft; onSend: (subject: string, message: string, quoteId?: string) => Promise<void> }) {
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [message, setMessage] = useState(draft?.message ?? '');
  const [quoteId, setQuoteId] = useState(draft?.quoteId);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => { if (draft) { setSubject(draft.subject); setMessage(draft.message); setQuoteId(draft.quoteId); } }, [draft]);

  const send = async () => {
    setIsSending(true);
    try { await onSend(subject, message, quoteId); setSubject(''); setMessage(''); setQuoteId(undefined); } finally { setIsSending(false); }
  };

  return (
    <div className="admin-workflow-stack">
      <section className="admin-subpanel admin-compose-panel">
        <div className="admin-subpanel-heading"><div><h3>Send email</h3><p>To {enquiry.name} at {enquiry.email}</p></div></div>
        <label>Template<select className="form-select" onChange={(event) => { const template = templates[event.target.value as keyof typeof templates]; setSubject(template.subject); setMessage(template.message); setQuoteId(undefined); }}><option value="blank">Blank message</option><option value="follow_up">Project follow-up</option><option value="clarification">Scope clarification</option><option value="availability">Availability update</option></select></label>
        <label>Subject<input className="form-control" maxLength={180} onChange={(event) => setSubject(event.target.value)} value={subject} /></label>
        <label>Message<textarea className="form-control" maxLength={5000} onChange={(event) => setMessage(event.target.value)} rows={8} value={message} /></label>
        <button className="btn btn-accent" disabled={isSending || !subject.trim() || !message.trim()} onClick={() => void send()} type="button"><Send size={16} /> {isSending ? 'Sending...' : 'Send email'}</button>
      </section>

      <section className="admin-subpanel">
        <div className="admin-subpanel-heading"><div><h3>Communication history</h3><p>Delivery attempts recorded for this enquiry.</p></div></div>
        <div className="admin-communication-list">
          {[...enquiry.communications].reverse().map((item) => <article key={item.id}><span className={`admin-delivery admin-delivery-${item.status}`}>{item.status}</span><div><strong>{item.subject}</strong><p>{item.message}</p><small>{formatDate(item.sent_at)} by {item.sent_by}</small><button className="btn btn-link admin-reuse-message" onClick={() => { setSubject(item.subject); setMessage(item.message); setQuoteId(undefined); }} type="button"><RotateCcw size={14} /> Use again</button></div></article>)}
          {enquiry.communications.length === 0 ? <p className="admin-empty">No messages have been sent from the dashboard.</p> : null}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

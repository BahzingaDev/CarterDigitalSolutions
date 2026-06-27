import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';

import type { AdminQuoteVersion } from '../src/api/admin';
import { formatCurrency } from '../src/data/pricing';

interface PublicQuote { customer_name: string; project_type: string; quote: AdminQuoteVersion & { accepted_at?: string; accepted_by?: string }; }

export function QuoteReviewPage() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const quoteId = params.get('quote') ?? '';
  const token = params.get('token') ?? '';
  const [data, setData] = useState<PublicQuote | null>(null);
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { void fetch(`/api/quotes/${encodeURIComponent(quoteId)}`, { headers: { 'X-Quote-Token': token } }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to load quote'); setData(body); setName(body.customer_name ?? ''); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load quote')); }, [quoteId, token]);

  const approve = async (event: FormEvent) => { event.preventDefault(); setError(''); try { const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to approve quote'); setData(body); } catch (approvalError) { setError(approvalError instanceof Error ? approvalError.message : 'Unable to approve quote'); } };

  if (error && !data) return <section className="quote-review-state"><h1>Quote unavailable</h1><p>{error}</p></section>;
  if (!data) return <section className="quote-review-state"><span className="spinner-border" /><p>Loading quote...</p></section>;
  const quote = data.quote;

  return <main className="quote-review-page"><header className="quote-review-header"><p className="admin-brand">CARTER<br />DIGITAL SOLUTIONS</p><button className="btn btn-outline-accent no-print" onClick={() => window.print()} type="button"><Printer size={16} /> Print / PDF</button></header><section className="quote-review-title"><p>QUOTE · VERSION {quote.version}</p><h1>{data.project_type || 'Project services'}</h1><span className={`admin-status admin-status-${quote.status === 'accepted' ? 'replied' : 'reviewed'}`}>{quote.status}</span></section><dl className="quote-review-meta"><div><dt>Prepared for</dt><dd>{data.customer_name}</dd></div><div><dt>Created</dt><dd>{formatDate(quote.created_at)}</dd></div><div><dt>Valid until</dt><dd>{quote.valid_until ? formatDate(quote.valid_until) : 'Open'}</dd></div></dl><table className="quote-review-table"><thead><tr><th>Service</th><th>Hours</th><th>Rate</th><th>Total</th></tr></thead><tbody>{quote.items.map((item, index) => <tr key={index}><td><strong>{item.service}</strong><small>{item.category}</small></td><td>{item.hours}</td><td>{formatCurrency(item.rate)}</td><td>{formatCurrency(item.hours * item.rate)}</td></tr>)}</tbody></table><section className="quote-review-totals"><span>Subtotal <strong>{formatCurrency(quote.subtotal)}</strong></span><span>Discount <strong>−{formatCurrency(quote.discount)}</strong></span><span className="is-total">Total <strong>{formatCurrency(quote.total)}</strong></span><span>Deposit <strong>{formatCurrency(quote.deposit)}</strong></span></section>{quote.notes ? <section className="quote-review-notes"><h2>Notes</h2><p>{quote.notes}</p></section> : null}{quote.status === 'accepted' ? <section className="quote-approved"><CheckCircle2 size={24} /><div><h2>Quote approved</h2><p>Approved by {quote.accepted_by} on {quote.accepted_at ? formatDate(quote.accepted_at) : 'recorded date'}.</p></div></section> : <form className="quote-approval no-print" onSubmit={approve}><h2>Approve this quote</h2><p>Approval confirms that the outlined scope and estimate can proceed to final project agreement.</p>{error ? <div className="alert alert-danger">{error}</div> : null}<label>Your name<input className="form-control" maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label><label className="quote-confirm"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required type="checkbox" /> I have reviewed and approve this quote.</label><button className="btn btn-accent" disabled={!confirmed} type="submit">Approve quote</button></form>}</main>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(value)); }

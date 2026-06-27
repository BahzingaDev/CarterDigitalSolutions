import { ArrowRight, CalendarClock, Clock3, Inbox, PoundSterling, ReceiptText } from 'lucide-react';

import type { AdminEnquiry, AdminView } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

export function AdminOverview({
  enquiries,
  onNavigate,
  onSelect,
}: {
  enquiries: AdminEnquiry[];
  onNavigate: (view: AdminView) => void;
  onSelect: (id: string) => void;
}) {
  const activeEnquiries = enquiries.filter((enquiry) => !enquiry.archived);
  const newCount = activeEnquiries.filter((enquiry) => enquiry.status === 'new').length;
  const followUpsDue = activeEnquiries.filter((enquiry) => enquiry.follow_up_at && new Date(enquiry.follow_up_at) <= new Date() && enquiry.status !== 'closed').length;
  const quoteRequests = activeEnquiries.filter((enquiry) => enquiry.type === 'quote');
  const pipelineValue = quoteRequests
    .filter((enquiry) => enquiry.status !== 'closed')
    .reduce((total, enquiry) => total + enquiry.estimated_cost, 0);
  const now = Date.now();
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
  const expiringQuotes = activeEnquiries.filter((enquiry) => {
    const quote = enquiry.quote_versions[enquiry.quote_versions.length - 1];
    if (!quote?.valid_until || !['draft', 'sent'].includes(quote.status)) return false;
    const expiry = new Date(quote.valid_until).getTime();
    return expiry >= now && expiry <= sevenDays;
  }).length;
  const depositInvoiceActions = activeEnquiries.flatMap((enquiry) => enquiry.quote_versions
    .filter((quote) => quote.status === 'accepted' && quote.deposit > 0 && (quote.deposit_invoice_status ?? 'pending') === 'pending')
    .map((quote) => ({ enquiry, quote })));

  return (
    <div className="admin-view-stack">
      <div className="admin-metric-grid">
        <Metric icon={Inbox} label="New enquiries" value={String(newCount)} tone="purple" />
        <Metric icon={Clock3} label="Follow-ups due" value={String(followUpsDue)} tone="amber" />
        <Metric icon={PoundSterling} label="Quoted pipeline" value={formatCurrency(pipelineValue)} tone="green" />
        <Metric icon={CalendarClock} label="Quotes expiring" value={String(expiringQuotes)} tone="neutral" />
        <Metric icon={ReceiptText} label="Invoices needed" value={String(depositInvoiceActions.length)} tone="amber" />
      </div>

      {depositInvoiceActions.length > 0 ? <section className="admin-panel admin-invoice-prompts">
        <div className="admin-panel-heading"><div><h2>Deposit invoices required</h2><p>These services have been accepted and are waiting for a deposit invoice.</p></div></div>
        <div className="admin-invoice-prompt-list">
          {depositInvoiceActions.map(({ enquiry, quote }) => <article key={quote.id}>
            <span className="admin-deposit-icon"><ReceiptText size={18} /></span>
            <div><strong>{enquiry.name}</strong><small>{enquiry.email}</small></div>
            <div><strong>{formatCurrency(quote.deposit)} deposit</strong><small>{quote.items.filter((item) => !item.optional || item.included).map((item) => item.service).join(', ')}</small></div>
            <button className="btn btn-outline-accent" onClick={() => { onSelect(enquiry.id); onNavigate('quotes'); }} type="button">Review invoice <ArrowRight size={16} /></button>
          </article>)}
        </div>
      </section> : null}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Recent enquiries</h2>
            <p>The latest contact and quote requests requiring your attention.</p>
          </div>
          <button className="btn btn-outline-accent" onClick={() => onNavigate('enquiries')} type="button">
            View inbox <ArrowRight size={16} />
          </button>
        </div>

        <div className="admin-recent-list">
          {activeEnquiries.slice(0, 5).map((enquiry) => (
            <button
              className="admin-recent-item"
              key={enquiry.id}
              onClick={() => {
                onSelect(enquiry.id);
                onNavigate(enquiry.type === 'quote' ? 'quotes' : 'enquiries');
              }}
              type="button"
            >
              <span className="admin-avatar" aria-hidden="true">{enquiry.name.charAt(0).toUpperCase()}</span>
              <span className="admin-recent-person">
                <strong>{enquiry.name}</strong>
                <small>{enquiry.project_type || enquiry.type}</small>
              </span>
              <span className={`admin-status admin-status-${enquiry.status}`}>{enquiry.status}</span>
              <time dateTime={enquiry.created_at}>{formatShortDate(enquiry.created_at)}</time>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ))}
          {activeEnquiries.length === 0 ? <p className="admin-empty">No active enquiries have been received yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: string; tone: string }) {
  return (
    <article className="admin-metric">
      <span className={`admin-metric-icon is-${tone}`}><Icon size={20} /></span>
      <div><p>{label}</p><strong>{value}</strong></div>
    </article>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value));
}

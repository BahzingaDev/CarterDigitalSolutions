import { ArrowRight, CircleCheck, Clock3, Inbox, PoundSterling } from 'lucide-react';

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
  const newCount = enquiries.filter((enquiry) => enquiry.status === 'new').length;
  const activeCount = enquiries.filter((enquiry) => !['replied', 'closed'].includes(enquiry.status)).length;
  const quoteRequests = enquiries.filter((enquiry) => enquiry.type === 'quote');
  const pipelineValue = quoteRequests
    .filter((enquiry) => enquiry.status !== 'closed')
    .reduce((total, enquiry) => total + enquiry.estimated_cost, 0);

  return (
    <div className="admin-view-stack">
      <div className="admin-metric-grid">
        <Metric icon={Inbox} label="New enquiries" value={String(newCount)} tone="purple" />
        <Metric icon={Clock3} label="Awaiting action" value={String(activeCount)} tone="amber" />
        <Metric icon={PoundSterling} label="Quoted pipeline" value={formatCurrency(pipelineValue)} tone="green" />
        <Metric icon={CircleCheck} label="Closed" value={String(enquiries.filter((item) => item.status === 'closed').length)} tone="neutral" />
      </div>

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
          {enquiries.slice(0, 5).map((enquiry) => (
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
          {enquiries.length === 0 ? <p className="admin-empty">No enquiries have been received yet.</p> : null}
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

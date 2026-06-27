import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AdminEnquiry, EnquiryStatus } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

const statuses: EnquiryStatus[] = ['new', 'reviewed', 'replied', 'closed'];

export function AdminInbox({
  enquiries,
  mode,
  selectedId,
  onSelect,
  onUpdate,
}: {
  enquiries: AdminEnquiry[];
  mode: 'all' | 'quotes';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | AdminEnquiry['priority']>('all');

  const filtered = useMemo(() => enquiries.filter((enquiry) => {
    const haystack = `${enquiry.name} ${enquiry.email} ${enquiry.project_type}`.toLowerCase();
    return (mode === 'all' || enquiry.type === 'quote')
      && (statusFilter === 'all' || enquiry.status === statusFilter)
      && (priorityFilter === 'all' || enquiry.priority === priorityFilter)
      && haystack.includes(query.trim().toLowerCase());
  }), [enquiries, mode, priorityFilter, query, statusFilter]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];

  return (
    <div className="admin-inbox-layout">
      <section className="admin-panel admin-inbox-list-panel">
        <div className="admin-inbox-controls">
          <label className="admin-search">
            <Search size={17} />
            <span className="visually-hidden">Search enquiries</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search enquiries" type="search" value={query} />
          </label>
          <div className="admin-filter-row">
            <select aria-label="Filter by status" className="form-select" onChange={(event) => setStatusFilter(event.target.value as 'all' | EnquiryStatus)} value={statusFilter}>
              <option value="all">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select aria-label="Filter by priority" className="form-select" onChange={(event) => setPriorityFilter(event.target.value as 'all' | AdminEnquiry['priority'])} value={priorityFilter}>
              <option value="all">All priorities</option>
              <option value="high">High</option><option value="medium">Medium</option><option value="standard">Standard</option>
            </select>
          </div>
        </div>

        <div className="admin-enquiry-list">
          {filtered.map((enquiry) => (
            <button className={`admin-enquiry-list-item ${selected?.id === enquiry.id ? 'is-active' : ''}`} key={enquiry.id} onClick={() => onSelect(enquiry.id)} type="button">
              <span className="admin-avatar" aria-hidden="true">{enquiry.name.charAt(0).toUpperCase()}</span>
              <span className="admin-list-copy"><strong>{enquiry.name}</strong><small>{enquiry.project_type || enquiry.type}</small></span>
              <span className={`admin-priority admin-priority-${enquiry.priority}`}>{enquiry.priority}</span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="admin-empty">No enquiries match these filters.</p> : null}
        </div>
      </section>

      <section className="admin-detail">
        {selected ? <AdminEnquiryDetail key={selected.id} enquiry={selected} onUpdate={onUpdate} /> : <div className="admin-panel admin-empty">Select an enquiry to view it.</div>}
      </section>
    </div>
  );
}

function AdminEnquiryDetail({ enquiry, onUpdate }: { enquiry: AdminEnquiry; onUpdate: (id: string, payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>) => Promise<void> }) {
  const [notes, setNotes] = useState(enquiry.admin_notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const saveNotes = async () => {
    setIsSaving(true);
    try { await onUpdate(enquiry.id, { admin_notes: notes }); } finally { setIsSaving(false); }
  };

  return (
    <article className="admin-panel admin-detail-card">
      <div className="admin-detail-header">
        <div><p className="section-kicker">{enquiry.type}</p><h2>{enquiry.name}</h2><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></div>
        <span className={`admin-priority admin-priority-${enquiry.priority}`}>{enquiry.priority}</span>
      </div>

      <dl className="admin-meta-grid">
        <div><dt>Received</dt><dd>{formatDate(enquiry.created_at)}</dd></div>
        <div><dt>Project type</dt><dd>{enquiry.project_type || 'Not specified'}</dd></div>
        <div><dt>Estimated hours</dt><dd>{enquiry.estimated_hours || 'Not provided'}</dd></div>
        <div><dt>Estimated cost</dt><dd>{enquiry.estimated_cost ? formatCurrency(enquiry.estimated_cost) : 'Not provided'}</dd></div>
      </dl>

      <label className="admin-status-control">Status
        <select className="form-select" onChange={(event) => void onUpdate(enquiry.id, { status: event.target.value as EnquiryStatus })} value={enquiry.status}>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>

      <section className="admin-message"><h3>Message</h3><p>{enquiry.message}</p></section>

      {enquiry.quote_items.length > 0 ? <section className="admin-quote-items"><h3>Selected services</h3><ul>{enquiry.quote_items.map((item, index) => <li key={`${item.service}-${index}`}><span><strong>{item.service}</strong><small>{item.category}</small></span><em>{item.hours} hrs at {formatCurrency(item.rate)}</em></li>)}</ul></section> : null}

      <section className="admin-notes">
        <label className="form-label" htmlFor={`notes-${enquiry.id}`}>Private notes</label>
        <textarea className="form-control" id={`notes-${enquiry.id}`} maxLength={4000} onChange={(event) => setNotes(event.target.value)} rows={5} value={notes} />
        <button className="btn btn-accent" disabled={isSaving || notes === enquiry.admin_notes} onClick={() => void saveNotes()} type="button">{isSaving ? 'Saving...' : 'Save notes'}</button>
      </section>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

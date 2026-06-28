import { Archive, CalendarClock, FileText, History, MessageSquare, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AdminEnquiry, AdminEnquiryUpdate, AdminQuoteItem, AdminQuotePayload, AdminQuoteVersion, EnquiryStatus } from '../../src/api/admin';
import { hasQuoteActivity } from '../../src/data/adminEnquiries';
import { formatCurrency } from '../../src/data/pricing';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';
import { AdminActivity } from './AdminActivity';
import { AdminCommunications, type CommunicationDraft } from './AdminCommunications';
import { AdminQuoteManager } from './AdminQuoteManager';

const statuses: EnquiryStatus[] = ['new', 'reviewed', 'replied', 'closed'];
const pageSize = 10;

export function AdminInbox({ enquiries, mode, selectedId, onConvertQuote, onCreateQuote, onDirtyChange, onQuoteStatus, onSelect, onSend, onShareQuote, onUpdate, onUpdateQuote }: {
  enquiries: AdminEnquiry[];
  mode: 'all' | 'quotes';
  selectedId: string | null;
  onCreateQuote: (id: string, payload: { items: AdminQuoteItem[]; discount: number; expenses: number; tax_rate: number; deposit: number; notes: string; valid_until: string | null }) => Promise<void>;
  onConvertQuote: (enquiry: AdminEnquiry, quote: AdminQuoteVersion) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  onQuoteStatus: (enquiryId: string, quoteId: string, status: AdminQuoteVersion['status']) => Promise<void>;
  onSelect: (id: string) => void;
  onSend: (id: string, subject: string, message: string, quoteId?: string, scheduledAt?: string) => Promise<void>;
  onShareQuote: (enquiryId: string, quoteId: string) => Promise<string>;
  onUpdate: (id: string, payload: AdminEnquiryUpdate) => Promise<void>;
  onUpdateQuote: (enquiryId: string, quoteId: string, payload: AdminQuotePayload) => Promise<void>;
}) {
  const savedFilters = useMemo(() => readSavedFilters(mode), [mode]);
  const [query, setQuery] = useState(savedFilters.query);
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>(savedFilters.status);
  const [priorityFilter, setPriorityFilter] = useState<'all' | AdminEnquiry['priority']>(savedFilters.priority);
  const [showArchived, setShowArchived] = useState(savedFilters.archived);
  const [workFilter, setWorkFilter] = useState<'all' | 'needs_reply' | 'follow_up' | 'awaiting'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    window.localStorage.setItem(`cds_admin_filters_${mode}`, JSON.stringify({ query, status: statusFilter, priority: priorityFilter, archived: showArchived }));
    setPage(1);
  }, [mode, priorityFilter, query, showArchived, statusFilter]);

  const filtered = useMemo(() => enquiries.filter((enquiry) => {
    const haystack = `${enquiry.name} ${enquiry.email} ${enquiry.project_type} ${(enquiry.labels ?? []).join(' ')}`.toLowerCase();
    return (mode === 'all' || hasQuoteActivity(enquiry))
      && (showArchived ? enquiry.archived : !enquiry.archived)
      && (statusFilter === 'all' || enquiry.status === statusFilter)
      && (priorityFilter === 'all' || enquiry.priority === priorityFilter)
      && (workFilter === 'all'
        || (workFilter === 'needs_reply' && enquiry.status === 'new')
        || (workFilter === 'follow_up' && Boolean(enquiry.follow_up_at) && new Date(enquiry.follow_up_at ?? '').getTime() <= Date.now() && enquiry.status !== 'closed')
        || (workFilter === 'awaiting' && enquiry.status === 'replied'))
      && haystack.includes(query.trim().toLowerCase());
  }), [enquiries, mode, priorityFilter, query, showArchived, statusFilter, workFilter]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  useEffect(() => {
    if (pageCount === 0 && page !== 1) setPage(1);
    if (pageCount > 0 && page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = filtered.find((item) => item.id === selectedId) ?? pageItems[0];
  const noun = mode === 'quotes' ? 'quote requests' : 'enquiries';
  const modeItems = enquiries.filter((item) => mode === 'all' || hasQuoteActivity(item));
  const visibleItems = modeItems.filter((item) => showArchived ? item.archived : !item.archived);
  const emptyMessage = visibleItems.length === 0
    ? `No ${showArchived ? 'archived ' : ''}${noun} yet.`
    : `No ${noun} match the current filters.`;

  return (
    <div className="admin-inbox-layout">
      <section className="admin-panel admin-inbox-list-panel">
        <div className="admin-inbox-controls">
          <label className="admin-search"><Search size={17} /><span className="visually-hidden">Search enquiries</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search enquiries" type="search" value={query} /></label>
          <div className="admin-filter-row">
            <select aria-label="Filter by status" className="form-select" onChange={(event) => setStatusFilter(event.target.value as 'all' | EnquiryStatus)} value={statusFilter}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <select aria-label="Filter by priority" className="form-select" onChange={(event) => setPriorityFilter(event.target.value as 'all' | AdminEnquiry['priority'])} value={priorityFilter}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="standard">Standard</option></select>
          </div>
          <label className="admin-archive-toggle"><input checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} type="checkbox" /> Show archived</label>
          <div className="admin-saved-views" aria-label="Saved views"><button className={workFilter === 'all' ? 'is-active' : ''} onClick={() => setWorkFilter('all')} type="button">All</button><button className={workFilter === 'needs_reply' ? 'is-active' : ''} onClick={() => setWorkFilter('needs_reply')} type="button">Needs reply</button><button className={workFilter === 'follow_up' ? 'is-active' : ''} onClick={() => setWorkFilter('follow_up')} type="button">Follow-up due</button><button className={workFilter === 'awaiting' ? 'is-active' : ''} onClick={() => setWorkFilter('awaiting')} type="button">Awaiting customer</button></div>
        </div>

        <div className="admin-enquiry-list">
          {pageItems.map((enquiry) => <button className={`admin-enquiry-list-item ${selected?.id === enquiry.id ? 'is-active' : ''}`} key={enquiry.id} onClick={() => onSelect(enquiry.id)} type="button"><span className="admin-avatar" aria-hidden="true">{enquiry.name.charAt(0).toUpperCase()}</span><span className="admin-list-copy"><strong>{enquiry.name}</strong><small>{enquiry.project_type || enquiry.type} · {formatAge(enquiry.created_at)}</small>{enquiry.follow_up_at ? <small className="admin-follow-up"><CalendarClock size={12} /> {formatShortDate(enquiry.follow_up_at)}</small> : null}</span><span className={`admin-priority admin-priority-${enquiry.priority}`}>{enquiry.priority}</span></button>)}
          {pageItems.length === 0 ? <p className="admin-empty admin-list-empty">{emptyMessage}</p> : null}
        </div>
        {pageCount > 1 ? <div className="admin-pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><span>{page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div> : null}
      </section>

      <section className="admin-detail">
        {selected ? <AdminEnquiryDetail key={`${selected.id}-${mode}`} defaultTab={mode === 'quotes' ? 'quote' : 'details'} enquiry={selected} onConvertQuote={onConvertQuote} onCreateQuote={onCreateQuote} onDirtyChange={onDirtyChange} onQuoteStatus={onQuoteStatus} onSend={onSend} onShareQuote={onShareQuote} onUpdate={onUpdate} onUpdateQuote={onUpdateQuote} /> : <div className="admin-panel admin-zero-state">{mode === 'quotes' ? <FileText size={28} /> : <UserRound size={28} />}<h2>No {noun} to display</h2><p>{emptyMessage}</p></div>}
      </section>
    </div>
  );
}

type DetailTab = 'details' | 'quote' | 'communications' | 'activity';

function AdminEnquiryDetail({ defaultTab, enquiry, onConvertQuote, onCreateQuote, onDirtyChange, onQuoteStatus, onSend, onShareQuote, onUpdate, onUpdateQuote }: {
  defaultTab: DetailTab;
  enquiry: AdminEnquiry;
  onCreateQuote: AdminInboxProps['onCreateQuote'];
  onConvertQuote: AdminInboxProps['onConvertQuote'];
  onDirtyChange?: (isDirty: boolean) => void;
  onQuoteStatus: AdminInboxProps['onQuoteStatus'];
  onSend: AdminInboxProps['onSend'];
  onShareQuote: AdminInboxProps['onShareQuote'];
  onUpdate: AdminInboxProps['onUpdate'];
  onUpdateQuote: AdminInboxProps['onUpdateQuote'];
}) {
  const [tab, setTab] = useState<DetailTab>(defaultTab);
  const [notes, setNotes] = useState(enquiry.admin_notes ?? '');
  const [labels, setLabels] = useState((enquiry.labels ?? []).join(', '));
  const [followUp, setFollowUp] = useState(toDateTimeInput(enquiry.follow_up_at));
  const [isSaving, setIsSaving] = useState(false);
  const [communicationDraft, setCommunicationDraft] = useState<CommunicationDraft>();
  const managementFingerprint = fingerprint({ notes, labels, followUp });
  const savedManagementFingerprint = fingerprint({ notes: enquiry.admin_notes ?? '', labels: (enquiry.labels ?? []).join(', '), followUp: toDateTimeInput(enquiry.follow_up_at) });
  const isDirty = managementFingerprint !== savedManagementFingerprint;
  useUnsavedChanges(isDirty, onDirtyChange);

  const saveManagement = async () => {
    setIsSaving(true);
    try { await onUpdate(enquiry.id, { admin_notes: notes, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), follow_up_at: followUp ? new Date(followUp).toISOString() : null }); } finally { setIsSaving(false); }
  };

  const prepareQuoteEmail = (quote: AdminQuoteVersion, approvalUrl: string) => {
    const itemSummary = quote.items.map((item) => `• ${item.service}: ${item.hours} hours at ${formatCurrency(item.rate)}/hr`).join('\n');
    setCommunicationDraft({ quoteId: quote.id, subject: `Quote for ${enquiry.project_type || 'your project'} – version ${quote.version}`, message: `Your quote is ready for review.\n\n${itemSummary}\n\nQuote total: ${formatCurrency(quote.total)}\nDeposit: ${formatCurrency(quote.deposit)}${quote.valid_until ? `\nValid until: ${formatDate(quote.valid_until)}` : ''}\n\nReview and approve your quote:\n${approvalUrl}\n\nPlease reply if you would like to discuss any part of the scope.` });
    setTab('communications');
  };

  return <article className="admin-panel admin-detail-card">
    <div className="admin-detail-header"><div><p className="section-kicker">{enquiry.type}</p><h2>{enquiry.name}</h2><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></div><span className={`admin-priority admin-priority-${enquiry.priority}`}>{enquiry.priority}</span></div>
    <div className="admin-detail-tabs" role="tablist"><Tab active={tab === 'details'} icon={UserRound} label="Details" onClick={() => setTab('details')} /><Tab active={tab === 'quote'} icon={FileText} label="Quotes" onClick={() => setTab('quote')} /><Tab active={tab === 'communications'} icon={MessageSquare} label="Messages" onClick={() => setTab('communications')} /><Tab active={tab === 'activity'} icon={History} label="Activity" onClick={() => setTab('activity')} /></div>

    {tab === 'details' ? <div className="admin-workflow-stack">
      <dl className="admin-meta-grid"><div><dt>Received</dt><dd>{formatDate(enquiry.created_at)}</dd></div><div><dt>Project type</dt><dd>{enquiry.project_type || 'Not specified'}</dd></div><div><dt>Estimated hours</dt><dd>{enquiry.estimated_hours || 'Not provided'}</dd></div><div><dt>Estimated cost</dt><dd>{enquiry.estimated_cost ? formatCurrency(enquiry.estimated_cost) : 'Not provided'}</dd></div></dl>
      <section className="admin-management-grid"><label>Status<select className="form-select" onChange={(event) => void onUpdate(enquiry.id, { status: event.target.value as EnquiryStatus })} value={enquiry.status}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Priority<select className="form-select" onChange={(event) => void onUpdate(enquiry.id, { priority: event.target.value as AdminEnquiry['priority'] })} value={enquiry.priority}><option value="standard">Standard</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Follow-up<input className="form-control" onChange={(event) => setFollowUp(event.target.value)} type="datetime-local" value={followUp} /></label><label>Labels<input className="form-control" onChange={(event) => setLabels(event.target.value)} placeholder="website, priority" value={labels} /></label></section>
      <section className="admin-message"><h3>Customer message</h3><p>{enquiry.message}</p></section>
      <section className="admin-notes"><label className="form-label" htmlFor={`notes-${enquiry.id}`}>Private notes</label><textarea className="form-control" id={`notes-${enquiry.id}`} maxLength={4000} onChange={(event) => setNotes(event.target.value)} rows={5} value={notes} /><div className="admin-management-actions"><button className="btn btn-accent" disabled={isSaving || !isDirty} onClick={() => void saveManagement()} type="button">{isSaving ? 'Saving...' : isDirty ? 'Save details' : 'Saved'}</button><button className="btn btn-outline-danger" onClick={() => void onUpdate(enquiry.id, { archived: !enquiry.archived })} type="button"><Archive size={16} /> {enquiry.archived ? 'Restore' : 'Archive'}</button></div></section>
    </div> : null}
    {tab === 'quote' ? <AdminQuoteManager enquiry={enquiry} onConvert={(quote) => onConvertQuote(enquiry, quote)} onCreate={(payload) => onCreateQuote(enquiry.id, payload)} onPrepareEmail={prepareQuoteEmail} onShare={(quoteId) => onShareQuote(enquiry.id, quoteId)} onStatus={(quoteId, status) => onQuoteStatus(enquiry.id, quoteId, status)} onUpdate={(quoteId, payload) => onUpdateQuote(enquiry.id, quoteId, payload)} /> : null}
    {tab === 'communications' ? <AdminCommunications draft={communicationDraft} enquiry={enquiry} onSend={(subject, message, quoteId, scheduledAt) => onSend(enquiry.id, subject, message, quoteId, scheduledAt)} /> : null}
    {tab === 'activity' ? <AdminActivity enquiry={enquiry} /> : null}
  </article>;
}

type AdminInboxProps = Parameters<typeof AdminInbox>[0];
function Tab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof UserRound; label: string; onClick: () => void }) { return <button aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick} role="tab" type="button"><Icon size={16} /><span>{label}</span></button>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value)); }
function formatAge(value: string) { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); return days === 0 ? 'today' : `${days}d old`; }
function toDateTimeInput(value?: string | null) { if (!value) return ''; const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function readSavedFilters(mode: string) { try { const parsed = JSON.parse(window.localStorage.getItem(`cds_admin_filters_${mode}`) ?? '{}'); return { query: typeof parsed.query === 'string' ? parsed.query : '', status: statuses.includes(parsed.status) ? parsed.status as EnquiryStatus : 'all' as const, priority: ['standard', 'medium', 'high'].includes(parsed.priority) ? parsed.priority as AdminEnquiry['priority'] : 'all' as const, archived: parsed.archived === true }; } catch { return { query: '', status: 'all' as const, priority: 'all' as const, archived: false }; } }

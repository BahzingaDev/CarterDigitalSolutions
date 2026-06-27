import { ArrowRight, CalendarClock, CheckCircle2, Clock3, FileWarning, Inbox, ListTodo, PoundSterling, ReceiptText } from 'lucide-react';

import type { AdminEnquiry, AdminProject, AdminView } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  label: string;
  urgency: number;
  icon: typeof Inbox;
  open: () => void;
}

export function getAdminActionCount(enquiries: AdminEnquiry[], projects: AdminProject[]) {
  return buildActionMetadata(enquiries, projects).length;
}

export function AdminOverview({ enquiries, projects, onNavigate, onOpenProject, onSelect }: {
  enquiries: AdminEnquiry[];
  projects: AdminProject[];
  onNavigate: (view: AdminView) => void;
  onOpenProject: (projectId: string, tab?: 'delivery' | 'meetings' | 'invoices') => void;
  onSelect: (id: string) => void;
}) {
  const activeEnquiries = enquiries.filter((enquiry) => !enquiry.archived);
  const actions = buildActionMetadata(enquiries, projects).map((action): ActionItem => ({
    ...action,
    open: () => {
      if (action.projectId) onOpenProject(action.projectId, action.projectTab);
      else if (action.enquiryId) {
        onSelect(action.enquiryId);
        onNavigate(action.view ?? 'enquiries');
      }
    },
  }));
  const pipelineValue = projects.filter((project) => project.stage !== 'completed').reduce((total, project) => total + project.value, 0);
  const overdueInvoices = projects.flatMap((project) => project.invoices).filter(isInvoiceOverdue).length;

  return <div className="admin-view-stack">
    <div className="admin-metric-grid">
      <Metric icon={ListTodo} label="Actions due" value={String(actions.length)} tone="purple" />
      <Metric icon={Inbox} label="New enquiries" value={String(activeEnquiries.filter((item) => item.status === 'new').length)} tone="amber" />
      <Metric icon={PoundSterling} label="Open pipeline" value={formatCurrency(pipelineValue)} tone="green" />
      <Metric icon={FileWarning} label="Overdue invoices" value={String(overdueInvoices)} tone="amber" />
    </div>

    <section className="admin-panel admin-action-queue">
      <div className="admin-panel-heading"><div><h2>Next actions</h2><p>One worklist for the customer and delivery tasks that need attention.</p></div></div>
      <div className="admin-action-list">
        {actions.slice(0, 12).map((action) => <button key={action.id} onClick={action.open} type="button">
          <span className={`admin-action-icon urgency-${action.urgency}`}><action.icon size={18} /></span>
          <span><strong>{action.title}</strong><small>{action.detail}</small></span>
          <em>{action.label}</em><ArrowRight size={16} />
        </button>)}
        {actions.length === 0 ? <div className="admin-action-clear"><CheckCircle2 size={24} /><div><strong>Everything is up to date</strong><small>New work and approaching deadlines will appear here.</small></div></div> : null}
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>Recent enquiries</h2><p>The latest contact and quote requests.</p></div><button className="btn btn-outline-accent" onClick={() => onNavigate('enquiries')} type="button">View inbox <ArrowRight size={16} /></button></div>
      <div className="admin-recent-list">
        {activeEnquiries.slice(0, 5).map((enquiry) => <button className="admin-recent-item" key={enquiry.id} onClick={() => { onSelect(enquiry.id); onNavigate(enquiry.type === 'quote' ? 'quotes' : 'enquiries'); }} type="button"><span className="admin-avatar" aria-hidden="true">{enquiry.name.charAt(0).toUpperCase()}</span><span className="admin-recent-person"><strong>{enquiry.name}</strong><small>{enquiry.project_type || enquiry.type}</small></span><span className={`admin-status admin-status-${enquiry.status}`}>{enquiry.status}</span><time dateTime={enquiry.created_at}>{formatShortDate(enquiry.created_at)}</time><ArrowRight size={17} aria-hidden="true" /></button>)}
        {activeEnquiries.length === 0 ? <p className="admin-empty">No active enquiries have been received yet.</p> : null}
      </div>
    </section>
  </div>;
}

function buildActionMetadata(enquiries: AdminEnquiry[], projects: AdminProject[]) {
  const now = Date.now();
  const sevenDays = now + 7 * 86400000;
  const actions: Array<Omit<ActionItem, 'open'> & { enquiryId?: string; projectId?: string; projectTab?: 'delivery' | 'meetings' | 'invoices'; view?: AdminView }> = [];
  enquiries.filter((item) => !item.archived).forEach((enquiry) => {
    if (enquiry.status === 'new') actions.push({ id: `new-${enquiry.id}`, title: `Reply to ${enquiry.name}`, detail: enquiry.project_type || 'New enquiry', label: 'New enquiry', urgency: 1, icon: Inbox, enquiryId: enquiry.id, view: enquiry.type === 'quote' ? 'quotes' : 'enquiries' });
    if (enquiry.follow_up_at && new Date(enquiry.follow_up_at).getTime() <= now && enquiry.status !== 'closed') actions.push({ id: `follow-${enquiry.id}`, title: `Follow up with ${enquiry.name}`, detail: `Due ${formatShortDate(enquiry.follow_up_at)}`, label: 'Follow-up', urgency: 1, icon: Clock3, enquiryId: enquiry.id, view: 'enquiries' });
    const quote = enquiry.quote_versions[enquiry.quote_versions.length - 1];
    if (quote?.status === 'accepted' && !quote.converted_project_id) actions.push({ id: `convert-${quote.id}`, title: `Create ${enquiry.name}'s project`, detail: 'Quote accepted and ready for delivery setup', label: 'Accepted quote', urgency: 1, icon: ReceiptText, enquiryId: enquiry.id, view: 'quotes' });
    if (quote?.valid_until && ['draft', 'sent'].includes(quote.status)) {
      const expiry = new Date(quote.valid_until).getTime();
      if (expiry >= now && expiry <= sevenDays) actions.push({ id: `expiry-${quote.id}`, title: `Review ${enquiry.name}'s quote`, detail: `Expires ${formatShortDate(quote.valid_until)}`, label: 'Expiring', urgency: 2, icon: CalendarClock, enquiryId: enquiry.id, view: 'quotes' });
    }
  });
  projects.filter((project) => project.stage !== 'completed').forEach((project) => {
    project.invoices.forEach((invoice) => {
      if (invoice.status === 'draft' && invoice.amount > 0) actions.push({ id: `invoice-${project.id}-${invoice.id}`, title: `Send ${invoice.reference}`, detail: `${project.client_name || project.name} · ${formatCurrency(invoice.amount)}`, label: 'Draft invoice', urgency: 2, icon: ReceiptText, projectId: project.id, projectTab: 'invoices' });
      if (isInvoiceOverdue(invoice)) actions.push({ id: `overdue-${project.id}-${invoice.id}`, title: `Chase ${invoice.reference}`, detail: `${project.client_name || project.name} · due ${formatShortDate(invoice.due_date)}`, label: 'Overdue', urgency: 1, icon: FileWarning, projectId: project.id, projectTab: 'invoices' });
    });
    project.tasks.filter((task) => !task.completed && task.due_date && new Date(`${task.due_date}T23:59:59`).getTime() < now).forEach((task) => actions.push({ id: `task-${project.id}-${task.id}`, title: task.title || 'Complete overdue task', detail: `${project.name} · due ${formatShortDate(task.due_date)}`, label: 'Overdue task', urgency: 1, icon: ListTodo, projectId: project.id, projectTab: 'delivery' }));
    project.meetings.filter((meeting) => meeting.status === 'scheduled').forEach((meeting) => { const start = new Date(meeting.start_at).getTime(); if (start >= now && start <= sevenDays) actions.push({ id: `meeting-${project.id}-${meeting.id}`, title: meeting.title, detail: `${project.client_name || project.name} · ${formatDateTime(meeting.start_at)}`, label: 'Upcoming', urgency: 3, icon: CalendarClock, projectId: project.id, projectTab: 'meetings' }); });
  });
  return actions.sort((a, b) => a.urgency - b.urgency || a.title.localeCompare(b.title));
}

function isInvoiceOverdue(invoice: AdminProject['invoices'][number]) { return invoice.status === 'overdue' || (invoice.status === 'sent' && Boolean(invoice.due_date) && new Date(`${invoice.due_date}T23:59:59`).getTime() < Date.now()); }
function Metric({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: string; tone: string }) { return <article className="admin-metric"><span className={`admin-metric-icon is-${tone}`}><Icon size={20} /></span><div><p>{label}</p><strong>{value}</strong></div></article>; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

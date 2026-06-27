import { CalendarPlus, Download, FilePlus2, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  deleteAdminProject,
  downloadAdminProjectInvoice,
  fetchCommercialSettings,
  fetchAdminProjects,
  saveAdminProject,
  sendAdminProjectInvoice,
  type AdminProject,
  type ProjectChecklistItem,
  type ProjectInvoice,
  type ProjectMeeting,
  type ProjectStage,
} from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

const stages: { id: ProjectStage; label: string }[] = [
  { id: 'lead', label: 'Lead' }, { id: 'discovery', label: 'Discovery' },
  { id: 'quoted', label: 'Quoted' }, { id: 'accepted', label: 'Accepted' },
  { id: 'active', label: 'Active' }, { id: 'on_hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
];
const empty: Partial<AdminProject> = {
  name: '', client_name: '', client_email: '', stage: 'lead', value: 0, due_date: '', notes: '', tags: [], linked_enquiry_id: '', source_quote_id: '',
  services: [], included_consultation_hours: 8, consultation_rate: 16.5, meetings: [], invoices: [], tasks: [], milestones: [], completion: 0,
};
type WorkspaceTab = 'delivery' | 'meetings' | 'invoices';

export function AdminProjects({ csrfToken }: { csrfToken: string }) {
  const [items, setItems] = useState<AdminProject[]>([]);
  const [draft, setDraft] = useState<Partial<AdminProject>>(empty);
  const [tags, setTags] = useState('');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('delivery');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    void fetchAdminProjects()
      .then((projects) => setItems(projects.map(normaliseProject)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load projects'));
  }, []);
  useEffect(() => { void fetchCommercialSettings().then((settings) => setTaxRate(settings.tax_rate)); }, []);

  const select = (item: AdminProject) => { setDraft(normaliseProject(item)); setTags(item.tags.join(', ')); setEditing(true); setTab('delivery'); setError(''); };
  const save = async (value = draft): Promise<AdminProject | undefined> => {
    setIsSaving(true); setError('');
    try {
      const saved = normaliseProject(await saveAdminProject(csrfToken, {
        ...value,
        services: value.services ?? [], meetings: value.meetings ?? [], invoices: value.invoices ?? [],
        tasks: value.tasks ?? [], milestones: value.milestones ?? [],
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }));
      setItems((current) => value.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setDraft(saved); setTags(saved.tags.join(', '));
      return saved;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save project'); }
    finally { setIsSaving(false); }
    return undefined;
  };
  const move = async (project: AdminProject, stage: ProjectStage) => {
    const saved = normaliseProject(await saveAdminProject(csrfToken, { ...project, stage }));
    setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
  };
  const remove = async () => {
    if (!draft.id || !window.confirm('Delete this project?')) return;
    await deleteAdminProject(csrfToken, draft.id);
    setItems((current) => current.filter((item) => item.id !== draft.id)); setDraft(empty); setEditing(false);
  };

  return <div className="admin-view-stack">
    <div className="admin-pipeline-toolbar"><div><strong>{items.length} projects</strong><span>{formatCurrency(items.filter((item) => item.stage !== 'completed').reduce((sum, item) => sum + item.value, 0))} open pipeline</span></div><button className="btn btn-accent" onClick={() => { setDraft(empty); setTags(''); setEditing(true); setTab('delivery'); }} type="button"><Plus size={16} /> New project</button></div>
    {error ? <div className="alert alert-danger">{error}</div> : null}
    {editing ? <section className="admin-panel admin-project-editor">
      <div className="admin-project-workspace-heading"><div><p className="section-kicker">Client project</p><h2>{draft.name || 'New project'}</h2><span>{draft.client_name || 'No client assigned'}</span></div><div className="admin-management-actions"><button className="btn btn-accent" disabled={isSaving} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : 'Save project'}</button><button className="btn btn-outline-secondary" onClick={() => setEditing(false)} type="button">Close</button>{draft.id ? <button className="admin-icon-button is-danger" onClick={() => void remove()} title="Delete project" type="button"><Trash2 size={16} /></button> : null}</div></div>
      <div className="admin-project-tabs" role="tablist"><ProjectTab active={tab === 'delivery'} label="Delivery" onClick={() => setTab('delivery')} /><ProjectTab active={tab === 'meetings'} label="Meetings" onClick={() => setTab('meetings')} /><ProjectTab active={tab === 'invoices'} label="Invoices" onClick={() => setTab('invoices')} /></div>
      {tab === 'delivery' ? <DeliveryWorkspace draft={draft} onChange={setDraft} tags={tags} onTags={setTags} /> : null}
      {tab === 'meetings' ? <MeetingWorkspace draft={draft} onChange={setDraft} taxRate={taxRate} /> : null}
      {tab === 'invoices' ? <InvoiceWorkspace draft={draft} onChange={setDraft} taxRate={taxRate} onDownload={async (invoice) => { const saved = await save(); if (saved) await downloadAdminProjectInvoice(saved.id, invoice.id, invoice.reference); }} onSend={async (invoice) => { const saved = await save(); if (!saved) return; try { const updated = normaliseProject(await sendAdminProjectInvoice(csrfToken, saved.id, invoice.id)); setDraft(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send invoice'); } }} /> : null}
    </section> : null}
    <div className="admin-kanban">{stages.map((stage) => <section className="admin-kanban-column" key={stage.id}><header><span>{stage.label}</span><em>{items.filter((item) => item.stage === stage.id).length}</em></header><div>{items.filter((item) => item.stage === stage.id).map((project) => <article className="admin-project-card" key={project.id} onClick={() => select(project)}><strong>{project.name}</strong><small>{project.client_name || 'No client assigned'}</small><span>{formatCurrency(project.value)}</span><div className="admin-card-progress"><i style={{ width: `${project.completion ?? 0}%` }} /></div><small>{project.meetings.filter((meeting) => meeting.status === 'scheduled').length} upcoming · {project.invoices.filter((invoice) => invoice.status === 'draft' || invoice.status === 'overdue').length} invoice actions</small>{project.due_date ? <time>{project.due_date}</time> : null}<select aria-label={`Move ${project.name}`} onClick={(event) => event.stopPropagation()} onChange={(event) => void move(project, event.target.value as ProjectStage)} value={project.stage}>{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article>)}</div></section>)}</div>
  </div>;
}

function DeliveryWorkspace({ draft, onChange, tags, onTags }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void; tags: string; onTags: (value: string) => void }) {
  return <div className="admin-project-workspace">
    <div className="admin-management-grid">
      <label>Project name<input className="form-control" onChange={(event) => onChange({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label>
      <label>Stage<select className="form-select" onChange={(event) => onChange({ ...draft, stage: event.target.value as ProjectStage })} value={draft.stage}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
      <label>Client name<input className="form-control" onChange={(event) => onChange({ ...draft, client_name: event.target.value })} value={draft.client_name ?? ''} /></label>
      <label>Client email<input className="form-control" onChange={(event) => onChange({ ...draft, client_email: event.target.value })} type="email" value={draft.client_email ?? ''} /></label>
      <label>Value (£)<input className="form-control" min="0" onChange={(event) => onChange({ ...draft, value: Number(event.target.value) })} step="0.01" type="number" value={draft.value ?? 0} /></label>
      <label>Due date<input className="form-control" onChange={(event) => onChange({ ...draft, due_date: event.target.value })} type="date" value={draft.due_date ?? ''} /></label>
    </div>
    <div className="admin-project-progress"><span>Completion</span><div><i style={{ width: `${draft.completion ?? 0}%` }} /></div><strong>{draft.completion ?? 0}%</strong></div>
    {(draft.services ?? []).length > 0 ? <section className="admin-project-services"><h3>Confirmed services</h3>{draft.services?.filter((item) => !item.optional || item.included).map((item, index) => <div key={`${item.service}-${index}`}><span><strong>{item.service}</strong><small>{item.category}</small></span><span>{item.hours} hours · {formatCurrency(item.rate)}/hour</span></div>)}</section> : null}
    <div className="admin-checklist-grid"><Checklist title="Tasks" items={draft.tasks ?? []} onChange={(tasks) => onChange({ ...draft, tasks })} /><Checklist title="Milestones" items={draft.milestones ?? []} onChange={(milestones) => onChange({ ...draft, milestones })} /></div>
    <label>Tags<input className="form-control" onChange={(event) => onTags(event.target.value)} value={tags} /></label>
    <label>Notes<textarea className="form-control" onChange={(event) => onChange({ ...draft, notes: event.target.value })} rows={4} value={draft.notes ?? ''} /></label>
  </div>;
}

function MeetingWorkspace({ draft, onChange, taxRate }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void; taxRate: number }) {
  const meetings = draft.meetings ?? [];
  const bookedHours = consultationHours(meetings, (meeting) => meeting.status !== 'cancelled');
  const completedHours = consultationHours(meetings, (meeting) => meeting.status === 'completed');
  const included = draft.included_consultation_hours ?? 8;
  const rate = draft.consultation_rate ?? 16.5;
  const billableHours = Math.max(0, bookedHours - included);
  const update = (index: number, patch: Partial<ProjectMeeting>) => onChange({ ...draft, meetings: meetings.map((meeting, meetingIndex) => meetingIndex === index ? { ...meeting, ...patch } : meeting) });
  const add = () => onChange({ ...draft, meetings: [...meetings, { id: crypto.randomUUID(), title: 'Project consultation', start_at: nextHourInput(), duration_minutes: 60, status: 'scheduled', counts_as_consultation: true, location: '', notes: '', calendar_provider: '', external_calendar_id: '' }] });
  const createConsultationInvoice = () => {
    const invoices = draft.invoices ?? [];
    const subtotal = Number((billableHours * rate).toFixed(2));
    const taxAmount = Number((subtotal * taxRate / 100).toFixed(2));
    onChange({ ...draft, invoices: [...invoices, { id: crypto.randomUUID(), reference: `CONS-${new Date().toISOString().slice(0, 10)}`, kind: 'consultation', status: 'draft', subtotal, tax_rate: taxRate, tax_amount: taxAmount, amount: subtotal + taxAmount, issue_date: '', due_date: '', paid_date: '', notes: `${billableHours.toFixed(2)} billable consultation hours` }] });
  };
  return <div className="admin-project-workspace">
    <div className="admin-management-grid"><label>Included consultation hours<input className="form-control" min="0" onChange={(event) => onChange({ ...draft, included_consultation_hours: Number(event.target.value) })} step="0.25" type="number" value={included} /></label><label>Billable consultation rate (£/hour)<input className="form-control" min="0" onChange={(event) => onChange({ ...draft, consultation_rate: Number(event.target.value) })} step="0.01" type="number" value={rate} /></label></div>
    <div className="admin-consultation-summary"><Summary label="Booked" value={`${bookedHours.toFixed(2)}h`} /><Summary label="Completed" value={`${completedHours.toFixed(2)}h`} /><Summary label="Included remaining" value={`${Math.max(0, included - bookedHours).toFixed(2)}h`} /><Summary label="Projected billable" value={formatCurrency(billableHours * rate)} /></div>
    <div className="admin-subpanel-heading"><div><h3>Meetings</h3><p>Schedule consultations and export them to your calendar.</p></div><button className="btn btn-outline-accent" onClick={add} type="button"><CalendarPlus size={16} /> Schedule meeting</button></div>
    <div className="admin-meeting-list">{meetings.map((meeting, index) => <article key={meeting.id}>
      <div className="admin-meeting-grid"><label>Title<input className="form-control" onChange={(event) => update(index, { title: event.target.value })} value={meeting.title} /></label><label>Starts<input className="form-control" onChange={(event) => update(index, { start_at: event.target.value })} type="datetime-local" value={toDateTimeInput(meeting.start_at)} /></label><label>Minutes<input className="form-control" min="15" max="480" onChange={(event) => update(index, { duration_minutes: Number(event.target.value) })} step="15" type="number" value={meeting.duration_minutes} /></label><label>Status<select className="form-select" onChange={(event) => update(index, { status: event.target.value as ProjectMeeting['status'] })} value={meeting.status}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Location or call link<input className="form-control" onChange={(event) => update(index, { location: event.target.value })} value={meeting.location} /></label></div>
      <label className="admin-archive-toggle"><input checked={meeting.counts_as_consultation} onChange={(event) => update(index, { counts_as_consultation: event.target.checked })} type="checkbox" /> Count towards consultation allowance</label>
      <label>Meeting notes<textarea className="form-control" onChange={(event) => update(index, { notes: event.target.value })} rows={2} value={meeting.notes} /></label>
      <div className="admin-management-actions"><button className="btn btn-outline-accent btn-sm" onClick={() => downloadCalendarEvent(draft, meeting)} type="button"><Download size={15} /> Add to calendar</button><button className="admin-icon-button is-danger" onClick={() => onChange({ ...draft, meetings: meetings.filter((_, meetingIndex) => meetingIndex !== index) })} title="Remove meeting" type="button"><X size={15} /></button></div>
    </article>)}</div>
    {meetings.length === 0 ? <p className="admin-empty">No meetings scheduled for this project.</p> : null}
    {billableHours > 0 ? <div className="admin-consultation-billing"><div><strong>{billableHours.toFixed(2)} hours exceed the included allowance</strong><p>Create a draft consultation invoice for {formatCurrency(billableHours * rate)}.</p></div><button className="btn btn-accent" onClick={createConsultationInvoice} type="button"><FilePlus2 size={16} /> Create invoice</button></div> : null}
  </div>;
}

function InvoiceWorkspace({ draft, onChange, onDownload, onSend, taxRate }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void; onDownload: (invoice: ProjectInvoice) => Promise<void>; onSend: (invoice: ProjectInvoice) => Promise<void>; taxRate: number }) {
  const invoices = draft.invoices ?? [];
  const update = (index: number, patch: Partial<ProjectInvoice>) => onChange({ ...draft, invoices: invoices.map((invoice, invoiceIndex) => { if (invoiceIndex !== index) return invoice; const next = { ...invoice, ...patch }; next.tax_amount = Number((next.subtotal * next.tax_rate / 100).toFixed(2)); next.amount = Number((next.subtotal + next.tax_amount).toFixed(2)); return next; }) });
  const add = () => onChange({ ...draft, invoices: [...invoices, { id: crypto.randomUUID(), reference: `INV-${String(invoices.length + 1).padStart(3, '0')}`, kind: 'interim', status: 'draft', subtotal: 0, tax_rate: taxRate, tax_amount: 0, amount: 0, issue_date: '', due_date: '', paid_date: '', notes: '' }] });
  const billed = invoices.filter((item) => item.status !== 'void').reduce((sum, item) => sum + item.amount, 0);
  const paid = invoices.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  return <div className="admin-project-workspace">
    <div className="admin-consultation-summary"><Summary label="Project value" value={formatCurrency(draft.value ?? 0)} /><Summary label="Invoiced" value={formatCurrency(billed)} /><Summary label="Paid" value={formatCurrency(paid)} /><Summary label="Outstanding" value={formatCurrency(Math.max(0, billed - paid))} /></div>
    <div className="admin-subpanel-heading"><div><h3>Invoice register</h3><p>Track deposit, interim, consultation, and final invoices.</p></div><button className="btn btn-outline-accent" onClick={add} type="button"><Plus size={16} /> Add invoice</button></div>
    <div className="admin-invoice-register">{invoices.map((invoice, index) => <article key={invoice.id}>
      <div className="admin-invoice-grid"><label>Reference<input className="form-control" onChange={(event) => update(index, { reference: event.target.value })} value={invoice.reference} /></label><label>Type<select className="form-select" onChange={(event) => update(index, { kind: event.target.value as ProjectInvoice['kind'] })} value={invoice.kind}><option value="deposit">Deposit</option><option value="interim">Interim</option><option value="final">Final</option><option value="consultation">Consultation</option><option value="other">Other</option></select></label><label>Net amount (£)<input className="form-control" min="0" onChange={(event) => update(index, { subtotal: Number(event.target.value) })} step="0.01" type="number" value={invoice.subtotal} /></label><label>Tax (global)<input className="form-control" readOnly value={`${invoice.tax_rate}%`} /></label><label>Total<input className="form-control" readOnly value={formatCurrency(invoice.amount)} /></label><label>Status<select className="form-select" onChange={(event) => { const status = event.target.value as ProjectInvoice['status']; update(index, { status, paid_date: status === 'paid' && !invoice.paid_date ? new Date().toISOString().slice(0, 10) : invoice.paid_date }); }} value={invoice.status}><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></label><label>Issued<input className="form-control" onChange={(event) => update(index, { issue_date: event.target.value })} type="date" value={invoice.issue_date} /></label><label>Due<input className="form-control" onChange={(event) => update(index, { due_date: event.target.value })} type="date" value={invoice.due_date} /></label></div>
      <label>Notes<input className="form-control" onChange={(event) => update(index, { notes: event.target.value })} value={invoice.notes} /></label>
      <div className="admin-management-actions"><button className="btn btn-outline-accent btn-sm" onClick={() => void onDownload(invoice)} type="button"><Download size={15} /> PDF</button><button className="btn btn-accent btn-sm" disabled={invoice.status === 'void'} onClick={() => void onSend(invoice)} type="button"><Send size={15} /> Send invoice</button><button className="admin-icon-button is-danger" onClick={() => onChange({ ...draft, invoices: invoices.filter((_, invoiceIndex) => invoiceIndex !== index) })} title="Remove invoice" type="button"><X size={15} /></button></div>
    </article>)}</div>
    {invoices.length === 0 ? <p className="admin-empty">No invoices recorded for this project.</p> : null}
  </div>;
}

function Checklist({ title, items, onChange }: { title: string; items: ProjectChecklistItem[]; onChange: (items: ProjectChecklistItem[]) => void }) {
  const add = () => onChange([...items, { id: crypto.randomUUID(), title: '', completed: false, due_date: '' }]);
  return <section className="admin-checklist"><div className="admin-subpanel-heading"><h3>{title}</h3><button className="btn btn-link" onClick={add} type="button"><Plus size={14} /> Add</button></div>{items.map((item, index) => <div className="admin-checklist-item" key={item.id}><input checked={item.completed} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, completed: event.target.checked } : value))} type="checkbox" /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} placeholder={title.slice(0, -1)} value={item.title} /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, due_date: event.target.value } : value))} type="date" value={item.due_date} /><button className="admin-icon-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="Remove" type="button"><X size={15} /></button></div>)}</section>;
}

function ProjectTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick} role="tab" type="button">{label}</button>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function consultationHours(meetings: ProjectMeeting[], filter: (meeting: ProjectMeeting) => boolean) { return meetings.filter((meeting) => meeting.counts_as_consultation && filter(meeting)).reduce((sum, meeting) => sum + meeting.duration_minutes / 60, 0); }
function normaliseProject(project: AdminProject): AdminProject { return { ...project, services: project.services ?? [], included_consultation_hours: project.included_consultation_hours ?? 8, consultation_rate: project.consultation_rate ?? 16.5, meetings: project.meetings ?? [], invoices: (project.invoices ?? []).map((invoice) => { const subtotal = invoice.subtotal ?? invoice.amount ?? 0; const rate = invoice.tax_rate ?? 0; const tax = invoice.tax_amount ?? Number((subtotal * rate / 100).toFixed(2)); return { ...invoice, subtotal, tax_rate: rate, tax_amount: tax, amount: Number((subtotal + tax).toFixed(2)) }; }), tasks: project.tasks ?? [], milestones: project.milestones ?? [], completion: project.completion ?? 0 }; }
function nextHourInput() { const date = new Date(Date.now() + 60 * 60 * 1000); date.setMinutes(0, 0, 0); return toDateTimeInput(date.toISOString()); }
function toDateTimeInput(value?: string) { if (!value) return ''; const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function downloadCalendarEvent(project: Partial<AdminProject>, meeting: ProjectMeeting) {
  const start = new Date(meeting.start_at); if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + meeting.duration_minutes * 60000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Carter Digital Solutions//Project CRM//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${meeting.id}@carterdigitalsolutions`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${clean(meeting.title)}`, `DESCRIPTION:${clean(meeting.notes || `Meeting for ${project.name ?? 'client project'}`)}`, `LOCATION:${clean(meeting.location || '')}`, ...(project.client_email ? [`ATTENDEE;CN=${clean(project.client_name || 'Client')}:mailto:${project.client_email}`] : []), 'END:VEVENT', 'END:VCALENDAR'];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'meeting'}.ics`; anchor.click(); URL.revokeObjectURL(url);
}

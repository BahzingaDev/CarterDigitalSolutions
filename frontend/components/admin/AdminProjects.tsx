import { Building2, CalendarPlus, CheckCircle2, Clock3, Download, FilePlus2, Mail, MessageSquareText, Phone, Plus, ReceiptText, Save, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  deleteAdminProject,
  downloadAdminProjectInvoice,
  fetchAdminCustomers,
  fetchCommercialSettings,
  fetchAdminProjects,
  saveAdminProject,
  sendAdminProjectInvoice,
  type AdminCustomer,
  type AdminEnquiry,
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
  services: [], included_consultation_hours: 0, consultation_rate: 16.5, meetings: [], invoices: [], tasks: [], milestones: [], completion: 0,
};
type WorkspaceTab = 'overview' | 'delivery' | 'meetings' | 'invoices';

export function AdminProjects({ csrfToken, enquiries, initialProjectId, initialTab, onInvoiceSent, onTabChange, refreshKey = 0 }: { csrfToken: string; enquiries: AdminEnquiry[]; initialProjectId?: string | null; initialTab?: WorkspaceTab; onInvoiceSent?: () => Promise<void>; onTabChange?: (tab: WorkspaceTab) => void; refreshKey?: number }) {
  const [items, setItems] = useState<AdminProject[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [draft, setDraft] = useState<Partial<AdminProject>>(empty);
  const [tags, setTags] = useState('');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [savedFingerprint, setSavedFingerprint] = useState(() => projectFingerprint(empty, ''));

  useEffect(() => {
    void fetchAdminProjects()
      .then((projects) => {
        const normalised = projects.map(normaliseProject);
        setItems(normalised);
        const target = normalised.find((project) => project.id === initialProjectId);
        if (target) { const targetTags = target.tags.join(', '); setDraft(target); setTags(targetTags); setSavedFingerprint(projectFingerprint(target, targetTags)); setEditing(true); setTab(initialTab ?? 'overview'); }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load projects'));
  }, [initialProjectId, refreshKey]);
  useEffect(() => { void fetchAdminCustomers().then(setCustomers).catch(() => setCustomers([])); }, [refreshKey]);
  useEffect(() => { void fetchCommercialSettings().then((settings) => setTaxRate(settings.tax_rate)); }, []);
  useEffect(() => { onTabChange?.(tab); }, [onTabChange, tab]);

  const isDirty = editing && projectFingerprint(draft, tags) !== savedFingerprint;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const select = (item: AdminProject) => { if (isDirty && !window.confirm('Discard unsaved project changes?')) return; const normalised = normaliseProject(item); const itemTags = item.tags.join(', '); setDraft(normalised); setTags(itemTags); setSavedFingerprint(projectFingerprint(normalised, itemTags)); setEditing(true); setTab('overview'); setError(''); };
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
      const savedTags = saved.tags.join(', '); setDraft(saved); setTags(savedTags); setSavedFingerprint(projectFingerprint(saved, savedTags));
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
    setItems((current) => current.filter((item) => item.id !== draft.id)); setDraft(empty); setSavedFingerprint(projectFingerprint(empty, '')); setEditing(false);
  };
  const linkedEnquiry = enquiries.find((item) => item.id === draft.linked_enquiry_id);
  const customer = customers.find((item) => item.email.toLowerCase() === String(draft.client_email ?? '').toLowerCase());

  return <div className="admin-view-stack">
    <div className="admin-pipeline-toolbar"><div><strong>{items.length} projects</strong><span>{formatCurrency(items.filter((item) => item.stage !== 'completed').reduce((sum, item) => sum + item.value, 0))} open pipeline</span></div><button className="btn btn-accent" onClick={() => { if (isDirty && !window.confirm('Discard unsaved project changes?')) return; setDraft(empty); setTags(''); setSavedFingerprint(projectFingerprint(empty, '')); setEditing(true); setTab('overview'); }} type="button"><Plus size={16} /> New project</button></div>
    {error ? <div className="alert alert-danger">{error}</div> : null}
    {editing ? <section className="admin-panel admin-project-editor">
      <div className="admin-project-workspace-heading"><div><p className="section-kicker">Client project</p><h2>{draft.name || 'New project'}</h2><span>{draft.client_name || 'No client assigned'}{isDirty ? ' · Unsaved changes' : ''}</span></div><div className="admin-management-actions"><button className="btn btn-accent" disabled={isSaving || !isDirty} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : isDirty ? 'Save project' : 'Saved'}</button><button className="btn btn-outline-secondary" onClick={() => { if (!isDirty || window.confirm('Discard unsaved project changes?')) setEditing(false); }} type="button">Close</button>{draft.id ? <button className="admin-icon-button is-danger" onClick={() => void remove()} title="Delete project" type="button"><Trash2 size={16} /></button> : null}</div></div>
      <ProjectNextAction draft={draft} onTab={setTab} />
      <div className="admin-project-tabs" role="tablist"><ProjectTab active={tab === 'overview'} label="Overview" onClick={() => setTab('overview')} /><ProjectTab active={tab === 'delivery'} label="Delivery" onClick={() => setTab('delivery')} /><ProjectTab active={tab === 'meetings'} label="Meetings" onClick={() => setTab('meetings')} /><ProjectTab active={tab === 'invoices'} label="Invoices" onClick={() => setTab('invoices')} /></div>
      {tab === 'overview' ? <ProjectOverview customer={customer} draft={draft} enquiry={linkedEnquiry} onChange={setDraft} onTags={setTags} tags={tags} /> : null}
      {tab === 'delivery' ? <DeliveryWorkspace draft={draft} onChange={setDraft} /> : null}
      {tab === 'meetings' ? <MeetingWorkspace draft={draft} onChange={setDraft} onInvoiceCreated={() => setTab('invoices')} taxRate={taxRate} /> : null}
      {tab === 'invoices' ? <InvoiceWorkspace draft={draft} onChange={setDraft} taxRate={taxRate} onDownload={async (invoice) => { const saved = await save(); if (saved) await downloadAdminProjectInvoice(saved.id, invoice.id, invoice.reference); }} onMarkPaid={async (invoice) => { const paidDraft = { ...draft, invoices: (draft.invoices ?? []).map((item) => item.id === invoice.id ? { ...item, status: 'paid' as const, paid_date: item.paid_date || new Date().toISOString().slice(0, 10) } : item) }; setDraft(paidDraft); const saved = await save(paidDraft); if (saved) await onInvoiceSent?.(); }} onSend={async (invoice) => { const saved = await save(); if (!saved) return; try { const updated = normaliseProject(await sendAdminProjectInvoice(csrfToken, saved.id, invoice.id)); setDraft(updated); setSavedFingerprint(projectFingerprint(updated, tags)); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); await onInvoiceSent?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send invoice'); } }} /> : null}
    </section> : null}
    {!editing ? <div className="admin-kanban">{stages.map((stage) => <section className="admin-kanban-column" key={stage.id}><header><span>{stage.label}</span><em>{items.filter((item) => item.stage === stage.id).length}</em></header><div>{items.filter((item) => item.stage === stage.id).map((project) => <article className="admin-project-card" key={project.id} onClick={() => select(project)}><strong>{project.name}</strong><small>{project.client_name || 'No client assigned'}</small><span>{formatCurrency(project.value)}</span><div className="admin-card-progress"><i style={{ width: `${project.completion ?? 0}%` }} /></div><small>{projectCardSummary(project)}</small><small className={`admin-card-deposit is-${depositState(project.invoices)}`}>{depositSummary(project.invoices)}</small>{project.due_date ? <time>{formatDisplayDate(project.due_date)}</time> : null}<select aria-label={`Move ${project.name}`} onClick={(event) => event.stopPropagation()} onChange={(event) => void move(project, event.target.value as ProjectStage)} value={project.stage}>{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article>)}</div></section>)}</div> : null}
  </div>;
}

function ProjectOverview({ customer, draft, enquiry, onChange, onTags, tags }: { customer?: AdminCustomer; draft: Partial<AdminProject>; enquiry?: AdminEnquiry; onChange: (value: Partial<AdminProject>) => void; onTags: (value: string) => void; tags: string }) {
  const quote = enquiry?.quote_versions.find((item) => item.id === draft.source_quote_id);
  const services = (draft.services ?? []).filter((item) => !item.optional || item.included);
  const labourHours = estimatedLabourHours(services);
  const deposit = (draft.invoices ?? []).find((item) => item.kind === 'deposit' && item.status !== 'void');
  const recentCommunications = [...(enquiry?.communications ?? [])].reverse().slice(0, 3);
  return <div className="admin-project-workspace admin-project-overview">
    <div className="admin-project-facts">
      <Summary label="Project value" value={formatCurrency(draft.value ?? 0)} />
      <Summary label="Labour" value={`${labourHours}h`} />
      <Summary label="Consultation included" value={`${draft.included_consultation_hours ?? 0}h`} />
      <Summary label="Deposit" value={deposit ? `${formatCurrency(deposit.amount)} · ${deposit.status}` : 'Not recorded'} />
      <Summary label="Completion" value={`${draft.completion ?? 0}%`} />
      <Summary label="Due" value={draft.due_date ? formatDisplayDate(draft.due_date) : 'Not set'} />
    </div>

    <div className="admin-project-overview-columns">
      <section className="admin-project-section">
        <div className="admin-project-section-heading"><div><h3>Project and client</h3><p>The working record and primary contact details.</p></div></div>
        <div className="admin-management-grid">
          <label>Project name<input className="form-control" onChange={(event) => onChange({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label>
          <label>Stage<select className="form-select" onChange={(event) => onChange({ ...draft, stage: event.target.value as ProjectStage })} value={draft.stage}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
          <label>Client name<input className="form-control" onChange={(event) => onChange({ ...draft, client_name: event.target.value })} value={draft.client_name ?? ''} /></label>
          <label>Client email<input className="form-control" onChange={(event) => onChange({ ...draft, client_email: event.target.value })} type="email" value={draft.client_email ?? ''} /></label>
          <label>Project value (£)<input className="form-control" min="0" onChange={(event) => onChange({ ...draft, value: Number(event.target.value) })} step="0.01" type="number" value={draft.value ?? 0} /></label>
          <label>Due date<input className="form-control" onChange={(event) => onChange({ ...draft, due_date: event.target.value })} type="date" value={draft.due_date ?? ''} /></label>
        </div>
        <div className="admin-contact-strip">
          <span><Mail size={15} /> {draft.client_email || 'No email recorded'}</span>
          <span><Phone size={15} /> {customer?.phone || 'No phone recorded'}</span>
          <span><Building2 size={15} /> {customer?.organisation || 'No organisation recorded'}</span>
        </div>
        {customer?.notes ? <div className="admin-project-note"><strong>Customer notes</strong><p>{customer.notes}</p></div> : null}
      </section>

      <section className="admin-project-section">
        <div className="admin-project-section-heading"><div><h3>Source and commercial context</h3><p>The enquiry and accepted quote behind this project.</p></div></div>
        {enquiry ? <>
          <dl className="admin-project-context-list"><div><dt>Project type</dt><dd>{enquiry.project_type || 'Not specified'}</dd></div><div><dt>Enquiry received</dt><dd>{formatDisplayDate(enquiry.created_at)}</dd></div><div><dt>Original estimate</dt><dd>{enquiry.estimated_hours || 0}h · {formatCurrency(enquiry.estimated_cost || 0)}</dd></div><div><dt>Enquiry status</dt><dd>{enquiry.status}</dd></div></dl>
          {enquiry.message ? <div className="admin-project-note"><strong>Customer request</strong><p>{enquiry.message}</p></div> : null}
        </> : <p className="admin-empty">This project is not linked to an enquiry.</p>}
        {quote ? <div className="admin-quote-snapshot"><strong>Quote version {quote.version} · {quote.status}</strong><dl><div><dt>Subtotal</dt><dd>{formatCurrency(quote.subtotal)}</dd></div><div><dt>Discount</dt><dd>{formatCurrency(quote.discount)}</dd></div><div><dt>Expenses</dt><dd>{formatCurrency(quote.expenses)}</dd></div><div><dt>Tax</dt><dd>{formatCurrency(quote.tax_amount)}</dd></div><div><dt>Total</dt><dd>{formatCurrency(quote.total)}</dd></div><div><dt>Deposit</dt><dd>{formatCurrency(quote.deposit)}</dd></div></dl>{quote.notes ? <div className="admin-project-note"><strong>Quote notes</strong><p>{quote.notes}</p></div> : null}</div> : null}
      </section>
    </div>

    <section className="admin-project-section admin-project-scope">
      <div className="admin-project-section-heading"><div><h3>Confirmed scope</h3><p>Every service, labour allowance, rate, line value, and configured deposit.</p></div><strong>{formatCurrency(services.reduce((total, item) => total + item.hours * item.rate, 0))}</strong></div>
      <div className="admin-project-service-table"><div className="is-header"><span>Service</span><span>Hours</span><span>Rate</span><span>Labour value</span><span>Deposit</span></div>{services.map((item, index) => <div key={`${item.service}-${index}`}><span><strong>{item.service}</strong><small>{item.category}</small></span><span>{item.hours}h</span><span>{formatCurrency(item.rate)}</span><span>{formatCurrency(item.hours * item.rate)}</span><span>{item.deposit_amount ? formatCurrency(item.deposit_amount) : '—'}</span></div>)}{services.length === 0 ? <p className="admin-empty">No services have been attached to this project.</p> : null}</div>
    </section>

    {recentCommunications.length > 0 || (enquiry?.activity.length ?? 0) > 0 ? <section className="admin-project-section"><div className="admin-project-section-heading"><div><h3>Communication and activity</h3><p>Customer messages and the complete source-record history.</p></div><MessageSquareText size={20} /></div>{recentCommunications.length > 0 ? <div className="admin-project-communications">{recentCommunications.map((item) => <CommunicationRow item={item} key={item.id} />)}</div> : null}{(enquiry?.communications.length ?? 0) > 3 ? <details className="admin-project-history"><summary>Full communication history ({enquiry?.communications.length})</summary><div className="admin-project-communications">{[...(enquiry?.communications ?? [])].reverse().map((item) => <CommunicationRow item={item} key={item.id} />)}</div></details> : null}{(enquiry?.activity.length ?? 0) > 0 ? <details className="admin-project-history"><summary>Enquiry and quote activity ({enquiry?.activity.length})</summary><ol>{[...(enquiry?.activity ?? [])].reverse().map((item) => <li key={item.id}><span>{item.description}</span><time>{formatDisplayDate(item.created_at)}</time></li>)}</ol></details> : null}</section> : null}

    <div className="admin-management-grid"><label>Tags<input className="form-control" onChange={(event) => onTags(event.target.value)} value={tags} /></label><span /></div>
    <label>Project notes<textarea className="form-control" onChange={(event) => onChange({ ...draft, notes: event.target.value })} rows={5} value={draft.notes ?? ''} /></label>
  </div>;
}

function DeliveryWorkspace({ draft, onChange }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void }) {
  return <div className="admin-project-workspace">
    <div className="admin-project-progress"><span>Completion</span><div><i style={{ width: `${draft.completion ?? 0}%` }} /></div><strong>{draft.completion ?? 0}%</strong></div>
    <div className="admin-checklist-grid"><Checklist title="Tasks" items={draft.tasks ?? []} onChange={(tasks) => onChange({ ...draft, tasks })} /><Checklist title="Milestones" items={draft.milestones ?? []} onChange={(milestones) => onChange({ ...draft, milestones })} /></div>
  </div>;
}

function CommunicationRow({ item }: { item: AdminEnquiry['communications'][number] }) {
  return <div><span><strong>{item.subject}</strong><small>{item.direction} · {item.status} · {formatDisplayDate(item.sent_at)}</small></span><p>{item.message}</p></div>;
}

function MeetingWorkspace({ draft, onChange, onInvoiceCreated, taxRate }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void; onInvoiceCreated: () => void; taxRate: number }) {
  const meetings = draft.meetings ?? [];
  const bookedHours = consultationHours(meetings, (meeting) => meeting.status !== 'cancelled');
  const completedHours = consultationHours(meetings, (meeting) => meeting.status === 'completed');
  const labourHours = estimatedLabourHours(draft.services ?? []);
  const includedCap = consultationHourCap(draft.services ?? []);
  const included = Math.min(draft.included_consultation_hours ?? includedCap, includedCap);
  const rate = draft.consultation_rate ?? 16.5;
  const completedBillableHours = Math.max(0, completedHours - included);
  const invoicedHours = (draft.invoices ?? []).filter((invoice) => invoice.kind === 'consultation' && invoice.status !== 'void').reduce((sum, invoice) => sum + invoiceConsultationHours(invoice), 0);
  const billableHours = Math.max(0, completedBillableHours - invoicedHours);
  const update = (index: number, patch: Partial<ProjectMeeting>) => onChange({ ...draft, meetings: meetings.map((meeting, meetingIndex) => meetingIndex === index ? { ...meeting, ...patch } : meeting) });
  const add = () => onChange({ ...draft, meetings: [...meetings, { id: crypto.randomUUID(), title: 'Project consultation', start_at: nextHourInput(), duration_minutes: 60, status: 'scheduled', counts_as_consultation: true, location: '', notes: '', calendar_provider: '', external_calendar_id: '' }] });
  const createConsultationInvoice = () => {
    const invoices = draft.invoices ?? [];
    const subtotal = Number((billableHours * rate).toFixed(2));
    const taxAmount = Number((subtotal * taxRate / 100).toFixed(2));
    onChange({ ...draft, invoices: [...invoices, { id: crypto.randomUUID(), reference: `CONS-${new Date().toISOString().slice(0, 10)}-${invoices.filter((item) => item.kind === 'consultation').length + 1}`, kind: 'consultation', status: 'draft', subtotal, tax_rate: taxRate, tax_amount: taxAmount, amount: subtotal + taxAmount, issue_date: '', due_date: '', paid_date: '', notes: `${billableHours.toFixed(2)} completed consultation hours`, consultation_hours: billableHours }] });
    onInvoiceCreated();
  };
  return <div className="admin-project-workspace">
    <div className="admin-management-grid"><label>Included consultation hours<input className="form-control" max={includedCap} min="0" onChange={(event) => onChange({ ...draft, included_consultation_hours: Math.min(Number(event.target.value), includedCap) })} step="0.25" type="number" value={included} /><small>Maximum {includedCap}h from {labourHours}h confirmed labour, capped at 8h.</small></label><label>Billable consultation rate (£/hour)<input className="form-control" min="0" onChange={(event) => onChange({ ...draft, consultation_rate: Number(event.target.value) })} step="0.01" type="number" value={rate} /></label></div>
    <div className="admin-consultation-summary"><Summary label="Booked" value={`${bookedHours.toFixed(2)}h`} /><Summary label="Completed" value={`${completedHours.toFixed(2)}h`} /><Summary label="Included remaining" value={`${Math.max(0, included - completedHours).toFixed(2)}h`} /><Summary label="Ready to invoice" value={formatCurrency(billableHours * rate)} /></div>
    <div className="admin-subpanel-heading"><div><h3>Meetings</h3><p>Schedule consultations and export them to your calendar.</p></div><button className="btn btn-outline-accent" onClick={add} type="button"><CalendarPlus size={16} /> Schedule meeting</button></div>
    <div className="admin-meeting-list">{meetings.map((meeting, index) => <article key={meeting.id}>
      <div className="admin-meeting-grid"><label>Title<input className="form-control" onChange={(event) => update(index, { title: event.target.value })} value={meeting.title} /></label><label>Starts<input className="form-control" onChange={(event) => update(index, { start_at: event.target.value })} type="datetime-local" value={toDateTimeInput(meeting.start_at)} /></label><label>Minutes<input className="form-control" min="15" max="480" onChange={(event) => update(index, { duration_minutes: Number(event.target.value) })} step="15" type="number" value={meeting.duration_minutes} /></label><label>Status<select className="form-select" onChange={(event) => update(index, { status: event.target.value as ProjectMeeting['status'] })} value={meeting.status}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Location or call link<input className="form-control" onChange={(event) => update(index, { location: event.target.value })} value={meeting.location} /></label></div>
      <label className="admin-archive-toggle"><input checked={meeting.counts_as_consultation} onChange={(event) => update(index, { counts_as_consultation: event.target.checked })} type="checkbox" /> Count towards consultation allowance</label>
      <label>Meeting notes<textarea className="form-control" onChange={(event) => update(index, { notes: event.target.value })} rows={2} value={meeting.notes} /></label>
      <div className="admin-management-actions"><button className="btn btn-outline-accent btn-sm" onClick={() => downloadCalendarEvent(draft, meeting)} type="button"><Download size={15} /> Add to calendar</button><button className="admin-icon-button is-danger" onClick={() => onChange({ ...draft, meetings: meetings.filter((_, meetingIndex) => meetingIndex !== index) })} title="Remove meeting" type="button"><X size={15} /></button></div>
    </article>)}</div>
    {meetings.length === 0 ? <p className="admin-empty">No meetings scheduled for this project.</p> : null}
    {billableHours > 0 ? <div className="admin-consultation-billing"><div><strong>{billableHours.toFixed(2)} completed hours are ready to invoice</strong><p>Previously invoiced consultation time is excluded automatically.</p></div><button className="btn btn-accent" onClick={createConsultationInvoice} type="button"><FilePlus2 size={16} /> Create {formatCurrency(billableHours * rate)} invoice</button></div> : null}
  </div>;
}

function InvoiceWorkspace({ draft, onChange, onDownload, onMarkPaid, onSend, taxRate }: { draft: Partial<AdminProject>; onChange: (value: Partial<AdminProject>) => void; onDownload: (invoice: ProjectInvoice) => Promise<void>; onMarkPaid: (invoice: ProjectInvoice) => Promise<void>; onSend: (invoice: ProjectInvoice) => Promise<void>; taxRate: number }) {
  const invoices = draft.invoices ?? [];
  const [sendingId, setSendingId] = useState('');
  const update = (index: number, patch: Partial<ProjectInvoice>) => onChange({ ...draft, invoices: invoices.map((invoice, invoiceIndex) => { if (invoiceIndex !== index) return invoice; const next = { ...invoice, ...patch }; next.tax_amount = Number((next.subtotal * next.tax_rate / 100).toFixed(2)); next.amount = Number((next.subtotal + next.tax_amount).toFixed(2)); return next; }) });
  const add = () => onChange({ ...draft, invoices: [...invoices, { id: crypto.randomUUID(), reference: `INV-${String(invoices.length + 1).padStart(3, '0')}`, kind: 'interim', status: 'draft', subtotal: 0, tax_rate: taxRate, tax_amount: 0, amount: 0, issue_date: '', due_date: '', paid_date: '', notes: '' }] });
  const billed = invoices.filter((item) => item.status !== 'void').reduce((sum, item) => sum + item.amount, 0);
  const paid = invoices.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  return <div className="admin-project-workspace">
    <DepositPaymentStatus invoices={invoices} />
    <div className="admin-consultation-summary"><Summary label="Project value" value={formatCurrency(draft.value ?? 0)} /><Summary label="Invoiced" value={formatCurrency(billed)} /><Summary label="Paid" value={formatCurrency(paid)} /><Summary label="Outstanding" value={formatCurrency(Math.max(0, billed - paid))} /></div>
    <div className="admin-subpanel-heading"><div><h3>Invoice register</h3><p>Track deposit, interim, consultation, and final invoices.</p></div><button className="btn btn-outline-accent" onClick={add} type="button"><Plus size={16} /> Add invoice</button></div>
    <div className="admin-invoice-register">{invoices.map((invoice, index) => <article key={invoice.id}>
      <div className="admin-invoice-grid"><label>Reference<input className="form-control" onChange={(event) => update(index, { reference: event.target.value })} value={invoice.reference} /></label><label>Type<select className="form-select" onChange={(event) => update(index, { kind: event.target.value as ProjectInvoice['kind'] })} value={invoice.kind}><option value="deposit">Deposit</option><option value="interim">Interim</option><option value="final">Final</option><option value="consultation">Consultation</option><option value="other">Other</option></select></label><label>Net amount (£)<input className="form-control" min="0" onChange={(event) => update(index, { subtotal: Number(event.target.value) })} step="0.01" type="number" value={invoice.subtotal} /></label><label>Tax (global)<input className="form-control" readOnly value={`${invoice.tax_rate}%`} /></label><label>Total<input className="form-control" readOnly value={formatCurrency(invoice.amount)} /></label><label>Status<select className="form-select" onChange={(event) => { const status = event.target.value as ProjectInvoice['status']; update(index, { status, paid_date: status === 'paid' && !invoice.paid_date ? new Date().toISOString().slice(0, 10) : invoice.paid_date }); }} value={invoice.status}><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></label><label>Issued<input className="form-control" onChange={(event) => update(index, { issue_date: event.target.value })} type="date" value={invoice.issue_date} /></label><label>Due<input className="form-control" onChange={(event) => update(index, { due_date: event.target.value })} type="date" value={invoice.due_date} /></label></div>
      <label>Notes<input className="form-control" onChange={(event) => update(index, { notes: event.target.value })} value={invoice.notes} /></label>
      <div className="admin-management-actions"><button className="btn btn-outline-accent btn-sm" onClick={() => void onDownload(invoice)} type="button"><Download size={15} /> PDF</button>{invoice.status === 'sent' || invoice.status === 'overdue' ? <button className="btn btn-outline-accent btn-sm" onClick={() => void onMarkPaid(invoice)} type="button">Mark paid</button> : null}<button className="btn btn-accent btn-sm" disabled={invoice.status === 'void' || sendingId === invoice.id} onClick={() => { if (!window.confirm(`Send ${invoice.reference} for ${formatCurrency(invoice.amount)} to ${draft.client_email || 'the client'}?`)) return; setSendingId(invoice.id); void onSend(invoice).finally(() => setSendingId('')); }} type="button"><Send size={15} /> {sendingId === invoice.id ? 'Sending...' : invoice.status === 'sent' || invoice.status === 'overdue' ? 'Send reminder' : 'Send invoice'}</button><button className="admin-icon-button is-danger" onClick={() => onChange({ ...draft, invoices: invoices.filter((_, invoiceIndex) => invoiceIndex !== index) })} title="Remove invoice" type="button"><X size={15} /></button></div>
    </article>)}</div>
    {invoices.length === 0 ? <p className="admin-empty">No invoices recorded for this project.</p> : null}
  </div>;
}

function DepositPaymentStatus({ invoices }: { invoices: ProjectInvoice[] }) {
  const invoice = invoices.find((item) => item.kind === 'deposit' && item.status !== 'void');
  if (!invoice) return <section className="admin-deposit-payment is-none"><ReceiptText size={20} /><div><strong>No deposit invoice recorded</strong><small>This project does not currently have an active deposit invoice.</small></div><span>Not recorded</span></section>;
  const paid = invoice.status === 'paid';
  const waiting = invoice.status === 'sent' || invoice.status === 'overdue';
  const detail = paid
    ? `${formatCurrency(invoice.amount)} paid${invoice.paid_date ? ` on ${formatDisplayDate(invoice.paid_date)}` : ''}.`
    : waiting
      ? `${formatCurrency(invoice.amount)} awaiting payment${invoice.due_date ? ` · due ${formatDisplayDate(invoice.due_date)}` : ''}.`
      : `${formatCurrency(invoice.amount)} draft invoice ready to send.`;
  return <section className={`admin-deposit-payment is-${invoice.status}`}>{paid ? <CheckCircle2 size={20} /> : waiting ? <Clock3 size={20} /> : <ReceiptText size={20} />}<div><strong>{paid ? 'Deposit paid by invoice' : waiting ? 'Deposit invoice awaiting payment' : 'Deposit invoice prepared'}</strong><small>{invoice.reference} · {detail}</small></div><span>{paid ? 'Paid' : invoice.status === 'overdue' ? 'Overdue' : invoice.status === 'sent' ? 'Sent' : 'Draft'}</span></section>;
}

function Checklist({ title, items, onChange }: { title: string; items: ProjectChecklistItem[]; onChange: (items: ProjectChecklistItem[]) => void }) {
  const add = () => onChange([...items, { id: crypto.randomUUID(), title: '', completed: false, due_date: '' }]);
  return <section className="admin-checklist"><div className="admin-subpanel-heading"><h3>{title}</h3><button className="btn btn-link" onClick={add} type="button"><Plus size={14} /> Add</button></div>{items.map((item, index) => <div className="admin-checklist-item" key={item.id}><input checked={item.completed} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, completed: event.target.checked } : value))} type="checkbox" /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} placeholder={title.slice(0, -1)} value={item.title} /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, due_date: event.target.value } : value))} type="date" value={item.due_date} /><button className="admin-icon-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="Remove" type="button"><X size={15} /></button></div>)}</section>;
}

function ProjectNextAction({ draft, onTab }: { draft: Partial<AdminProject>; onTab: (tab: WorkspaceTab) => void }) {
  if (!draft.id) return null;
  const overdueInvoice = draft.invoices?.find((invoice) => invoice.status === 'overdue' || (invoice.status === 'sent' && invoice.due_date && new Date(`${invoice.due_date}T23:59:59`).getTime() < Date.now()));
  const draftDeposit = draft.invoices?.find((invoice) => invoice.kind === 'deposit' && invoice.status === 'draft');
  const overdueTask = draft.tasks?.find((task) => !task.completed && task.due_date && new Date(`${task.due_date}T23:59:59`).getTime() < Date.now());
  const hasKickoff = draft.meetings?.some((meeting) => meeting.status !== 'cancelled');
  const action = overdueInvoice
    ? { title: `Follow up ${overdueInvoice.reference}`, detail: 'This invoice has passed its due date.', tab: 'invoices' as const }
    : draftDeposit
      ? { title: `Send ${draftDeposit.reference}`, detail: 'The deposit invoice is ready before delivery begins.', tab: 'invoices' as const }
      : draft.stage === 'accepted' && !hasKickoff
        ? { title: 'Schedule the project kickoff', detail: 'Add the first client meeting and calendar event.', tab: 'meetings' as const }
        : overdueTask
          ? { title: `Complete ${overdueTask.title || 'the overdue task'}`, detail: 'An open delivery task has passed its due date.', tab: 'delivery' as const }
          : null;
  return action ? <button className="admin-project-next-action" onClick={() => onTab(action.tab)} type="button"><span><strong>Next action: {action.title}</strong><small>{action.detail}</small></span><span>Open {action.tab}</span></button> : null;
}

function ProjectTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick} role="tab" type="button">{label}</button>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function consultationHours(meetings: ProjectMeeting[], filter: (meeting: ProjectMeeting) => boolean) { return meetings.filter((meeting) => meeting.counts_as_consultation && filter(meeting)).reduce((sum, meeting) => sum + meeting.duration_minutes / 60, 0); }
function estimatedLabourHours(services: AdminProject['services']) { return services.filter((service) => !service.optional || service.included).reduce((total, service) => total + Number(service.hours || 0), 0); }
function consultationHourCap(services: AdminProject['services']) { return Math.min(8, Math.floor(estimatedLabourHours(services) / 4)); }
function invoiceConsultationHours(invoice: ProjectInvoice) { if ((invoice.consultation_hours ?? 0) > 0) return invoice.consultation_hours ?? 0; const match = invoice.notes.match(/([\d.]+)\s+(?:completed\s+)?billable\s+consultation\s+hours/i) ?? invoice.notes.match(/([\d.]+)\s+completed\s+consultation\s+hours/i); return match ? Number(match[1]) : 0; }
function projectCardSummary(project: AdminProject) { const openTasks = project.tasks.filter((item) => !item.completed).length; const upcoming = project.meetings.filter((item) => item.status === 'scheduled').length; return `${openTasks} open task${openTasks === 1 ? '' : 's'} · ${upcoming} upcoming meeting${upcoming === 1 ? '' : 's'}`; }
function depositState(invoices: ProjectInvoice[]) { return invoices.find((item) => item.kind === 'deposit' && item.status !== 'void')?.status ?? 'none'; }
function depositSummary(invoices: ProjectInvoice[]) { const invoice = invoices.find((item) => item.kind === 'deposit' && item.status !== 'void'); if (!invoice) return 'No deposit invoice'; if (invoice.status === 'paid') return `Deposit paid · ${formatCurrency(invoice.amount)}`; if (invoice.status === 'overdue') return `Deposit overdue · ${formatCurrency(invoice.amount)}`; if (invoice.status === 'sent') return `Deposit sent · ${formatCurrency(invoice.amount)}`; return `Deposit draft · ${formatCurrency(invoice.amount)}`; }
function projectFingerprint(project: Partial<AdminProject>, tags: string) { return JSON.stringify({ ...project, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }); }
function normaliseProject(project: AdminProject): AdminProject {
  return {
    ...project,
    services: project.services ?? [],
    included_consultation_hours: Math.min(project.included_consultation_hours ?? consultationHourCap(project.services ?? []), consultationHourCap(project.services ?? [])),
    consultation_rate: project.consultation_rate ?? 16.5,
    meetings: project.meetings ?? [],
    invoices: (project.invoices ?? []).map((invoice) => {
      const subtotal = invoice.subtotal ?? invoice.amount ?? 0;
      const rate = invoice.tax_rate ?? 0;
      const tax = invoice.tax_amount ?? Number((subtotal * rate / 100).toFixed(2));
      const overdue = invoice.status === 'sent' && invoice.due_date && new Date(`${invoice.due_date}T23:59:59`).getTime() < Date.now();
      return { ...invoice, status: overdue ? 'overdue' : invoice.status, subtotal, tax_rate: rate, tax_amount: tax, amount: Number((subtotal + tax).toFixed(2)) };
    }),
    tasks: project.tasks ?? [],
    milestones: project.milestones ?? [],
    completion: project.completion ?? 0,
  };
}
function formatDisplayDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }
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

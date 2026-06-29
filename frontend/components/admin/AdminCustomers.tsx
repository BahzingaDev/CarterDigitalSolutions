import { Activity, ArrowRight, BriefcaseBusiness, Files, Mail, Phone, ReceiptText, Save, Search, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { deleteAdminCustomer, fetchAdminCustomers, saveAdminCustomer, type AdminCustomer } from '../../src/api/admin';
import { hasQuoteActivity } from '../../src/data/adminEnquiries';
import { formatCurrency } from '../../src/data/pricing';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';
import { AdminDocuments } from './AdminDocuments';
import { ADMIN_PANE_PAGE_SIZE, AdminPagination, pageItems } from './AdminPagination';

type CustomerTab = 'overview' | 'engagements' | 'billing' | 'activity' | 'documents';

export function AdminCustomers({ csrfToken, onDirtyChange, onOpenEnquiry, onOpenProject, refreshKey = 0 }: {
  csrfToken: string;
  onOpenEnquiry: (id: string, isQuote: boolean) => void;
  onOpenProject: (id: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<AdminCustomer[]>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<AdminCustomer>();
  const [tags, setTags] = useState('');
  const [activeTab, setActiveTab] = useState<CustomerTab>('overview');
  const [sectionPage, setSectionPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState('');

  const isDirty = Boolean(draft) && fingerprint({ draft, tags }) !== savedFingerprint;
  const confirmDiscard = useUnsavedChanges(isDirty, onDirtyChange);

  const select = (customer: AdminCustomer) => {
    if (!confirmDiscard()) return;
    const nextTags = customer.tags.join(', ');
    setSelectedEmail(customer.email);
    setDraft(customer);
    setTags(nextTags);
    setActiveTab('overview');
    setSectionPage(1);
    setSavedFingerprint(fingerprint({ draft: customer, tags: nextTags }));
    setError('');
    setMessage('');
  };

  useEffect(() => {
    void fetchAdminCustomers()
      .then((customers) => {
        setItems(customers);
        const selected = customers.find((item) => item.email === selectedEmail) ?? customers[0];
        if (selected) select(selected);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load customers'));
  }, [refreshKey]);

  const filtered = useMemo(
    () => items.filter((item) => `${item.name} ${item.email} ${item.organisation}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / ADMIN_PANE_PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const visibleCustomers = pageItems(filtered, page);

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAdminCustomer(csrfToken, { ...draft, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      const merged = { ...draft, ...saved };
      setItems((current) => current.map((item) => item.email === merged.email ? merged : item));
      const nextTags = merged.tags.join(', ');
      setDraft(merged);
      setTags(nextTags);
      setSavedFingerprint(fingerprint({ draft: merged, tags: nextTags }));
      setMessage('Customer profile saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!draft) return;
    const linkedSummary = `${draft.enquiries.length} linked enquiries and ${draft.projects.length} linked projects`;
    if (!window.confirm(`Permanently delete ${draft.name || draft.email}, ${linkedSummary}, and associated documents? This cannot be undone.`)) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminCustomer(csrfToken, draft.email, true);
      const remaining = items.filter((item) => item.email !== draft.email);
      setItems(remaining);
      setSelectedEmail('');
      setDraft(undefined);
      setTags('');
      setSavedFingerprint('');
      if (remaining[0]) {
        const nextTags = remaining[0].tags.join(', ');
        setSelectedEmail(remaining[0].email);
        setDraft(remaining[0]);
        setTags(nextTags);
        setSavedFingerprint(fingerprint({ draft: remaining[0], tags: nextTags }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete customer');
    } finally {
      setIsSaving(false);
    }
  };

  const projects = draft?.projects ?? [];
  const enquiries = draft?.enquiries ?? [];
  const invoices = projects.flatMap((project) => (project.invoices ?? []).map((invoice) => ({ invoice, project })));
  const activeProjects = projects.filter((project) => project.stage !== 'completed');
  const projectValue = projects.reduce((total, project) => total + Number(project.value || 0), 0);
  const billedValue = invoices.filter(({ invoice }) => invoice.status !== 'void').reduce((total, { invoice }) => total + Number(invoice.amount || 0), 0);
  const paidValue = invoices.filter(({ invoice }) => invoice.status === 'paid').reduce((total, { invoice }) => total + Number(invoice.amount || 0), 0);
  const communicationCount = enquiries.reduce((total, enquiry) => total + (enquiry.communications?.length ?? 0), 0);
  const changeTab = (tab: CustomerTab) => { setActiveTab(tab); setSectionPage(1); };

  return <div className="admin-workspace-split admin-customer-layout">
    <section className="admin-panel admin-workspace-list">
      <label className="admin-search"><Search size={16} /><input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search customers" value={query} /></label>
      <p className="admin-list-caption">{filtered.length} customer{filtered.length === 1 ? '' : 's'}</p>
      {visibleCustomers.map((customer) => <button className={selectedEmail === customer.email ? 'is-active' : ''} key={customer.email} onClick={() => select(customer)} type="button"><strong>{customer.name || customer.email}</strong><small>{customer.organisation || customer.email}</small></button>)}
      {filtered.length === 0 ? <p className="admin-empty">No customers found.</p> : null}
      <AdminPagination count={filtered.length} onPageChange={setPage} page={page} />
    </section>

    {draft ? <section className="admin-panel admin-workspace-editor admin-customer-workspace">
      <header className="admin-customer-header">
        <div className="admin-customer-heading"><span className="admin-account-avatar">{(draft.name || draft.email).charAt(0).toUpperCase()}</span><div><p className="section-kicker">Customer account</p><h2>{draft.name || draft.email}</h2><span>{draft.organisation || draft.email}</span></div></div>
        <div className="admin-management-actions">
          {draft.phone ? <a className="btn btn-outline-secondary" href={`tel:${draft.phone}`}><Phone size={16} /> Call</a> : null}
          <a className="btn btn-accent" href={`mailto:${draft.email}`}><Mail size={16} /> Email customer</a>
          <button className="admin-icon-button is-danger" disabled={isSaving} onClick={() => void remove()} title="Delete customer" type="button"><Trash2 size={16} /></button>
        </div>
      </header>

      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}

      <div className="admin-customer-metrics" aria-label="Customer summary">
        <Summary label="Active projects" value={String(activeProjects.length)} />
        <Summary label="Engagement value" value={formatCurrency(projectValue)} />
        <Summary label="Total invoiced" value={formatCurrency(billedValue)} />
        <Summary label="Outstanding" value={formatCurrency(Math.max(0, billedValue - paidValue))} />
      </div>

      <nav className="admin-customer-tabs" aria-label="Customer account sections">
        <CustomerTabButton active={activeTab === 'overview'} icon={UserRound} label="Overview" onClick={() => changeTab('overview')} />
        <CustomerTabButton active={activeTab === 'engagements'} icon={BriefcaseBusiness} label="Engagements" onClick={() => changeTab('engagements')} />
        <CustomerTabButton active={activeTab === 'billing'} icon={ReceiptText} label="Billing" onClick={() => changeTab('billing')} />
        <CustomerTabButton active={activeTab === 'activity'} icon={Activity} label="Activity" onClick={() => changeTab('activity')} />
        <CustomerTabButton active={activeTab === 'documents'} icon={Files} label="Documents" onClick={() => changeTab('documents')} />
      </nav>

      {activeTab === 'overview' ? <div className="admin-customer-section">
        <SectionHeading description="Core account information and internal context." title="Contact and profile">
          <button className="btn btn-accent" disabled={!isDirty || isSaving} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : isDirty ? 'Save profile' : 'Saved'}</button>
        </SectionHeading>
        <div className="admin-management-grid"><label>Name<input className="form-control" onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} /></label><label>Organisation<input className="form-control" onChange={(event) => setDraft({ ...draft, organisation: event.target.value })} value={draft.organisation} /></label><label>Email<input className="form-control" disabled type="email" value={draft.email} /></label><label>Phone<input className="form-control" onChange={(event) => setDraft({ ...draft, phone: event.target.value })} value={draft.phone} /></label><label>Tags<input className="form-control" onChange={(event) => setTags(event.target.value)} value={tags} /></label></div>
        <label className="admin-field">Customer notes<textarea className="form-control" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={5} value={draft.notes} /></label>
      </div> : null}

      {activeTab === 'engagements' ? <div className="admin-customer-section">
        <SectionHeading description="Projects and commercial work associated with this customer." title="Business engagements" />
        <div className="admin-customer-engagements">
          {pageItems(projects, sectionPage).map((item) => <button key={item.id} onClick={() => onOpenProject(item.id)} type="button"><span><strong>{item.name}</strong><small>{readableStatus(item.stage)} · {item.completion ?? 0}% complete</small></span><span><strong>{formatCurrency(item.value)}</strong><small>{item.due_date ? `Due ${formatDate(item.due_date)}` : 'No due date'}</small></span><ArrowRight size={16} /></button>)}
          {projects.length === 0 ? <p className="admin-empty">No projects have been created for this customer.</p> : null}
        </div>
        <AdminPagination count={projects.length} onPageChange={setSectionPage} page={sectionPage} />
      </div> : null}

      {activeTab === 'billing' ? <div className="admin-customer-section">
        <SectionHeading description="Billing across every customer project in one place." title="Invoice history"><strong>{formatCurrency(paidValue)} paid</strong></SectionHeading>
        <div className="admin-customer-invoices">
          <div className="is-header"><span>Invoice</span><span>Project</span><span>Issued</span><span>Status</span><span>Amount</span><span /></div>
          {pageItems(invoices, sectionPage).map(({ invoice, project }) => <button key={invoice.id} onClick={() => onOpenProject(project.id)} type="button"><span><strong>{invoice.reference}</strong><small>{readableStatus(invoice.kind)}</small></span><span>{project.name}</span><span>{invoice.issue_date ? formatDate(invoice.issue_date) : 'Not issued'}</span><span><em className={`admin-status admin-status-${invoice.status}`}>{readableStatus(invoice.status)}</em></span><strong>{formatCurrency(invoice.amount)}</strong><ArrowRight size={16} /></button>)}
          {invoices.length === 0 ? <p className="admin-empty">No invoices have been raised for this customer.</p> : null}
        </div>
        <AdminPagination count={invoices.length} onPageChange={setSectionPage} page={sectionPage} />
      </div> : null}

      {activeTab === 'activity' ? <div className="admin-customer-section">
        <SectionHeading description={`${enquiries.length} enquiries and ${communicationCount} recorded messages.`} title="Enquiries and correspondence" />
        <div className="admin-customer-engagements">
          {pageItems(enquiries, sectionPage).map((item) => <button key={item.id} onClick={() => onOpenEnquiry(item.id, hasQuoteActivity(item))} type="button"><span><strong>{item.project_type || item.type}</strong><small>{formatDate(item.created_at)} · {readableStatus(item.status)} · {(item.communications?.length ?? 0)} messages</small></span><span><strong>{formatCurrency(item.estimated_cost)}</strong><small>Initial estimate</small></span><ArrowRight size={16} /></button>)}
          {enquiries.length === 0 ? <p className="admin-empty">No enquiry or correspondence history is available.</p> : null}
        </div>
        <AdminPagination count={enquiries.length} onPageChange={setSectionPage} page={sectionPage} />
      </div> : null}

      {activeTab === 'documents' ? <div className="admin-customer-section"><SectionHeading description="Generated and uploaded files associated with this account." title="Customer documents" /><AdminDocuments csrfToken={csrfToken} customerEmail={draft.email} ownerId={draft.email} ownerType="customer" /></div> : null}
    </section> : <section className="admin-panel admin-zero-state"><UserRound size={28} /><h2>No customer selected</h2><p>Select a customer to open their account workspace.</p></section>}
  </div>;
}

function CustomerTabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof UserRound; label: string; onClick: () => void }) {
  return <button aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''} onClick={onClick} type="button"><Icon size={16} /><span>{label}</span></button>;
}

function SectionHeading({ children, description, title }: { children?: ReactNode; description: string; title: string }) {
  return <div className="admin-section-heading"><div><h3>{title}</h3><p>{description}</p></div>{children}</div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function readableStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character: string) => character.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

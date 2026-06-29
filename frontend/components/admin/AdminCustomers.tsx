import { ArrowRight, Mail, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { fetchAdminCustomers, saveAdminCustomer, type AdminCustomer } from '../../src/api/admin';
import { hasQuoteActivity } from '../../src/data/adminEnquiries';
import { formatCurrency } from '../../src/data/pricing';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';
import { AdminDocuments } from './AdminDocuments';

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
  const [draft, setDraft] = useState<AdminCustomer>();
  const [tags, setTags] = useState('');
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
    } finally { setIsSaving(false); }
  };

  return <div className="admin-workspace-split">
    <section className="admin-panel admin-workspace-list">
      <label className="admin-search"><Search size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" value={query} /></label>
      {filtered.map((customer) => <button className={selectedEmail === customer.email ? 'is-active' : ''} key={customer.email} onClick={() => select(customer)} type="button"><strong>{customer.name || customer.email}</strong><small>{customer.organisation || customer.email}</small></button>)}
      {filtered.length === 0 ? <p className="admin-empty">No customers found.</p> : null}
    </section>
    {draft ? <section className="admin-panel admin-workspace-editor">
      <div className="admin-customer-heading"><span className="admin-account-avatar">{(draft.name || draft.email).charAt(0).toUpperCase()}</span><div><h2>{draft.name || draft.email}</h2><a href={`mailto:${draft.email}`}><Mail size={14} /> {draft.email}</a></div></div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}
      <div className="admin-management-grid"><label>Name<input className="form-control" onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} /></label><label>Organisation<input className="form-control" onChange={(event) => setDraft({ ...draft, organisation: event.target.value })} value={draft.organisation} /></label><label>Phone<input className="form-control" onChange={(event) => setDraft({ ...draft, phone: event.target.value })} value={draft.phone} /></label><label>Tags<input className="form-control" onChange={(event) => setTags(event.target.value)} value={tags} /></label></div>
      <label>Customer notes<textarea className="form-control" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={5} value={draft.notes} /></label>
      <button className="btn btn-accent" disabled={!isDirty || isSaving} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : isDirty ? 'Save profile' : 'Saved'}</button>
      <section className="admin-customer-history">
        <h3>Enquiries</h3>
        {draft.enquiries.map((item) => <button key={item.id} onClick={() => onOpenEnquiry(item.id, hasQuoteActivity(item))} type="button"><span><strong>{item.project_type || item.type}</strong><small>{item.status} · {formatCurrency(item.estimated_cost)}</small></span><ArrowRight size={16} /></button>)}
        {draft.enquiries.length === 0 ? <p className="admin-empty">No enquiries.</p> : null}
        <h3>Projects</h3>
        {draft.projects.map((item) => <button key={item.id} onClick={() => onOpenProject(item.id)} type="button"><span><strong>{item.name}</strong><small>{item.stage} · {formatCurrency(item.value)} · {item.completion ?? 0}%</small></span><ArrowRight size={16} /></button>)}
        {draft.projects.length === 0 ? <p className="admin-empty">No projects.</p> : null}
      </section>
      <section className="admin-customer-documents"><h3>Documents</h3><AdminDocuments csrfToken={csrfToken} customerEmail={draft.email} ownerId={draft.email} ownerType="customer" /></section>
    </section> : <section className="admin-panel admin-zero-state"><h2>No customer selected</h2></section>}
  </div>;
}

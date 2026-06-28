import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteAdminTemplate, fetchAdminTemplates, saveAdminTemplate, type AdminTemplate } from '../../src/api/admin';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';

const empty = { name: '', subject: '', body: '' };
const placeholders = [
  ['name', 'Customer name'], ['email', 'Customer email'], ['project_type', 'Project type'],
  ['enquiry_type', 'Enquiry type'], ['reference', 'Enquiry reference'], ['received_date', 'Received date'],
  ['estimated_hours', 'Estimated hours'], ['estimated_cost', 'Estimated cost'],
  ['quote_total', 'Latest quote total'], ['quote_deposit', 'Latest quote deposit'],
] as const;
const samples: Record<string, string> = { name: 'Alex Morgan', email: 'alex@example.com', project_type: 'Professional website', enquiry_type: 'quote', reference: 'ENQ-EXAMPLE', received_date: '27 June 2026', estimated_hours: '24', estimated_cost: '£540.00', quote_total: '£540.00', quote_deposit: '£162.00' };

export function AdminTemplates({ csrfToken, onDirtyChange }: { csrfToken: string; onDirtyChange?: (isDirty: boolean) => void }) {
  const [items, setItems] = useState<AdminTemplate[]>([]);
  const [draft, setDraft] = useState<Partial<AdminTemplate>>(empty);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState(() => fingerprint(empty));
  useEffect(() => { void fetchAdminTemplates().then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load templates')); }, []);
  const isDirty = fingerprint(draft) !== savedFingerprint;
  const confirmDiscard = useUnsavedChanges(isDirty, onDirtyChange);
  const insert = (field: 'subject' | 'body', key: string) => setDraft((current) => ({ ...current, [field]: `${current[field] ?? ''}{{${key}}}` }));
  const select = (item: Partial<AdminTemplate>) => { if (!confirmDiscard()) return; setDraft(item); setSavedFingerprint(fingerprint(item)); setPreview(false); setError(''); setMessage(''); };
  const save = async () => { setIsSaving(true); setError(''); setMessage(''); try { const saved = await saveAdminTemplate(csrfToken, draft); setItems((current) => draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.name.localeCompare(b.name))); setDraft(saved); setSavedFingerprint(fingerprint(saved)); setMessage('Template saved.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save template'); } finally { setIsSaving(false); } };
  const remove = async () => { if (!draft.id || !window.confirm('Delete this template?')) return; setIsSaving(true); setError(''); setMessage(''); try { await deleteAdminTemplate(csrfToken, draft.id); setItems((current) => current.filter((item) => item.id !== draft.id)); setDraft(empty); setSavedFingerprint(fingerprint(empty)); setPreview(false); setMessage('Template deleted.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete template'); } finally { setIsSaving(false); } };

  return <div className="admin-workspace-split">
    <section className="admin-panel admin-workspace-list"><button className="btn btn-accent" onClick={() => select(empty)} type="button"><Plus size={16} /> New template</button>{items.map((item) => <button className={draft.id === item.id ? 'is-active' : ''} key={item.id} onClick={() => select(item)} type="button"><strong>{item.name}</strong><small>{item.subject}</small></button>)}{items.length === 0 ? <p className="admin-empty">No templates yet.</p> : null}</section>
    <section className="admin-panel admin-workspace-editor">
      <div className="admin-panel-heading"><div><h2>{draft.id ? 'Edit template' : 'New template'}</h2><p>Preview merge fields before using the template.</p></div><button className="btn btn-outline-accent" onClick={() => setPreview((current) => !current)} type="button"><Eye size={16} /> Preview</button></div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}
      {preview ? <article className="admin-template-preview"><small>Subject</small><h3>{resolve(draft.subject ?? '') || 'No subject'}</h3><div>{resolve(draft.body ?? '').split('\n').map((line, index) => <p key={index}>{line || <br />}</p>)}</div></article> : <><label>Name<input className="form-control" maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label><TemplateField label="Subject" multiline={false} onChange={(value) => setDraft({ ...draft, subject: value })} onInsert={(key) => insert('subject', key)} value={draft.subject ?? ''} /><TemplateField label="Message" multiline onChange={(value) => setDraft({ ...draft, body: value })} onInsert={(key) => insert('body', key)} value={draft.body ?? ''} /></>}
      <div className="admin-management-actions"><button className="btn btn-accent" disabled={!isDirty || isSaving} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : isDirty ? 'Save template' : 'Saved'}</button>{draft.id ? <button className="btn btn-outline-danger" disabled={isSaving} onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
    </section>
  </div>;
}

function TemplateField({ label, multiline, onChange, onInsert, value }: { label: string; multiline: boolean; onChange: (value: string) => void; onInsert: (key: string) => void; value: string }) { return <div className="admin-template-field"><label>{label}{multiline ? <textarea className="form-control" maxLength={5000} onChange={(event) => onChange(event.target.value)} rows={12} value={value} /> : <input className="form-control" maxLength={180} onChange={(event) => onChange(event.target.value)} value={value} />}</label><select aria-label={`Insert ${label} placeholder`} className="form-select admin-placeholder-select" onChange={(event) => { if (event.target.value) onInsert(event.target.value); event.target.value = ''; }} value=""><option value="">Insert placeholder</option>{placeholders.map(([key, text]) => <option key={key} value={key}>{text} — {'{{'}{key}{'}}'}</option>)}</select></div>; }
function resolve(value: string) { return Object.entries(samples).reduce((result, [key, replacement]) => result.split(`{{${key}}}`).join(replacement), value); }

import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteAdminTemplate, fetchAdminTemplates, saveAdminTemplate, type AdminTemplate } from '../../src/api/admin';
import { enquiryPlaceholders, resolveCorrespondence } from '../../src/data/correspondencePlaceholders';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';
import { PlaceholderReference, PlaceholderSelect } from './AdminPlaceholderReference';
import { AdminRichTextEditor, normaliseRichText } from './AdminRichTextEditor';

const empty = { name: '', subject: '', body: '' };
const samples = Object.fromEntries(enquiryPlaceholders.map((item) => [item.key, item.sample]));

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
      <PlaceholderReference definitions={enquiryPlaceholders} title="Available correspondence placeholders" />
      {preview ? <article className="admin-template-preview"><small>Subject</small><h3>{resolve(draft.subject ?? '') || 'No subject'}</h3><div dangerouslySetInnerHTML={{ __html: normaliseRichText(resolve(draft.body ?? '')) }} /></article> : <><label>Name<input className="form-control" maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label><TemplateField label="Subject" multiline={false} onChange={(value) => setDraft({ ...draft, subject: value })} onInsert={(key) => insert('subject', key)} value={draft.subject ?? ''} /><TemplateField label="Message" multiline onChange={(value) => setDraft({ ...draft, body: value })} onInsert={(key) => insert('body', key)} value={draft.body ?? ''} /></>}
      <div className="admin-management-actions"><button className="btn btn-accent" disabled={!isDirty || isSaving} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : isDirty ? 'Save template' : 'Saved'}</button>{draft.id ? <button className="btn btn-outline-danger" disabled={isSaving} onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
    </section>
  </div>;
}

function TemplateField({ label, multiline, onChange, onInsert, value }: { label: string; multiline: boolean; onChange: (value: string) => void; onInsert: (key: string) => void; value: string }) { return <div className="admin-template-field">{multiline ? <AdminRichTextEditor label={label} onChange={onChange} value={value} /> : <label>{label}<input className="form-control" maxLength={180} onChange={(event) => onChange(event.target.value)} value={value} /></label>}<PlaceholderSelect definitions={enquiryPlaceholders} label={`Insert ${label} placeholder`} onInsert={onInsert} /></div>; }
function resolve(value: string) { return resolveCorrespondence(value, samples); }

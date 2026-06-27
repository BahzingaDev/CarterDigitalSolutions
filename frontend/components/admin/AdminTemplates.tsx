import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteAdminTemplate, fetchAdminTemplates, saveAdminTemplate, type AdminTemplate } from '../../src/api/admin';

const empty = { name: '', subject: '', body: '' };

export function AdminTemplates({ csrfToken }: { csrfToken: string }) {
  const [items, setItems] = useState<AdminTemplate[]>([]);
  const [draft, setDraft] = useState<Partial<AdminTemplate>>(empty);
  const [error, setError] = useState('');

  const load = () => void fetchAdminTemplates().then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load templates'));
  useEffect(load, []);

  const save = async () => { setError(''); try { const saved = await saveAdminTemplate(csrfToken, draft); setItems((current) => draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.name.localeCompare(b.name))); setDraft(saved); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save template'); } };
  const remove = async () => { if (!draft.id || !window.confirm('Delete this template?')) return; await deleteAdminTemplate(csrfToken, draft.id); setItems((current) => current.filter((item) => item.id !== draft.id)); setDraft(empty); };

  return <div className="admin-workspace-split"><section className="admin-panel admin-workspace-list"><button className="btn btn-accent" onClick={() => setDraft(empty)} type="button"><Plus size={16} /> New template</button>{items.map((item) => <button className={draft.id === item.id ? 'is-active' : ''} key={item.id} onClick={() => setDraft(item)} type="button"><strong>{item.name}</strong><small>{item.subject}</small></button>)}{items.length === 0 ? <p className="admin-empty">No templates yet.</p> : null}</section><section className="admin-panel admin-workspace-editor"><div className="admin-panel-heading"><div><h2>{draft.id ? 'Edit template' : 'New template'}</h2><p>Templates become available in the enquiry message composer.</p></div></div>{error ? <div className="alert alert-danger">{error}</div> : null}<label>Name<input className="form-control" maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label><label>Subject<input className="form-control" maxLength={180} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} value={draft.subject ?? ''} /></label><label>Message<textarea className="form-control" maxLength={5000} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={12} value={draft.body ?? ''} /></label><div className="admin-management-actions"><button className="btn btn-accent" onClick={() => void save()} type="button"><Save size={16} /> Save template</button>{draft.id ? <button className="btn btn-outline-danger" onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button> : null}</div></section></div>;
}

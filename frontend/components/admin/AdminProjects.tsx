import { Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteAdminProject, fetchAdminProjects, saveAdminProject, type AdminProject, type ProjectChecklistItem, type ProjectStage } from '../../src/api/admin';
import { formatCurrency } from '../../src/data/pricing';

const stages: { id: ProjectStage; label: string }[] = [
  { id: 'lead', label: 'Lead' }, { id: 'discovery', label: 'Discovery' },
  { id: 'quoted', label: 'Quoted' }, { id: 'accepted', label: 'Accepted' },
  { id: 'active', label: 'Active' }, { id: 'on_hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
];
const empty = { name: '', client_name: '', client_email: '', stage: 'lead' as ProjectStage, value: 0, due_date: '', notes: '', tags: [], linked_enquiry_id: '', source_quote_id: '', tasks: [], milestones: [], completion: 0 };

export function AdminProjects({ csrfToken }: { csrfToken: string }) {
  const [items, setItems] = useState<AdminProject[]>([]);
  const [draft, setDraft] = useState<Partial<AdminProject>>(empty);
  const [tags, setTags] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void fetchAdminProjects().then((projects) => setItems(projects.map((item) => ({ ...item, tasks: item.tasks ?? [], milestones: item.milestones ?? [], completion: item.completion ?? 0 })))).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load projects')); }, []);
  const select = (item: AdminProject) => { setDraft(item); setTags(item.tags.join(', ')); setEditing(true); };
  const save = async (value = draft) => { try { const saved = await saveAdminProject(csrfToken, { ...value, tasks: value.tasks ?? [], milestones: value.milestones ?? [], tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }); setItems((current) => value.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); select(saved); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save project'); } };
  const move = async (project: AdminProject, stage: ProjectStage) => { const saved = await saveAdminProject(csrfToken, { ...project, stage }); setItems((current) => current.map((item) => item.id === saved.id ? saved : item)); };
  const remove = async () => { if (!draft.id || !window.confirm('Delete this project?')) return; await deleteAdminProject(csrfToken, draft.id); setItems((current) => current.filter((item) => item.id !== draft.id)); setDraft(empty); setEditing(false); };

  return <div className="admin-view-stack">
    <div className="admin-pipeline-toolbar"><div><strong>{items.length} projects</strong><span>{formatCurrency(items.filter((item) => item.stage !== 'completed').reduce((sum, item) => sum + item.value, 0))} open pipeline</span></div><button className="btn btn-accent" onClick={() => { setDraft(empty); setTags(''); setEditing(true); }} type="button"><Plus size={16} /> New project</button></div>
    {error ? <div className="alert alert-danger">{error}</div> : null}
    {editing ? <section className="admin-panel admin-project-editor">
      <div className="admin-management-grid">
        <label>Project name<input className="form-control" onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label>
        <label>Stage<select className="form-select" onChange={(event) => setDraft({ ...draft, stage: event.target.value as ProjectStage })} value={draft.stage}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
        <label>Client name<input className="form-control" onChange={(event) => setDraft({ ...draft, client_name: event.target.value })} value={draft.client_name ?? ''} /></label>
        <label>Client email<input className="form-control" onChange={(event) => setDraft({ ...draft, client_email: event.target.value })} type="email" value={draft.client_email ?? ''} /></label>
        <label>Value (£)<input className="form-control" min="0" onChange={(event) => setDraft({ ...draft, value: Number(event.target.value) })} step="0.01" type="number" value={draft.value ?? 0} /></label>
        <label>Due date<input className="form-control" onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} type="date" value={draft.due_date ?? ''} /></label>
      </div>
      <div className="admin-project-progress"><span>Completion</span><div><i style={{ width: `${draft.completion ?? 0}%` }} /></div><strong>{draft.completion ?? 0}%</strong></div>
      <div className="admin-checklist-grid"><Checklist title="Tasks" items={draft.tasks ?? []} onChange={(tasks) => setDraft({ ...draft, tasks })} /><Checklist title="Milestones" items={draft.milestones ?? []} onChange={(milestones) => setDraft({ ...draft, milestones })} /></div>
      <label>Tags<input className="form-control" onChange={(event) => setTags(event.target.value)} value={tags} /></label>
      <label>Notes<textarea className="form-control" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} value={draft.notes ?? ''} /></label>
      <div className="admin-management-actions"><button className="btn btn-accent" onClick={() => void save()} type="button"><Save size={16} /> Save project</button><button className="btn btn-outline-secondary" onClick={() => setEditing(false)} type="button">Close</button>{draft.id ? <button className="btn btn-outline-danger" onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
    </section> : null}
    <div className="admin-kanban">{stages.map((stage) => <section className="admin-kanban-column" key={stage.id}><header><span>{stage.label}</span><em>{items.filter((item) => item.stage === stage.id).length}</em></header><div>{items.filter((item) => item.stage === stage.id).map((project) => <article className="admin-project-card" key={project.id} onClick={() => select(project)}><strong>{project.name}</strong><small>{project.client_name || 'No client assigned'}</small><span>{formatCurrency(project.value)}</span><div className="admin-card-progress"><i style={{ width: `${project.completion ?? 0}%` }} /></div>{project.due_date ? <time>{project.due_date}</time> : null}<select aria-label={`Move ${project.name}`} onClick={(event) => event.stopPropagation()} onChange={(event) => void move(project, event.target.value as ProjectStage)} value={project.stage}>{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article>)}</div></section>)}</div>
  </div>;
}

function Checklist({ title, items, onChange }: { title: string; items: ProjectChecklistItem[]; onChange: (items: ProjectChecklistItem[]) => void }) {
  const add = () => onChange([...items, { id: crypto.randomUUID(), title: '', completed: false, due_date: '' }]);
  return <section className="admin-checklist"><div className="admin-subpanel-heading"><h3>{title}</h3><button className="btn btn-link" onClick={add} type="button"><Plus size={14} /> Add</button></div>{items.map((item, index) => <div className="admin-checklist-item" key={item.id}><input checked={item.completed} onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, completed: event.target.checked } : value))} type="checkbox" /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} placeholder={title.slice(0, -1)} value={item.title} /><input className="form-control" onChange={(event) => onChange(items.map((value, itemIndex) => itemIndex === index ? { ...value, due_date: event.target.value } : value))} type="date" value={item.due_date} /><button className="admin-icon-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title="Remove" type="button"><X size={15} /></button></div>)}</section>;
}

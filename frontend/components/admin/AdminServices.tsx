import { Eye, FolderTree, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  deleteAdminService,
  deleteAdminServiceCategory,
  fetchAdminServiceCategories,
  fetchAdminServices,
  saveAdminService,
  saveAdminServiceCategory,
  type AdminServiceCategory,
  type AdminServiceOverride,
} from '../../src/api/admin';
import { getBaselineCategories } from '../../src/api/services';
import { pricingCategories } from '../../src/data/pricing';
import { fingerprint, useUnsavedChanges } from '../../src/hooks/useUnsavedChanges';
import { ADMIN_PANE_PAGE_SIZE, AdminPagination, pageItems } from './AdminPagination';

const baseline = pricingCategories.flatMap((audience) => audience.groups.flatMap((group, groupIndex) =>
  group.services.map((service, index) => ({
    id: '',
    slug: service.slug,
    name: service.name,
    audience: audience.category,
    category_id: '',
    category: group.subcategory,
    description: group.description,
    best_for: service.bestFor,
    starting_from: service.startingFrom ?? 0,
    hourly_rate: service.hourlyRate ?? 0,
    estimated_hours: service.estimatedHours,
    deposit: service.deposit,
    deposit_amount: calculateDepositAmount(service.startingFrom ?? 0, service.deposit),
    active: true,
    sort_order: groupIndex * 100 + index,
    status: 'published' as const,
    outcomes: [],
    process_notes: [],
  }))));

const blankService: Partial<AdminServiceOverride> = {
  audience: 'For Industry', category_id: '', category: '', active: true, status: 'draft',
  starting_from: 0, hourly_rate: 16.5, estimated_hours: 6, deposit_amount: 0, sort_order: 0, outcomes: [], process_notes: [],
};
const blankCategory: Partial<AdminServiceCategory> = {
  audience: 'For Industry', active: true, status: 'draft', sort_order: 0,
};

export function AdminServices({ csrfToken, onDirtyChange }: { csrfToken: string; onDirtyChange?: (isDirty: boolean) => void }) {
  const [mode, setMode] = useState<'services' | 'categories'>('services');
  const [page, setPage] = useState(1);
  const [overrides, setOverrides] = useState<AdminServiceOverride[]>([]);
  const [managedCategories, setManagedCategories] = useState<AdminServiceCategory[]>([]);
  const [serviceDraft, setServiceDraft] = useState<Partial<AdminServiceOverride>>(baseline[0]);
  const [categoryDraft, setCategoryDraft] = useState<Partial<AdminServiceCategory>>(blankCategory);
  const [outcomes, setOutcomes] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedServiceFingerprint, setSavedServiceFingerprint] = useState(() => fingerprint({ draft: baseline[0], outcomes: '', processNotes: '' }));
  const [savedCategoryFingerprint, setSavedCategoryFingerprint] = useState(() => fingerprint(blankCategory));

  const serviceFingerprint = fingerprint({ draft: serviceDraft, outcomes, processNotes });
  const categoryFingerprint = fingerprint(categoryDraft);
  const isDirty = mode === 'services' ? serviceFingerprint !== savedServiceFingerprint : categoryFingerprint !== savedCategoryFingerprint;
  const confirmDiscard = useUnsavedChanges(isDirty, onDirtyChange);

  useEffect(() => {
    void Promise.all([fetchAdminServices(), fetchAdminServiceCategories()])
      .then(([services, categories]) => { setOverrides(services); setManagedCategories(categories); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the service catalogue'));
  }, []);

  const services = useMemo(() => [
    ...baseline.map((service) => ({ ...service, ...overrides.find((item) => item.slug === service.slug) })),
    ...overrides.filter((item) => !baseline.some((base) => base.slug === item.slug)),
  ].filter((service) => !service.deleted).sort((left, right) => left.sort_order - right.sort_order), [overrides]);

  const categories = useMemo(() => {
    const builtIn = getBaselineCategories().map((category) => ({
      ...category,
      ...managedCategories.find((item) => item.audience === category.audience && item.name === category.name),
    }));
    return [...builtIn, ...managedCategories.filter((item) => !builtIn.some((base) => base.id === item.id))]
      .sort((left, right) => left.sort_order - right.sort_order);
  }, [managedCategories]);

  const selectService = (service: Partial<AdminServiceOverride>) => {
    if (!confirmDiscard()) return;
    const nextOutcomes = (service.outcomes ?? []).join('\n');
    const nextProcessNotes = (service.process_notes ?? []).join('\n');
    setServiceDraft(service);
    setOutcomes(nextOutcomes);
    setProcessNotes(nextProcessNotes);
    setSavedServiceFingerprint(fingerprint({ draft: service, outcomes: nextOutcomes, processNotes: nextProcessNotes }));
    setPreview(false);
    setError('');
    setMessage('');
  };

  const selectCategory = (category: Partial<AdminServiceCategory>) => {
    if (!confirmDiscard()) return;
    setCategoryDraft(category);
    setSavedCategoryFingerprint(fingerprint(category));
    setError('');
    setMessage('');
  };

  const changeMode = (nextMode: 'services' | 'categories') => {
    if (nextMode === mode || !confirmDiscard()) return;
    setMode(nextMode);
    setPage(1);
  };

  const saveService = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAdminService(csrfToken, { ...serviceDraft, outcomes: lines(outcomes), process_notes: lines(processNotes) });
      setOverrides((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current.filter((item) => item.slug !== saved.slug), saved]);
      const nextOutcomes = (saved.outcomes ?? []).join('\n');
      const nextProcessNotes = (saved.process_notes ?? []).join('\n');
      setServiceDraft(saved);
      setOutcomes(nextOutcomes);
      setProcessNotes(nextProcessNotes);
      setSavedServiceFingerprint(fingerprint({ draft: saved, outcomes: nextOutcomes, processNotes: nextProcessNotes }));
      setMessage('Service saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save service');
    } finally { setIsSaving(false); }
  };

  const saveCategory = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAdminServiceCategory(csrfToken, categoryDraft);
      setManagedCategories((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setCategoryDraft(saved);
      setSavedCategoryFingerprint(fingerprint(saved));
      setMessage('Category saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save category');
    } finally { setIsSaving(false); }
  };

  const importBuiltIns = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const importedCategories = [...managedCategories];
      for (const category of getBaselineCategories()) {
        if (importedCategories.some((item) => item.audience === category.audience && item.name === category.name)) continue;
        importedCategories.push(await saveAdminServiceCategory(csrfToken, category));
      }
      const importedServices = [...overrides];
      for (const service of baseline) {
        const category = importedCategories.find((item) => item.audience === service.audience && item.name === service.category);
        const existingIndex = importedServices.findIndex((item) => item.slug === service.slug);
        if (existingIndex >= 0) {
          const existing = importedServices[existingIndex];
          if ((!existing.category_id && category?.id) || existing.deposit_amount == null) {
            importedServices[existingIndex] = await saveAdminService(csrfToken, { ...service, ...existing, deposit_amount: existing.deposit_amount ?? service.deposit_amount, category_id: existing.category_id || category?.id || '' });
          }
          continue;
        }
        importedServices.push(await saveAdminService(csrfToken, { ...service, category_id: category?.id ?? '' }));
      }
      setManagedCategories(importedCategories);
      setOverrides(importedServices);
      setMessage('Built-in catalogue imported.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import the built-in catalogue');
    } finally { setIsSaving(false); }
  };

  const importRequired = getBaselineCategories().some((category) => !managedCategories.some((item) => item.audience === category.audience && item.name === category.name))
    || baseline.some((service) => !overrides.some((item) => item.slug === service.slug));
  const paneItems = mode === 'services' ? services : categories;
  const pageCount = Math.max(1, Math.ceil(paneItems.length / ADMIN_PANE_PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const visibleServices = pageItems(services, page);
  const visibleCategories = pageItems(categories, page);
  const removeService = async () => {
    if (!serviceDraft.id || !window.confirm('Permanently delete this service?')) return;
    setIsSaving(true); setError(''); setMessage('');
    try {
      if (baseline.some((item) => item.slug === serviceDraft.slug)) {
        const deleted = await saveAdminService(csrfToken, { ...serviceDraft, active: false, deleted: true });
        setOverrides((current) => current.map((item) => item.id === deleted.id ? deleted : item));
      } else {
        await deleteAdminService(csrfToken, serviceDraft.id);
        setOverrides((current) => current.filter((item) => item.id !== serviceDraft.id));
      }
      setServiceDraft(blankService); setOutcomes(''); setProcessNotes(''); setSavedServiceFingerprint(fingerprint({ draft: blankService, outcomes: '', processNotes: '' }));
      setMessage('Service deleted.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete service'); }
    finally { setIsSaving(false); }
  };
  const removeCategory = async () => {
    if (!categoryDraft.id || !window.confirm('Permanently delete this category?')) return;
    setIsSaving(true); setError(''); setMessage('');
    try {
      await deleteAdminServiceCategory(csrfToken, categoryDraft.id);
      setManagedCategories((current) => current.filter((item) => item.id !== categoryDraft.id));
      setCategoryDraft(blankCategory); setSavedCategoryFingerprint(fingerprint(blankCategory));
      setMessage('Category deleted.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete category'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="admin-view-stack">
      <div className="admin-catalogue-toolbar">
        <div className="admin-segmented" role="tablist" aria-label="Catalogue area">
          <button className={mode === 'services' ? 'is-active' : ''} onClick={() => changeMode('services')} role="tab" type="button">Services</button>
          <button className={mode === 'categories' ? 'is-active' : ''} onClick={() => changeMode('categories')} role="tab" type="button">Categories</button>
        </div>
        {importRequired ? <button className="btn btn-outline-accent" disabled={isSaving} onClick={() => void importBuiltIns()} type="button">Import built-in catalogue</button> : <span className="admin-catalogue-synced">Catalogue stored in MongoDB</span>}
      </div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}
      {mode === 'services' ? (
        <div className="admin-workspace-split">
          <section className="admin-panel admin-workspace-list">
            <button className="btn btn-accent" onClick={() => selectService(blankService)} type="button"><Plus size={16} /> New service</button>
            {visibleServices.map((service) => <button className={serviceDraft.slug === service.slug ? 'is-active' : ''} key={service.slug} onClick={() => selectService(service)} type="button"><strong>{service.name}</strong><small>{service.status} · {service.category}</small></button>)}
            <AdminPagination count={services.length} onPageChange={setPage} page={page} />
          </section>
          <ServiceEditor categories={categories} draft={serviceDraft} isSaving={isSaving} outcomes={outcomes} preview={preview} processNotes={processNotes} onDraft={setServiceDraft} onOutcomes={setOutcomes} onPreview={() => setPreview((current) => !current)} onProcessNotes={setProcessNotes} onSave={saveService} onDelete={removeService} />
        </div>
      ) : (
        <div className="admin-workspace-split">
          <section className="admin-panel admin-workspace-list">
            <button className="btn btn-accent" onClick={() => selectCategory(blankCategory)} type="button"><Plus size={16} /> New category</button>
            {visibleCategories.map((category) => <button className={categoryDraft.slug === category.slug ? 'is-active' : ''} key={`${category.audience}-${category.slug}`} onClick={() => selectCategory(category)} type="button"><strong>{category.name}</strong><small>{category.status} · {category.audience}</small></button>)}
            <AdminPagination count={categories.length} onPageChange={setPage} page={page} />
          </section>
          <CategoryEditor draft={categoryDraft} isSaving={isSaving} onDraft={setCategoryDraft} onSave={saveCategory} onDelete={removeCategory} />
        </div>
      )}
    </div>
  );
}

function ServiceEditor({ categories, draft, isSaving, outcomes, preview, processNotes, onDraft, onOutcomes, onPreview, onProcessNotes, onSave, onDelete }: {
  categories: AdminServiceCategory[]; draft: Partial<AdminServiceOverride>; isSaving: boolean; outcomes: string; preview: boolean; processNotes: string;
  onDraft: (value: Partial<AdminServiceOverride>) => void; onOutcomes: (value: string) => void; onPreview: () => void; onProcessNotes: (value: string) => void; onSave: () => Promise<void>; onDelete: () => Promise<void>;
}) {
  const availableCategories = categories.filter((item) => item.audience === draft.audience);
  return <section className="admin-panel admin-workspace-editor">
    <div className="admin-panel-heading"><div><h2>{draft.id ? 'Edit service' : 'New service'}</h2><p>Configure the public catalogue and quote defaults.</p></div><button className="btn btn-outline-accent" onClick={onPreview} type="button"><Eye size={16} /> Preview</button></div>
    {preview ? <article className="admin-service-preview"><p className="section-kicker">{draft.audience} / {draft.category}</p><h2>{draft.name || 'Untitled service'}</h2><p>{draft.description}</p><strong>Starting from £{draft.starting_from ?? 0}</strong><p>{draft.best_for}</p><h3>Outcomes</h3><ul>{lines(outcomes).map((item) => <li key={item}>{item}</li>)}</ul><h3>Process</h3><ul>{lines(processNotes).map((item) => <li key={item}>{item}</li>)}</ul></article> : <>
      <div className="admin-management-grid">
        <label>Name<input className="form-control" maxLength={120} onChange={(event) => onDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label>
        <label>Slug<input className="form-control" maxLength={120} onChange={(event) => onDraft({ ...draft, slug: event.target.value })} placeholder="generated-from-name" value={draft.slug ?? ''} /></label>
        <label>Audience<select className="form-select" onChange={(event) => onDraft({ ...draft, audience: event.target.value, category_id: '', category: '' })} value={draft.audience}><AudienceOptions /></select></label>
        <label>Category<select className="form-select" onChange={(event) => { const category = availableCategories.find((item) => (item.id || item.slug) === event.target.value); onDraft({ ...draft, category_id: category?.id ?? '', category: category?.name ?? '' }); }} value={draft.category_id || (() => { const item = availableCategories.find((category) => category.name === draft.category); return item?.id || item?.slug || ''; })()}><option value="">Select category</option>{availableCategories.map((item) => <option key={item.id || item.slug} value={item.id || item.slug}>{item.name}</option>)}</select></label>
        <label>Starting from (£)<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, starting_from: Number(event.target.value) })} step="0.01" type="number" value={draft.starting_from ?? 0} /></label>
        <label>Hourly rate (£)<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, hourly_rate: Number(event.target.value) })} step="0.01" type="number" value={draft.hourly_rate ?? 0} /></label>
        <label>Estimated hours<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, estimated_hours: Number(event.target.value) })} step="0.25" type="number" value={draft.estimated_hours ?? 0} /></label>
        <label>Deposit description<input className="form-control" maxLength={80} onChange={(event) => onDraft({ ...draft, deposit: event.target.value })} value={draft.deposit ?? ''} /></label>
        <label>Deposit amount (£)<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, deposit_amount: Number(event.target.value) })} step="0.01" type="number" value={draft.deposit_amount ?? 0} /></label>
        <label>Sort order<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, sort_order: Number(event.target.value) })} type="number" value={draft.sort_order ?? 0} /></label>
        <label>Status<select className="form-select" onChange={(event) => onDraft({ ...draft, status: event.target.value as 'draft' | 'published' })} value={draft.status}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      </div>
      <label>Description<textarea className="form-control" maxLength={500} onChange={(event) => onDraft({ ...draft, description: event.target.value })} rows={3} value={draft.description ?? ''} /></label>
      <label>Best for<textarea className="form-control" maxLength={500} onChange={(event) => onDraft({ ...draft, best_for: event.target.value })} rows={2} value={draft.best_for ?? ''} /></label>
      <label>Outcomes, one per line<textarea className="form-control" onChange={(event) => onOutcomes(event.target.value)} rows={4} value={outcomes} /></label>
      <label>Process notes, one per line<textarea className="form-control" onChange={(event) => onProcessNotes(event.target.value)} rows={4} value={processNotes} /></label>
      <label className="admin-archive-toggle"><input checked={draft.active !== false} onChange={(event) => onDraft({ ...draft, active: event.target.checked })} type="checkbox" /> Active on public pages</label>
    </>}
    <div className="admin-management-actions"><button className="btn btn-accent" disabled={isSaving} onClick={() => void onSave()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : 'Save service'}</button>{draft.id ? <button className="btn btn-outline-danger" onClick={() => void onDelete()} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
  </section>;
}

function CategoryEditor({ draft, isSaving, onDraft, onSave, onDelete }: { draft: Partial<AdminServiceCategory>; isSaving: boolean; onDraft: (value: Partial<AdminServiceCategory>) => void; onSave: () => Promise<void>; onDelete: () => Promise<void> }) {
  return <section className="admin-panel admin-workspace-editor">
    <div className="admin-panel-heading"><div><h2>{draft.id ? 'Edit category' : 'New category'}</h2><p>Categories control catalogue grouping and navigation order.</p></div><FolderTree size={22} /></div>
    <div className="admin-management-grid">
      <label>Name<input className="form-control" maxLength={80} onChange={(event) => onDraft({ ...draft, name: event.target.value })} value={draft.name ?? ''} /></label>
      <label>Slug<input className="form-control" maxLength={120} onChange={(event) => onDraft({ ...draft, slug: event.target.value })} placeholder="generated-from-name" value={draft.slug ?? ''} /></label>
      <label>Audience<select className="form-select" onChange={(event) => onDraft({ ...draft, audience: event.target.value })} value={draft.audience}><AudienceOptions /></select></label>
      <label>Sort order<input className="form-control" min="0" onChange={(event) => onDraft({ ...draft, sort_order: Number(event.target.value) })} type="number" value={draft.sort_order ?? 0} /></label>
      <label>Status<select className="form-select" onChange={(event) => onDraft({ ...draft, status: event.target.value as 'draft' | 'published' })} value={draft.status}><option value="draft">Draft</option><option value="published">Published</option></select></label>
    </div>
    <label>Description<textarea className="form-control" maxLength={500} onChange={(event) => onDraft({ ...draft, description: event.target.value })} rows={4} value={draft.description ?? ''} /></label>
    <label className="admin-archive-toggle"><input checked={draft.active !== false} onChange={(event) => onDraft({ ...draft, active: event.target.checked })} type="checkbox" /> Active on public pages</label>
    <div className="admin-management-actions"><button className="btn btn-accent" disabled={isSaving} onClick={() => void onSave()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : 'Save category'}</button>{draft.id ? <button className="btn btn-outline-danger" onClick={() => void onDelete()} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
  </section>;
}

function AudienceOptions() { return <><option>For Industry</option><option>For Individuals</option><option>Working With You</option></>; }
function lines(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
function calculateDepositAmount(startingFrom: number, description: string) { if (/paid upfront/i.test(description)) return startingFrom; if (/none/i.test(description)) return 0; const percentage = Number(description.match(/\d+(?:\.\d+)?/)?.[0] ?? 0); return Number((startingFrom * percentage / 100).toFixed(2)); }

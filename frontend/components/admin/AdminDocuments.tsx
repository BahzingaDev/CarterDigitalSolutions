import { Download, FilePlus2, FileText, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { deleteAdminDocument, downloadAdminDocument, fetchAdminDocuments, fetchAdminDocumentTemplates, generateAdminDocument, uploadAdminDocument, type AdminDocument, type AdminDocumentTemplate } from '../../src/api/admin';

export function AdminDocuments({ csrfToken, customerEmail = '', ownerId, ownerType }: { csrfToken: string; customerEmail?: string; ownerId: string; ownerType: 'project' | 'customer' }) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [templates, setTemplates] = useState<AdminDocumentTemplate[]>([]);
  const [templateId, setTemplateId] = useState('proposal');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ownerId) return;
    void Promise.all([fetchAdminDocuments(ownerType, ownerId), fetchAdminDocumentTemplates()])
      .then(([items, available]) => { setDocuments(items); setTemplates(available); if (available[0]) setTemplateId(available[0].id); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load documents'));
  }, [ownerId, ownerType]);

  const generate = async () => {
    setPending(true); setError('');
    try { const document = await generateAdminDocument(csrfToken, ownerType, ownerId, templateId); setDocuments((current) => [document, ...current]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate document'); }
    finally { setPending(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setPending(true); setError('');
    try { const document = await uploadAdminDocument(csrfToken, ownerType, ownerId, file, customerEmail); setDocuments((current) => [document, ...current]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to upload document'); }
    finally { setPending(false); }
  };
  const remove = async (document: AdminDocument) => {
    if (!window.confirm(`Delete ${document.filename}?`)) return;
    try { await deleteAdminDocument(csrfToken, document.id); setDocuments((current) => current.filter((item) => item.id !== document.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete document'); }
  };

  return <div className="admin-documents-workspace">
    {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
    <div className="admin-document-actions"><label>Template<select className="form-select" onChange={(event) => setTemplateId(event.target.value)} value={templateId}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><button className="btn btn-accent" disabled={pending || !templateId} onClick={() => void generate()} type="button"><FilePlus2 size={16} /> {pending ? 'Working...' : 'Create copy'}</button><label className="btn btn-outline-accent"><Upload size={16} /> Upload file<input accept=".doc,.docx,.pdf,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" hidden onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} type="file" /></label></div>
    <p className="admin-document-note">Known project and customer fields are populated automatically. Discovery answers, credentials, contractual choices, acceptance, dates requiring confirmation, and signatures remain blank.</p>
    <div className="admin-document-list">{documents.map((document) => <div key={document.id}><FileText size={18} /><span><strong>{document.filename}</strong><small>{document.kind} · {formatBytes(document.size)} · {formatDate(document.created_at)}</small></span><button className="admin-icon-button" onClick={() => void downloadAdminDocument(document.id)} title="Download copy" type="button"><Download size={15} /></button><button className="admin-icon-button is-danger" onClick={() => void remove(document)} title="Delete document" type="button"><Trash2 size={15} /></button></div>)}{documents.length === 0 ? <p className="admin-empty">No documents have been created or uploaded.</p> : null}</div>
  </div>;
}

function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }

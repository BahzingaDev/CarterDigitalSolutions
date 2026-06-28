import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchCommunicationSettings, saveCommunicationSettings } from '../../src/api/admin';
import { enquiryPlaceholders } from '../../src/data/correspondencePlaceholders';
import { PlaceholderReference, PlaceholderSelect } from './AdminPlaceholderReference';

export function AdminCommunicationSettings({ csrfToken }: { csrfToken: string }) {
  const [signature, setSignature] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => { void fetchCommunicationSettings().then((settings) => setSignature(settings.signature)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the email signature')); }, []);
  const save = async () => { setIsSaving(true); setError(''); try { const settings = await saveCommunicationSettings(csrfToken, signature); setSignature(settings.signature); setSaved(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the email signature'); } finally { setIsSaving(false); } };
  return <section className="admin-panel admin-workspace-editor admin-signature-panel"><div className="admin-panel-heading"><div><h2>Email signature</h2><p>Appended to messages sent from the enquiry composer.</p></div></div>{error ? <div className="alert alert-danger" role="alert">{error}</div> : null}<div className="admin-template-field"><label>Signature<textarea className="form-control" maxLength={2000} onChange={(event) => { setSignature(event.target.value); setSaved(false); }} rows={6} value={signature} /></label><PlaceholderSelect definitions={enquiryPlaceholders} label="Insert signature placeholder" onInsert={(key) => { setSignature((current) => `${current}{{${key}}}`); setSaved(false); }} /></div><PlaceholderReference definitions={enquiryPlaceholders} title="Signature placeholder reference" /><button className="btn btn-accent" disabled={isSaving || saved} onClick={() => void save()} type="button"><Save size={16} /> {isSaving ? 'Saving...' : saved ? 'Saved' : 'Save signature'}</button></section>;
}

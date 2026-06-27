import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchCommunicationSettings, saveCommunicationSettings } from '../../src/api/admin';

export function AdminCommunicationSettings({ csrfToken }: { csrfToken: string }) {
  const [signature, setSignature] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { void fetchCommunicationSettings().then((settings) => setSignature(settings.signature)); }, []);
  const save = async () => { const settings = await saveCommunicationSettings(csrfToken, signature); setSignature(settings.signature); setSaved(true); };
  return <section className="admin-panel admin-workspace-editor admin-signature-panel"><div className="admin-panel-heading"><div><h2>Email signature</h2><p>Appended to messages sent from the enquiry composer.</p></div></div><label>Signature<textarea className="form-control" maxLength={2000} onChange={(event) => { setSignature(event.target.value); setSaved(false); }} rows={6} value={signature} /></label><button className="btn btn-accent" onClick={() => void save()} type="button"><Save size={16} /> {saved ? 'Saved' : 'Save signature'}</button></section>;
}

import { Save, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchCommercialSettings, saveCommercialSettings, type CommercialSettings } from '../../src/api/admin';

const defaults: CommercialSettings = { id: 'commercial', tax_rate: 0, invoice_business_name: 'Carter Digital Solutions', invoice_address: '', payment_details: '', invoice_due_days: 14, invoice_email_subject: 'Invoice {{invoice_reference}} from Carter Digital Solutions', invoice_email_message: 'Please find invoice {{invoice_reference}} attached as a PDF.' };

export function AdminCommercialSettings({ csrfToken }: { csrfToken: string }) {
  const [settings, setSettings] = useState(defaults);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { void fetchCommercialSettings().then(setSettings).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load commercial settings')); }, []);
  const save = async () => { setError(''); setMessage(''); try { setSettings(await saveCommercialSettings(csrfToken, settings)); setMessage('Commercial settings saved.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save commercial settings'); } };
  return <section className="admin-panel admin-commercial-settings">
    <div className="admin-panel-heading"><div><h2>Commercial settings</h2><p>Shared tax and invoice defaults used across quotes and projects.</p></div><button className="btn btn-outline-accent" onClick={() => setOpen((current) => !current)} type="button"><Settings2 size={16} /> {open ? 'Close settings' : 'Configure'}</button></div>
    {error ? <div className="alert alert-danger">{error}</div> : null}{message ? <div className="alert alert-success">{message}</div> : null}
    {open ? <div className="admin-project-workspace"><div className="admin-management-grid"><label>Tax rate (%)<input className="form-control" min="0" max="100" onChange={(event) => setSettings({ ...settings, tax_rate: Number(event.target.value) })} step="0.01" type="number" value={settings.tax_rate} /></label><label>Invoice due after (days)<input className="form-control" min="0" max="365" onChange={(event) => setSettings({ ...settings, invoice_due_days: Number(event.target.value) })} type="number" value={settings.invoice_due_days} /></label><label>Business name<input className="form-control" maxLength={160} onChange={(event) => setSettings({ ...settings, invoice_business_name: event.target.value })} value={settings.invoice_business_name} /></label></div><label>Invoice address<textarea className="form-control" maxLength={1000} onChange={(event) => setSettings({ ...settings, invoice_address: event.target.value })} rows={3} value={settings.invoice_address} /></label><label>Payment details<textarea className="form-control" maxLength={2000} onChange={(event) => setSettings({ ...settings, payment_details: event.target.value })} rows={3} value={settings.payment_details} /></label><label>Invoice email subject<input className="form-control" maxLength={180} onChange={(event) => setSettings({ ...settings, invoice_email_subject: event.target.value })} value={settings.invoice_email_subject} /></label><label>Invoice email message<textarea className="form-control" maxLength={5000} onChange={(event) => setSettings({ ...settings, invoice_email_message: event.target.value })} rows={3} value={settings.invoice_email_message} /></label><button className="btn btn-accent" onClick={() => void save()} type="button"><Save size={16} /> Save commercial settings</button></div> : null}
  </section>;
}

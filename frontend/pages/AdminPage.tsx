import { Menu, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminAccount } from '../components/admin/AdminAccount';
import { AdminInbox } from '../components/admin/AdminInbox';
import { AdminCustomers } from '../components/admin/AdminCustomers';
import { AdminCommunicationSettings } from '../components/admin/AdminCommunicationSettings';
import { AdminCommercialSettings } from '../components/admin/AdminCommercialSettings';
import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminProjects } from '../components/admin/AdminProjects';
import { AdminRecords } from '../components/admin/AdminRecords';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminSetup } from '../components/admin/AdminSetup';
import { AdminServices } from '../components/admin/AdminServices';
import { AdminTemplates } from '../components/admin/AdminTemplates';
import {
  type AdminEnquiry,
  type AdminEnquiryUpdate,
  type AdminQuoteItem,
  type AdminQuotePayload,
  type AdminQuoteVersion,
  type AdminSession,
  type AdminView,
  createAdminQuote,
  createQuoteShareLink,
  fetchAdminEnquiries,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
  sendAdminCommunication,
  saveAdminProject,
  setupAdmin,
  updateAdminEnquiry,
  updateAdminDepositInvoice,
  updateAdminQuoteStatus,
  updateAdminQuote,
} from '../src/api/admin';

const viewTitles: Record<AdminView, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'A clear view of current enquiries and potential work.' },
  enquiries: { title: 'Enquiries', description: 'Review contact requests, priorities, and follow-up notes.' },
  quotes: { title: 'Quote requests', description: 'Review customer-built estimates and selected services.' },
  projects: { title: 'Project pipeline', description: 'Move opportunities and active work through delivery stages.' },
  customers: { title: 'Customers', description: 'See each customer’s enquiries, projects, and CRM notes together.' },
  records: { title: 'Custom records', description: 'Keep flexible, structured business records in one place.' },
  services: { title: 'Service catalogue', description: 'Manage public pricing and quote-builder service values.' },
  templates: { title: 'Email templates', description: 'Create reusable messages for enquiry communications.' },
  account: { title: 'Account', description: 'Your administrator session and security details.' },
};

export function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [view, setView] = useState<AdminView>('overview');
  const [collapsed, setCollapsed] = useState(() => {
    const preference = window.localStorage.getItem('cds_admin_sidebar');
    return preference ? preference === 'collapsed' : window.matchMedia('(max-width: 991.98px)').matches;
  });
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const newCount = useMemo(
    () => enquiries.filter((item) => item.status === 'new' && !item.archived).length,
    [enquiries],
  );

  const loadEnquiries = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchAdminEnquiries();
      setEnquiries(data.enquiries);
      setSelectedId((current) => current ?? data.enquiries[0]?.id ?? null);
    } catch (loadError) {
      const text = loadError instanceof Error ? loadError.message : 'Unable to load enquiries';
      setError(text);
      if (text === 'Authentication required.') setSession({ authenticated: false, configured: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchAdminSession()
      .then(async (nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession.authenticated) await loadEnquiries();
        else setIsLoading(false);
      })
      .catch((sessionError) => {
        if (!active) return;
        const text = sessionError instanceof Error ? sessionError.message : 'Unable to check admin session';
        setSession({ authenticated: false, configured: false, configuration_error: text });
        setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const nextSession = await loginAdmin(email, password);
    setSession(nextSession);
    await loadEnquiries();
  };

  const handleSetup = async (name: string, email: string, password: string) => {
    const nextSession = await setupAdmin(name, email, password);
    setSession(nextSession);
    await loadEnquiries();
  };

  const handleLogout = async () => {
    if (session?.csrf_token) await logoutAdmin(session.csrf_token);
    setSession({ authenticated: false, configured: true });
    setEnquiries([]);
    setSelectedId(null);
  };

  const replaceEnquiry = (updated: AdminEnquiry) => {
    setEnquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const handleUpdate = async (id: string, payload: AdminEnquiryUpdate) => {
    if (!session?.csrf_token) return;
    setError('');
    setMessage('');
    try {
      const data = await updateAdminEnquiry(session.csrf_token, id, payload);
      replaceEnquiry(data.enquiry);
      setMessage('Enquiry updated successfully.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update enquiry');
    }
  };

  const handleCreateQuote = async (id: string, payload: { items: AdminQuoteItem[]; discount: number; expenses: number; tax_rate: number; deposit: number; notes: string; valid_until: string | null }) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try { const data = await createAdminQuote(session.csrf_token, id, payload); replaceEnquiry(data.enquiry); setMessage('Quote version created.'); }
    catch (quoteError) { setError(quoteError instanceof Error ? quoteError.message : 'Unable to create quote'); throw quoteError; }
  };

  const handleQuoteStatus = async (enquiryId: string, quoteId: string, status: AdminQuoteVersion['status']) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try { const data = await updateAdminQuoteStatus(session.csrf_token, enquiryId, quoteId, status); replaceEnquiry(data.enquiry); setMessage('Quote status updated.'); }
    catch (quoteError) { setError(quoteError instanceof Error ? quoteError.message : 'Unable to update quote'); }
  };
  const handleDepositInvoice = async (enquiryId: string, quoteId: string, status: 'pending' | 'sent' | 'paid', reference?: string) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try {
      const data = await updateAdminDepositInvoice(session.csrf_token, enquiryId, quoteId, status, reference);
      replaceEnquiry(data.enquiry);
      setMessage(`Deposit invoice marked ${status}.`);
    } catch (invoiceError) {
      setError(invoiceError instanceof Error ? invoiceError.message : 'Unable to update deposit invoice');
      throw invoiceError;
    }
  };
  const handleUpdateQuote = async (enquiryId: string, quoteId: string, payload: AdminQuotePayload) => {
    if (!session?.csrf_token) return;
    const data = await updateAdminQuote(session.csrf_token, enquiryId, quoteId, payload);
    replaceEnquiry(data.enquiry);
    setMessage('Draft quote updated.');
  };

  const handleSend = async (id: string, subject: string, body: string, quoteId?: string, scheduledAt?: string) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try { const data = await sendAdminCommunication(session.csrf_token, id, subject, body, quoteId, scheduledAt); replaceEnquiry(data.enquiry); setMessage(scheduledAt ? 'Email scheduled and recorded.' : 'Email sent and recorded.'); }
    catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Unable to send email'); throw sendError; }
  };

  const handleShareQuote = async (enquiryId: string, quoteId: string) => {
    if (!session?.csrf_token) throw new Error('Authentication required.');
    const data = await createQuoteShareLink(session.csrf_token, enquiryId, quoteId);
    setMessage('Secure approval link copied to the clipboard.');
    return data.url;
  };

  const handleConvertQuote = async (enquiry: AdminEnquiry, quote: AdminQuoteVersion) => {
    if (!session?.csrf_token) throw new Error('Authentication required.');
    const confirmedServices = quote.items.filter((item) => !item.optional || item.included);
    const consultationRate = confirmedServices.length
      ? confirmedServices.reduce((total, item) => total + item.rate, 0) / confirmedServices.length
      : 16.5;
    const depositInvoiceStatus = quote.deposit_invoice_status === 'paid'
      ? 'paid'
      : quote.deposit_invoice_status === 'sent' ? 'sent' : 'draft';
    await saveAdminProject(session.csrf_token, {
      name: enquiry.project_type || `${enquiry.name} project`,
      client_name: enquiry.name,
      client_email: enquiry.email,
      stage: quote.status === 'accepted' ? 'accepted' : 'quoted',
      value: quote.total,
      due_date: '',
      notes: quote.notes,
      tags: ['Quote conversion'],
      linked_enquiry_id: enquiry.id,
      source_quote_id: quote.id,
      services: quote.items.map((item) => ({ ...item, optional: item.optional ?? false, included: item.included ?? true })),
      included_consultation_hours: 8,
      consultation_rate: Number(consultationRate.toFixed(2)),
      meetings: [],
      invoices: quote.deposit > 0 ? [{
        id: crypto.randomUUID(),
        reference: quote.deposit_invoice_reference || `DEP-${quote.version}-${enquiry.id.slice(0, 6).toUpperCase()}`,
        kind: 'deposit',
        status: depositInvoiceStatus,
        subtotal: Number((quote.deposit / (1 + (quote.tax_rate || 0) / 100)).toFixed(2)),
        tax_rate: quote.tax_rate || 0,
        tax_amount: Number((quote.deposit - quote.deposit / (1 + (quote.tax_rate || 0) / 100)).toFixed(2)),
        amount: quote.deposit,
        issue_date: quote.deposit_invoice_sent_at?.slice(0, 10) ?? '',
        due_date: '',
        paid_date: quote.deposit_paid_at?.slice(0, 10) ?? '',
        notes: `Deposit for quote version ${quote.version}`,
      }] : [],
    });
    setMessage('Quote converted to a project.');
    setView('projects');
  };

  if (!session || (isLoading && !session.authenticated)) {
    return <main className="admin-loading" aria-busy="true"><span className="spinner-border" /><p>Checking your session...</p></main>;
  }

  if (!session.authenticated) {
    if (session.setup_required) {
      return <AdminSetup onSetup={handleSetup} />;
    }
    return (
      <AdminLogin
        configured={session.configured !== false && session.storage_available !== false}
        configurationError={session.configuration_error}
        onLogin={handleLogin}
      />
    );
  }

  const heading = viewTitles[view];

  return (
    <div className={`admin-shell ${collapsed ? 'has-collapsed-nav' : ''}`}>
      <AdminSidebar activeView={view} collapsed={collapsed} newCount={newCount} onCollapse={() => {
        setCollapsed((current) => {
          window.localStorage.setItem('cds_admin_sidebar', current ? 'expanded' : 'collapsed');
          return !current;
        });
      }} onLogout={() => void handleLogout()} onNavigate={setView} />

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-icon-button admin-mobile-menu" onClick={() => setCollapsed((current) => !current)} title="Toggle navigation" type="button"><Menu size={21} /></button>
          <div><h1>{heading.title}</h1><p>{heading.description}</p></div>
          {view !== 'account' ? <button className="btn btn-outline-accent admin-refresh" disabled={isLoading} onClick={() => void loadEnquiries()} type="button"><RefreshCw className={isLoading ? 'is-spinning' : ''} size={16} /> {isLoading ? 'Refreshing' : 'Refresh'}</button> : null}
        </header>

        <div className={`admin-content ${view === 'projects' ? 'admin-content-wide' : ''}`}>
          {message ? <div className="alert alert-success" role="status">{message}</div> : null}
          {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
          {view === 'overview' ? <AdminOverview enquiries={enquiries} onNavigate={setView} onSelect={setSelectedId} /> : null}
          {view === 'enquiries' ? <AdminInbox enquiries={enquiries} mode="all" onConvertQuote={handleConvertQuote} onCreateQuote={handleCreateQuote} onDepositInvoice={handleDepositInvoice} onQuoteStatus={handleQuoteStatus} onSelect={setSelectedId} onSend={handleSend} onShareQuote={handleShareQuote} onUpdate={handleUpdate} onUpdateQuote={handleUpdateQuote} selectedId={selectedId} /> : null}
          {view === 'quotes' ? <AdminInbox enquiries={enquiries} mode="quotes" onConvertQuote={handleConvertQuote} onCreateQuote={handleCreateQuote} onDepositInvoice={handleDepositInvoice} onQuoteStatus={handleQuoteStatus} onSelect={setSelectedId} onSend={handleSend} onShareQuote={handleShareQuote} onUpdate={handleUpdate} onUpdateQuote={handleUpdateQuote} selectedId={selectedId} /> : null}
          {view === 'projects' ? <div className="admin-view-stack"><AdminCommercialSettings csrfToken={session.csrf_token ?? ''} /><AdminProjects csrfToken={session.csrf_token ?? ''} /></div> : null}
          {view === 'customers' ? <AdminCustomers csrfToken={session.csrf_token ?? ''} /> : null}
          {view === 'records' ? <AdminRecords csrfToken={session.csrf_token ?? ''} /> : null}
          {view === 'services' ? <AdminServices csrfToken={session.csrf_token ?? ''} /> : null}
          {view === 'templates' ? <div className="admin-view-stack"><AdminCommunicationSettings csrfToken={session.csrf_token ?? ''} /><AdminTemplates csrfToken={session.csrf_token ?? ''} /></div> : null}
          {view === 'account' ? <AdminAccount email={session.email ?? ''} name={session.name ?? 'Administrator'} /> : null}
        </div>
      </main>
    </div>
  );
}

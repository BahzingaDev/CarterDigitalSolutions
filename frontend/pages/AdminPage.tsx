import { ArrowRight, FolderKanban, Inbox, Menu, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminAccount } from '../components/admin/AdminAccount';
import { AdminInbox } from '../components/admin/AdminInbox';
import { AdminCustomers } from '../components/admin/AdminCustomers';
import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminOverview, getAdminActionCount } from '../components/admin/AdminOverview';
import { AdminProjects } from '../components/admin/AdminProjects';
import { AdminRecords } from '../components/admin/AdminRecords';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminSettings } from '../components/admin/AdminSettings';
import { AdminSetup } from '../components/admin/AdminSetup';
import { AdminServices } from '../components/admin/AdminServices';
import { AdminTemplates } from '../components/admin/AdminTemplates';
import {
  type AdminEnquiry,
  type AdminEnquiryUpdate,
  type AdminProject,
  type AdminQuoteItem,
  type AdminQuotePayload,
  type AdminQuoteVersion,
  type AdminSession,
  type AdminView,
  createAdminQuote,
  createQuoteShareLink,
  fetchAdminEnquiries,
  fetchAdminProjects,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
  sendAdminCommunication,
  saveAdminProject,
  setupAdmin,
  updateAdminEnquiry,
  updateAdminQuoteStatus,
  updateAdminQuote,
} from '../src/api/admin';
import { useTheme } from '../src/hooks/useTheme';
import { hasQuoteActivity } from '../src/data/adminEnquiries';

const viewTitles: Record<AdminView, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'A clear view of current enquiries and potential work.' },
  enquiries: { title: 'Enquiries', description: 'Review contact requests, priorities, and follow-up notes.' },
  quotes: { title: 'Quote requests', description: 'Review customer-built estimates and selected services.' },
  projects: { title: 'Project pipeline', description: 'Move opportunities and active work through delivery stages.' },
  customers: { title: 'Customers', description: 'See each customer’s enquiries, projects, and CRM notes together.' },
  records: { title: 'Custom records', description: 'Keep flexible, structured business records in one place.' },
  services: { title: 'Service catalogue', description: 'Manage public pricing and quote-builder service values.' },
  templates: { title: 'Email templates', description: 'Create reusable messages for enquiry communications.' },
  settings: { title: 'Settings', description: 'Manage shared commercial and communication defaults.' },
  account: { title: 'Account', description: 'Your administrator session and security details.' },
};

export function AdminPage() {
  const [theme, toggleTheme] = useTheme();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [view, setView] = useState<AdminView>(() => readAdminLocation().view);
  const [collapsed, setCollapsed] = useState(() => {
    const preference = window.localStorage.getItem('cds_admin_sidebar');
    return preference ? preference === 'collapsed' : window.matchMedia('(max-width: 991.98px)').matches;
  });
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => readAdminLocation().enquiryId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => readAdminLocation().projectId);
  const [selectedProjectTab, setSelectedProjectTab] = useState<'overview' | 'delivery' | 'meetings' | 'invoices' | undefined>(() => readAdminLocation().projectTab);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const newCount = useMemo(
    () => enquiries.filter((item) => item.status === 'new' && !item.archived).length,
    [enquiries],
  );
  const actionCount = useMemo(() => getAdminActionCount(enquiries, projects), [enquiries, projects]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [enquiryResult, projectResult] = await Promise.allSettled([fetchAdminEnquiries(), fetchAdminProjects()]);
      if (enquiryResult.status === 'rejected') throw enquiryResult.reason;
      setEnquiries(enquiryResult.value.enquiries);
      setSelectedId((current) => current ?? enquiryResult.value.enquiries[0]?.id ?? null);
      if (projectResult.status === 'fulfilled') {
        setProjects(projectResult.value);
      } else {
        const projectError = projectResult.reason instanceof Error ? projectResult.reason.message : 'Projects storage is unavailable.';
        setError(`Enquiries loaded, but projects could not be loaded: ${projectError}`);
      }
    } catch (loadError) {
      const text = loadError instanceof Error ? loadError.message : 'Unable to load enquiries';
      setError(text);
      if (text === 'Authentication required.') setSession({ authenticated: false, configured: true });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDiscard = () => !hasUnsavedChanges || window.confirm('Discard unsaved changes?');
  const navigate = (nextView: AdminView) => {
    if (nextView === view) return true;
    if (!confirmDiscard()) return false;
    setHasUnsavedChanges(false);
    setView(nextView);
    setSearchQuery('');
    setError('');
    setMessage('');
    return true;
  };
  const selectEnquiry = (id: string) => {
    if (id === selectedId || !confirmDiscard()) return;
    setHasUnsavedChanges(false);
    setSelectedId(id);
  };
  const openProject = (projectId: string, tab?: 'overview' | 'delivery' | 'meetings' | 'invoices') => {
    if ((view !== 'projects' || projectId !== selectedProjectId) && !confirmDiscard()) return;
    setHasUnsavedChanges(false);
    setSelectedProjectId(projectId);
    setSelectedProjectTab(tab);
    setView('projects');
    setSearchQuery('');
    setError('');
    setMessage('');
  };
  const openEnquiry = (id: string, isQuote = false) => {
    const nextView = isQuote ? 'quotes' : 'enquiries';
    if ((view !== nextView || id !== selectedId) && !confirmDiscard()) return;
    setHasUnsavedChanges(false);
    setSelectedId(id);
    setView(nextView);
    setSearchQuery('');
    setError('');
    setMessage('');
  };

  useEffect(() => {
    if (!session?.authenticated) return;
    const params = new URLSearchParams();
    params.set('view', view);
    if ((view === 'enquiries' || view === 'quotes') && selectedId) params.set('enquiry', selectedId);
    if (view === 'projects' && selectedProjectId) params.set('project', selectedProjectId);
    if (view === 'projects' && selectedProjectTab) params.set('tab', selectedProjectTab);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [selectedId, selectedProjectId, selectedProjectTab, session?.authenticated, view]);

  useEffect(() => {
    let active = true;
    void fetchAdminSession()
      .then(async (nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession.authenticated) await loadWorkspace();
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
    await loadWorkspace();
  };

  const handleSetup = async (name: string, email: string, password: string) => {
    const nextSession = await setupAdmin(name, email, password);
    setSession(nextSession);
    await loadWorkspace();
  };

  const handleLogout = async () => {
    if (!confirmDiscard()) return;
    if (session?.csrf_token) await logoutAdmin(session.csrf_token);
    setHasUnsavedChanges(false);
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
    try { const data = await updateAdminQuoteStatus(session.csrf_token, enquiryId, quoteId, status); replaceEnquiry(data.enquiry); if (status === 'accepted') await loadWorkspace(); setMessage(data.automation_warning ?? (status === 'accepted' ? 'Quote accepted. Its project and draft deposit invoice are ready.' : 'Quote status updated.')); }
    catch (quoteError) { setError(quoteError instanceof Error ? quoteError.message : 'Unable to update quote'); }
  };
  const handleUpdateQuote = async (enquiryId: string, quoteId: string, payload: AdminQuotePayload) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try {
      const data = await updateAdminQuote(session.csrf_token, enquiryId, quoteId, payload);
      replaceEnquiry(data.enquiry);
      setMessage('Draft quote updated.');
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : 'Unable to update the draft quote');
    }
  };

  const handleSend = async (id: string, subject: string, body: string, quoteId?: string, scheduledAt?: string, documentIds: string[] = [], files: File[] = []) => {
    if (!session?.csrf_token) return;
    setError(''); setMessage('');
    try { const data = await sendAdminCommunication(session.csrf_token, id, subject, body, quoteId, scheduledAt, documentIds, files); replaceEnquiry(data.enquiry); setMessage(scheduledAt ? 'Email scheduled and recorded.' : 'Email sent and recorded.'); }
    catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Unable to send email'); throw sendError; }
  };

  const handleShareQuote = async (enquiryId: string, quoteId: string) => {
    if (!session?.csrf_token) return '';
    setError(''); setMessage('');
    try {
      const data = await createQuoteShareLink(session.csrf_token, enquiryId, quoteId);
      setMessage('Secure approval link created.');
      return data.url;
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Unable to create an approval link');
      return '';
    }
  };

  const handleConvertQuote = async (enquiry: AdminEnquiry, quote: AdminQuoteVersion) => {
    if (!session?.csrf_token) { setError('Authentication required.'); return; }
    if (quote.status !== 'accepted') { setError('Accept the quote before creating its project workspace.'); return; }
    setError(''); setMessage('');
    try {
    const confirmedServices = quote.items.filter((item) => !item.optional || item.included);
    const consultationRate = confirmedServices.length
      ? confirmedServices.reduce((total, item) => total + item.rate, 0) / confirmedServices.length
      : 16.5;
    const depositInvoiceStatus = quote.deposit_invoice_status === 'paid'
      ? 'paid'
      : quote.deposit_invoice_status === 'sent' ? 'sent' : 'draft';
    const project = await saveAdminProject(session.csrf_token, {
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
      services: confirmedServices.map((item) => ({ ...item, optional: item.optional ?? false, included: item.included ?? true })),
      included_consultation_hours: consultationHourCap(confirmedServices),
      consultation_rate: Number(consultationRate.toFixed(2)),
      meetings: [],
      invoices: quote.status === 'accepted' && quote.deposit > 0 ? [{
        id: crypto.randomUUID(),
        reference: quote.deposit_invoice_reference || `DEP-${quote.version}-${enquiry.id.slice(0, 6).toUpperCase()}`,
        kind: 'deposit',
        status: depositInvoiceStatus,
        subtotal: quote.deposit_subtotal ?? Number((quote.deposit / (1 + (quote.tax_rate || 0) / 100)).toFixed(2)),
        tax_rate: quote.tax_rate || 0,
        tax_amount: quote.deposit_tax_amount ?? Number((quote.deposit - quote.deposit / (1 + (quote.tax_rate || 0) / 100)).toFixed(2)),
        amount: quote.deposit,
        issue_date: quote.deposit_invoice_sent_at?.slice(0, 10) ?? '',
        due_date: '',
        paid_date: quote.deposit_paid_at?.slice(0, 10) ?? '',
        notes: `Deposit for quote version ${quote.version}`,
      }] : [],
    });
    await loadWorkspace();
    setSelectedProjectId(project.id);
    setSelectedProjectTab('invoices');
    navigate('projects');
    setMessage(`Project workspace created for ${project.client_name || enquiry.name}. The deposit invoice is ready in its invoice register.`);
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : 'Unable to create the project workspace');
    }
  };

  if (!session || (isLoading && !session.authenticated)) {
    return <><AdminThemeToggle floating theme={theme} toggle={toggleTheme} /><main className="admin-loading" aria-busy="true"><span className="spinner-border" /><p>Checking your session...</p></main></>;
  }

  if (!session.authenticated) {
    if (session.setup_required) {
      return <><AdminThemeToggle floating theme={theme} toggle={toggleTheme} /><AdminSetup onSetup={handleSetup} /></>;
    }
    return (
      <><AdminThemeToggle floating theme={theme} toggle={toggleTheme} /><AdminLogin
        configured={session.configured !== false && session.storage_available !== false}
        configurationError={session.configuration_error}
        onLogin={handleLogin}
      /></>
    );
  }

  const heading = viewTitles[view];

  return (
    <div className={`admin-shell ${collapsed ? 'has-collapsed-nav' : ''}`}>
      <AdminSidebar actionCount={actionCount} activeView={view} collapsed={collapsed} newCount={newCount} onCollapse={() => {
        setCollapsed((current) => {
          window.localStorage.setItem('cds_admin_sidebar', current ? 'expanded' : 'collapsed');
          return !current;
        });
      }} onLogout={() => void handleLogout()} onNavigate={navigate} />

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-icon-button admin-mobile-menu" onClick={() => setCollapsed((current) => !current)} title="Toggle navigation" type="button"><Menu size={21} /></button>
          <div><h1>{heading.title}</h1><p>{heading.description}</p></div>
          <AdminGlobalSearch enquiries={enquiries} onOpenEnquiry={openEnquiry} onOpenProject={openProject} projects={projects} query={searchQuery} setQuery={setSearchQuery} />
          <AdminThemeToggle theme={theme} toggle={toggleTheme} />
          {view !== 'account' ? <button className="btn btn-outline-accent admin-refresh" disabled={isLoading} onClick={() => { if (!confirmDiscard()) return; setHasUnsavedChanges(false); setRefreshKey((current) => current + 1); void loadWorkspace(); }} type="button"><RefreshCw className={isLoading ? 'is-spinning' : ''} size={16} /> {isLoading ? 'Refreshing' : 'Refresh'}</button> : null}
        </header>

        <div className={`admin-content ${view === 'projects' ? 'admin-content-wide' : ''}`}>
          {message ? <div className="alert alert-success" role="status">{message}</div> : null}
          {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
          {view === 'overview' ? <AdminOverview enquiries={enquiries} projects={projects} onNavigate={navigate} onOpenProject={openProject} onSelect={selectEnquiry} /> : null}
          {view === 'enquiries' ? <AdminInbox enquiries={enquiries} mode="all" onConvertQuote={handleConvertQuote} onCreateQuote={handleCreateQuote} onDirtyChange={setHasUnsavedChanges} onQuoteStatus={handleQuoteStatus} onSelect={selectEnquiry} onSend={handleSend} onShareQuote={handleShareQuote} onUpdate={handleUpdate} onUpdateQuote={handleUpdateQuote} selectedId={selectedId} /> : null}
          {view === 'quotes' ? <AdminInbox enquiries={enquiries} mode="quotes" onConvertQuote={handleConvertQuote} onCreateQuote={handleCreateQuote} onDirtyChange={setHasUnsavedChanges} onQuoteStatus={handleQuoteStatus} onSelect={selectEnquiry} onSend={handleSend} onShareQuote={handleShareQuote} onUpdate={handleUpdate} onUpdateQuote={handleUpdateQuote} selectedId={selectedId} /> : null}
          {view === 'projects' ? <AdminProjects csrfToken={session.csrf_token ?? ''} enquiries={enquiries} initialProjectId={selectedProjectId} initialTab={selectedProjectTab} onDirtyChange={setHasUnsavedChanges} onInvoiceSent={loadWorkspace} onTabChange={setSelectedProjectTab} refreshKey={refreshKey} /> : null}
          {view === 'customers' ? <AdminCustomers csrfToken={session.csrf_token ?? ''} onDirtyChange={setHasUnsavedChanges} onOpenEnquiry={openEnquiry} onOpenProject={openProject} refreshKey={refreshKey} /> : null}
          {view === 'records' ? <AdminRecords csrfToken={session.csrf_token ?? ''} key={`records-${refreshKey}`} onDirtyChange={setHasUnsavedChanges} /> : null}
          {view === 'services' ? <AdminServices csrfToken={session.csrf_token ?? ''} key={`services-${refreshKey}`} onDirtyChange={setHasUnsavedChanges} /> : null}
          {view === 'templates' ? <AdminTemplates csrfToken={session.csrf_token ?? ''} key={`templates-${refreshKey}`} onDirtyChange={setHasUnsavedChanges} /> : null}
          {view === 'settings' ? <AdminSettings csrfToken={session.csrf_token ?? ''} key={`settings-${refreshKey}`} /> : null}
          {view === 'account' ? <AdminAccount email={session.email ?? ''} name={session.name ?? 'Administrator'} /> : null}
        </div>
      </main>
    </div>
  );
}

function AdminThemeToggle({ floating = false, theme, toggle }: { floating?: boolean; theme: 'light' | 'dark'; toggle: () => void }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return <button aria-label={`Switch to ${nextTheme} mode`} className={`admin-icon-button admin-theme-toggle ${floating ? 'is-floating' : ''}`} onClick={toggle} title={`Switch to ${nextTheme} mode`} type="button">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

function AdminGlobalSearch({ enquiries, onOpenEnquiry, onOpenProject, projects, query, setQuery }: {
  enquiries: AdminEnquiry[];
  onOpenEnquiry: (id: string, isQuote?: boolean) => void;
  onOpenProject: (id: string) => void;
  projects: AdminProject[];
  query: string;
  setQuery: (value: string) => void;
}) {
  const term = query.trim().toLowerCase();
  const matches = term ? [
    ...enquiries.filter((item) => `${item.name} ${item.email} ${item.project_type}`.toLowerCase().includes(term)).slice(0, 4).map((item) => ({ id: item.id, label: item.name, detail: item.project_type || item.email, type: 'enquiry' as const, isQuote: hasQuoteActivity(item) })),
    ...projects.filter((item) => `${item.name} ${item.client_name} ${item.client_email}`.toLowerCase().includes(term)).slice(0, 4).map((item) => ({ id: item.id, label: item.name, detail: item.client_name || 'Project', type: 'project' as const, isQuote: false })),
  ].slice(0, 6) : [];
  return <div className="admin-global-search"><label><Search size={16} /><span className="visually-hidden">Search dashboard</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search customers and work" type="search" value={query} /></label>{term ? <div className="admin-global-results">{matches.map((item) => <button key={`${item.type}-${item.id}`} onClick={() => item.type === 'project' ? onOpenProject(item.id) : onOpenEnquiry(item.id, item.isQuote)} type="button">{item.type === 'project' ? <FolderKanban size={16} /> : <Inbox size={16} />}<span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowRight size={14} /></button>)}{matches.length === 0 ? <p>No matching records</p> : null}</div> : null}</div>;
}

function readAdminLocation(): { view: AdminView; enquiryId: string | null; projectId: string | null; projectTab?: 'overview' | 'delivery' | 'meetings' | 'invoices' } {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  const views: AdminView[] = ['overview', 'enquiries', 'quotes', 'customers', 'projects', 'records', 'services', 'templates', 'settings', 'account'];
  const tab = params.get('tab');
  return { view: views.includes(requested as AdminView) ? requested as AdminView : 'overview', enquiryId: params.get('enquiry'), projectId: params.get('project'), projectTab: ['overview', 'delivery', 'meetings', 'invoices'].includes(tab ?? '') ? tab as 'overview' | 'delivery' | 'meetings' | 'invoices' : undefined };
}

function consultationHourCap(services: AdminQuoteItem[]) {
  const labourHours = services.reduce((total, service) => total + Number(service.hours || 0), 0);
  return Math.min(8, Math.floor(labourHours / 4));
}

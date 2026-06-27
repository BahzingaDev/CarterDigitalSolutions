import { Menu, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminAccount } from '../components/admin/AdminAccount';
import { AdminInbox } from '../components/admin/AdminInbox';
import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminSetup } from '../components/admin/AdminSetup';
import {
  type AdminEnquiry,
  type AdminSession,
  type AdminView,
  fetchAdminEnquiries,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
  setupAdmin,
  updateAdminEnquiry,
} from '../src/api/admin';

const viewTitles: Record<AdminView, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'A clear view of current enquiries and potential work.' },
  enquiries: { title: 'Enquiries', description: 'Review contact requests, priorities, and follow-up notes.' },
  quotes: { title: 'Quote requests', description: 'Review customer-built estimates and selected services.' },
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

  const newCount = useMemo(() => enquiries.filter((item) => item.status === 'new').length, [enquiries]);

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
        setSession({ authenticated: false, configured: false });
        setError(sessionError instanceof Error ? sessionError.message : 'Unable to check admin session');
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

  const handleUpdate = async (id: string, payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>) => {
    if (!session?.csrf_token) return;
    setError('');
    setMessage('');
    try {
      const data = await updateAdminEnquiry(session.csrf_token, id, payload);
      setEnquiries((current) => current.map((item) => item.id === id ? data.enquiry : item));
      setMessage('Enquiry updated successfully.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update enquiry');
    }
  };

  if (!session || (isLoading && !session.authenticated)) {
    return <main className="admin-loading" aria-busy="true"><span className="spinner-border" /><p>Checking your session...</p></main>;
  }

  if (!session.authenticated) {
    if (session.setup_required) {
      return <AdminSetup onSetup={handleSetup} />;
    }
    return <AdminLogin configured={session.configured !== false} onLogin={handleLogin} />;
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

        <div className="admin-content">
          {message ? <div className="alert alert-success" role="status">{message}</div> : null}
          {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
          {view === 'overview' ? <AdminOverview enquiries={enquiries} onNavigate={setView} onSelect={setSelectedId} /> : null}
          {view === 'enquiries' ? <AdminInbox enquiries={enquiries} mode="all" onSelect={setSelectedId} onUpdate={handleUpdate} selectedId={selectedId} /> : null}
          {view === 'quotes' ? <AdminInbox enquiries={enquiries} mode="quotes" onSelect={setSelectedId} onUpdate={handleUpdate} selectedId={selectedId} /> : null}
          {view === 'account' ? <AdminAccount email={session.email ?? ''} name={session.name ?? 'Administrator'} /> : null}
        </div>
      </main>
    </div>
  );
}

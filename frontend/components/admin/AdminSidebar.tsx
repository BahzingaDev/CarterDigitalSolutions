import {
  ChevronLeft,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  Inbox,
  LogOut,
  MessageSquareText,
  PackageSearch,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import type { AdminView } from '../../src/api/admin';

interface NavigationItem {
  id?: AdminView;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const groups: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview' as const, label: 'Overview', icon: Gauge },
      { id: 'enquiries' as const, label: 'Enquiries', icon: Inbox },
      { id: 'quotes' as const, label: 'Quote requests', icon: FileText },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'customers', label: 'Customers', icon: UserRound },
      { id: 'records', label: 'Custom records', icon: Database },
      { id: 'services', label: 'Services', icon: PackageSearch },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'templates', label: 'Email templates', icon: MessageSquareText },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'account' as const, label: 'Account', icon: UserRound },
    ],
  },
];

export function AdminSidebar({
  activeView,
  collapsed,
  newCount,
  actionCount,
  onCollapse,
  onLogout,
  onNavigate,
}: {
  activeView: AdminView;
  collapsed: boolean;
  newCount: number;
  actionCount: number;
  onCollapse: () => void;
  onLogout: () => void;
  onNavigate: (view: AdminView) => void;
}) {
  return (
    <aside className={`admin-nav ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="admin-nav-brand">
        <span className="admin-brand-full">CARTER<br />DIGITAL SOLUTIONS</span>
        <span className="admin-brand-short" aria-hidden="true">CDS</span>
        <button className="admin-icon-button admin-collapse-button" onClick={onCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} type="button">
          <ChevronLeft size={18} />
        </button>
      </div>

      <nav aria-label="Admin navigation">
        {groups.map((group) => (
          <div className="admin-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;
              return (
                <button
                  aria-current={active ? 'page' : undefined}
                  className={`admin-nav-item ${active ? 'is-active' : ''}`}
                  disabled={item.disabled}
                  key={item.label}
                  onClick={() => item.id && onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  type="button"
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {item.id === 'enquiries' && newCount > 0 ? <em>{newCount}</em> : null}
                  {item.id === 'overview' && actionCount > 0 ? <em>{actionCount}</em> : null}
                  {item.disabled ? <small>Soon</small> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button className="admin-nav-item admin-logout" onClick={onLogout} title={collapsed ? 'Sign out' : undefined} type="button">
        <LogOut size={19} />
        <span>Sign out</span>
      </button>
    </aside>
  );
}

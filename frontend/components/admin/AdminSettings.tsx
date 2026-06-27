import { AdminCommercialSettings } from './AdminCommercialSettings';
import { AdminCommunicationSettings } from './AdminCommunicationSettings';

export function AdminSettings({ csrfToken }: { csrfToken: string }) {
  return (
    <div className="admin-view-stack">
      <AdminCommercialSettings csrfToken={csrfToken} />
      <AdminCommunicationSettings csrfToken={csrfToken} />
    </div>
  );
}

import { Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AdminEnquiry } from '../../src/api/admin';
import { ADMIN_PANE_PAGE_SIZE, AdminPagination, pageItems } from './AdminPagination';

export function AdminActivity({ enquiry }: { enquiry: AdminEnquiry }) {
  const [page, setPage] = useState(1);
  const activity = [...enquiry.activity].reverse();
  const pageCount = Math.max(1, Math.ceil(activity.length / ADMIN_PANE_PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  return <section className="admin-subpanel">
    <div className="admin-subpanel-heading"><div><h3>Activity history</h3><p>Recorded changes and customer contact.</p></div></div>
    <ol className="admin-activity-list">
      {pageItems(activity, page).map((item) => <li key={item.id}><span><Activity size={15} /></span><div><strong>{item.description}</strong><small>{formatDate(item.created_at)}</small></div></li>)}
      {activity.length === 0 ? <li className="admin-empty">No activity has been recorded for this older enquiry.</li> : null}
    </ol>
    <AdminPagination count={activity.length} onPageChange={setPage} page={page} />
  </section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

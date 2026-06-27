import { Activity } from 'lucide-react';

import type { AdminEnquiry } from '../../src/api/admin';

export function AdminActivity({ enquiry }: { enquiry: AdminEnquiry }) {
  return <section className="admin-subpanel"><div className="admin-subpanel-heading"><div><h3>Activity history</h3><p>Recorded changes and customer contact.</p></div></div><ol className="admin-activity-list">{[...enquiry.activity].reverse().map((item) => <li key={item.id}><span><Activity size={15} /></span><div><strong>{item.description}</strong><small>{formatDate(item.created_at)}</small></div></li>)}{enquiry.activity.length === 0 ? <li className="admin-empty">No activity has been recorded for this older enquiry.</li> : null}</ol></section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

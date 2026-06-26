import { type FormEvent, useMemo, useState } from 'react';

import {
  type AdminEnquiry,
  type EnquiryStatus,
  fetchAdminEnquiries,
  updateAdminEnquiry,
} from '../src/api/admin';
import { formatCurrency } from '../src/data/pricing';

const statuses: EnquiryStatus[] = ['new', 'reviewed', 'replied', 'closed'];
const tokenKey = 'cds_admin_token';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminPage() {
  const [token, setToken] = useState(() => window.sessionStorage.getItem(tokenKey) ?? '');
  const [tokenInput, setTokenInput] = useState(token);
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | AdminEnquiry['priority']>('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredEnquiries = useMemo(
    () =>
      enquiries.filter((enquiry) => {
        const statusMatches = statusFilter === 'all' || enquiry.status === statusFilter;
        const priorityMatches = priorityFilter === 'all' || enquiry.priority === priorityFilter;
        return statusMatches && priorityMatches;
      }),
    [enquiries, priorityFilter, statusFilter],
  );

  const selectedEnquiry =
    enquiries.find((enquiry) => enquiry.id === selectedId) ?? filteredEnquiries[0];

  const loadEnquiries = async (activeToken = token) => {
    if (!activeToken) {
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await fetchAdminEnquiries(activeToken);
      setEnquiries(data.enquiries);
      setSelectedId((current) => current ?? data.enquiries[0]?.id ?? null);
      setMessage('Enquiries loaded.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load enquiries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    setToken(nextToken);
    window.sessionStorage.setItem(tokenKey, nextToken);
    await loadEnquiries(nextToken);
  };

  const handleUpdate = async (
    id: string,
    payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>,
  ) => {
    setError('');
    setMessage('');

    try {
      const data = await updateAdminEnquiry(token, id, payload);
      setEnquiries((current) =>
        current.map((enquiry) => (enquiry.id === id ? data.enquiry : enquiry)),
      );
      setMessage('Enquiry updated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update enquiry');
    }
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="section-kicker">Admin</p>
          <h1>Enquiry inbox.</h1>
          <p>Review submitted enquiries, update status, and keep private notes.</p>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          {!token ? (
            <form className="admin-token-panel" onSubmit={handleTokenSubmit}>
              <label className="form-label" htmlFor="adminToken">
                Admin token
              </label>
              <div className="admin-token-row">
                <input
                  className="form-control"
                  id="adminToken"
                  onChange={(event) => {
                    setTokenInput(event.target.value);
                  }}
                  type="password"
                  value={tokenInput}
                />
                <button className="btn btn-accent" type="submit">
                  Load inbox
                </button>
              </div>
            </form>
          ) : (
            <div className="admin-layout">
              <aside className="admin-sidebar">
                <div className="admin-toolbar">
                  <button
                    className="btn btn-outline-accent"
                    disabled={isLoading}
                    onClick={() => void loadEnquiries()}
                    type="button"
                  >
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  <button
                    className="btn btn-link"
                    onClick={() => {
                      window.sessionStorage.removeItem(tokenKey);
                      setToken('');
                      setTokenInput('');
                      setEnquiries([]);
                      setSelectedId(null);
                    }}
                    type="button"
                  >
                    Clear token
                  </button>
                </div>

                <div className="admin-filters">
                  <label>
                    Status
                    <select
                      className="form-select"
                      onChange={(event) => {
                        setStatusFilter(event.target.value as 'all' | EnquiryStatus);
                      }}
                      value={statusFilter}
                    >
                      <option value="all">All</option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Priority
                    <select
                      className="form-select"
                      onChange={(event) => {
                        setPriorityFilter(
                          event.target.value as 'all' | AdminEnquiry['priority'],
                        );
                      }}
                      value={priorityFilter}
                    >
                      <option value="all">All</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="standard">Standard</option>
                    </select>
                  </label>
                </div>

                <div className="admin-enquiry-list">
                  {filteredEnquiries.map((enquiry) => (
                    <button
                      className={`admin-enquiry-list-item ${
                        selectedEnquiry?.id === enquiry.id ? 'is-active' : ''
                      }`}
                      key={enquiry.id}
                      onClick={() => {
                        setSelectedId(enquiry.id);
                      }}
                      type="button"
                    >
                      <span>
                        <strong>{enquiry.name}</strong>
                        <small>{enquiry.project_type || enquiry.type}</small>
                      </span>
                      <em>{enquiry.priority}</em>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="admin-detail">
                {message ? (
                  <div className="alert alert-success" role="status">
                    {message}
                  </div>
                ) : null}
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}

                {selectedEnquiry ? (
                  <AdminEnquiryDetail enquiry={selectedEnquiry} onUpdate={handleUpdate} />
                ) : (
                  <p className="admin-empty">No enquiries match the current filters.</p>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AdminEnquiryDetail({
  enquiry,
  onUpdate,
}: {
  enquiry: AdminEnquiry;
  onUpdate: (
    id: string,
    payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>,
  ) => Promise<void>;
}) {
  const [notes, setNotes] = useState(enquiry.admin_notes ?? '');

  return (
    <article className="admin-detail-card">
      <div className="admin-detail-header">
        <div>
          <p className="section-kicker">{enquiry.type}</p>
          <h2>{enquiry.name}</h2>
          <p>{enquiry.email}</p>
        </div>
        <span className={`admin-priority admin-priority-${enquiry.priority}`}>
          {enquiry.priority}
        </span>
      </div>

      <dl className="admin-meta-grid">
        <div>
          <dt>Received</dt>
          <dd>{formatDate(enquiry.created_at)}</dd>
        </div>
        <div>
          <dt>Project type</dt>
          <dd>{enquiry.project_type || 'Not specified'}</dd>
        </div>
        <div>
          <dt>Estimated hours</dt>
          <dd>{enquiry.estimated_hours}</dd>
        </div>
        <div>
          <dt>Estimated cost</dt>
          <dd>{formatCurrency(enquiry.estimated_cost)}</dd>
        </div>
      </dl>

      <div className="admin-status-row">
        <label>
          Status
          <select
            className="form-select"
            onChange={(event) =>
              void onUpdate(enquiry.id, { status: event.target.value as EnquiryStatus })
            }
            value={enquiry.status}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="admin-message">
        <h3>Message</h3>
        <p>{enquiry.message}</p>
      </section>

      {enquiry.quote_items.length > 0 ? (
        <section className="admin-quote-items">
          <h3>Quote items</h3>
          <ul>
            {enquiry.quote_items.map((item) => (
              <li key={`${item.service}-${item.category}`}>
                <span>
                  <strong>{item.service}</strong>
                  <small>{item.category}</small>
                </span>
                <em>
                  {item.hours} hrs at {formatCurrency(item.rate)}
                </em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-notes">
        <label className="form-label" htmlFor="adminNotes">
          Private notes
        </label>
        <textarea
          className="form-control"
          id="adminNotes"
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          rows={5}
          value={notes}
        />
        <button
          className="btn btn-accent"
          onClick={() => void onUpdate(enquiry.id, { admin_notes: notes })}
          type="button"
        >
          Save notes
        </button>
      </section>
    </article>
  );
}

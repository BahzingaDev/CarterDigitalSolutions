export type EnquiryStatus = 'new' | 'reviewed' | 'replied' | 'closed';
export type AdminView = 'overview' | 'enquiries' | 'quotes' | 'account';

export interface AdminSession {
  authenticated: boolean;
  configured?: boolean;
  storage_available?: boolean;
  configuration_error?: string;
  setup_required?: boolean;
  name?: string;
  email?: string;
  csrf_token?: string;
}

export interface AdminQuoteItem {
  service: string;
  category: string;
  hours: number;
  rate: number;
}

export interface AdminQuoteVersion {
  id: string;
  version: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  items: AdminQuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
  notes: string;
  valid_until?: string | null;
  created_at: string;
  status_updated_at?: string;
}

export interface AdminActivity {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

export interface AdminCommunication {
  id: string;
  direction: 'outgoing';
  subject: string;
  message: string;
  status: 'sent' | 'failed';
  sent_at: string;
  sent_by: string;
}

export interface AdminEnquiry {
  id: string;
  created_at: string;
  status: EnquiryStatus;
  status_updated_at?: string;
  priority: 'standard' | 'medium' | 'high';
  type: 'contact' | 'quote';
  name: string;
  email: string;
  project_type: string;
  message: string;
  quote_items: AdminQuoteItem[];
  estimated_hours: number;
  estimated_cost: number;
  admin_notes: string;
  labels: string[];
  follow_up_at?: string | null;
  archived: boolean;
  quote_versions: AdminQuoteVersion[];
  communications: AdminCommunication[];
  activity: AdminActivity[];
}

export type AdminEnquiryUpdate = Partial<
  Pick<AdminEnquiry, 'status' | 'priority' | 'admin_notes' | 'labels' | 'follow_up_at' | 'archived'>
>;

export async function fetchAdminSession() {
  const response = await fetch('/api/admin/auth/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const data = await readAdminResponse<AdminSession>(response);
  if (!response.ok && typeof data.authenticated !== 'boolean') {
    throw new Error(data.error ?? 'Unable to check the admin session');
  }
  return data;
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch('/api/admin/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseAdminResponse<AdminSession>(response);
}

export async function setupAdmin(name: string, email: string, password: string) {
  const response = await fetch('/api/admin/auth/setup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return parseAdminResponse<AdminSession>(response);
}

export async function logoutAdmin(csrfToken: string) {
  const response = await fetch('/api/admin/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
  });
  return parseAdminResponse<AdminSession>(response);
}

export async function fetchAdminEnquiries() {
  const response = await fetch('/api/admin/enquiries?limit=100', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  return parseAdminResponse<{ enquiries: AdminEnquiry[] }>(response);
}

export async function updateAdminEnquiry(
  csrfToken: string,
  id: string,
  payload: AdminEnquiryUpdate,
) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  return parseAdminResponse<{ enquiry: AdminEnquiry }>(response);
}

export async function createAdminQuote(
  csrfToken: string,
  id: string,
  payload: {
    items: AdminQuoteItem[];
    discount: number;
    deposit: number;
    notes: string;
    valid_until: string | null;
  },
) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}/quotes`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(payload),
  });
  return parseAdminResponse<{ enquiry: AdminEnquiry }>(response);
}

export async function updateAdminQuoteStatus(csrfToken: string, enquiryId: string, quoteId: string, status: AdminQuoteVersion['status']) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(enquiryId)}/quotes/${encodeURIComponent(quoteId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ status }),
  });
  return parseAdminResponse<{ enquiry: AdminEnquiry }>(response);
}

export async function createQuoteShareLink(csrfToken: string, enquiryId: string, quoteId: string) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(enquiryId)}/quotes/${encodeURIComponent(quoteId)}/share`, {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
  });
  return parseAdminResponse<{ url: string }>(response);
}

export async function sendAdminCommunication(csrfToken: string, enquiryId: string, subject: string, message: string, quoteId?: string) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(enquiryId)}/communications`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ subject, message, quote_id: quoteId ?? '' }),
  });
  return parseAdminResponse<{ enquiry: AdminEnquiry }>(response);
}

async function parseAdminResponse<T>(response: Response): Promise<T> {
  const data = await readAdminResponse<T>(response);

  if (!response.ok) {
    throw new Error(data.error ?? 'Admin request failed');
  }

  return data;
}

async function readAdminResponse<T>(response: Response): Promise<T & { error?: string }> {
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? ((await response.json()) as T & { error?: string })
    : { error: 'Unexpected response from server' };
  return data as T & { error?: string };
}

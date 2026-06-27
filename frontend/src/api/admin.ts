export type EnquiryStatus = 'new' | 'reviewed' | 'replied' | 'closed';
export type AdminView = 'overview' | 'enquiries' | 'quotes' | 'account';

export interface AdminSession {
  authenticated: boolean;
  configured?: boolean;
  email?: string;
  csrf_token?: string;
}

export interface AdminQuoteItem {
  service: string;
  category: string;
  hours: number;
  rate: number;
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
}

export async function fetchAdminSession() {
  const response = await fetch('/api/admin/auth/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  return parseAdminResponse<AdminSession>(response);
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
  payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>,
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

async function parseAdminResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? ((await response.json()) as { error?: string })
    : { error: 'Unexpected response from server' };

  if (!response.ok) {
    throw new Error(data.error ?? 'Admin request failed');
  }

  return data as T;
}

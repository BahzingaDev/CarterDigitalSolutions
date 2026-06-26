export type EnquiryStatus = 'new' | 'reviewed' | 'replied' | 'closed';

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

export async function fetchAdminEnquiries(token: string) {
  const response = await fetch('/api/admin/enquiries?limit=100', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseAdminResponse<{ enquiries: AdminEnquiry[] }>(response);
}

export async function updateAdminEnquiry(
  token: string,
  id: string,
  payload: Partial<Pick<AdminEnquiry, 'status' | 'admin_notes'>>,
) {
  const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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

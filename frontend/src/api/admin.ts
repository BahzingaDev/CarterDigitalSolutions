export type EnquiryStatus = 'new' | 'reviewed' | 'replied' | 'closed';
export type AdminView = 'overview' | 'enquiries' | 'quotes' | 'customers' | 'projects' | 'records' | 'services' | 'templates' | 'account';

export interface AdminTemplate { id: string; name: string; subject: string; body: string; created_at: string; updated_at: string; }
export interface AdminCustomField { key: string; value: string; }
export interface AdminRecord { id: string; title: string; record_type: string; tags: string[]; notes: string; fields: AdminCustomField[]; archived: boolean; created_at: string; updated_at: string; }
export type ProjectStage = 'lead' | 'discovery' | 'quoted' | 'accepted' | 'active' | 'on_hold' | 'completed';
export interface ProjectChecklistItem { id: string; title: string; completed: boolean; due_date: string; }
export interface AdminProject { id: string; name: string; client_name: string; client_email: string; stage: ProjectStage; value: number; due_date: string; notes: string; tags: string[]; linked_enquiry_id: string; tasks: ProjectChecklistItem[]; milestones: ProjectChecklistItem[]; completion: number; created_at: string; updated_at: string; }
export interface AdminCustomer { email: string; name: string; phone: string; organisation: string; notes: string; tags: string[]; enquiries: AdminEnquiry[]; projects: AdminProject[]; }
export interface AdminServiceOverride { id: string; slug: string; name: string; audience: string; category: string; description: string; best_for: string; starting_from: number; hourly_rate: number; estimated_hours: number; deposit: string; active: boolean; sort_order: number; }

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
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'delayed' | 'bounced' | 'complained' | 'failed' | 'suppressed';
  sent_at: string;
  sent_by: string;
  provider_message_id?: string;
  delivery_events: { id: string; type: string; created_at: string; details: Record<string, unknown> }[];
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

export const fetchAdminTemplates = () => workspaceList<AdminTemplate>('templates');
export const fetchAdminRecords = () => workspaceList<AdminRecord>('records');
export const fetchAdminProjects = () => workspaceList<AdminProject>('projects');
export const saveAdminTemplate = (csrf: string, item: Partial<AdminTemplate>) => workspaceSave<AdminTemplate>('templates', csrf, item);
export const saveAdminRecord = (csrf: string, item: Partial<AdminRecord>) => workspaceSave<AdminRecord>('records', csrf, item);
export const saveAdminProject = (csrf: string, item: Partial<AdminProject>) => workspaceSave<AdminProject>('projects', csrf, item);
export const deleteAdminTemplate = (csrf: string, id: string) => workspaceDelete('templates', csrf, id);
export const deleteAdminRecord = (csrf: string, id: string) => workspaceDelete('records', csrf, id);
export const deleteAdminProject = (csrf: string, id: string) => workspaceDelete('projects', csrf, id);
export const fetchAdminServices = () => workspaceList<AdminServiceOverride>('services');
export const saveAdminService = (csrf: string, item: Partial<AdminServiceOverride>) => workspaceSave<AdminServiceOverride>('services', csrf, item);
export const deleteAdminService = (csrf: string, id: string) => workspaceDelete('services', csrf, id);
export async function fetchAdminCustomers() { const response = await fetch('/api/admin/customers', { credentials: 'same-origin', headers: { Accept: 'application/json' } }); return (await parseAdminResponse<{ customers: AdminCustomer[] }>(response)).customers; }
export async function saveAdminCustomer(csrf: string, customer: Partial<AdminCustomer>) { const response = await fetch(`/api/admin/customers/${encodeURIComponent(customer.email ?? '')}`, { method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(customer) }); return (await parseAdminResponse<{ customer: AdminCustomer }>(response)).customer; }

async function workspaceList<T>(resource: string): Promise<T[]> {
  const response = await fetch(`/api/admin/${resource}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const data = await parseAdminResponse<Record<string, T[]>>(response);
  return data[resource];
}

async function workspaceSave<T extends { id: string }>(resource: string, csrf: string, item: Partial<T>): Promise<T> {
  const response = await fetch(`/api/admin/${resource}${item.id ? `/${encodeURIComponent(item.id)}` : ''}`, { method: item.id ? 'PUT' : 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(item) });
  const singular = resource === 'templates' ? 'template' : resource === 'records' ? 'record' : resource === 'services' ? 'service' : 'project';
  const data = await parseAdminResponse<Record<string, T>>(response);
  return data[singular];
}

async function workspaceDelete(resource: string, csrf: string, id: string) {
  const response = await fetch(`/api/admin/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf } });
  if (!response.ok) await parseAdminResponse(response);
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

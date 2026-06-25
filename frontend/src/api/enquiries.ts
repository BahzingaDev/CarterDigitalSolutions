export interface QuoteItemPayload {
  service: string;
  category: string;
  hours: number;
  rate: number;
}

export interface EnquiryPayload {
  type: 'contact' | 'quote';
  name: string;
  email: string;
  projectType?: string;
  message: string;
  website?: string;
  quoteItems?: QuoteItemPayload[];
  estimatedHours?: number;
  estimatedCost?: number;
}

export async function submitEnquiry(payload: EnquiryPayload) {
  const response = await fetch('/api/enquiries', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? ((await response.json()) as { error?: string; id?: string })
    : { error: 'Unexpected response from server' };

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to submit enquiry');
  }

  return data;
}

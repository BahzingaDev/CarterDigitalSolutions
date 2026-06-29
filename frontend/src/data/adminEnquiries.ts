import type { AdminEnquiry } from '../api/admin';

type QuoteActivityEnquiry = Pick<AdminEnquiry, 'quote_items' | 'quote_versions' | 'type'>;

export function hasQuoteActivity(enquiry: QuoteActivityEnquiry) {
  return enquiry.type === 'quote'
    || (enquiry.quote_items?.length ?? 0) > 0
    || (enquiry.quote_versions?.length ?? 0) > 0;
}

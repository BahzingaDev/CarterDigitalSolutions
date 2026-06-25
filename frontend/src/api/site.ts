import type { SiteSummary } from '../types';

export async function fetchSiteSummary(): Promise<SiteSummary> {
  const response = await fetch('/api/site-summary', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to load site summary');
  }

  return response.json() as Promise<SiteSummary>;
}

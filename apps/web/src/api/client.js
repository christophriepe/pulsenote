// API client. Speaks FHIR over REST to the backend (draft endpoints, see root README → API).
// With CONFIG.apiBase = null it talks to the in-browser mock instead.
// Case ids are random UUIDs, never patient data, so URLs stay free of patient data.

import { CONFIG } from '../config.js';
import { session } from '../auth/session.js';
import { mockFetch, caseStatus, transferredAt } from './mock-server.js';

export class OfflineError extends Error {}

async function call(method, path, body) {
  try {
    if (!CONFIG.apiBase) return await mockFetch(method, path, body, session.token);
    const res = await fetch(CONFIG.apiBase + path, {
      method,
      headers: { 'Content-Type': 'application/fhir+json', Authorization: `Bearer ${session.token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
    return res.headers.get('content-type')?.includes('json') ? res.json() : { text: await res.text() };
  } catch (e) {
    if (e.offline || e instanceof TypeError) throw new OfflineError('No connection');
    throw e;
  }
}

// Normalized view of a case for lists
export function caseView(qr) {
  return {
    id: qr.id,
    qr,
    status: caseStatus(qr),
    authorId: qr.author?.identifier?.value,
    authorName: qr.author?.display,
    authored: new Date(qr.authored).getTime(),
    updated: new Date(qr.meta?.lastUpdated || qr.authored).getTime(),
    transferredAt: transferredAt(qr) ? new Date(transferredAt(qr)).getTime() : null,
  };
}

export const api = {
  async listCases({ mine = false } = {}) {
    const b = await call('GET', `/cases${mine ? '?author=me' : ''}`);
    return (b.entry || []).map((e) => caseView(e.resource));
  },
  getCase: async (id) => caseView(await call('GET', `/cases/${id}`)),
  putCase: async (id, qr) => caseView(await call('PUT', `/cases/${id}`, qr)),
  getText: async (id) => (await call('GET', `/cases/${id}/text`)).text,
  getFhir: (id, format) => call('GET', `/cases/${id}/fhir${format ? `?format=${format}` : ''}`),
  markTransferred: async (id) => caseView(await call('POST', `/cases/${id}/transfer`)), // proposed endpoint
  audit: (id) => call('GET', `/audit?case=${id}`), // proposed endpoint
};

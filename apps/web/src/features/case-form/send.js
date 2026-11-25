// Sending a draft: PUT /cases/{id} with the QuestionnaireResponse. The draft is deleted from the
// device only after the server confirms receipt. Same id on retry → no duplicate on the server.

import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { buildResponse } from '../../lib/questionnaire.js';
import { h, toast, confirmDialog } from '../../lib/dom.js';
import { drafts } from './drafts.js';
import { loadForm } from './forms.js';

export async function sendDraft(draft) {
  if (!session.isValid() && !(await reauth())) return false;
  const q = await loadForm(draft.formId);
  const qr = buildResponse(q, draft.answers, { id: draft.id, status: 'completed', authored: draft.createdAt, author: session.user });
  try {
    await api.putCase(draft.id, qr);
    await drafts.remove(draft.id);
    toast('Case sent. Removed from this phone.', 'ok');
    return true;
  } catch (e) {
    if (e instanceof OfflineError) toast('No connection. The case stays on this phone as an unsent draft.', 'warn');
    else toast(`Could not send: ${e.message}`, 'error');
    return false;
  }
}

// Session expired (shift over): drafts stay editable, but sending needs a fresh sign-in.
export async function reauth() {
  const pw = h('input', { type: 'password', class: 'input', placeholder: 'Password', autocomplete: 'current-password' });
  const ok = await confirmDialog({
    title: 'Sign in again to send',
    body: [h('p', null, `Your session has expired. Your drafts are still on this device. Enter the password for ${session.user?.name || 'your account'} to send.`), pw],
    confirm: 'Sign in',
  });
  if (!ok) return false;
  try { await session.signIn(session.user.username, pw.value); return true; }
  catch (e) { toast(e.message, 'error'); return false; }
}

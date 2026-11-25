// Sending a draft: PUT /cases/{id} with the QuestionnaireResponse. The draft is deleted from the
// device only after the server confirms receipt. Same id on retry → no duplicate on the server.

import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { buildResponse } from '../../lib/questionnaire.js';
import { h, toast, confirmDialog } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { drafts } from './drafts.js';
import { loadForm } from './forms.js';

export async function sendDraft(draft) {
  if (!session.isValid() && !(await reauth())) return false;
  const q = await loadForm(draft.formId);
  const qr = buildResponse(q, draft.answers, { id: draft.id, status: 'completed', authored: draft.createdAt, author: session.user });
  try {
    await api.putCase(draft.id, qr);
    await drafts.remove(draft.id);
    toast(t('send.ok'), 'ok');
    return true;
  } catch (e) {
    if (e instanceof OfflineError) toast(t('send.offline'), 'warn');
    else toast(t('send.error', { m: e.message }), 'error');
    return false;
  }
}

// Session expired (shift over): drafts stay editable, but sending needs a fresh sign-in.
export async function reauth() {
  const pw = h('input', { type: 'password', class: 'input', placeholder: t('login.password'), autocomplete: 'current-password' });
  const ok = await confirmDialog({
    title: t('reauth.title'),
    body: [h('p', null, t('reauth.body', { name: session.user?.name || '' })), pw],
    confirm: t('login.submit'),
  });
  if (!ok) return false;
  try { await session.signIn(session.user.username, pw.value); return true; }
  catch (e) { toast(t(e.message), 'error'); return false; }
}

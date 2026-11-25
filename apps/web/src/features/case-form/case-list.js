// Phone home screen: the physician's own cases of the current shift.
//   Drafts – stored on this phone, not sent yet (clearly marked)
//   Sent   – loaded fresh from the server every time, never cached on the phone

import { h, clear, clock, fmtTime, fmtDuration, confirmDialog, toast } from '../../lib/dom.js';
import { CONFIG } from '../../config.js';
import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { caseSummary, answersFromResponse } from '../../lib/questionnaire.js';
import { drafts } from './drafts.js';
import { loadForm, availableForms, formForCanonical } from './forms.js';
import { sendDraft } from './send.js';

export async function renderCaseList(root, nav) {
  const user = session.user;
  const draftSection = h('section', { class: 'list-section' }, h('div', { class: 'muted pad' }, 'Loading drafts …'));
  const sentSection = h('section', { class: 'list-section' }, h('div', { class: 'muted pad' }, 'Loading sent cases …'));
  clear(root,
    h('div', { class: 'page page-narrow' },
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, 'My shift'), h('p', { class: 'muted' }, `${user.name} · cases since the start of your shift`)),
        h('button', { class: 'btn btn-primary btn-lg', onclick: () => pickTemplate(nav) }, h('span', { 'aria-hidden': 'true' }, '+ '), 'New case')),
      draftSection, sentSection));

  // Drafts
  const { drafts: list, expired } = await drafts.list(user.id);
  if (expired) toast(`${expired} unsent draft${expired > 1 ? 's' : ''} expired and ${expired > 1 ? 'were' : 'was'} deleted from this phone.`, 'warn');
  const cards = [];
  for (const d of list) {
    const q = await loadForm(d.formId);
    cards.push(draftCard(d, q, nav, () => renderCaseList(root, nav)));
  }
  const soon = list.filter((d) => d.expiresAt - clock.now() < CONFIG.draftWarnMs);
  clear(draftSection,
    h('h2', { class: 'section-title' }, 'Drafts', h('span', { class: 'count' }, list.length), h('span', { class: 'badge badge-warn' }, 'on this phone · not sent')),
    soon.length > 0 && h('div', { class: 'banner banner-warn', role: 'alert' },
      `${soon.length} draft${soon.length > 1 ? 's expire' : ' expires'} within ${fmtDuration(CONFIG.draftWarnMs)}. Send ${soon.length > 1 ? 'them' : 'it'} now, or the data will be deleted from this phone.`),
    cards.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'empty' }, 'No unsent drafts.'));

  // Sent (server only)
  try {
    const shiftStart = clock.now() - CONFIG.sessionMs;
    const sent = (await api.listCases({ mine: true })).filter((c) => c.authored >= shiftStart).sort((a, b) => b.updated - a.updated);
    const sentCards = [];
    for (const c of sent) sentCards.push(sentCard(c, await loadFormFor(c), nav));
    clear(sentSection,
      h('h2', { class: 'section-title' }, 'Sent', h('span', { class: 'count' }, sent.length), h('span', { class: 'badge' }, 'on the server')),
      sentCards.length ? h('div', { class: 'cards' }, sentCards) : h('p', { class: 'empty' }, 'Nothing sent yet this shift.'),
      h('p', { class: 'muted small' }, 'Older cases are in the dashboard.'));
  } catch (e) {
    clear(sentSection,
      h('h2', { class: 'section-title' }, 'Sent'),
      h('div', { class: 'banner banner-offline' }, e instanceof OfflineError
        ? 'Offline. Sent cases are only shown with a connection, because they are never stored on the phone.'
        : `Could not load sent cases: ${e.message}`));
  }
}

async function loadFormFor(c) {
  return (await formForCanonical(c.qr.questionnaire)).questionnaire;
}

function draftCard(d, q, nav, reload) {
  const s = caseSummary(q, d.answers);
  const left = d.expiresAt - clock.now();
  return h('article', { class: `card draft-card ${left < CONFIG.draftWarnMs ? 'expiring' : ''}` },
    h('button', { class: 'card-main', onclick: () => nav.openDraft(d.id) },
      h('div', { class: 'card-top' }, h('strong', null, s.name), s.meta && h('span', { class: 'muted' }, s.meta)),
      s.complaint && h('div', { class: 'card-complaint' }, s.complaint),
      h('div', { class: 'card-meta' },
        h('span', { class: 'pill pill-draft' }, 'Not sent'),
        h('span', null, q.title),
        s.location && h('span', null, s.location),
        h('span', { class: left < CONFIG.draftWarnMs ? 'warn-text' : '' }, `Expires ${fmtTime(d.expiresAt)} (in ${fmtDuration(left)})`))),
    h('div', { class: 'card-actions' },
      h('button', { class: 'btn btn-sm', onclick: () => nav.openDraft(d.id) }, 'Continue'),
      h('button', { class: 'btn btn-sm btn-primary', onclick: async (e) => { e.target.disabled = true; await sendDraft(d); reload(); } }, 'Send'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
        if (await confirmDialog({ title: 'Discard draft?', body: 'The draft is deleted from this phone. It was never sent.', confirm: 'Discard', danger: true })) {
          await drafts.remove(d.id); reload();
        }
      } }, 'Discard')));
}

function sentCard(c, q, nav) {
  const s = caseSummary(q, answersFromResponse(c.qr));
  return h('article', { class: 'card' },
    h('button', { class: 'card-main', onclick: () => nav.openCase(c.id) },
      h('div', { class: 'card-top' }, h('strong', null, s.name), s.meta && h('span', { class: 'muted' }, s.meta)),
      s.complaint && h('div', { class: 'card-complaint' }, s.complaint),
      h('div', { class: 'card-meta' },
        h('span', { class: `pill pill-${c.status}` }, c.status === 'transferred' ? 'In HIS' : 'Sent'),
        h('span', null, q.title), s.location && h('span', null, s.location), h('span', null, fmtTime(c.updated)))));
}

async function pickTemplate(nav) {
  let chosen = null;
  const list = h('div', { class: 'template-list' }, availableForms().map((f) =>
    h('button', { class: 'template', disabled: !f.available, onclick: () => { chosen = f; overlay.querySelector('.btn-primary').click(); } },
      h('strong', null, f.label), h('span', { class: 'muted small' }, f.hint))));
  const p = confirmDialog({ title: 'New case: choose a template', body: list, confirm: 'Cancel', cancel: null });
  const overlay = document.querySelector('.modal-overlay:last-of-type');
  await p;
  if (chosen) nav.newDraft(chosen.id);
}

// Phone home screen: the physician's own cases of the current shift.
//   Drafts – stored on this phone, not sent yet (clearly marked)
//   Sent   – loaded fresh from the server every time, never cached on the phone

import { h, clear, clock, fmtTime, fmtDuration, confirmDialog, toast } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { CONFIG } from '../../config.js';
import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { caseSummary, answersFromResponse, formTitle } from '../../lib/questionnaire.js';
import { summaryText } from '../../components/case-summary.js';
import { drafts } from './drafts.js';
import { loadForm, availableForms, formForCanonical } from './forms.js';
import { sendDraft } from './send.js';

export async function renderCaseList(root, nav) {
  const user = session.user;
  const reload = () => renderCaseList(root, nav);
  const draftSection = h('section', { class: 'list-section', 'aria-busy': 'true' }, h('div', { class: 'muted pad' }, t('list.loadingDrafts')));
  const sentSection = h('section', { class: 'list-section', 'aria-busy': 'true' }, h('div', { class: 'muted pad' }, t('list.loadingSent')));
  clear(root,
    h('div', { class: 'page page-narrow' },
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, t('list.title')), h('p', { class: 'muted' }, t('list.subtitle', { name: user.name, h: Math.round(CONFIG.sessionMs / 3600000) }))),
        h('button', { class: 'btn btn-primary btn-lg new-case', onclick: () => pickTemplate(nav) }, h('span', { class: 'plus', 'aria-hidden': 'true' }), t('list.new'))),
      draftSection, sentSection));

  // Drafts
  const { drafts: list, expired } = await drafts.list(user.id);
  if (expired) toast(t('list.expired', { n: expired }), 'warn');
  const cards = [];
  for (const d of list) cards.push(draftCard(d, await loadForm(d.formId), nav, reload));
  const soon = list.filter((d) => d.expiresAt - clock.now() < CONFIG.draftWarnMs);
  draftSection.removeAttribute('aria-busy');
  clear(draftSection,
    h('h2', { class: 'section-title' }, t('list.drafts'), h('span', { class: 'count' }, list.length)),
    soon.length > 0 && h('div', { class: 'banner banner-warn', role: 'alert' }, t('list.expiring', { n: soon.length, d: fmtDuration(CONFIG.draftWarnMs) })),
    cards.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'empty' }, t('list.noDrafts')));

  // Sent (server only)
  try {
    const since = clock.now() - CONFIG.sessionMs;
    const sent = (await api.listCases({ mine: true })).filter((c) => c.authored >= since).sort((a, b) => b.updated - a.updated);
    const sentCards = [];
    for (const c of sent) sentCards.push(sentCard(c, (await formForCanonical(c.qr.questionnaire)).questionnaire, nav));
    clear(sentSection,
      h('h2', { class: 'section-title' }, t('list.sent'), h('span', { class: 'count' }, sent.length)),
      sentCards.length ? h('div', { class: 'cards' }, sentCards) : h('p', { class: 'empty' }, t('list.noSent')),
      h('p', { class: 'muted small center' }, t('list.older')));
  } catch (e) {
    clear(sentSection,
      h('h2', { class: 'section-title' }, t('list.sent')),
      h('div', { class: 'banner banner-offline' }, e instanceof OfflineError ? t('list.offlineSent') : t('list.loadError', { m: e.message })));
  }
  sentSection.removeAttribute('aria-busy');
}

function cardHead(s) {
  return h('div', { class: 'card-top' }, h('strong', { class: 'card-name' }, s.name), s.meta && h('span', { class: 'muted' }, s.meta));
}

function draftCard(d, q, nav, reload) {
  const s = summaryText(caseSummary(q, d.answers));
  const left = d.expiresAt - clock.now();
  const expiring = left < CONFIG.draftWarnMs;
  return h('article', { class: `card draft-card ${expiring ? 'expiring' : ''}` },
    h('button', { class: 'card-main', onclick: () => nav.openDraft(d.id) },
      cardHead(s),
      s.complaint && h('div', { class: 'card-complaint' }, s.complaint),
      h('div', { class: 'card-meta' },
        h('span', { class: 'pill pill-draft' }, t('card.notSent')),
        s.location && h('span', null, s.location),
        h('span', null, formTitle(q)))),
    h('div', { class: 'card-foot' },
      h('span', { class: `expiry ${expiring ? 'warn-text' : ''}` }, h('span', { class: 'clock-icon', 'aria-hidden': 'true' }), t('card.expires', { t: fmtTime(d.expiresAt), d: fmtDuration(left) })),
      h('div', { class: 'card-actions' },
        h('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
          if (await confirmDialog({ title: t('card.discardTitle'), body: t('card.discardBody'), confirm: t('card.discard'), danger: true })) {
            await drafts.remove(d.id); reload();
          }
        } }, t('card.discard')),
        h('button', { class: 'btn btn-sm btn-primary', onclick: async (e) => { e.currentTarget.disabled = true; await sendDraft(d); reload(); } }, t('card.send')))));
}

function sentCard(c, q, nav) {
  const s = summaryText(caseSummary(q, answersFromResponse(c.qr)));
  return h('article', { class: 'card' },
    h('button', { class: 'card-main', onclick: () => nav.openCase(c.id) },
      cardHead(s),
      s.complaint && h('div', { class: 'card-complaint' }, s.complaint),
      h('div', { class: 'card-meta' },
        h('span', { class: `pill pill-${c.status}` }, c.status === 'transferred' ? t('card.inHis') : t('card.sent')),
        s.location && h('span', null, s.location), h('span', null, fmtTime(c.updated)))));
}

async function pickTemplate(nav) {
  let chosen = null;
  const button = (f) => h('button', { class: `template ${f.main ? 'template-main' : ''}`, disabled: !f.available,
    onclick: () => { chosen = f; document.querySelector('.modal-actions .btn:last-child').click(); } },
  h('span', { class: 'template-text' },
    h('strong', null, t(`template.${f.id}`)),
    h('span', { class: 'muted small' }, f.available ? t(`template.${f.id}.hint`) : `${t(`template.${f.id}.hint`)} · ${t('template.notYet')}`)),
  f.main && h('span', { class: 'pill pill-received' }, t('template.main')));
  const forms = availableForms();
  const list = h('div', { class: 'template-list' },
    forms.filter((f) => f.main).map(button),
    h('div', { class: 'template-sep muted small' }, t('template.more')),
    forms.filter((f) => !f.main).map(button));
  await confirmDialog({ title: t('template.title'), body: list, confirm: t('cancel'), cancel: null, quiet: true });
  if (chosen) nav.newDraft(chosen.id);
}

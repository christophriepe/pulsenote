// App shell: header, routing, demo controls.
// Routes hold no patient data and no case ids (#login, #shift, #case, #dashboard); the current
// draft or case lives in memory only.

import { h, clear, clock, confirmDialog, toast, fmtTime } from './lib/dom.js';
import { t } from './lib/i18n.js';
import { CONFIG } from './config.js';
import { session } from './auth/session.js';
import { renderLogin, initials } from './auth/login.js';
import { langButton } from './components/lang-button.js';
import { drafts } from './features/case-form/drafts.js';
import { loadForm } from './features/case-form/forms.js';
import { renderCaseList } from './features/case-form/case-list.js';
import { renderWizard } from './features/case-form/wizard.js';
import { renderDashboard } from './features/dashboard/dashboard.js';
import { mockNet } from './api/mock-server.js';

const ui = { draftId: null, caseId: undefined, wizard: null };
const appRoot = document.getElementById('app');
const isDesktop = () => window.innerWidth >= CONFIG.desktopMinWidth;

const nav = {
  home: () => route('#shift'),
  dashboard: () => route('#dashboard'),
  openDraft: (id) => { ui.draftId = id; ui.wizard = null; route('#case'); },
  openCase: (id) => { ui.caseId = id; route('#dashboard'); },
  async newDraft(formId) {
    const q = await loadForm(formId);
    const d = drafts.create(session.user, { id: formId }, q);
    await drafts.put(d);
    nav.openDraft(d.id);
  },
};

function route(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  if (!session.user) return showLogin();
  const hash = location.hash || '#shift';
  const main = h('main', { id: 'main', tabindex: '-1' });
  const step = ui.wizard?.step ?? 0;
  ui.wizard = null;
  clear(appRoot, h('a', { class: 'skip-link', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Skip to content'), header(hash), main);
  if (hash === '#case' && ui.draftId) {
    const d = await drafts.get(ui.draftId);
    if (d && d.userId === session.user.id) { ui.wizard = await renderWizard(main, d, nav, step); return; }
    return nav.home();
  }
  if (hash === '#dashboard') {
    const sel = ui.caseId; ui.caseId = undefined;
    return renderDashboard(main, nav, sel);
  }
  return renderCaseList(main, nav);
}

function showLogin() {
  if (location.hash !== '#login') history.replaceState(null, '', '#login');
  const main = h('main', { id: 'main' });
  clear(appRoot, main);
  renderLogin(main, () => route(isDesktop() ? '#dashboard' : '#shift'));
  paintDemoBar();
}

function header(hash) {
  const u = session.user;
  const expired = !session.isValid();
  const onDash = hash === '#dashboard';
  return h('header', { class: 'app-header' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'PulseNote'),
    h('nav', { class: 'main-nav', 'aria-label': 'PulseNote' },
      h('a', { href: '#shift', 'aria-current': !onDash ? 'page' : null }, t('nav.shift')),
      h('a', { href: '#dashboard', 'aria-current': onDash ? 'page' : null }, t('nav.dashboard'))),
    h('div', { class: 'header-right' },
      // Connection status only when it matters: offline (sending and sent cases unavailable)
      mockNet.offline && h('span', { class: 'net off', role: 'status', title: t('net.label') }, t('net.offline')),
      expired && h('span', { class: 'pill pill-draft', title: t('session.expiredHint') }, t('session.expired')),
      langButton(() => { render(); paintDemoBar(); }),
      h('span', { class: 'user-chip' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(u.name)),
        h('span', { class: 'user-text' }, h('strong', null, u.name), h('span', { class: 'muted small' }, t(`role.${u.role}`)))),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: signOut }, t('signout'))));
}

async function signOut() {
  const { drafts: list } = await drafts.list(session.user.id);
  if (list.length) {
    const ok = await confirmDialog({
      title: t('signout.title'),
      body: h('p', null, t('signout.body', { n: list.length })),
      confirm: t('signout.confirm'), danger: true,
    });
    if (!ok) return;
  }
  await drafts.removeAllForUser(session.user.id);
  session.signOut();
  ui.draftId = null;
  showLogin();
}

// Demo controls: simulate dropped connections and fast-forward time to show draft expiry.
let demoBar = null;
function paintDemoBar() {
  const open = demoBar?.open || false;
  demoBar?.remove();
  const label = h('span', { class: 'small' });
  const paint = () => { label.textContent = `${t('demo.clock')} ${fmtTime(clock.now())}${clock.offset ? ` (+${Math.round(clock.offset / 3600000)} h)` : ''}`; };
  const shift = (ms) => { clock.offset = ms == null ? 0 : clock.offset + ms; paint(); if (session.user) render(); };
  demoBar = h('details', { class: 'demo-bar', open },
    h('summary', null, t('demo.title')),
    h('div', { class: 'demo-bar-body' },
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: mockNet.offline, onchange: (e) => {
        mockNet.offline = e.target.checked;
        toast(mockNet.offline ? t('demo.offlineOn') : t('demo.offlineOff'));
        if (session.user) render();
      } }), ` ${t('demo.offline')}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', onclick: () => shift(3600000) }, '+1 h'),
        h('button', { class: 'btn btn-sm', onclick: () => shift(11 * 3600000) }, '+11 h'),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => shift(null) }, t('demo.reset'))),
      label,
      h('p', { class: 'muted small' }, t('demo.note'))));
  paint();
  document.body.append(demoBar);
}

window.addEventListener('hashchange', render);
paintDemoBar();
render();

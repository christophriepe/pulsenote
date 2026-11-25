// App shell: header, routing, demo toolbar.
// Routes hold no patient data and no case ids (#login, #shift, #case, #dashboard); the current
// draft or case lives in memory only.

import { h, clear, clock, confirmDialog, toast, fmtTime } from './lib/dom.js';
import { CONFIG } from './config.js';
import { session, ROLE_LABEL } from './auth/session.js';
import { renderLogin } from './auth/login.js';
import { drafts } from './features/case-form/drafts.js';
import { loadForm } from './features/case-form/forms.js';
import { renderCaseList } from './features/case-form/case-list.js';
import { renderWizard } from './features/case-form/wizard.js';
import { renderDashboard } from './features/dashboard/dashboard.js';
import { mockNet } from './api/mock-server.js';

const ui = { draftId: null, caseId: undefined };
const appRoot = document.getElementById('app');
const isDesktop = () => window.innerWidth >= CONFIG.desktopMinWidth;

const nav = {
  home: () => route('#shift'),
  dashboard: () => route('#dashboard'),
  openDraft: (id) => { ui.draftId = id; route('#case'); },
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
  const main = h('main', { id: 'main' });
  clear(appRoot, header(hash), main);
  if (hash === '#case' && ui.draftId) {
    const d = await drafts.get(ui.draftId);
    if (d && d.userId === session.user.id) return renderWizard(main, d, nav);
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
}

function header(hash) {
  const u = session.user;
  const expired = !session.isValid();
  return h('header', { class: 'app-header' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'PulseNote'),
    h('nav', { class: 'main-nav' },
      h('a', { href: '#shift', 'aria-current': hash !== '#dashboard' ? 'page' : null }, 'My shift'),
      h('a', { href: '#dashboard', 'aria-current': hash === '#dashboard' ? 'page' : null }, 'Dashboard')),
    h('div', { class: 'header-right' },
      h('span', { class: `net ${mockNet.offline ? 'off' : 'on'}`, title: 'Connection' }, mockNet.offline ? 'Offline' : 'Online'),
      expired && h('span', { class: 'pill pill-draft', title: 'Drafts stay editable. Sign in again to send.' }, 'Session expired'),
      h('span', { class: 'user-chip' }, h('strong', null, u.name), h('span', { class: 'muted small' }, ROLE_LABEL[u.role])),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: signOut }, 'Sign out')));
}

async function signOut() {
  const { drafts: list } = await drafts.list(session.user.id);
  if (list.length) {
    const ok = await confirmDialog({
      title: 'Sign out and delete drafts?',
      body: h('p', null, `${list.length} unsent draft${list.length > 1 ? 's are' : ' is'} on this device. Signing out deletes ${list.length > 1 ? 'them' : 'it'}, so the next person on this device never sees ${list.length > 1 ? 'them' : 'it'}. Send first if you still need ${list.length > 1 ? 'them' : 'it'}.`),
      confirm: 'Delete drafts and sign out', danger: true,
    });
    if (!ok) return;
  }
  await drafts.removeAllForUser(session.user.id);
  session.signOut();
  ui.draftId = null;
  showLogin();
}

// Demo toolbar: simulate dropped connections and fast-forward time to show draft expiry.
function demoBar() {
  const label = h('span', { class: 'small' });
  const paint = () => { label.textContent = `Clock ${fmtTime(clock.now())}${clock.offset ? ` (+${Math.round(clock.offset / 3600000)} h)` : ''}`; };
  const bar = h('details', { class: 'demo-bar' },
    h('summary', null, 'Demo controls'),
    h('div', { class: 'demo-bar-body' },
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', onchange: (e) => { mockNet.offline = e.target.checked; toast(mockNet.offline ? 'Simulating: no connection' : 'Back online'); render(); } }), ' Simulate offline'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', onclick: () => { clock.offset += 3600000; paint(); render(); } }, '+1 h'),
        h('button', { class: 'btn btn-sm', onclick: () => { clock.offset += 11 * 3600000; paint(); render(); } }, '+11 h'),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { clock.offset = 0; paint(); render(); } }, 'Reset')),
      label,
      h('p', { class: 'muted small' }, 'Synthetic patients only. Backend is mocked in the browser.')));
  paint();
  document.body.append(bar);
}

window.addEventListener('hashchange', render);
demoBar();
render();

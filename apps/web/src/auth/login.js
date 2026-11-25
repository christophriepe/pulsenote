// Login screen. One login for phone and desktop.

import { h, clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { session, DEMO_USERS } from './session.js';
import { langButton } from '../components/lang-button.js';

export function renderLogin(root, onSignedIn) {
  const rerender = () => renderLogin(root, onSignedIn);
  const user = h('input', { class: 'input', id: 'login-user', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: t('login.placeholder') });
  const pw = h('input', { class: 'input', id: 'login-pw', type: 'password', autocomplete: 'current-password' });
  const err = h('div', { class: 'field-warn', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, t('login.submit'));

  const form = h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true; err.hidden = true;
    try { onSignedIn(await session.signIn(user.value, pw.value)); }
    catch (ex) { err.textContent = t(ex.message); err.hidden = false; btn.disabled = false; }
  } },
  h('label', { class: 'field-label', for: 'login-user' }, t('login.account')), user,
  h('label', { class: 'field-label', for: 'login-pw' }, t('login.password')), pw,
  err, btn);

  clear(root, h('div', { class: 'login-page' },
    h('div', { class: 'login-card' },
      h('div', { class: 'login-top' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'PulseNote'),
        langButton(rerender)),
      h('p', { class: 'muted' }, t('login.tagline')),
      form,
      h('details', { class: 'demo-accounts', open: true },
        h('summary', null, t('login.demo')),
        h('p', { class: 'muted small' }, t('login.demoHint')),
        DEMO_USERS.map((u) => h('button', { type: 'button', class: 'demo-user', onclick: () => { user.value = u.username; pw.value = 'demo'; btn.focus(); } },
          h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(u.name)),
          h('span', { class: 'demo-user-text' }, h('strong', null, u.name), h('span', { class: 'muted small' }, `${u.username} · ${t('role.' + u.role)}`))))),
      h('p', { class: 'fineprint' }, t('login.fine')))));
  user.focus();
}

export function initials(name) {
  return name.replace(/^Dr\.\s*/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('');
}

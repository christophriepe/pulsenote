// Login screen. One login for phone and desktop.

import { h, clear } from '../lib/dom.js';
import { session, DEMO_USERS, ROLE_LABEL } from './session.js';

export function renderLogin(root, onSignedIn) {
  const user = h('input', { class: 'input', id: 'login-user', autocomplete: 'username', autocapitalize: 'none', placeholder: 'e.g. weber' });
  const pw = h('input', { class: 'input', id: 'login-pw', type: 'password', autocomplete: 'current-password' });
  const err = h('div', { class: 'field-warn', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, 'Sign in');

  const form = h('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true; err.hidden = true;
    try { onSignedIn(await session.signIn(user.value, pw.value)); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  } },
  h('label', { class: 'field-label', for: 'login-user' }, 'Hospital account'), user,
  h('label', { class: 'field-label', for: 'login-pw' }, 'Password'), pw,
  err, btn);

  clear(root, h('div', { class: 'login-page' },
    h('div', { class: 'login-card' },
      h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), 'PulseNote'),
      h('p', { class: 'muted' }, 'Bedside history & examination for the emergency department.'),
      form,
      h('details', { class: 'demo-accounts', open: true },
        h('summary', null, 'Demo accounts'),
        h('p', { class: 'muted small' }, 'Any password works. Tap to fill in.'),
        DEMO_USERS.map((u) => h('button', { type: 'button', class: 'demo-user', onclick: () => { user.value = u.username; pw.value = 'demo'; btn.focus(); } },
          h('strong', null, u.name), h('span', { class: 'muted small' }, `${u.username} · ${ROLE_LABEL[u.role]}`)))),
      h('p', { class: 'fineprint' }, 'Course prototype. Synthetic patients only, never real patient data. In a hospital this would be the hospital login (SSO).'))));
  user.focus();
}

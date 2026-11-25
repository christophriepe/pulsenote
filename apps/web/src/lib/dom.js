// Tiny DOM helpers. No framework, no build step.

import { i18n, t } from './i18n.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'dataset')Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Demo clock: lets the demo toolbar fast-forward time to show draft expiry.
export const clock = {
  offset: 0,
  now() { return Date.now() + this.offset; },
};

export function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(ms) {
  return new Date(ms).toLocaleString(i18n.locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDuration(ms) {
  if (ms <= 0) return '0 min';
  const m = Math.round(ms / 60000);
  const hh = Math.floor(m / 60);
  return hh ? `${hh} h ${m % 60} min` : `${m} min`;
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export function toast(msg, kind = 'info') {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  host.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// Modal dialog (no window.confirm, which blocks and looks out of place on phones)
export function confirmDialog({ title, body, confirm = 'OK', cancel = t('cancel'), danger = false, quiet = false }) {
  return new Promise((resolve) => {
    const close = (v) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(v); };
    const overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) close(false); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', null, title),
        h('div', { class: 'modal-body' }, body),
        h('div', { class: 'modal-actions' },
          cancel && h('button', { class: 'btn', onclick: () => close(false) }, cancel),
          h('button', { class: `btn ${quiet ? '' : danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, confirm))));
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    (overlay.querySelector('.modal-body input') || overlay.querySelector('.modal-actions .btn:last-child')).focus();
  });
}

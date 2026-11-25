// DE / EN switch. Re-renders the current view; form input in progress is already autosaved.

import { h } from '../lib/dom.js';
import { i18n, t } from '../lib/i18n.js';

export function langButton(onChange) {
  return h('button', { type: 'button', class: 'btn btn-ghost btn-sm lang-btn', 'aria-label': t('lang.label'), title: t('lang.label'),
    onclick: () => { i18n.set(i18n.lang === 'de' ? 'en' : 'de'); onChange(); } },
  h('span', { class: i18n.lang === 'de' ? 'on' : '' }, 'DE'), h('span', { 'aria-hidden': 'true' }, ' / '), h('span', { class: i18n.lang === 'en' ? 'on' : '' }, 'EN'));
}

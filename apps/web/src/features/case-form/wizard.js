// Phone case form: one step per top-level group of the Questionnaire (patient → history → examination).
// Every input is autosaved to the device right away. Sending shows a short review first.

import { h, clear, clock, fmtTime, fmtDuration, debounce, confirmDialog } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { CONFIG } from '../../config.js';
import { progress, caseSummary, itemText, formTitle } from '../../lib/questionnaire.js';
import { summaryText } from '../../components/case-summary.js';
import { createRenderer } from './renderer.js';
import { drafts } from './drafts.js';
import { loadForm } from './forms.js';
import { sendDraft } from './send.js';

export async function renderWizard(root, draft, nav, startStep = 0) {
  const q = await loadForm(draft.formId);
  const steps = q.item.filter((i) => i.type === 'group');
  let stepIdx = Math.min(startStep, steps.length - 1);

  const saveState = h('span', { class: 'save-state', role: 'status', 'aria-live': 'polite' });
  const savedText = () => t('wiz.saved', { t: fmtTime(draft.updatedAt) });
  const save = debounce(async () => {
    await drafts.put(draft);
    saveState.textContent = savedText();
    saveState.classList.add('flash');
    setTimeout(() => saveState.classList.remove('flash'), 600);
    paintStepper();
  }, 250);

  const renderer = createRenderer(q, draft.answers, () => { saveState.textContent = t('wiz.saving'); save(); });
  const stepper = h('ol', { class: 'stepper', 'aria-label': formTitle(q) });
  const body = h('div', { class: 'wizard-body' });
  const stepHeading = h('h2', { class: 'step-heading', tabindex: '-1' });
  const back = h('button', { class: 'btn btn-lg', onclick: () => go(stepIdx - 1) }, t('wiz.back'));
  const next = h('button', { class: 'btn btn-lg btn-primary', onclick: () => (stepIdx < steps.length - 1 ? go(stepIdx + 1) : review()) });
  const left = draft.expiresAt - clock.now();

  clear(root, h('div', { class: 'page page-narrow wizard' },
    h('div', { class: 'wizard-head' },
      h('button', { class: 'btn btn-ghost back-link', onclick: () => { save.flush(); nav.home(); } }, `‹ ${t('wiz.backToList')}`),
      h('div', { class: 'wizard-title' }, h('strong', null, formTitle(q)), h('span', { class: 'pill pill-draft' }, t('wiz.draft')))),
    h('div', { class: `wizard-meta ${left < CONFIG.draftWarnMs ? 'warn-text' : ''}` },
      saveState, h('span', null, t('card.expires', { t: fmtTime(draft.expiresAt), d: fmtDuration(left) }))),
    stepper, stepHeading, body,
    h('div', { class: 'wizard-foot' }, back, next)));
  saveState.textContent = savedText();

  // Render all steps once (keeps input state); show one at a time.
  const panes = steps.map((s) => h('div', { class: 'step-pane', hidden: true }, renderer.renderItems(s.item, 1)));
  body.append(...panes);
  renderer.refresh();

  function paintStepper() {
    clear(stepper, steps.map((s, i) => {
      const p = progress(s, draft.answers, renderer.index);
      return h('li', { class: `${i === stepIdx ? 'current' : ''} ${p.done ? 'started' : ''}` },
        h('button', { onclick: () => go(i), 'aria-current': i === stepIdx ? 'step' : null },
          h('span', { class: 'step-num' }, i + 1), h('span', { class: 'step-name' }, itemText(s)),
          h('span', { class: 'step-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${p.total ? (100 * p.done) / p.total : 0}%` })),
          h('span', { class: 'visually-hidden' }, t('review.answered', { d: p.done, t: p.total }))));
    }));
  }

  function go(i, focus = true) {
    stepIdx = Math.max(0, Math.min(steps.length - 1, i));
    panes.forEach((p, j) => { p.hidden = j !== stepIdx; });
    stepHeading.textContent = `${t('wiz.step', { i: stepIdx + 1, n: steps.length })} · ${itemText(steps[stepIdx])}`;
    back.disabled = stepIdx === 0;
    next.textContent = stepIdx === steps.length - 1 ? t('wiz.send') : t('wiz.next', { s: itemText(steps[stepIdx + 1]) });
    paintStepper();
    window.scrollTo({ top: 0 });
    if (focus) stepHeading.focus({ preventScroll: true });
  }

  async function review() {
    save.flush();
    await drafts.put(draft);
    const s = summaryText(caseSummary(q, draft.answers));
    // Identifying fields (found via item.definition, so this works for any form) that are still empty
    const byDef = (suffix) => [...renderer.index.byId.values()].find((it) => it.definition?.endsWith(suffix));
    const missing = ['Patient.name.family', 'Patient.birthDate'].map(byDef)
      .filter((it) => it && !draft.answers[it.linkId]).map(itemText);
    const ok = await confirmDialog({
      title: t('review.title'),
      body: [
        h('div', { class: 'review-patient' }, h('strong', null, s.name), s.meta && h('span', { class: 'muted' }, ` · ${s.meta}`),
          s.complaint && h('div', null, s.complaint)),
        h('ul', { class: 'review-steps' }, steps.map((st) => { const p = progress(st, draft.answers, renderer.index);
          return h('li', null, h('span', null, itemText(st)), h('span', { class: 'muted' }, t('review.answered', { d: p.done, t: p.total }))); })),
        missing.length > 0 && h('div', { class: 'banner banner-warn' }, t('review.missing', { f: missing.join(', ') })),
        h('p', { class: 'muted small' }, t('review.body')),
      ],
      confirm: t('review.confirm'),
    });
    if (!ok) return;
    next.disabled = true;
    const sent = await sendDraft(draft);
    next.disabled = false;
    if (sent) nav.home();
  }

  go(stepIdx, false);
  return { get step() { return stepIdx; } };
}

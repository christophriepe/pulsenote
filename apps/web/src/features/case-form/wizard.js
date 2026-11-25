// Phone case form: one step per top-level group of the Questionnaire (patient → history → examination).
// Every input is autosaved to the device right away.

import { h, clear, clock, fmtTime, fmtDuration, debounce } from '../../lib/dom.js';
import { CONFIG } from '../../config.js';
import { progress } from '../../lib/questionnaire.js';
import { createRenderer } from './renderer.js';
import { drafts } from './drafts.js';
import { loadForm } from './forms.js';
import { sendDraft } from './send.js';

export async function renderWizard(root, draft, nav) {
  const q = await loadForm(draft.formId);
  const steps = q.item.filter((i) => i.type === 'group');
  let stepIdx = 0;

  const saveState = h('span', { class: 'save-state' });
  const save = debounce(async () => {
    await drafts.put(draft);
    saveState.textContent = `Saved on this phone ${fmtTime(draft.updatedAt)}`;
    saveState.classList.add('flash');
    setTimeout(() => saveState.classList.remove('flash'), 600);
    paintStepper();
  }, 250);

  const renderer = createRenderer(q, draft.answers, () => { saveState.textContent = 'Saving …'; save(); });
  const stepper = h('ol', { class: 'stepper' });
  const body = h('div', { class: 'wizard-body' });
  const back = h('button', { class: 'btn btn-lg', onclick: () => go(stepIdx - 1) }, 'Back');
  const next = h('button', { class: 'btn btn-lg btn-primary', onclick: () => (stepIdx < steps.length - 1 ? go(stepIdx + 1) : send()) });
  const left = draft.expiresAt - clock.now();

  clear(root, h('div', { class: 'page page-narrow wizard' },
    h('div', { class: 'wizard-head' },
      h('button', { class: 'btn btn-ghost', onclick: async () => { save.flush(); nav.home(); } }, '‹ My shift'),
      h('div', { class: 'wizard-title' }, h('strong', null, q.title), h('span', { class: 'pill pill-draft' }, 'Draft · not sent'))),
    h('div', { class: `wizard-meta ${left < CONFIG.draftWarnMs ? 'warn-text' : ''}` },
      saveState, h('span', null, `Expires ${fmtTime(draft.expiresAt)} (in ${fmtDuration(left)})`)),
    stepper, body,
    h('div', { class: 'wizard-foot' }, back, next)));
  saveState.textContent = `Saved on this phone ${fmtTime(draft.updatedAt)}`;

  // Render all steps once (keeps input state and focus); show one at a time.
  const panes = steps.map((s) => h('div', { class: 'step-pane', hidden: true }, renderer.renderItems(s.item, 1)));
  body.append(...panes);
  renderer.refresh();

  function paintStepper() {
    clear(stepper, steps.map((s, i) => {
      const p = progress(s, draft.answers, renderer.index);
      return h('li', { class: i === stepIdx ? 'current' : '' },
        h('button', { onclick: () => go(i), 'aria-current': i === stepIdx ? 'step' : null },
          h('span', { class: 'step-num' }, i + 1), h('span', { class: 'step-name' }, s.text),
          h('span', { class: 'step-count' }, `${p.done}/${p.total}`)));
    }));
  }

  function go(i) {
    stepIdx = Math.max(0, Math.min(steps.length - 1, i));
    panes.forEach((p, j) => { p.hidden = j !== stepIdx; });
    back.disabled = stepIdx === 0;
    next.textContent = stepIdx === steps.length - 1 ? 'Send case' : `Next: ${steps[stepIdx + 1].text}`;
    paintStepper();
    window.scrollTo({ top: 0 });
  }

  async function send() {
    save.flush();
    await drafts.put(draft);
    next.disabled = true;
    const ok = await sendDraft(draft);
    next.disabled = false;
    if (ok) nav.home();
  }

  go(0);
}

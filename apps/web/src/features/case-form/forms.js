// Loads Questionnaires from packages/form-definitions. Forms ship with the app (cached by the
// service worker later), so a new case can be started offline.
// The single-file demo build inlines them as window.PN_FORMS.

import { CONFIG } from '../../config.js';

const cache = new Map();

export async function loadForm(formId) {
  if (cache.has(formId)) return cache.get(formId);
  const inline = window.PN_FORMS?.[formId];
  let q = inline;
  if (!q) {
    const form = CONFIG.forms.find((f) => f.id === formId);
    if (!form?.path) throw new Error(`No Questionnaire for ${formId}`);
    const res = await fetch(form.path);
    if (!res.ok) throw new Error(`Could not load ${form.path}`);
    q = await res.json();
  }
  cache.set(formId, q);
  return q;
}

// Find the loaded form for a QuestionnaireResponse.questionnaire canonical ("url|version")
export async function formForCanonical(canonicalRef) {
  const url = canonicalRef.split('|')[0];
  for (const f of CONFIG.forms.filter((x) => x.path || window.PN_FORMS?.[x.id])) {
    const q = await loadForm(f.id);
    if (q.url === url) return { form: f, questionnaire: q };
  }
  throw new Error(`Unknown form ${canonicalRef}`);
}

export function availableForms() {
  return CONFIG.forms.map((f) => ({ ...f, available: !!(f.path || window.PN_FORMS?.[f.id]) }));
}

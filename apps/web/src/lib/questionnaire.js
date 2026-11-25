// Generic FHIR R4 Questionnaire helpers: indexing, enableWhen, QuestionnaireResponse build/parse.
// Answers are kept as a map: linkId -> array of FHIR answer objects, e.g. [{ valueBoolean: true }].

const SD = 'http://hl7.org/fhir/StructureDefinition/';
export const EXT = {
  unit: SD + 'questionnaire-unit',
  min: SD + 'minValue',
  max: SD + 'maxValue',
  itemControl: SD + 'questionnaire-itemControl',
  sliderStep: SD + 'questionnaire-sliderStepValue',
  optionExclusive: SD + 'questionnaire-optionExclusive',
  observationExtract: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract',
};

export function extValue(item, url) {
  const e = (item.extension || []).find((x) => x.url === url);
  if (!e) return undefined;
  const k = Object.keys(e).find((x) => x.startsWith('value'));
  return e[k];
}

export const itemControl = (item) => extValue(item, EXT.itemControl)?.coding?.[0]?.code;
export const unitOf = (item) => extValue(item, EXT.unit);

export function walkItems(items, fn, parent = null) {
  for (const it of items || []) {
    fn(it, parent);
    walkItems(it.item, fn, it);
  }
}

export function indexQuestionnaire(q) {
  const byId = new Map();
  const parentOf = new Map();
  walkItems(q.item, (it, p) => { byId.set(it.linkId, it); parentOf.set(it.linkId, p); });
  return { byId, parentOf };
}

// The value key of an answer or enableWhen ("valueBoolean", "answerCoding", ...)
function fhirValue(obj, prefix) {
  const k = Object.keys(obj).find((x) => x.startsWith(prefix) && x !== 'answer' && x !== 'item');
  return k ? { type: k.slice(prefix.length), v: obj[k] } : null;
}

export function sameValue(a, b) {
  if (a == null || b == null) return false;
  if (typeof a === 'object') return a.code === b.code && (a.system || '') === (b.system || '');
  return a === b;
}

function conditionHolds(cond, answers) {
  const given = answers[cond.question] || [];
  if (cond.operator === 'exists') return (given.length > 0) === cond.answerBoolean;
  if (!given.length) return false;
  const exp = fhirValue(cond, 'answer');
  const vals = given.map((a) => fhirValue(a, 'value')?.v);
  switch (cond.operator) {
    case '=': return vals.some((v) => sameValue(v, exp.v));
    case '!=': return !vals.some((v) => sameValue(v, exp.v));
    case '>': return vals.some((v) => v > exp.v);
    case '<': return vals.some((v) => v < exp.v);
    case '>=': return vals.some((v) => v >= exp.v);
    case '<=': return vals.some((v) => v <= exp.v);
    default: return true;
  }
}

// An item is enabled if its own enableWhen holds and all its ancestors are enabled.
export function isEnabled(item, answers, index) {
  for (let it = item; it; it = index.parentOf.get(it.linkId)) {
    const conds = it.enableWhen;
    if (!conds?.length) continue;
    const res = conds.map((c) => conditionHolds(c, answers));
    const ok = it.enableBehavior === 'any' ? res.some(Boolean) : res.every(Boolean);
    if (!ok) return false;
  }
  return true;
}

export function canonical(q) { return `${q.url}|${q.version}`; }

// Answers -> QuestionnaireResponse.item. Disabled items and empty groups are left out (SDC behaviour);
// the draft itself keeps them, so toggling a question back on does not lose input.
export function buildItems(items, answers, index) {
  const out = [];
  for (const it of items || []) {
    if (it.type === 'display' || !isEnabled(it, answers, index)) continue;
    if (it.type === 'group') {
      const children = buildItems(it.item, answers, index);
      if (children.length) out.push({ linkId: it.linkId, text: it.text, item: children });
      continue;
    }
    const ans = answers[it.linkId];
    const nested = buildItems(it.item, answers, index);
    if (ans?.length) out.push({ linkId: it.linkId, text: it.text, answer: ans, ...(nested.length ? { item: nested } : {}) });
  }
  return out;
}

export function buildResponse(q, answers, { id, status = 'in-progress', authored, author }) {
  const index = indexQuestionnaire(q);
  return {
    resourceType: 'QuestionnaireResponse',
    id,
    questionnaire: canonical(q),
    status,
    authored: new Date(authored).toISOString(),
    author: author ? { identifier: { value: author.id }, display: author.name } : undefined,
    item: buildItems(q.item, answers, index),
  };
}

export function answersFromResponse(qr) {
  const answers = {};
  walkItems(qr.item, (it) => { if (it.answer?.length) answers[it.linkId] = it.answer.map((a) => ({ ...a })); });
  return answers;
}

// Human-readable answer, used in summaries and the free-text mock.
export function displayAnswer(a, item) {
  const v = fhirValue(a, 'value');
  if (!v) return '';
  const unit = item && unitOf(item)?.display;
  switch (v.type) {
    case 'Boolean': return v.v ? 'ja' : 'nein';
    case 'Coding': return v.v.display || v.v.code;
    case 'Date': return new Date(v.v).toLocaleDateString('de-DE');
    case 'Integer':
    case 'Decimal': return `${String(v.v).replace('.', ',')}${unit ? ' ' + unit : ''}`;
    default: return String(v.v);
  }
}

// Short identifying summary for case lists. Uses item.definition (Patient.*) so it works for any form.
export function caseSummary(q, answers) {
  const index = indexQuestionnaire(q);
  const byDef = (suffix) => {
    for (const it of index.byId.values()) if (it.definition?.endsWith(suffix)) return answers[it.linkId]?.[0];
    return undefined;
  };
  const given = byDef('Patient.name.given')?.valueString || '';
  const family = byDef('Patient.name.family')?.valueString || '';
  const birth = byDef('Patient.birthDate')?.valueDate;
  const sex = byDef('Patient.gender')?.valueCoding?.code;
  const age = birth ? Math.floor((Date.now() - new Date(birth)) / 31557600000) : null;
  const first = (ids) => ids.map((id) => answers[id]?.[0]).find(Boolean);
  const complaint = first(['chief-complaint', 'course-summary']);
  const room = first(['location-room'])?.valueString;
  const stretcher = first(['location-stretcher'])?.valueString;
  return {
    name: [family, given].filter(Boolean).join(', ') || 'Unnamed patient',
    meta: [sex ? { male: 'm', female: 'w', other: 'd' }[sex] || sex : null, age != null ? `${age} J.` : null].filter(Boolean).join(' · '),
    complaint: complaint ? displayAnswer(complaint) : '',
    location: [room && `Room ${room}`, stretcher && `Stretcher ${stretcher}`].filter(Boolean).join(' · '),
  };
}

// Progress per top-level group (answered / answerable questions)
export function progress(group, answers, index) {
  let total = 0, done = 0;
  walkItems(group.item, (it) => {
    if (it.type === 'group' || it.type === 'display' || !isEnabled(it, answers, index)) return;
    total++;
    if (answers[it.linkId]?.length) done++;
  });
  return { total, done };
}

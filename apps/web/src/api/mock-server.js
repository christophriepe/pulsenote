// In-browser stand-in for the FastAPI backend (apps/api), so the frontend can be built and demoed
// before the backend exists. It follows the draft API in the root README; endpoints marked
// "proposed" are not in the README yet and need agreement with area 2.
//
// The real free text (area 1/2) and FHIR extraction (packages/fhir-mapping, area 2) live in the
// backend. The versions here are rough placeholders, only good enough to build the UI against.
// Data lives in memory for this page only; nothing here is written to the device.

import { CONFIG } from '../config.js';
import { clock, uuid } from '../lib/dom.js';
import { DEMO_USERS } from '../auth/session.js';
import { loadForm, formForCanonical } from '../features/case-form/forms.js';
import { walkItems, displayAnswer, indexQuestionnaire, buildResponse, extValue, EXT, unitOf } from '../lib/questionnaire.js';

const STATUS_SYSTEM = 'https://pulsenote.example/CodeSystem/case-status';
const TRANSFER_EXT = 'https://pulsenote.example/StructureDefinition/his-transferred';

export const mockNet = { offline: false, latencyMs: 350 };

const db = { cases: new Map(), audit: [], seeded: null };

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

function userFromToken(token) {
  const user = DEMO_USERS.find((u) => token === `demo-token-${u.id}`);
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

function canSee(user, qr) { return user.role === 'attending' || qr.author?.identifier?.value === user.id; }

// Audit log: who did what to which case, when. No patient data in the log.
function audit(user, action, caseId) {
  db.audit.push({ id: uuid(), at: clock.now(), userId: user.id, userName: user.name, action, caseId });
}

export const caseStatus = (qr) => qr.meta?.tag?.find((t) => t.system === STATUS_SYSTEM)?.code || 'received';
export const transferredAt = (qr) => qr.extension?.find((e) => e.url === TRANSFER_EXT)?.valueDateTime;

function purgeExpired() {
  const limit = CONFIG.retentionDays * 86400000;
  for (const [id, qr] of db.cases) {
    const t = transferredAt(qr);
    if (t && clock.now() - new Date(t).getTime() > limit) db.cases.delete(id);
  }
}

export async function mockFetch(method, path, body, token) {
  await new Promise((r) => setTimeout(r, mockNet.latencyMs));
  if (mockNet.offline) throw Object.assign(new TypeError('Failed to fetch'), { offline: true });
  await (db.seeded ||= seed());
  purgeExpired();
  const user = userFromToken(token);
  const [, , id, sub] = path.split('?')[0].split('/'); // /cases/{id}/{sub}
  const params = new URLSearchParams(path.split('?')[1] || '');

  if (method === 'GET' && path.startsWith('/cases') && !id) {
    let list = [...db.cases.values()].filter((qr) => canSee(user, qr));
    if (params.get('author') === 'me') list = list.filter((qr) => qr.author?.identifier?.value === user.id);
    audit(user, 'list cases', null);
    return { resourceType: 'Bundle', type: 'searchset', total: list.length, entry: list.map((r) => ({ resource: structuredClone(r) })) };
  }

  if (path.startsWith('/audit')) { // proposed: GET /audit?case={id}
    if (user.role !== 'attending' && params.get('case') && !canSee(user, db.cases.get(params.get('case')) || {})) throw new HttpError(403, 'Forbidden');
    return db.audit.filter((e) => !params.get('case') || e.caseId === params.get('case')).slice(-50).reverse();
  }

  const existing = db.cases.get(id);
  if (method === 'PUT' && !sub) {
    if (existing && !canSee(user, existing)) throw new HttpError(403, 'Forbidden');
    const qr = structuredClone(body);
    qr.id = id;
    qr.status = existing ? 'amended' : 'completed';
    qr.meta = { lastUpdated: new Date(clock.now()).toISOString(), versionId: String((+existing?.meta?.versionId || 0) + 1),
      tag: [{ system: STATUS_SYSTEM, code: existing ? caseStatus(existing) : 'received' }] };
    if (existing?.extension) qr.extension = existing.extension;
    if (existing) qr.author = existing.author; // author stays the creating physician
    db.cases.set(id, qr);
    audit(user, existing ? 'update case' : 'create case', id);
    return structuredClone(qr);
  }

  if (!existing) throw new HttpError(404, 'Case not found');
  if (!canSee(user, existing)) throw new HttpError(403, 'Forbidden');

  if (method === 'GET' && !sub) { audit(user, 'read case', id); return structuredClone(existing); }
  if (method === 'GET' && sub === 'text') { audit(user, 'export free text', id); return { text: await freeText(existing) }; }
  if (method === 'GET' && sub === 'fhir') { audit(user, 'export FHIR', id); return extract(existing, params.get('format')); }
  if (method === 'POST' && sub === 'transfer') { // proposed: POST /cases/{id}/transfer
    existing.meta.tag = [{ system: STATUS_SYSTEM, code: 'transferred' }];
    existing.extension = [{ url: TRANSFER_EXT, valueDateTime: new Date(clock.now()).toISOString() }];
    audit(user, 'mark transferred to HIS', id);
    return structuredClone(existing);
  }
  throw new HttpError(404, 'No such endpoint');
}

// ---------- placeholder free text (real template: area 1, generated in the backend) ----------

async function freeText(qr) {
  const { questionnaire: q } = await formForCanonical(qr.questionnaire);
  const index = indexQuestionnaire(q);
  const lines = [q.title, `Erstellt ${new Date(qr.authored).toLocaleString('de-DE')} von ${qr.author?.display || '–'}`];
  const ans = (it) => it.answer.map((a) => displayAnswer(a, index.byId.get(it.linkId))).join(', ');
  // Top-level groups become headings, nested groups sub-headings, questions "Label: answer".
  const walk = (items, depth, parentText) => {
    for (const it of items || []) {
      const pad = '  '.repeat(Math.max(0, depth - 1));
      if (it.answer) lines.push(`${pad}${it.text === parentText ? '' : it.text + ': '}${ans(it)}`);
      if (!it.answer && it.item) {
        if (depth === 0) lines.push('', it.text.toUpperCase());
        else lines.push(`${pad}${it.text}:`);
      }
      if (it.item) walk(it.item, depth + 1, it.text);
    }
  };
  walk(qr.item, 0, null);
  return lines.join('\n').trim();
}

// ---------- placeholder extraction (real one: packages/fhir-mapping, area 2) ----------

async function extract(qr, format) {
  const { questionnaire: q } = await formForCanonical(qr.questionnaire);
  const index = indexQuestionnaire(q);
  const answers = {};
  walkItems(qr.item, (it) => { if (it.answer) answers[it.linkId] = it.answer; });
  const def = (suffix) => [...index.byId.values()].find((it) => it.definition?.endsWith(suffix));
  const a0 = (it) => it && answers[it.linkId]?.[0];
  const patientId = uuid(), encId = uuid();
  const patient = {
    resourceType: 'Patient', id: patientId,
    name: [{ family: a0(def('Patient.name.family'))?.valueString, given: [a0(def('Patient.name.given'))?.valueString].filter(Boolean) }],
    gender: a0(def('Patient.gender'))?.valueCoding?.code,
    birthDate: a0(def('Patient.birthDate'))?.valueDate,
  };
  const encounter = { resourceType: 'Encounter', id: encId, status: 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
    subject: { reference: `Patient/${patientId}` } };
  const obs = [];
  for (const it of index.byId.values()) {
    if (!extValue(it, EXT.observationExtract) || !answers[it.linkId] || !it.code) continue;
    const a = answers[it.linkId][0];
    const unit = unitOf(it);
    const value = a.valueInteger ?? a.valueDecimal;
    obs.push({ resourceType: 'Observation', id: uuid(), status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
      code: { coding: it.code }, subject: { reference: `Patient/${patientId}` }, encounter: { reference: `Encounter/${encId}` },
      effectiveDateTime: qr.authored,
      ...(value != null ? { valueQuantity: { value, unit: unit?.display, system: unit?.system, code: unit?.code } } : {}) });
  }
  const resources = format === 'qr' ? [qr] : [patient, encounter, ...obs, qr];
  return { resourceType: 'Bundle', id: uuid(), type: 'collection', timestamp: new Date(clock.now()).toISOString(),
    entry: resources.map((r) => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })) };
}

// ---------- synthetic seed cases (fictional patients, never real data) ----------

async function seed() {
  const q = await loadForm('ed-surgery');
  const index = indexQuestionnaire(q);
  const opt = (linkId, display) => {
    const o = index.byId.get(linkId).answerOption.find((x) => (x.valueCoding?.display || x.valueString) === display);
    return o.valueCoding ? { valueCoding: o.valueCoding } : { valueString: o.valueString };
  };
  const S = (v) => [{ valueString: v }], B = (v) => [{ valueBoolean: v }], I = (v) => [{ valueInteger: v }], D = (v) => [{ valueDecimal: v }];
  const base = (sex, given, family, birth, room, stretcher) => ({
    'patient-sex': [opt('patient-sex', sex)], 'patient-given-name': S(given), 'patient-family-name': S(family),
    'patient-birth-date': [{ valueDate: birth }], 'location-room': S(room), 'location-stretcher': S(stretcher) });
  const cases = [
    ['u-weber', 95, 'received', { ...base('Weiblich', 'Erika', 'Musterfrau', '1971-03-12', '3', '2'),
      'chief-complaint': S('Rechtsseitige Unterbauchschmerzen seit gestern Abend, zunehmend'), pain: B(true), 'pain-nrs': I(7),
      nausea: B(true), vomiting: B(false), fever: B(true), 'allergies-known': B(false), 'long-term-medication': B(false),
      'bp-systolic': I(135), 'bp-diastolic': I(85), 'heart-rate': I(98), 'respiratory-rate': I(18), 'oxygen-saturation': I(97), 'body-temperature': D(38.2),
      'general-condition': [opt('general-condition', 'Reduziert')], 'abdomen-soft': B(true), 'abdominal-tenderness': B(true),
      'abdominal-tenderness-location': S('Rechter Unterbauch, McBurney positiv'), 'bowel-sounds': [opt('bowel-sounds', 'Spärlich')] }],
    ['u-weber', 40, 'received', { ...base('Männlich', 'Max', 'Mustermann', '1958-07-01', 'Schockraum', '1'),
      'chief-complaint': S('Oberbauchschmerzen, Teerstuhl seit 2 Tagen'), pain: B(true), 'pain-nrs': I(4),
      'bowel-movement': [opt('bowel-movement', 'Meläna')], 'long-term-medication': B(true), 'long-term-medication-details': S('ASS 100, Ramipril 5 mg'), anticoagulants: B(true),
      'bp-systolic': I(102), 'bp-diastolic': I(64), 'heart-rate': I(112), 'oxygen-saturation': I(96),
      'dre-performed': B(true), 'dre-findings': [opt('dre-findings', 'Teerstuhl am Fingerling')] }],
    ['u-klein', 300, 'transferred', { ...base('Weiblich', 'Anna', 'Beispiel', '1990-11-23', '5', '4'),
      'chief-complaint': S('Schnittverletzung linker Unterarm'), pain: B(true), 'pain-nrs': I(3), 'allergies-known': B(true), 'allergies-details': S('Penicillin'),
      'bp-systolic': I(124), 'bp-diastolic': I(78), 'heart-rate': I(84), 'general-condition': [opt('general-condition', 'Gut')] }],
    ['u-klein', 20, 'received', { ...base('Divers', 'Kim', 'Testperson', '2001-02-14', '2', '6'),
      'chief-complaint': S('Kolikartige Flankenschmerzen links'), pain: B(true), 'pain-nrs': I(8), nausea: B(true), vomiting: B(true),
      'micturition': [opt('micturition', 'Hämaturie')], 'bp-systolic': I(148), 'bp-diastolic': I(92), 'heart-rate': I(104) }],
  ];
  for (const [authorId, minsAgo, status, answers] of cases) {
    const author = DEMO_USERS.find((u) => u.id === authorId);
    const id = uuid();
    const t = clock.now() - minsAgo * 60000;
    const qr = buildResponse(q, answers, { id, status: 'completed', authored: t, author });
    qr.meta = { lastUpdated: new Date(t).toISOString(), versionId: '1', tag: [{ system: STATUS_SYSTEM, code: status }] };
    if (status === 'transferred') qr.extension = [{ url: TRANSFER_EXT, valueDateTime: new Date(t + 3600000).toISOString() }];
    db.cases.set(id, qr);
  }
}

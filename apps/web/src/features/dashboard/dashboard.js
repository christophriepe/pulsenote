// Desktop dashboard: browse cases from the server, edit them on one page, export free text / FHIR,
// mark as transferred to the HIS. Nothing here is cached on the device.

import { h, clear, fmtDateTime, toast, confirmDialog } from '../../lib/dom.js';
import { CONFIG } from '../../config.js';
import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { caseSummary, answersFromResponse, buildResponse } from '../../lib/questionnaire.js';
import { createRenderer } from '../case-form/renderer.js';
import { formForCanonical } from '../case-form/forms.js';

const state = { filter: 'open', scope: 'all', search: '', selected: null, tab: 'case' };

export async function renderDashboard(root, nav, selectId) {
  if (selectId !== undefined) state.selected = selectId;
  const listEl = h('div', { class: 'dash-list' });
  const detailEl = h('div', { class: 'dash-detail' });
  const user = session.user;

  const toolbar = h('div', { class: 'dash-toolbar' },
    h('input', { class: 'input search', type: 'search', placeholder: 'Search name, complaint, room …', value: state.search,
      oninput: (e) => { state.search = e.target.value; paintList(); } }),
    h('div', { class: 'seg seg-sm' }, [['open', 'Open'], ['transferred', 'In HIS'], ['all', 'All']].map(([v, l]) =>
      h('button', { class: 'seg-btn', 'aria-pressed': String(state.filter === v), onclick: (e) => { state.filter = v; e.target.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); paintList(); } }, l))),
    user.role === 'attending' && h('select', { class: 'input input-sm', onchange: (e) => { state.scope = e.target.value; paintList(); } },
      h('option', { value: 'all', selected: state.scope === 'all' }, 'All physicians'), h('option', { value: 'mine', selected: state.scope === 'mine' }, 'My cases')));

  clear(root, h('div', { class: `page dashboard ${state.selected ? 'has-selection' : ''}` },
    h('div', { class: 'dash-left' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Cases'),
        h('p', { class: 'muted' }, user.role === 'attending' ? 'All cases of the department (attending view)' : 'Your cases'))),
      toolbar, listEl),
    detailEl));

  let cases = [];
  try {
    cases = await Promise.all((await api.listCases()).map(async (c) => {
      const { questionnaire } = await formForCanonical(c.qr.questionnaire);
      return { ...c, questionnaire, summary: caseSummary(questionnaire, answersFromResponse(c.qr)) };
    }));
  } catch (e) {
    clear(listEl, h('div', { class: 'banner banner-offline' }, e instanceof OfflineError ? 'Offline. The dashboard needs a connection.' : e.message));
    return;
  }

  function paintList() {
    const term = state.search.toLowerCase();
    const shown = cases
      .filter((c) => state.filter === 'all' || (state.filter === 'open' ? c.status !== 'transferred' : c.status === 'transferred'))
      .filter((c) => state.scope === 'all' || c.authorId === user.id)
      .filter((c) => !term || [c.summary.name, c.summary.complaint, c.summary.location, c.authorName].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.updated - a.updated);
    clear(listEl, shown.length ? h('table', { class: 'case-table' },
      h('thead', null, h('tr', null, ['Patient', 'Chief complaint', 'Location', 'Template', 'Physician', 'Updated', 'Status'].map((t) => h('th', null, t)))),
      h('tbody', null, shown.map((c) => h('tr', { class: c.id === state.selected ? 'selected' : '', tabindex: 0,
        onclick: () => select(c.id), onkeydown: (e) => { if (e.key === 'Enter') select(c.id); } },
        h('td', null, h('strong', null, c.summary.name), h('div', { class: 'muted small' }, c.summary.meta)),
        h('td', null, h('div', { class: 'clip' }, c.summary.complaint || '–')),
        h('td', null, c.summary.location || '–'),
        h('td', null, c.questionnaire.title.replace('Notaufnahme – ', '')),
        h('td', null, c.authorName),
        h('td', null, fmtDateTime(c.updated)),
        h('td', null, statusPill(c))))))
      : h('p', { class: 'empty' }, 'No cases match.'));
  }

  function select(id) {
    state.selected = id;
    root.querySelector('.dashboard').classList.toggle('has-selection', !!id);
    paintList();
    paintDetail();
  }

  async function paintDetail() {
    if (!state.selected) { clear(detailEl, h('div', { class: 'detail-empty' }, h('p', null, 'Select a case to review, edit and export it.'))); return; }
    const c = cases.find((x) => x.id === state.selected);
    if (!c) { state.selected = null; return paintDetail(); }
    await renderDetail(detailEl, c, {
      close: () => select(null),
      updated: (nc) => { Object.assign(c, nc, { summary: caseSummary(c.questionnaire, answersFromResponse(nc.qr)) }); paintList(); paintDetail(); },
    });
  }

  paintList();
  paintDetail();
}

function statusPill(c) {
  return c.status === 'transferred' ? h('span', { class: 'pill pill-transferred' }, 'In HIS') : h('span', { class: 'pill pill-received' }, 'Open');
}

async function renderDetail(el, c, actions) {
  const q = c.questionnaire;
  const deleteAt = c.transferredAt ? c.transferredAt + CONFIG.retentionDays * 86400000 : null;
  const tabs = [['case', 'Case'], ['text', 'Free text'], ['fhir', 'FHIR'], ['audit', 'Audit log']];
  const tabBody = h('div', { class: 'tab-body' });
  const tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) =>
    h('button', { role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => { state.tab = k; tabBar.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(tabs[i][0] === k))); paintTab(); } }, l)));

  clear(el,
    h('div', { class: 'detail-head' },
      h('button', { class: 'btn btn-ghost only-narrow', onclick: actions.close }, '‹ Cases'),
      h('div', { class: 'detail-title' },
        h('h2', null, c.summary.name, ' ', statusPill(c)),
        h('div', { class: 'muted' }, [c.summary.meta, c.summary.location, q.title, `by ${c.authorName}`, `created ${fmtDateTime(c.authored)}`].filter(Boolean).join(' · '))),
      c.status !== 'transferred'
        ? h('button', { class: 'btn btn-primary', onclick: async () => {
          const ok = await confirmDialog({ title: 'Mark as transferred to the HIS?',
            body: h('p', null, `Do this after the report is in the HIS. The HIS entry then becomes the official record, the case is locked here, and PulseNote deletes it after ${CONFIG.retentionDays} days.`),
            confirm: 'Mark as transferred' });
          if (ok) actions.updated(await api.markTransferred(c.id));
        } }, 'Mark as transferred to HIS')
        : h('div', { class: 'retention' }, `Transferred ${fmtDateTime(c.transferredAt)}`, h('br'), `Deleted from PulseNote ${fmtDateTime(deleteAt)}`)),
    tabBar, tabBody);

  async function paintTab() {
    clear(tabBody, h('p', { class: 'muted pad' }, 'Loading …'));
    try {
      if (state.tab === 'case') return paintCase();
      if (state.tab === 'text') return paintText();
      if (state.tab === 'fhir') return paintFhir();
      if (state.tab === 'audit') return paintAudit();
    } catch (e) {
      clear(tabBody, h('div', { class: 'banner banner-offline' }, e instanceof OfflineError ? 'Offline. This needs a connection.' : e.message));
    }
  }

  function paintCase() {
    const locked = c.status === 'transferred';
    const answers = answersFromResponse(c.qr);
    let dirty = false;
    const saveBtn = h('button', { class: 'btn btn-primary', disabled: true, onclick: async () => {
      saveBtn.disabled = true;
      const qr = buildResponse(q, answers, { id: c.id, authored: c.authored, author: { id: c.authorId, name: c.authorName } });
      try { actions.updated(await api.putCase(c.id, qr)); toast('Changes saved on the server', 'ok'); }
      catch (e) { saveBtn.disabled = false; toast(e instanceof OfflineError ? 'Offline. Changes not saved.' : e.message, 'error'); }
    } }, 'Save changes');
    const r = createRenderer(q, answers, () => { if (!dirty) { dirty = true; saveBtn.disabled = false; } }, { readOnly: locked });
    clear(tabBody,
      locked && h('div', { class: 'banner' }, 'This case is in the HIS and locked here. The HIS entry is the official record.'),
      h('div', { class: 'desk-form' }, q.item.map((g) => h('section', { class: 'desk-group' }, h('h3', null, g.text), r.renderItems(g.item, 1)))),
      !locked && h('div', { class: 'sticky-actions' }, h('span', { class: 'muted small' }, 'Same fields and checks as the phone form.'), saveBtn));
    r.refresh();
  }

  async function paintText() {
    const text = await api.getText(c.id);
    const pre = h('textarea', { class: 'input mono report', rows: 22, readonly: true, value: text });
    clear(tabBody,
      h('div', { class: 'tab-actions' },
        h('button', { class: 'btn btn-primary', onclick: async () => {
          try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into the HIS.', 'ok'); }
          catch { pre.select(); document.execCommand('copy'); toast('Copied', 'ok'); }
        } }, 'Copy for HIS'),
        h('span', { class: 'muted small' }, 'Generated by the backend (GET /cases/{id}/text). Placeholder wording until area 1 delivers the template.')),
      pre);
  }

  async function paintFhir() {
    let format = 'bundle';
    const out = h('pre', { class: 'json' });
    const load = async () => {
      out.textContent = 'Loading …';
      const b = await api.getFhir(c.id, format === 'qr' ? 'qr' : undefined);
      out.textContent = JSON.stringify(format === 'qr' ? b.entry[0].resource : b, null, 2);
    };
    clear(tabBody,
      h('div', { class: 'tab-actions' },
        h('div', { class: 'seg seg-sm' }, [['bundle', 'Resources (Bundle)'], ['qr', 'QuestionnaireResponse'], ['ips', 'IPS document']].map(([v, l]) =>
          h('button', { class: 'seg-btn', 'aria-pressed': String(v === format), disabled: v === 'ips', title: v === 'ips' ? 'Coming with packages/fhir-mapping (area 2)' : null,
            onclick: (e) => { format = v; e.target.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); load(); } }, l))),
        h('button', { class: 'btn', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([out.textContent], { type: 'application/fhir+json' })), download: `case-${c.id.slice(0, 8)}.fhir.json` });
          a.click(); URL.revokeObjectURL(a.href);
        } }, 'Download JSON'),
        h('button', { class: 'btn', onclick: async () => {
          try { await navigator.clipboard.writeText(out.textContent); toast('JSON copied', 'ok'); } catch { toast('Copy not allowed here', 'error'); }
        } }, 'Copy JSON')),
      h('p', { class: 'muted small' }, 'Mock extraction (vital signs, Patient, Encounter). The real mapping lives in packages/fhir-mapping.'),
      out);
    await load();
  }

  async function paintAudit() {
    const events = await api.audit(c.id);
    clear(tabBody,
      h('p', { class: 'muted small' }, 'Every access and change is logged with user and time. The log holds case ids only, no patient data.'),
      h('table', { class: 'case-table audit' },
        h('thead', null, h('tr', null, h('th', null, 'Time'), h('th', null, 'User'), h('th', null, 'Action'))),
        h('tbody', null, events.map((e) => h('tr', null, h('td', null, fmtDateTime(e.at)), h('td', null, e.userName), h('td', null, e.action))))));
  }

  paintTab();
}

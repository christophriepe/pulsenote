// Desktop dashboard: browse cases from the server, edit them on one page, export free text / FHIR,
// mark as transferred to the HIS. Nothing here is cached on the device.

import { h, clear, clock, fmtDateTime, toast, confirmDialog } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { CONFIG } from '../../config.js';
import { api, OfflineError } from '../../api/client.js';
import { session } from '../../auth/session.js';
import { caseSummary, answersFromResponse, buildResponse, itemText, formTitle } from '../../lib/questionnaire.js';
import { summaryText } from '../../components/case-summary.js';
import { createRenderer } from '../case-form/renderer.js';
import { formForCanonical } from '../case-form/forms.js';

const state = { filter: 'open', scope: 'all', search: '', selected: null, tab: 'case' };

function segmented(options, current, onPick, label) {
  const wrap = h('div', { class: 'seg seg-sm', role: 'group', 'aria-label': label });
  options.forEach(([v, l, extra]) => wrap.append(h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(v === current), ...extra,
    onclick: (e) => { wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); onPick(v); } }, l)));
  return wrap;
}

export async function renderDashboard(root, nav, selectId) {
  if (selectId !== undefined) state.selected = selectId;
  const user = session.user;
  const listEl = h('div', { class: 'dash-list', 'aria-busy': 'true' }, h('p', { class: 'muted pad' }, t('loading')));
  const detailEl = h('div', { class: 'dash-detail' });
  const kpiEl = h('div', { class: 'kpis' });

  const toolbar = h('div', { class: 'dash-toolbar' },
    h('input', { class: 'input search', type: 'search', placeholder: t('dash.search'), 'aria-label': t('dash.search'), value: state.search,
      oninput: (e) => { state.search = e.target.value; paintList(); } }),
    segmented([['open', t('dash.open')], ['transferred', t('dash.inHis')], ['all', t('dash.all')]], state.filter, (v) => { state.filter = v; paintList(); }, t('dash.col.status')),
    user.role === 'attending' && h('select', { class: 'input input-sm', 'aria-label': t('dash.col.physician'), onchange: (e) => { state.scope = e.target.value; paintList(); } },
      h('option', { value: 'all', selected: state.scope === 'all' }, t('dash.allPhysicians')), h('option', { value: 'mine', selected: state.scope === 'mine' }, t('dash.mine'))));

  clear(root, h('div', { class: `page dashboard ${state.selected ? 'has-selection' : ''}` },
    h('div', { class: 'dash-left' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('dash.title')),
        h('p', { class: 'muted' }, user.role === 'attending' ? t('dash.subAttending') : t('dash.subPhysician')))),
      kpiEl, toolbar, listEl),
    detailEl));

  let cases = [];
  try {
    cases = await Promise.all((await api.listCases()).map(async (c) => {
      const { questionnaire } = await formForCanonical(c.qr.questionnaire);
      return { ...c, questionnaire, summary: summaryText(caseSummary(questionnaire, answersFromResponse(c.qr))) };
    }));
  } catch (e) {
    listEl.removeAttribute('aria-busy');
    clear(listEl, h('div', { class: 'banner banner-offline' }, e instanceof OfflineError ? t('dash.offline') : e.message));
    clear(detailEl);
    return;
  }
  listEl.removeAttribute('aria-busy');

  function paintKpis() {
    const open = cases.filter((c) => c.status !== 'transferred').length;
    const recent = cases.filter((c) => c.authored > clock.now() - 12 * 3600000).length;
    const his = cases.length - open;
    clear(kpiEl, [[open, t('dash.kpiOpen'), 'kpi-open'], [recent, t('dash.kpiToday'), ''], [his, t('dash.kpiHis'), 'kpi-his']].map(([n, l, c]) =>
      h('div', { class: `kpi ${c}` }, h('strong', null, n), h('span', null, l))));
  }

  function paintList() {
    const term = state.search.toLowerCase();
    const shown = cases
      .filter((c) => state.filter === 'all' || (state.filter === 'open' ? c.status !== 'transferred' : c.status === 'transferred'))
      .filter((c) => state.scope === 'all' || c.authorId === user.id)
      .filter((c) => !term || [c.summary.name, c.summary.complaint, c.summary.location, c.authorName].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.updated - a.updated);
    const cols = ['patient', 'complaint', 'location', 'template', 'physician', 'updated', 'status'];
    clear(listEl, shown.length ? h('table', { class: 'case-table' },
      h('thead', null, h('tr', null, cols.map((k) => h('th', { scope: 'col' }, t(`dash.col.${k}`))))),
      h('tbody', null, shown.map((c) => h('tr', { class: c.id === state.selected ? 'selected' : '', tabindex: 0, 'aria-selected': String(c.id === state.selected),
        onclick: () => select(c.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c.id); } } },
        h('td', null, h('strong', null, c.summary.name), h('div', { class: 'muted small' }, c.summary.meta)),
        h('td', null, h('div', { class: 'clip' }, c.summary.complaint || '–')),
        h('td', null, c.summary.location || '–'),
        h('td', null, formTitle(c.questionnaire).replace(/^.*? – /, '')),
        h('td', null, c.authorName),
        h('td', { class: 'nowrap' }, fmtDateTime(c.updated)),
        h('td', null, statusPill(c))))))
      : h('p', { class: 'empty' }, t('dash.noMatch')));
  }

  function select(id) {
    state.selected = id;
    root.querySelector('.dashboard').classList.toggle('has-selection', !!id);
    paintList();
    paintDetail();
    if (id && window.innerWidth < CONFIG.desktopMinWidth) window.scrollTo({ top: 0 });
  }

  async function paintDetail() {
    if (!state.selected) {
      clear(detailEl, h('div', { class: 'detail-empty' }, h('div', { class: 'detail-empty-icon', 'aria-hidden': 'true' }), h('p', null, t('dash.select'))));
      return;
    }
    const c = cases.find((x) => x.id === state.selected);
    if (!c) { state.selected = null; return paintDetail(); }
    await renderDetail(detailEl, c, {
      close: () => select(null),
      updated: (nc) => {
        Object.assign(c, nc, { summary: summaryText(caseSummary(c.questionnaire, answersFromResponse(nc.qr))) });
        paintKpis(); paintList(); paintDetail();
      },
    });
  }

  paintKpis();
  paintList();
  paintDetail();
}

function statusPill(c) {
  return c.status === 'transferred' ? h('span', { class: 'pill pill-transferred' }, t('dash.inHis')) : h('span', { class: 'pill pill-received' }, t('dash.open'));
}

async function renderDetail(el, c, actions) {
  const q = c.questionnaire;
  const deleteAt = c.transferredAt ? c.transferredAt + CONFIG.retentionDays * 86400000 : null;
  const tabs = ['case', 'text', 'fhir', 'audit'];
  const tabBody = h('div', { class: 'tab-body', role: 'tabpanel' });
  const tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map((k) =>
    h('button', { role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => {
      state.tab = k;
      tabBar.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(tabs[i] === k)));
      paintTab();
    } }, t(`dash.tab.${k}`))));

  clear(el,
    h('div', { class: 'detail-head' },
      h('button', { class: 'btn btn-ghost only-narrow back-link', onclick: actions.close }, `‹ ${t('dash.back')}`),
      h('div', { class: 'detail-title' },
        h('h2', null, c.summary.name, ' ', statusPill(c)),
        h('div', { class: 'muted small detail-sub' },
          [c.summary.meta, c.summary.location, formTitle(q), t('dash.by', { n: c.authorName }), t('dash.created', { t: fmtDateTime(c.authored) })].filter(Boolean).join(' · '))),
      c.status !== 'transferred'
        ? h('button', { class: 'btn btn-primary', onclick: async () => {
          const ok = await confirmDialog({ title: t('dash.transferTitle'), body: h('p', null, t('dash.transferBody', { d: CONFIG.retentionDays })), confirm: t('dash.transfer') });
          if (ok) {
            try { actions.updated(await api.markTransferred(c.id)); }
            catch (e) { toast(e instanceof OfflineError ? t('dash.needsConn') : e.message, 'error'); }
          }
        } }, t('dash.transfer'))
        : h('div', { class: 'retention' }, t('dash.transferred', { t: fmtDateTime(c.transferredAt) }), h('br'), t('dash.deletedOn', { t: fmtDateTime(deleteAt) }))),
    tabBar, tabBody);

  async function paintTab() {
    clear(tabBody, h('p', { class: 'muted pad' }, t('loading')));
    try {
      if (state.tab === 'case') return paintCase();
      if (state.tab === 'text') return await paintText();
      if (state.tab === 'fhir') return await paintFhir();
      if (state.tab === 'audit') return await paintAudit();
    } catch (e) {
      clear(tabBody, h('div', { class: 'banner banner-offline' }, e instanceof OfflineError ? t('dash.needsConn') : e.message));
    }
  }

  function paintCase() {
    const locked = c.status === 'transferred';
    const answers = answersFromResponse(c.qr);
    const dirtyNote = h('span', { class: 'muted small' }, t('dash.sameFields'));
    const saveBtn = h('button', { class: 'btn btn-primary', disabled: true, onclick: async () => {
      saveBtn.disabled = true;
      const qr = buildResponse(q, answers, { id: c.id, authored: c.authored, author: { id: c.authorId, name: c.authorName } });
      try { actions.updated(await api.putCase(c.id, qr)); toast(t('dash.saved'), 'ok'); }
      catch (e) { saveBtn.disabled = false; toast(e instanceof OfflineError ? t('dash.notSaved') : e.message, 'error'); }
    } }, t('dash.save'));
    const r = createRenderer(q, answers, () => {
      saveBtn.disabled = false;
      dirtyNote.textContent = t('dash.unsaved');
      dirtyNote.classList.add('warn-text');
    }, { readOnly: locked });
    const sections = q.item.map((g) => h('section', { class: 'desk-group', id: `sec-${g.linkId}` }, h('h3', null, itemText(g)), r.renderItems(g.item, 1)));
    clear(tabBody,
      locked && h('div', { class: 'banner' }, t('dash.locked')),
      h('nav', { class: 'section-jump' }, q.item.map((g, i) => h('button', { type: 'button', class: 'chip chip-sm',
        onclick: () => sections[i].scrollIntoView({ behavior: 'smooth', block: 'start' }) }, itemText(g)))),
      h('div', { class: 'desk-form' }, sections),
      !locked && h('div', { class: 'sticky-actions' }, dirtyNote, saveBtn));
    r.refresh();
  }

  async function paintText() {
    const text = await api.getText(c.id);
    const pre = h('textarea', { class: 'input mono report', rows: 22, readonly: true, value: text, 'aria-label': t('dash.tab.text') });
    clear(tabBody,
      h('div', { class: 'tab-actions' },
        h('button', { class: 'btn btn-primary', onclick: async () => {
          try { await navigator.clipboard.writeText(text); toast(t('dash.copied'), 'ok'); }
          catch { pre.select(); toast(document.execCommand('copy') ? t('dash.copied') : t('dash.copyFail'), 'ok'); }
        } }, t('dash.copyHis')),
        h('span', { class: 'muted small' }, t('dash.textNote'))),
      pre);
  }

  async function paintFhir() {
    let format = 'bundle';
    const out = h('pre', { class: 'json', tabindex: '0' });
    let req = 0;
    const load = async () => {
      const mine = ++req, fmt = format; // ignore responses that arrive after the user switched views
      out.textContent = t('loading');
      const b = await api.getFhir(c.id, fmt === 'qr' ? 'qr' : undefined);
      if (mine !== req) return;
      out.textContent = JSON.stringify(fmt === 'qr' ? b.entry[0].resource : b, null, 2);
    };
    clear(tabBody,
      h('div', { class: 'tab-actions' },
        segmented([['bundle', t('dash.fhirBundle')], ['qr', 'QuestionnaireResponse'], ['ips', t('dash.fhirIps'), { disabled: true, title: t('dash.fhirIpsSoon') }]],
          format, (v) => { format = v; load(); }, 'FHIR'),
        h('button', { class: 'btn btn-sm', onclick: async () => {
          try { await navigator.clipboard.writeText(out.textContent); toast(t('dash.jsonCopied'), 'ok'); } catch { toast(t('dash.copyFail'), 'error'); }
        } }, t('dash.copyJson')),
        h('button', { class: 'btn btn-sm', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([out.textContent], { type: 'application/fhir+json' })), download: `case-${c.id.slice(0, 8)}.fhir.json` });
          a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } }, t('dash.download'))),
      h('p', { class: 'muted small' }, t('dash.fhirNote')),
      out);
    await load();
  }

  async function paintAudit() {
    const events = await api.audit(c.id);
    clear(tabBody,
      h('p', { class: 'muted small' }, t('dash.auditNote')),
      h('table', { class: 'case-table audit' },
        h('thead', null, h('tr', null, ['time', 'user', 'action'].map((k) => h('th', { scope: 'col' }, t(`dash.col.${k}`))))),
        h('tbody', null, events.map((e) => h('tr', null, h('td', { class: 'nowrap' }, fmtDateTime(e.at)), h('td', null, e.userName), h('td', { class: 'mono' }, e.action))))));
  }

  paintTab();
}

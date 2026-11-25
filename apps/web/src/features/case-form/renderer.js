// Generic Questionnaire renderer. Turns any Questionnaire item into touch-friendly controls.
// Used by the phone wizard (one top-level group per step) and the desktop editor (all groups on one page).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { EXT, extValue, itemControl, unitOf, isEnabled, indexQuestionnaire, sameValue, itemText, codingDisplay, plainCoding, setFormLanguage } from '../../lib/questionnaire.js';

export function createRenderer(questionnaire, answers, onChange, { readOnly = false } = {}) {
  const index = indexQuestionnaire(questionnaire);
  setFormLanguage(questionnaire);
  const conditional = []; // { item, el } of items with enableWhen (or under one)

  function set(linkId, arr) {
    if (arr && arr.length) answers[linkId] = arr;
    else delete answers[linkId];
    refresh();
    onChange?.(linkId);
  }

  function refresh() {
    for (const { item, el } of conditional) el.hidden = !isEnabled(item, answers, index);
  }

  function renderItems(items, depth = 0) {
    return (items || []).map((it) => renderItem(it, depth)).filter(Boolean);
  }

  function renderItem(item, depth) {
    if (item.type === 'display') return null;
    let el;
    if (item.type === 'group') {
      const kids = (item.item || []).filter((c) => c.type !== 'display');
      const inline = kids.length > 1 && kids.every((c) => (c.type === 'integer' || c.type === 'decimal') && !isSlider(c));
      el = h('section', { class: `group depth-${depth}${inline ? ' group-inline' : ''}` },
        depth > 0 && h('h3', { class: 'group-title' }, itemText(item)),
        h('div', { class: 'group-body' }, renderItems(item.item, depth + 1)));
    } else {
      el = field(item);
      const nested = (item.item || []).filter((c) => c.type !== 'display');
      if (nested.length) el.append(h('div', { class: 'nested' }, renderItems(nested, depth + 1)));
    }
    if (item.enableWhen?.length) { conditional.push({ item, el }); el.classList.add('conditional'); }
    return el;
  }

  function field(item) {
    const id = `f-${item.linkId}`;
    const control = makeControl(item, id);
    // Button groups (yes/no, chips) are labelled via aria-labelledby, since <label for> only works on form controls.
    const group = control.matches('[role]') ? control : control.querySelector('[role]');
    group?.setAttribute('aria-labelledby', `l-${item.linkId}`);
    return h('div', { class: `field type-${item.type}${isSlider(item) ? ' is-slider' : ''}`, dataset: { linkId: item.linkId } },
      h('label', { class: 'field-label', for: group ? null : id, id: `l-${item.linkId}` },
        itemText(item),
        item.required && h('span', { class: 'req', title: t('form.required') }, ' *')),
      control);
  }

  const isSlider = (item) => itemControl(item) === 'slider';

  function makeControl(item, id) {
    const cur = answers[item.linkId] || [];
    switch (item.type) {
      case 'boolean': return booleanControl(item, id, cur);
      case 'choice':
      case 'open-choice': return choiceControl(item, id, cur);
      case 'integer':
      case 'decimal': return isSlider(item) ? sliderControl(item, id, cur) : numberControl(item, id, cur);
      case 'date': return h('input', { id, type: 'date', class: 'input', value: cur[0]?.valueDate || '', disabled: readOnly,
        onchange: (e) => set(item.linkId, e.target.value ? [{ valueDate: e.target.value }] : []) });
      case 'text': return h('textarea', { id, class: 'input', rows: 3, value: cur[0]?.valueString || '', disabled: readOnly,
        oninput: (e) => set(item.linkId, e.target.value.trim() ? [{ valueString: e.target.value }] : []) });
      default: return h('input', { id, type: 'text', class: 'input', value: cur[0]?.valueString || '', autocomplete: 'off', disabled: readOnly,
        oninput: (e) => set(item.linkId, e.target.value.trim() ? [{ valueString: e.target.value }] : []) });
    }
  }

  // Yes / No as a segmented control. Tapping the active option again clears it (= not asked / unknown).
  function booleanControl(item, id, cur) {
    const wrap = h('div', { class: 'seg', id, role: 'group' });
    const paint = () => {
      const v = answers[item.linkId]?.[0]?.valueBoolean;
      wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(v) === b.dataset.v)));
    };
    for (const [label, v] of [[t('form.yes'), true], [t('form.no'), false]]) {
      wrap.append(h('button', { type: 'button', class: 'seg-btn', dataset: { v: String(v) }, disabled: readOnly,
        onclick: () => {
          const now = answers[item.linkId]?.[0]?.valueBoolean;
          set(item.linkId, now === v ? [] : [{ valueBoolean: v }]);
          paint();
        } }, label));
    }
    paint();
    return wrap;
  }

  // Choice: chips (single or multi). Long lists fall back to a <select>. open-choice adds a free-text "other".
  function choiceControl(item, id, cur) {
    const opts = (item.answerOption || []).map((o) => ({
      value: o.valueCoding ? plainCoding(o.valueCoding) : o.valueString,
      key: o.valueCoding ? 'valueCoding' : 'valueString',
      label: o.valueCoding ? codingDisplay(o.valueCoding) : o.valueString,
      exclusive: !!extValue(o, EXT.optionExclusive),
    }));
    const multi = !!item.repeats;
    if (!multi && isSlider(item) && opts.length > 1) return ordinalSlider(item, id, opts);
    const coded = () => (answers[item.linkId] || []).filter((a) => !(item.type === 'open-choice' && a.valueString != null && !opts.some((o) => o.value === a.valueString)));
    const other = () => (answers[item.linkId] || []).find((a) => item.type === 'open-choice' && a.valueString != null && !opts.some((o) => o.value === a.valueString));

    if (!multi && opts.length > 7 && item.type === 'choice') {
      const sel = h('select', { id, class: 'input', disabled: readOnly,
        onchange: (e) => { const o = opts[+e.target.value]; set(item.linkId, o ? [{ [o.key]: o.value }] : []); } },
        h('option', { value: '' }, '–'),
        opts.map((o, i) => h('option', { value: i, selected: cur.some((a) => sameValue(a[o.key], o.value)) }, o.label)));
      return sel;
    }

    const wrap = h('div', { class: 'chips', id, role: multi ? 'group' : 'radiogroup' });
    const paint = () => wrap.querySelectorAll('.chip').forEach((b, i) =>
      b.setAttribute('aria-pressed', String(coded().some((a) => sameValue(a[opts[i].key], opts[i].value)))));
    opts.forEach((o) => wrap.append(h('button', { type: 'button', class: 'chip', disabled: readOnly,
      onclick: () => {
        const isOn = coded().some((a) => sameValue(a[o.key], o.value));
        let next;
        if (!multi) next = isOn ? [] : [{ [o.key]: o.value }];
        else if (isOn) next = coded().filter((a) => !sameValue(a[o.key], o.value));
        else if (o.exclusive) next = [{ [o.key]: o.value }];
        else next = [...coded().filter((a) => !opts.some((x) => x.exclusive && sameValue(a[x.key], x.value))), { [o.key]: o.value }];
        const oth = other();
        set(item.linkId, oth && (multi || !next.length) ? [...next, oth] : next);
        paint();
      } }, o.label)));
    paint();

    if (item.type === 'open-choice') {
      wrap.append(h('input', { type: 'text', class: 'input chip-other', placeholder: t('form.other'), value: other()?.valueString || '', disabled: readOnly,
        oninput: (e) => {
          const txt = e.target.value.trim();
          const base = multi ? coded() : txt ? [] : coded();
          set(item.linkId, txt ? [...base, { valueString: txt }] : base);
          if (!multi) paint();
        } }));
    }
    return wrap;
  }

  // Numbers: text input with numeric keyboard (accepts German decimal comma), unit suffix, soft range check.
  function numberControl(item, id, cur) {
    const unit = unitOf(item);
    const min = extValue(item, EXT.min), max = extValue(item, EXT.max);
    const key = item.type === 'integer' ? 'valueInteger' : 'valueDecimal';
    const warn = h('div', { class: 'field-warn', hidden: true });
    const input = h('input', { id, class: 'input', type: 'text', inputmode: item.type === 'integer' ? 'numeric' : 'decimal',
      autocomplete: 'off', disabled: readOnly, value: cur[0]?.[key] != null ? String(cur[0][key]).replace('.', ',') : '',
      oninput: (e) => {
        const raw = e.target.value.replace(',', '.').trim();
        const n = item.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        const bad = raw && (isNaN(n) || !/^-?\d*([.]\d*)?$/.test(raw));
        const out = !bad && raw && ((min != null && n < min) || (max != null && n > max));
        warn.hidden = !(bad || out);
        warn.textContent = bad ? t('form.nan') : t('form.range', { min, max });
        input.classList.toggle('invalid', !!(bad || out));
        set(item.linkId, raw && !bad ? [{ [key]: n }] : []);
      } });
    return h('div', null, h('div', { class: 'num' }, input, unit && h('span', { class: 'num-unit' }, unit.display || unit.code)), warn);
  }

  // Ordered single choice (e.g. care level 0–5) as a slider over its answer options.
  // Each stop stores the option's coding; ticks show the option's trailing number (or "–").
  function ordinalSlider(item, id, opts) {
    const idx = () => opts.findIndex((o) => (answers[item.linkId] || []).some((a) => sameValue(a[o.key], o.value)));
    const out = h('output', { class: 'slider-choice' });
    const paint = () => { const i = idx(); out.textContent = i < 0 ? '–' : opts[i].label; range.classList.toggle('untouched', i < 0); };
    const range = h('input', { id, type: 'range', min: 0, max: opts.length - 1, step: 1, value: Math.max(0, idx()), disabled: readOnly,
      'aria-valuetext': idx() < 0 ? '' : opts[idx()].label,
      oninput: (e) => { const o = opts[+e.target.value]; set(item.linkId, [{ [o.key]: o.value }]); range.setAttribute('aria-valuetext', o.label); paint(); } });
    const tick = (o, i) => (o.label.match(/(\d+)\s*$/) || [])[1] || (i === 0 ? '0' : '·'); // e.g. "No care level" → 0
    paint();
    return h('div', { class: 'slider slider-ordinal' },
      h('div', { class: 'slider-row' },
        h('div', { class: 'slider-track' }, range, h('div', { class: 'slider-ticks', 'aria-hidden': 'true' }, opts.map((o, i) => h('span', null, tick(o, i))))),
        !readOnly && h('button', { type: 'button', class: 'link-btn', onclick: () => { range.value = 0; set(item.linkId, []); paint(); } }, t('form.clear'))),
      out);
  }

  function sliderControl(item, id, cur) {
    const min = extValue(item, EXT.min) ?? 0, max = extValue(item, EXT.max) ?? 10;
    const step = extValue(item, EXT.sliderStep) ?? 1;
    const labelOf = (code) => { const d = (item.item || []).find((c) => c.type === 'display' && itemControl(c) === code); return d && itemText(d); };
    const key = item.type === 'integer' ? 'valueInteger' : 'valueDecimal';
    const v = cur[0]?.[key];
    const out = h('output', { class: 'slider-value' }, v ?? '–');
    const range = h('input', { id, type: 'range', min, max, step, value: v ?? min, disabled: readOnly,
      class: v == null ? 'untouched' : '',
      oninput: (e) => { range.classList.remove('untouched'); out.textContent = e.target.value; set(item.linkId, [{ [key]: Number(e.target.value) }]); } });
    return h('div', { class: 'slider' },
      h('div', { class: 'slider-row' }, range, out,
        !readOnly && h('button', { type: 'button', class: 'link-btn', onclick: () => { range.classList.add('untouched'); out.textContent = '–'; set(item.linkId, []); } }, t('form.clear'))),
      h('div', { class: 'slider-labels' }, h('span', null, `${min} ${labelOf('lower') || ''}`), h('span', null, `${max} ${labelOf('upper') || ''}`)));
  }

  return { renderItems, renderItem, refresh, index };
}

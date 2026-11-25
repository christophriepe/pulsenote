// Formats the identifying summary of a case (see caseSummary in lib/questionnaire.js) for lists.

import { t, i18n } from '../lib/i18n.js';

export function summaryText(s) {
  return {
    name: s.name || t('card.unnamed'),
    meta: [s.sex && ((i18n.lang === 'de' ? { male: 'M', female: 'W', other: 'D' } : { male: 'M', female: 'F', other: 'D' })[s.sex] || s.sex), s.age != null ? `${s.age} ${i18n.lang === 'de' ? 'J.' : 'Y'}` : null].filter(Boolean).join(' · '),
    complaint: s.complaint,
    location: [s.room && t('card.room', { r: s.room }), s.stretcher && t('card.stretcher', { s: s.stretcher })].filter(Boolean).join(' · '),
  };
}

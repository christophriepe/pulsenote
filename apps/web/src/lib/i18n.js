// UI language (German / English). Only the app's own text is translated here.
// Form content comes from the Questionnaires; translated forms would use the FHIR translation
// extension on Questionnaire.item.text (later). The free-text report stays German (it goes into the HIS).

const STRINGS = {
  // shell
  'nav.shift': { en: 'My Shift', de: 'Meine Schicht' },
  'nav.dashboard': { en: 'Dashboard', de: 'Dashboard' },
  'net.online': { en: 'Online', de: 'Online' },
  'net.offline': { en: 'Offline', de: 'Offline' },
  'net.label': { en: 'Connection', de: 'Verbindung' },
  'session.expired': { en: 'Session expired', de: 'Sitzung abgelaufen' },
  'session.expiredHint': { en: 'Drafts stay editable. Sign in again to send.', de: 'Entwürfe bleiben bearbeitbar. Zum Senden erneut anmelden.' },
  'signout': { en: 'Sign out', de: 'Abmelden' },
  'signout.title': { en: 'Sign out and delete drafts?', de: 'Abmelden und Entwürfe löschen?' },
  'signout.body': {
    en: '{n} unsent draft(s) on this device will be deleted, so the next person on this device never sees them. Send first if you still need them.',
    de: '{n} nicht gesendete(r) Entwurf/Entwürfe auf diesem Gerät werden gelöscht, damit die nächste Person am Gerät sie nie sieht. Vorher senden, falls noch benötigt.' },
  'signout.confirm': { en: 'Delete drafts and sign out', de: 'Entwürfe löschen und abmelden' },
  'role.physician': { en: 'Physician', de: 'Ärztin/Arzt' },
  'role.attending': { en: 'Attending', de: 'Oberärztin/-arzt' },
  'lang.switch': { en: 'Deutsch', de: 'English' },
  'lang.label': { en: 'Sprache wechseln', de: 'Switch language' },
  'cancel': { en: 'Cancel', de: 'Abbrechen' },
  'loading': { en: 'Loading …', de: 'Lädt …' },

  // demo controls
  'demo.title': { en: 'Demo controls', de: 'Demo-Steuerung' },
  'demo.offline': { en: 'Simulate offline', de: 'Offline simulieren' },
  'demo.offlineOn': { en: 'Simulating: no connection', de: 'Simuliert: keine Verbindung' },
  'demo.offlineOff': { en: 'Back online', de: 'Wieder online' },
  'demo.reset': { en: 'Reset', de: 'Zurücksetzen' },
  'demo.clock': { en: 'Clock', de: 'Uhr' },
  'demo.note': { en: 'Synthetic patients only. Backend is mocked in the browser.', de: 'Nur synthetische Patient:innen. Backend im Browser simuliert.' },

  // login
  'login.tagline': { en: 'Bedside history & examination.', de: 'Anamnese und Untersuchung am Patientenbett.' },
  'login.account': { en: 'Username or email', de: 'Benutzername oder E-Mail' },
  'login.password': { en: 'Password', de: 'Passwort' },
  'login.placeholder': { en: 'e.g. weber', de: 'z. B. weber' },
  'login.submit': { en: 'Sign in', de: 'Anmelden' },
  'login.error': { en: 'Unknown user or wrong password', de: 'Unbekanntes Konto oder falsches Passwort' },
  'login.demo': { en: 'Demo accounts', de: 'Demo-Konten' },
  'login.demoHint': { en: 'Any password works. Tap to fill in.', de: 'Jedes Passwort funktioniert. Antippen zum Ausfüllen.' },
  'login.fine': {
    en: 'Course prototype. Synthetic patients only, never real patient data. In a hospital this would be the hospital login (SSO).',
    de: 'Kursprototyp. Nur synthetische Patient:innen, niemals echte Patientendaten. In der Klinik wäre dies die Klinik-Anmeldung (SSO).' },

  // case list
  'list.title': { en: 'My Shift', de: 'Meine Schicht' },
  'list.subtitle': { en: '{name} · cases of the last {h} hours', de: '{name} · Fälle der letzten {h} Stunden' },
  'list.new': { en: 'New', de: 'Neu' },
  'list.drafts': { en: 'Drafts', de: 'Entwürfe' },
  'list.noDrafts': { en: 'No unsent drafts.', de: 'Keine ungesendeten Entwürfe.' },
  'list.expiring': { en: '{n} draft(s) expire within {d}. Send now, or the data will be deleted from this phone.', de: '{n} Entwurf/Entwürfe laufen innerhalb von {d} ab. Jetzt senden, sonst werden die Daten von diesem Gerät gelöscht.' },
  'list.expired': { en: '{n} unsent draft(s) expired and were deleted from this phone.', de: '{n} ungesendete(r) Entwurf/Entwürfe abgelaufen und von diesem Gerät gelöscht.' },
  'list.sent': { en: 'Sent', de: 'Gesendet' },
  'list.noSent': { en: 'Nothing sent yet this shift.', de: 'In dieser Schicht noch nichts gesendet.' },
  'list.older': { en: 'Older cases are in the dashboard.', de: 'Ältere Fälle finden Sie im Dashboard.' },
  'list.offlineSent': { en: 'Offline. Sent cases are only shown with a connection, because they are never stored on the phone.', de: 'Offline. Gesendete Fälle werden nur mit Verbindung angezeigt, weil sie nie auf dem Gerät gespeichert werden.' },
  'list.loadError': { en: 'Could not load sent cases: {m}', de: 'Gesendete Fälle konnten nicht geladen werden: {m}' },
  'list.loadingDrafts': { en: 'Loading drafts …', de: 'Entwürfe werden geladen …' },
  'list.loadingSent': { en: 'Loading sent cases …', de: 'Gesendete Fälle werden geladen …' },
  'card.notSent': { en: 'Not sent', de: 'Nicht gesendet' },
  'card.sent': { en: 'Sent', de: 'Gesendet' },
  'card.inHis': { en: 'In HIS', de: 'Im KIS' },
  'card.expires': { en: 'Expires {t} (in {d})', de: 'Läuft ab {t} (in {d})' },
  'card.continue': { en: 'Continue', de: 'Weiter' },
  'card.send': { en: 'Send', de: 'Senden' },
  'card.discard': { en: 'Discard', de: 'Verwerfen' },
  'card.discardTitle': { en: 'Discard draft?', de: 'Entwurf verwerfen?' },
  'card.discardBody': { en: 'The draft is deleted from this phone. It was never sent.', de: 'Der Entwurf wird von diesem Gerät gelöscht. Er wurde nie gesendet.' },
  'card.unnamed': { en: 'Unnamed patient', de: 'Ohne Namen' },
  'card.room': { en: 'Room {r}', de: 'Zi. {r}' },
  'card.stretcher': { en: 'Stretcher {s}', de: 'Trage {s}' },
  'template.title': { en: 'New case: choose a template', de: 'Neuer Fall: Vorlage wählen' },
  'template.notYet': { en: 'Questionnaire not written yet', de: 'Fragebogen noch nicht erstellt' },
  'template.ed-surgery': { en: 'Surgery', de: 'Chirurgie' },
  'template.ed-surgery.hint': { en: 'Surgical patients', de: 'Chirurgische Patient:innen' },
  'template.ed-general': { en: 'Emergency Department', de: 'Notaufnahme' },
  'template.ed-general.hint': { en: 'History and Examination', de: 'Anamnese und Untersuchung' },
  'template.main': { en: 'Main template', de: 'Hauptvorlage' },
  'template.more': { en: 'Specialty templates', de: 'Fachvorlagen' },
  'template.ed-respiratory': { en: 'Respiratory', de: 'Respiratorisch' },
  'template.ed-respiratory.hint': { en: 'Infection / respiratory clinic', de: 'Infekt- / Atemwegsambulanz' },

  // wizard & form
  'wiz.back': { en: 'Back', de: 'Zurück' },
  'wiz.backToList': { en: 'My Shift', de: 'Meine Schicht' },
  'wiz.next': { en: 'Next: {s}', de: 'Weiter: {s}' },
  'wiz.send': { en: 'Review & send', de: 'Prüfen & senden' },
  'wiz.draft': { en: 'Draft · not sent', de: 'Entwurf · nicht gesendet' },
  'wiz.saved': { en: 'Saved on this phone {t}', de: 'Auf diesem Gerät gespeichert {t}' },
  'wiz.saving': { en: 'Saving …', de: 'Speichert …' },
  'wiz.step': { en: 'Step {i} of {n}', de: 'Schritt {i} von {n}' },
  'review.title': { en: 'Send this case?', de: 'Diesen Fall senden?' },
  'review.body': { en: 'After sending, the case is stored on the server and deleted from this phone.', de: 'Nach dem Senden liegt der Fall auf dem Server und wird von diesem Gerät gelöscht.' },
  'review.missing': { en: 'Missing: {f}', de: 'Fehlt: {f}' },
  'review.confirm': { en: 'Send case', de: 'Fall senden' },
  'review.answered': { en: '{d} of {t} answered', de: '{d} von {t} beantwortet' },
  'form.yes': { en: 'Yes', de: 'Ja' },
  'form.no': { en: 'No', de: 'Nein' },
  'form.other': { en: 'Other …', de: 'Andere …' },
  'form.clear': { en: 'Clear', de: 'Löschen' },
  'form.required': { en: 'Required', de: 'Pflichtfeld' },
  'form.nan': { en: 'Not a number', de: 'Keine Zahl' },
  'form.range': { en: 'Outside the plausible range ({min}–{max})', de: 'Außerhalb des plausiblen Bereichs ({min}–{max})' },
  'form.notRecorded': { en: 'not recorded', de: 'nicht erhoben' },

  // send
  'send.ok': { en: 'Case sent. Removed from this phone.', de: 'Fall gesendet. Von diesem Gerät entfernt.' },
  'send.offline': { en: 'No connection. The case stays on this phone as an unsent draft.', de: 'Keine Verbindung. Der Fall bleibt als ungesendeter Entwurf auf diesem Gerät.' },
  'send.error': { en: 'Could not send: {m}', de: 'Senden fehlgeschlagen: {m}' },
  'reauth.title': { en: 'Sign in again to send', de: 'Zum Senden erneut anmelden' },
  'reauth.body': { en: 'Your session has expired. Your drafts are still on this device. Enter the password for {name} to send.', de: 'Ihre Sitzung ist abgelaufen. Ihre Entwürfe sind noch auf diesem Gerät. Passwort für {name} eingeben, um zu senden.' },

  // dashboard
  'dash.title': { en: 'Cases', de: 'Fälle' },
  'dash.subAttending': { en: 'All cases of the department', de: 'Alle Fälle der Abteilung' },
  'dash.subPhysician': { en: 'Your cases', de: 'Ihre Fälle' },
  'dash.search': { en: 'Search name, complaint, room …', de: 'Name, Leitsymptom, Zimmer suchen …' },
  'dash.open': { en: 'Open', de: 'Offen' },
  'dash.inHis': { en: 'In HIS', de: 'Im KIS' },
  'dash.all': { en: 'All', de: 'Alle' },
  'dash.allPhysicians': { en: 'All physicians', de: 'Alle Ärzt:innen' },
  'dash.mine': { en: 'My cases', de: 'Meine Fälle' },
  'dash.kpiOpen': { en: 'open', de: 'offen' },
  'dash.kpiToday': { en: 'created in the last 12 h', de: 'in den letzten 12 h erstellt' },
  'dash.kpiHis': { en: 'in HIS, awaiting deletion', de: 'im KIS, Löschung ausstehend' },
  'dash.col.patient': { en: 'Patient', de: 'Patient:in' },
  'dash.col.complaint': { en: 'Chief complaint', de: 'Leitsymptom' },
  'dash.col.location': { en: 'Location', de: 'Ort' },
  'dash.col.template': { en: 'Template', de: 'Vorlage' },
  'dash.col.physician': { en: 'Physician', de: 'Ärzt:in' },
  'dash.col.updated': { en: 'Updated', de: 'Geändert' },
  'dash.col.status': { en: 'Status', de: 'Status' },
  'dash.noMatch': { en: 'No cases match.', de: 'Keine passenden Fälle.' },
  'dash.offline': { en: 'Offline. The dashboard needs a connection.', de: 'Offline. Das Dashboard braucht eine Verbindung.' },
  'dash.needsConn': { en: 'Offline. This needs a connection.', de: 'Offline. Dafür wird eine Verbindung benötigt.' },
  'dash.select': { en: 'Select a case to review, edit and export it.', de: 'Fall auswählen, um ihn zu prüfen, zu bearbeiten und zu exportieren.' },
  'dash.back': { en: 'Cases', de: 'Fälle' },
  'dash.by': { en: 'by {n}', de: 'von {n}' },
  'dash.created': { en: 'created {t}', de: 'erstellt {t}' },
  'dash.transfer': { en: 'Mark as transferred to HIS', de: 'Als ins KIS übertragen markieren' },
  'dash.transferTitle': { en: 'Mark as transferred to the HIS?', de: 'Als ins KIS übertragen markieren?' },
  'dash.transferBody': { en: 'Do this after the report is in the HIS. The HIS entry then becomes the official record, the case is locked here, and PulseNote deletes it after {d} days.', de: 'Erst, wenn der Bericht im KIS ist. Der KIS-Eintrag ist dann die offizielle Dokumentation, der Fall wird hier gesperrt und von PulseNote nach {d} Tagen gelöscht.' },
  'dash.transferred': { en: 'Transferred {t}', de: 'Übertragen {t}' },
  'dash.deletedOn': { en: 'Deleted from PulseNote {t}', de: 'Löschung aus PulseNote {t}' },
  'dash.tab.case': { en: 'Case', de: 'Fall' },
  'dash.tab.text': { en: 'Free text', de: 'Freitext' },
  'dash.tab.fhir': { en: 'FHIR', de: 'FHIR' },
  'dash.tab.audit': { en: 'Audit log', de: 'Protokoll' },
  'dash.locked': { en: 'This case is in the HIS and locked here. The HIS entry is the official record.', de: 'Dieser Fall ist im KIS und hier gesperrt. Der KIS-Eintrag ist die offizielle Dokumentation.' },
  'dash.save': { en: 'Save changes', de: 'Änderungen speichern' },
  'dash.saved': { en: 'Changes saved on the server', de: 'Änderungen auf dem Server gespeichert' },
  'dash.notSaved': { en: 'Offline. Changes not saved.', de: 'Offline. Änderungen nicht gespeichert.' },
  'dash.sameFields': { en: 'Same fields and checks as the phone form.', de: 'Gleiche Felder und Prüfungen wie das Formular am Handy.' },
  'dash.unsaved': { en: 'Unsaved changes', de: 'Ungespeicherte Änderungen' },
  'dash.copyHis': { en: 'Copy for HIS', de: 'Für KIS kopieren' },
  'dash.copied': { en: 'Copied. Paste it into the HIS.', de: 'Kopiert. Jetzt ins KIS einfügen.' },
  'dash.copyFail': { en: 'Copy not allowed here', de: 'Kopieren hier nicht erlaubt' },
  'dash.textNote': { en: 'Generated by the backend (GET /cases/{id}/text). Always in German, because it goes into the HIS. Placeholder wording until area 1 delivers the template.', de: 'Vom Backend erzeugt (GET /cases/{id}/text). Platzhalter, bis Bereich 1 die Vorlage liefert.' },
  'dash.fhirBundle': { en: 'Resources (Bundle)', de: 'Ressourcen (Bundle)' },
  'dash.fhirIps': { en: 'IPS document', de: 'IPS-Dokument' },
  'dash.fhirIpsSoon': { en: 'Coming with packages/fhir-mapping (area 2)', de: 'Kommt mit packages/fhir-mapping (Bereich 2)' },
  'dash.download': { en: 'Download JSON', de: 'JSON herunterladen' },
  'dash.copyJson': { en: 'Copy JSON', de: 'JSON kopieren' },
  'dash.jsonCopied': { en: 'JSON copied', de: 'JSON kopiert' },
  'dash.fhirNote': { en: 'Mock extraction (vital signs, Patient, Encounter). The real mapping lives in packages/fhir-mapping.', de: 'Vorläufige Extraktion (Vitalwerte, Patient, Encounter). Das echte Mapping liegt in packages/fhir-mapping.' },
  'dash.auditNote': { en: 'Every access and change is logged with user and time. The log holds case ids only, no patient data.', de: 'Jeder Zugriff und jede Änderung wird mit Nutzer:in und Zeit protokolliert. Das Protokoll enthält nur Fall-IDs, keine Patientendaten.' },
  'dash.col.time': { en: 'Time', de: 'Zeit' },
  'dash.col.user': { en: 'User', de: 'Nutzer:in' },
  'dash.col.action': { en: 'Action', de: 'Aktion' },
};

function initialLang() {
  try { const s = localStorage.getItem('pulsenote.lang'); if (s === 'de' || s === 'en') return s; } catch { /* storage unavailable */ }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const i18n = {
  lang: initialLang(),
  get locale() { return this.lang === 'de' ? 'de-DE' : 'en-GB'; },
  set(lang) {
    this.lang = lang;
    document.documentElement.lang = lang;
    try { localStorage.setItem('pulsenote.lang', lang); } catch { /* ignore */ }
  },
};
document.documentElement.lang = i18n.lang;

export function t(key, vars = {}) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return (entry[i18n.lang] ?? entry.en).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// App-wide settings. Values marked "open question" are still to be decided by the team (see root README).

export const CONFIG = {
  // null = use the in-browser mock backend (src/api/mock-server.js).
  // Set to e.g. "/api" once the FastAPI backend from apps/api is running.
  apiBase: null,

  // Unsent drafts expire this long after they were created (about one shift). Open question: 12 or 24 h.
  draftTtlMs: 12 * 60 * 60 * 1000,
  // Show an expiry warning when less than this is left.
  draftWarnMs: 60 * 60 * 1000,

  // A case is deleted this long after it was transferred to the HIS. Open question: retention period.
  retentionDays: 7,

  // A session lasts one shift. Drafts stay editable after it expires; only sending needs a new sign-in.
  sessionMs: 12 * 60 * 60 * 1000,

  // Phone vs. desktop layout breakpoint (px)
  desktopMinWidth: 900,

  // Templates offered in "New case". Forms are data: a new template is a new Questionnaire JSON file.
  forms: [
    { id: 'ed-surgery', label: 'Surgery', hint: 'Surgical patients', path: '../../packages/form-definitions/questionnaires/ed-surgery.json' },
    { id: 'ed-general', label: 'General', hint: 'Internal medicine · Questionnaire not written yet' },
    { id: 'ed-respiratory', label: 'Respiratory', hint: 'Infection / respiratory clinic · Questionnaire not written yet' },
    { id: 'ward-round-visceral', label: 'Ward round (outlook)', hint: 'Same app beyond the ED', path: '../../packages/form-definitions/questionnaires/ward-round-visceral.json' },
  ],
};

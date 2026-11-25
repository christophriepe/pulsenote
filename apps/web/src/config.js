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

  // Templates offered in "New case" (labels in lib/i18n.js). Forms are data: a new template is a new Questionnaire JSON file.
  forms: [
    { id: 'ed-general', main: true, path: '../../packages/form-definitions/questionnaires/ed-general.json' },
    { id: 'ed-surgery', path: '../../packages/form-definitions/questionnaires/ed-surgery.json' },
    { id: 'ed-respiratory' },
  ],
};

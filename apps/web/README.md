# apps/web

The PulseNote web app in **plain HTML, CSS and JavaScript** (ES modules, no framework, no build step): one app with one login and two views.

> **Status: rough draft.** The backend is mocked in the browser (`src/api/mock-server.js`) so the UI can be built and demoed before `apps/api` exists. Synthetic patients only.

## Run it

```sh
# from the repository root (the app loads the Questionnaires from packages/form-definitions)
python3 -m http.server 8000
# open http://localhost:8000/apps/web/
```

Single-file demo (CSS, forms and modules inlined, opens straight from disk):

```sh
python3 apps/web/tools/build-demo.py   # -> apps/web/dist/pulsenote-demo.html (git-ignored)
```

Demo accounts: `weber`, `klein` (physicians), `schmidt` (attending). Any password works. The **Demo controls** panel simulates a dropped connection and fast-forwards the clock to show draft expiry.

## Structure

```
apps/web/
├── index.html
├── styles/app.css                one stylesheet, phone first, desktop from 900 px
├── src/
│   ├── main.js                   app shell, routing (no ids or patient data in URLs), demo controls
│   ├── config.js                 draft expiry, retention, session length, template list
│   ├── lib/
│   │   ├── dom.js                h() element helper, modal, toast, demo clock
│   │   ├── i18n.js               German / English UI strings, t()
│   │   └── questionnaire.js      generic Questionnaire logic: enableWhen, QuestionnaireResponse build/parse
│   ├── auth/                     login screen, session and roles (mocked)
│   ├── components/               language switch, case summary formatting
│   ├── api/
│   │   ├── client.js             API client, FHIR over REST (switch to the real backend via CONFIG.apiBase)
│   │   └── mock-server.js        stand-in backend incl. placeholder free text + FHIR extraction, audit log
│   └── features/
│       ├── case-form/            renderer, phone wizard, case list, local drafts (IndexedDB), send
│       └── dashboard/            case table, single-page editing, free text, FHIR, audit, HIS transfer
└── tools/build-demo.py           single-file demo bundle
```

## What works in the draft

- **Templates**: *ED patient* (`ed-general`, new draft) is the main template in "New case"; Surgery is listed below it as a specialty template.
- **Generic renderer**: renders any `Questionnaire` (tested with `ed-general`, `ed-surgery` and `ward-round-visceral`; the ward round is not offered in the app): groups, `boolean`, `choice`/`open-choice` (single and `repeats`, `optionExclusive`), `integer`/`decimal` with units and soft range checks (German decimal comma), slider control, `date`, `string`, `text`, `enableWhen` (incl. nested). Disabled answers are left out of the `QuestionnaireResponse` but kept in the draft.
- **Phone**: case list with *Drafts* (on the phone, not sent, expiry countdown and warning) and *Sent* (server only, hidden offline); three-step wizard with progress per step; autosave after every input; send → draft deleted only after the server confirms; offline send keeps the draft; re-sign-in prompt when the shift session has expired.
- **Desktop dashboard**: case table with search, status filter and (for attendings) all physicians; same form on one page with save; free text with copy for HIS; FHIR Bundle / QuestionnaireResponse view and download; audit log; mark as transferred → locked, deletion date shown.
- **Language**: the switch changes the app's own text (`src/lib/i18n.js`) and the form text. Forms carry their English text inside the Questionnaire via the FHIR translation extension (`item._text`, `Coding._display`, `_title`); the `QuestionnaireResponse` and the free-text report stay in the form's base language (German), because they go into the HIS. Default from the browser, remembered per device.
- **Accessibility**: labelled button groups, keyboard-usable tables and dialogs (Escape closes), focus moves to the step heading, live save status, skip link, reduced motion.
- **Data protection in the UI**: drafts tied to the user and deleted on sign-out (with warning); expired drafts deleted; sent cases never stored on the device; no patient data in URLs; audit log holds case ids only.

## Not yet

Service worker / PWA manifest, real login, real API calls, IPS document, required-field validation before sending, tests.

**Open (team decision):** whether a case is locked after transfer to the HIS, and the retention period (the draft locks it and uses 7 days, see `src/config.js`).

**Owner:** Area 4 (Frontend & prototype)

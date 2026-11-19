# apps/web

The PulseNote web app (React): one app with one login and two views, built as an offline-capable Progressive Web App (PWA).

- `src/features/case-form/`: case form. Renders the FHIR `Questionnaire`s from `packages/form-definitions` generically: three-step wizard on phones, single page on the PC. Local drafts and the phone's case list.
- `src/features/dashboard/`: case list, editing, free-text and FHIR export (incl. IPS document), analytics (planned).
- `src/auth/`: shared login.
- `src/components/`: shared UI building blocks.

**Offline & local drafts:** The case form works offline. A service worker caches the app, and every input is autosaved to IndexedDB. Sending needs a connection. See "Offline use & local drafts" in the root README.

**Data protection:** Only unsent drafts are stored in the browser, and only temporarily:

- deleted as soon as the server confirms receipt
- expire after a fixed time (about one shift)
- tied to the signed-in user, deleted on sign-out

Sent cases are always loaded from the server and never cached. See "Data protection & security" in the root README.

**Owner:** Area 4 (Frontend & prototype)

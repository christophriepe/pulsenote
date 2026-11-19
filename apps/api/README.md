# apps/api

The PulseNote backend. Stack still to be decided (see "Backend options" in the root README).

- `src/routes/`: endpoints for saving, loading and exporting cases.
- `src/auth/`: authentication and roles.
- `src/db/`: database access.
- `src/export/`: IPS bundle and free-text generation (uses `packages/fhir-mapping` and `packages/terminology`).
- `migrations/`: database schema.

**Receiving cases from phones:** Cases are often written offline and sent later.

- Each case gets its ID on the phone. Receiving the same ID again updates the case instead of creating a duplicate.
- The backend accepts cases built with older form versions, since a phone may still run an older app version.

**Data protection:** The backend is a temporary case store, not the patient record. Once a case has been transferred to the HIS, it is deleted after a defined retention period. Access and changes are audit-logged. Runs on-premise in the hospital intranet in production. See "Data protection & security" in the root README.

**Owner:** Area 2 (Backend & FHIR / IPS modelling)

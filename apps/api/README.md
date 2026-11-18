# apps/api

The PulseNote backend. Stack still to be decided (see "Backend options" in the root README).

- `src/routes/`: endpoints for saving, loading and exporting cases.
- `src/auth/`: authentication and roles.
- `src/db/`: database access.
- `src/export/`: IPS bundle and free-text generation (uses `packages/fhir-mapping` and `packages/terminology`).
- `migrations/`: database schema.

**Owner:** Area 2 (Backend & FHIR / IPS modelling)

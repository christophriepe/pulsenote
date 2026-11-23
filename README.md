<!-- Logo: CaseFlow wordmark for now. The final project name (PulseNote or CaseFlow) is not decided yet. -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/caseflow-wordmark-dark.svg">
    <img src="docs/brand/caseflow-wordmark-light.svg" alt="CaseFlow" width="360">
  </picture>
</p>

<p align="center">
  Structured, mobile-first documentation forms for physicians in the emergency department (ED).
</p>

<p align="center">
  <a href="https://hl7.org/fhir/R4/"><img src="https://img.shields.io/badge/FHIR-R4-2563EB" alt="FHIR R4"></a>
  <a href="https://hl7.org/fhir/uv/ips/"><img src="https://img.shields.io/badge/IPS-aligned-2563EB" alt="IPS aligned"></a>
  <img src="https://img.shields.io/badge/status-prototype-64748B" alt="Status: prototype">
  <a href="https://caseflow.christophriepe.com"><img src="https://img.shields.io/badge/demo-live-16A34A" alt="Live demo"></a>
</p>

PulseNote lets ED physicians record history and physical examination at the bedside on their phone. Data is stored temporarily in a central repository. On a desktop PC, the same web app offers a dashboard where cases can be reviewed, edited and transferred into the hospital information system (HIS), either as **HL7 FHIR R4 resources** with standard terminologies or as a **free-text report**.

Forms are defined as **FHIR `Questionnaire`s**, as data rather than code. Each case's answers become standard FHIR resources, aligned with the **International Patient Summary (IPS)**. From these, PulseNote can generate an IPS document for further treatment. In German hospitals, the path into the HIS would be **ISiK**.

**The HIS remains the patient record.** PulseNote is an input tool: it holds a case only until it has been transferred to the HIS.

> **Status:** Early planning. A local-only prototype (formerly *CaseFlow*) is live at [caseflow.christophriepe.com](https://caseflow.christophriepe.com). It stores all data in the browser and has no backend yet.

> **This repository** is the shared monorepo for the whole project: frontend (`apps/web`), backend (`apps/backend`) and shared packages (`packages/`). See [Repository structure](#repository-structure).

## Outline

- [Workflow](#workflow)
- [Features](#features)
  - [Case form (optimized for phones)](#case-form-optimized-for-phones)
  - [Offline use & local drafts](#offline-use--local-drafts)
  - [Dashboard (optimized for desktop)](#dashboard-optimized-for-desktop)
- [Team & responsibilities](#team--responsibilities)
  - [Shared contracts](#shared-contracts)
  - [Working agreements](#working-agreements)
- [Architecture](#architecture)
  - [FHIR as the shared data model](#fhir-as-the-shared-data-model)
  - [API](#api)
  - [Repository structure](#repository-structure)
- [FHIR data model](#fhir-data-model)
  - [IPS document](#ips-document)
  - [Vital signs (LOINC + UCUM)](#vital-signs-loinc--ucum)
  - [Terminologies](#terminologies)
- [Hosting](#hosting)
- [Data protection & security](#data-protection--security)
- [Roadmap](#roadmap)
- [Open questions](#open-questions)
- [Getting started](#getting-started)
- [License](#license)

---

## Workflow

1. **At the bedside:** The physician signs in to PulseNote on their phone, opens a new case and picks the template that fits the patient (e.g. internal medicine, surgery, respiratory).
2. **Documentation:** They work through the three form steps: patient → history → examination. Every input is saved locally on the phone right away, so nothing is lost if the app is closed or the connection drops.
3. **Store:** When the case is complete, the phone's web app creates it on the central PulseNote backend. Without a connection, it stays on the phone as an unsent draft until it can be sent. Later edits on the phone update the case on the backend _(optional)_.
4. **Review on the desktop (any time):** The physician signs in to the same web app on a desktop PC with the same credentials.
   - **Load & view:** open and review cases from the backend.
   - **Update:** complete or correct a case on the backend _(optional)_.
   - **Free text:** the desktop web app requests a free-text report for a case from the backend and copies it straight into the HIS.
   - **Patient document:** either web app can request the case as a patient document from the backend's export endpoint: FHIR R4 resources coded with SNOMED CT, LOINC and UCUM (plus ICD-10-GM for diagnoses), or an IPS document. In the future this file could be imported into the HIS, where the HIS only supports file import.
   - **Direct access:** the backend offers the same export endpoints to other systems, so an HIS could also fetch the data directly, without the web app.
5. **Hand-over to the HIS:** Once the case is in the HIS, the HIS entry is the official record. PulseNote deletes the case after a defined retention period.
6. **Analytics (planned):** statistics across cases, by accessing the backend directly, based on pseudonymized or aggregated data.

```mermaid
flowchart LR
    subgraph PN [PulseNote]
        direction LR
        P[Web app on the phone]
        B[Backend<br/>case store, provide api endpoints]
        D[Web app on the desktop]
    end
    F[Analytics]
    H[HIS<br/>official patient record]

    P -- "create / update case" --> B
    B ~~~ D
    D -- "load / update case<br/>get free text<br/>get patient FHIR document" --> B
    D -- "copy free text" --> H
    D -. "import patient FHIR document" .-> H
    B -. "export endpoints (future)" .-> H
    F -. "direct access (planned)" .-> B
```

---

## Features

PulseNote is **one web app with one login**, built as a Progressive Web App (PWA) that can be installed on the phone's home screen and works offline. It has two views:

- the **case form**, optimized for phones
- the **dashboard**, optimized for desktop monitors

Both views render the same form definitions, stored as FHIR `Questionnaire`s (see [`packages/form-definitions`](packages/form-definitions/README.md)). A case entered on the phone looks and validates the same way when it is edited on the PC.

### Case form (optimized for phones)

Each template is a three-step wizard. After the last step the physician sends the case to the backend. On the PC, the same fields are shown on a single page for editing.

**Case list on the phone:** The phone shows the physician's own cases of the current shift in two groups:

- **Drafts:** cases stored locally on the phone that have not been sent yet, clearly marked as "not sent"
- **Sent:** cases already on the server. They are loaded fresh from the server each time and are not stored on the phone, so they are only visible with a connection.

Older cases are available in the dashboard on the PC.

| Step                     | Contents (example: General)                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Patient**     | Sex, name, date of birth, height, weight, location (room, stretcher number)                                                                                                                                                                              |
| **2. History**     | Chief complaint, symptoms (chest pain, dyspnea, palpitations, syncope, …), allergies, past medical and surgical history, long-term medication, last meal, GP, referring physician, social history (care level, legal guardian, nursing home, insurance) |
| **3. Examination** | Vital signs (BP, HR, SpO₂, temperature, RR), lab findings, general and nutritional condition, heart, lungs, abdomen, extremities, other findings                                                                                                        |

Templates available in the prototype:

- **General**: internal medicine patients
- **Surgery**: surgical patients
- **Respiratory**: infection / respiratory clinic

Planned: orthopedics, neurology, pediatrics, and more.

**Beyond the ED (outlook):** Because forms are data, the same app can serve other settings, such as ward rounds or doctors' practices, with new `Questionnaire`s instead of new code. Only the form and the type of `Encounter` change.

### Offline use & local drafts

Connectivity in the ED is unreliable, and losing ten minutes of history taking is not acceptable. The case form therefore works fully offline:

| What                  | Offline | How                                                                                     |
| --------------------- | ------- | --------------------------------------------------------------------------------------- |
| Open the app          | ✅      | A service worker (plain JavaScript) caches the app. The first start needs a connection. |
| Fill in a case        | ✅      | Form definitions ship with the app                                                       |
| Save drafts           | ✅      | Autosave after every input to IndexedDB in the browser                                   |
| Send a case           | ❌      | Needs a connection; the draft stays on the phone until then                              |
| See sent cases        | ❌      | Loaded from the server only, by design                                                   |

**Things to watch:**

- **Session:** Signing in again is impossible offline. The session lasts a full shift, and drafts stay editable even if the session has expired. Signing in again is only needed to send.
- **App updates:** New versions arrive on the next start with a connection. The backend must therefore accept cases built with older form versions.
- **No duplicates:** Each case gets its ID on the phone, so sending it again after a dropped connection does not create a second copy.
- **iOS:** Safari and the home-screen app have separate storage. Physicians always use the installed home-screen app.
- **Native app:** Not needed. If native features are needed later (secure system storage, wristband barcode scanning, distribution via the hospital's device management), the same web app can be wrapped with [Capacitor](https://capacitorjs.com/).

### Dashboard (optimized for desktop)

Saved cases are reviewed, edited and exported in the dashboard. It works on a phone, but it is designed for monitors.

- **Case view**: browse and open saved cases
- **Editing**: complete or correct a case using the same fields as the case form
- **Free-text export**: generate the structured report and copy it into the HIS
- **FHIR export**: the case as FHIR R4 resources, optionally as an IPS document (see [FHIR data model](#fhir-data-model))

---

## Team & responsibilities

The team has four people. The four areas follow the course's team assessment criteria, so each graded criterion has exactly one owner. Owning an area means making its decisions and keeping it in shape, not working on it alone.

| # | Area                                     | Assessment criterion    | Owner       | Responsibilities                                                                                                                                                                         |
| - | ---------------------------------------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Medical domain & use case**      | Use case and user focus | Christoph   | Clinical problem and user needs, clinical content of the forms (fields, answer options, templates), free-text report content and wording, test cases and sample patients, dashboard KPIs |
| 2 | **Backend & FHIR / IPS modelling** | FHIR / IPS modelling    | Jeremias??? | API, data model and storage, extraction from `QuestionnaireResponse` to FHIR resources, IPS document, validation, free-text generation in code, deployment |
| 3 | **Terminologies**                  | Terminologies           | Heinrich??? | SNOMED CT, LOINC, UCUM, ICD-10-GM, ATC; ValueSets for every answer option; ConceptMaps; code bindings in the FHIR resources; IPS "absent/unknown" codes                                  |
| 4 | **Frontend & prototype**           | Prototype and demo      | Chad???     | Web app in HTML, CSS and JavaScript (case form and dashboard), login UI, mobile and desktop UX, demo build                                                                                                     |

**Load balancing:**

- Area 2 carries the highest-weighted criterion plus the server itself. Data protection and hosting paperwork are therefore kept to a minimum for the course project.
- Areas 1 and 3 will likely have somewhat less work. Their owners help out in area 4 and especially in area 2.

### Shared contracts

Most problems happen where two areas meet, so these interfaces are agreed on together and changed only by agreement:

| Contract                                                                             | Between          | Format                                                      |
| ------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------- |
| **Form definition**: fields, types, answer options and their codes             | 1 ↔ 3 ↔ 4 ↔ 2 | FHIR `Questionnaire` in [`packages/form-definitions`](packages/form-definitions/README.md) |
| **Terminology bindings**: which code and ValueSet goes into which FHIR element | 3 ↔ 2           | Mapping table in the repo                                   |
| **Extraction mapping**: which answer becomes which FHIR resource and IPS section | 2 ↔ 1 ↔ 3      | Mapping table in the repo (see [FHIR data model](#fhir-data-model)) |
| **API**: endpoints for creating, updating, fetching and exporting cases, incl. free text | 4 ↔ 2   | OpenAPI spec, generated by FastAPI (see [API](#api))        |
| **Free-text report**: structure and wording of the HIS text                    | 1 ↔ 2           | Template with example output                                |

### Working agreements

- Pull requests that touch another area are **reviewed by that area's owner**. [`.github/CODEOWNERS`](.github/CODEOWNERS) maps each folder to its owners, so GitHub requests the right reviewers automatically.
- The **final presentation** is given by the whole team together. Each person mainly presents their own area.
- The **form definition comes first**: every area depends on it, so areas 1 and 3 define fields *with codes* together, before parallel work starts.
- Architecture decisions (e.g. the storage format) are made by the whole team and recorded as short decision records in `docs/decisions/`.

---

## Architecture

PulseNote is a **prototype**. The stack is kept deliberately simple:

| Layer    | Technology                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | One web app for phone and desktop in **plain HTML, CSS and JavaScript**: no framework, no build step. Offline-capable PWA with a shared login. |
| Backend  | **Python + [FastAPI](https://fastapi.tiangolo.com/)**, run in **Docker**                                                        |
| Storage  | **JSON files** on disk, one file per case (alternatively one single file). No database, since this is only a prototype.        |
| Hosting  | Locally for the presentation, or on a private personal server (see [Hosting](#hosting))                                        |

### FHIR as the shared data model

The FHIR data model is **defined once** in this repository: the `Questionnaire`s (forms), the resources extracted from them, and the ValueSets behind every answer option (see [FHIR data model](#fhir-data-model)). Every part of the system uses this one model:

- **The web apps speak FHIR.** On phones and desktops, the web app creates, updates and fetches FHIR resources on/from the server. There is no internal format to translate, so the web apps and the server are interoperable by design.
- **The server provides an API endpoint for every function** described in this README, including free-text generation. The web apps contain no business logic of their own beyond rendering the forms and keeping local drafts.
- **Other services can use the same API.** The endpoints are not tied to the web apps, so other systems (e.g. an HIS interface or an analytics tool) can create and read cases the same way.
- **FHIR export runs through the API.** Single resources, a full bundle per case or an IPS document can be fetched from the backend.

```mermaid
flowchart LR
    P[Web app on the phone<br/>case form, local drafts] -- FHIR over REST --> API
    D[Web app on the PC<br/>dashboard] <-- FHIR over REST --> API
    O[Other services] <-. FHIR over REST .-> API
    API[FastAPI backend<br/>Docker] <--> S[(JSON files<br/>one per case)]
    API -- export --> X[FHIR bundle / IPS document<br/>free-text report]
```

A dedicated FHIR server (e.g. [HAPI FHIR](https://hapifhir.io/)) was considered as storage. For a prototype it adds too much operational effort (Java server, memory, upgrades). Because the data is FHIR already, it can be added later as a storage or export target without changing the web apps.

Form versioning: each `QuestionnaireResponse` refers to the exact `Questionnaire` version it was filled in with.

### API

Draft. FastAPI generates the full OpenAPI spec at `/api/docs`. Details (validation, versions, storage): [`apps/backend`](apps/backend/README.md).

| Endpoint                         | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `GET /api/cases`                 | List cases                                      |
| `GET /api/cases/{id}`            | Load a case                                     |
| `PUT /api/cases/{id}`            | Create or update a case                         |
| `DELETE /api/cases/{id}`         | Delete a case                                   |
| `GET /api/cases/{id}/text`       | Get the free text _(not implemented yet)_       |
| `GET /api/cases/{id}/export`       | Get the patient FHIR document _(not implemented yet)_ |
| `GET /api/questionnaires[/{id}]` | Get the form definitions                        |

### Repository structure

The project is a single repository (monorepo). Everything that runs and is deployed lives in `apps/`. Data and libraries shared by several apps live in `packages/`.

```
pulsenote/
├── apps/
│   ├── web/                    # web app in HTML, CSS, JS: case form + dashboard (area 4)
│   └── backend/                # FastAPI backend in Docker, incl. docker-compose.yml (area 2)
├── packages/
│   ├── form-definitions/       # FHIR Questionnaires (area 1, codes with area 3)
│   ├── terminology/            # ValueSets, ConceptMaps (area 3)
│   └── fhir-mapping/           # QuestionnaireResponse → FHIR resources, IPS (area 2, used by the API)
├── docs/
│   └── decisions/              # architecture decision records
└── README.md
```

Case data is not part of the repository. The backend writes it as JSON files to a Docker volume that is ignored by git.

---

## FHIR data model

> New to FHIR or the IPS? Start with the [FHIR & IPS guide](docs/fhir-ips-guide.md): the concepts, the field-by-field [mapping table](docs/fhir-ips-guide.md#7-the-mapping-table) and [where to look up codes](docs/fhir-ips-guide.md#where-to-look-things-up). This section is the summary. The mapping table is the detailed, binding version.

PulseNote uses FHIR R4 on two layers: **capture** with `Questionnaire` / `QuestionnaireResponse` (see [guide, section 3](docs/fhir-ips-guide.md#3-forms-questionnaire-and-questionnaireresponse)), and **clinical data** with standard resources (see [guide, section 4](docs/fhir-ips-guide.md#4-clinical-resources)). The output targets (IPS, ISiK, KBV, free text) are described in [`packages/form-definitions`](packages/form-definitions/README.md).

```
Questionnaire                 form definition as data, one per template
     │  filled in by the physician
     ▼
QuestionnaireResponse         raw answers of one case
     │  extraction (FHIR SDC)
     ▼
Encounter · Patient · Observation · Condition ·
AllergyIntolerance · MedicationStatement · Procedure      (IPS-aligned)
     │  depending on the target
     ▼
IPS document · ISiK (HIS in German hospitals) · free-text report
```

- **ED documentation** lives in the extracted resources: an `Encounter` for the ED visit (class `EMER`), plus `Observation`s for vital signs, symptoms and examination findings. This covers everything the form records, including the physical examination.
- **IPS alignment:** Wherever an IPS profile exists (`Patient`, `Condition`, `AllergyIntolerance`, `MedicationStatement`, `Procedure`, results), the extracted resources follow it (see [guide, section 5](docs/fhir-ips-guide.md#5-profiles-and-the-ips-profiles)).
- **IPS document:** For further treatment, e.g. at transfer or discharge, PulseNote can generate an IPS document from the same resources.
- **ISiK:** The German FHIR interface specifications for hospital information systems, published by gematik. A real import into a German HIS would most likely go through ISiK. This is an outlook beyond the course project.

### IPS document

The IPS ([hl7.org/fhir/uv/ips](http://hl7.org/fhir/uv/ips)) is a short, international summary of a person's key health data for further treatment. An IPS document is a `Bundle` of type `document`. Its first entry is a `Composition` with LOINC `60591-5` (*Patient summary Document*). After it come the resources that the Composition's sections reference. The backend returns it at `GET /api/cases/{id}/export` (see [API](#api) and [guide, section 6](docs/fhir-ips-guide.md#6-fhir-documents-and-the-ips-document)).

#### Form content → IPS sections

| Form content                                              | IPS section (LOINC)                      | Resource / profile                                  | Terminology                               |
| --------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Patient demographics                                      | – (`Composition.subject`)             | `Patient` (IPS)                                   | –                                        |
| Chief complaint, current symptoms                         | Problems (`11450-4`), if modelled as `Condition` | `Condition` (IPS) or `Observation` _(open)_ | SNOMED CT                       |
| Allergies                                                 | Allergies and intolerances (`48765-2`) | `AllergyIntolerance` (IPS)                        | SNOMED CT                                 |
| Long-term medication                                      | Medication summary (`10160-0`)         | `MedicationStatement` (IPS), `Medication` (IPS) | SNOMED CT, ATC                            |
| Past medical history                                      | History of past illness (`11348-0`)    | `Condition` (IPS)                                 | SNOMED CT, ICD-10-GM as additional coding |
| Past surgeries                                            | History of procedures (`47519-4`)      | `Procedure` (IPS)                                 | SNOMED CT                                 |
| Vital signs, height, weight                               | Vital signs (`8716-3`)                 | `Observation` (FHIR vital signs profiles)         | LOINC, UCUM                               |
| Lab findings                                              | Results (`30954-2`)                    | `Observation` (IPS results profiles)              | LOINC, SNOMED CT                          |
| Social history (care level, nursing home)                 | Social history (`29762-2`)             | `Observation`                                     | SNOMED CT / LOINC _(to be modelled)_    |

**Required sections:** The IPS requires *Problems*, *Allergies and intolerances* and *Medication summary*. They must be present even when the form has no entries. For that case the IPS defines explicit codes such as "no known allergies" or "no information about medications". The form's "No" answers map to these codes, from the IPS code system *Absent and Unknown Data*.

#### Outside the IPS scope

The IPS summarizes a *person*; it does not document a single visit. These form fields are therefore not part of the IPS document:

- Physical examination findings (heart, lungs, abdomen, extremities, general condition)
- ED context: room, stretcher number, last meal, GP, referring physician, legal guardian, insurance

They are not lost: they live in other extracted resources (`Encounter`, `Observation`, `Patient.generalPractitioner`, `Patient.contact`, `Coverage`) and in the free-text report. The [mapping table](docs/fhir-ips-guide.md#7-the-mapping-table) gives the exact element for each field.

### Vital signs (LOINC + UCUM)

| Measurement                        | LOINC                    | UCUM unit  |
| ---------------------------------- | ------------------------ | ---------- |
| Blood pressure panel               | `85354-9`              | –         |
| ↳ Systolic                        | `8480-6`               | `mm[Hg]` |
| ↳ Diastolic                       | `8462-4`               | `mm[Hg]` |
| Heart rate                         | `8867-4`               | `/min`   |
| Respiratory rate                   | `9279-1`               | `/min`   |
| Oxygen saturation (pulse oximetry) | `2708-6` + `59408-5` | `%`      |
| Body temperature                   | `8310-5`               | `Cel`    |
| Body height                        | `8302-2`               | `cm`     |
| Body weight                        | `29463-7`              | `kg`     |

### Terminologies

| Terminology         | Used for                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **SNOMED CT** | Problems, symptoms, findings, allergies, procedures, medication. Germany has a national license through the BfArM. |
| **LOINC**     | IPS section codes, vital signs, lab results                                                                        |
| **UCUM**      | All units of measure                                                                                               |
| **ICD-10-GM** | Additional coding for diagnoses (German context)                                                                   |
| **ATC**       | Medication classes                                                                                                 |
| **IPS Absent and Unknown Data** | "No known allergies", "no information about medications" and similar, for the required IPS sections |

Every answer option in the `Questionnaire`s is backed by a **ValueSet**, so the form, the extracted resources, the FHIR export and the free-text report all use the same codes. Where to look up each code system: see the [guide](docs/fhir-ips-guide.md#where-to-look-things-up).

---

## Hosting

The prototype is only run for the presentation, either **locally** (`docker compose up`) or on a **private personal server**. It is used with **synthetic patients only**, never with real patient data.

### Outlook: production in a hospital

A real deployment would run **on-premise in the hospital intranet**, so patient data never leaves the hospital network. A cloud would only be an option for development and demos with synthetic data.

|                              | **On-premise (hospital intranet)**                                                  | **Cloud (EU)**                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Approval**                 | ➕ Patient data stays in the hospital network, so approval is much easier           | ➖ Needs data protection officer approval, a data processing agreement (AVV), and possibly a cloud attestation (e.g. BSI C5); German hospital and professional secrecy rules (§ 203 StGB, state hospital laws) may restrict outsourcing |
| **HIS integration**          | ➕ Close to the HIS; direct integration possible later                              | ➖ Needs a secure link into the hospital network                                                                                                                                                                                   |
| **Login**                    | ➕ Can use existing hospital accounts                                               | ➖ Needs a connection to the hospital's directory, or separate accounts                                                                                                                                                            |
| **Access from phones**       | ➖ Needs hospital Wi-Fi and hospital-managed devices                                 | ➕ Reachable over the internet (with strong auth)                                                                                                                                                                                  |
| **Time to first deployment** | ➖ Depends on hospital IT processes and resources                                    | ➕ Fast; managed database, backups, TLS                                                                                                                                                                                            |
| **Operations & updates**     | ➖ Per-site installation and updates                                                 | ➕ Central; one deployment for all users                                                                                                                                                                                           |
| **Scalability / multi-site** | ➖ Every site runs its own instance                                                   | ➕ Easy to serve several hospitals                                                                                                                                                                                                 |
| **Costs**                    | ➖ Hardware and IT staff time at the hospital                                        | ➖ Ongoing hosting costs                                                                                                                                                                                                           |

**Conditions for on-premise operation:**

- Run officially by the hospital IT, not as a privately operated server in the hospital network
- Listed in the hospital's record of processing activities, with a data protection impact assessment (DPIA)
- Used on hospital-managed devices (MDM) with device encryption and screen lock; only unsent drafts are stored on the phone, temporarily
- JSON file storage replaced by a proper database or FHIR server

---

## Data protection & security

PulseNote processes health data, a special category under Art. 9 GDPR. The legal basis is treatment by the treating physicians (Art. 9(2)(h) GDPR together with state hospital law).

**Principles:**

- **The HIS remains the patient record.** PulseNote is a temporary store. A case is deleted after a defined retention period once it has been transferred to the HIS.
- **In production: on-premise operation** by the hospital IT (see [Hosting](#hosting)). The prototype runs locally or on a private server with synthetic data only.
- **Only unsent drafts on the device, temporarily** (see [Offline use & local drafts](#offline-use--local-drafts)):
  - A draft is deleted from the phone as soon as the server confirms receipt.
  - Unsent drafts expire after a fixed time (e.g. 12–24 hours, about one shift); the app warns before that.
  - Drafts are tied to the signed-in user and deleted on sign-out. Another person on the same device never sees them.
  - Sent cases are loaded from the server and never cached on the phone.
  - Most of the protection comes from the hospital-managed device (encryption, screen lock). Extra encryption in the browser adds little, since the key would sit on the same device.
- **Analytics** only on pseudonymized or aggregated data, since the treatment basis does not cover statistics by itself
- **Course project:** synthetic patients only, never real patient data

**Technical requirements (for production):**

- Login with hospital accounts and role-based access control
- Encryption in transit (TLS) and at rest
- Audit logging of access and changes
- No patient data in URLs or logs

---

## Roadmap

- [X] Local prototype with General, Surgery and Respiratory templates
- [X] Decide architecture: FHIR as the shared data model, FastAPI backend in Docker, JSON file storage, plain HTML/CSS/JS web app
- [ ] First form definition as FHIR `Questionnaire` (`ed-general`), with codes
- [ ] Data protection concept for on-premise operation (DPIA, retention period)
- [ ] Authentication and user management
- [ ] FastAPI backend with case endpoints (create, update, fetch) and Docker setup
- [ ] Case form with three steps, sending to the backend
- [ ] Local drafts with autosave and offline use (PWA)
- [ ] Case list on the phone (drafts and sent cases)
- [ ] Dashboard with case view and editing
- [ ] Free-text generation endpoint and export in the dashboard
- [ ] Extraction from `QuestionnaireResponse` to IPS-aligned FHIR resources
- [ ] FHIR export in the dashboard, including an IPS document validated against the IPS implementation guide
- [ ] More specialty templates (orthopedics, neurology, pediatrics, …)
- [ ] Analytics with direct access to the backend (e.g. case volumes, symptom distribution, documentation completeness)
- [ ] Outlook: ISiK interface to the HIS; other settings (ward round, practice)

---

## Open questions

- **Authentication:** How do we connect to the hospital accounts (Active Directory / LDAP, or OIDC, e.g. via Keycloak)?
- **Patient identification:** How are cases linked to the HIS (case number, patient ID, barcode scan)?
- **Retention period:** How long does a case stay in PulseNote after it has been transferred to the HIS?
- **Draft expiry:** Do unsent drafts expire after 12 or 24 hours?
- **Sign-off & history:** Saved cases can be edited on the PC. Is there a final sign-off after which a case is locked, and do we need a version history of edits?
- **Language:** German only, or multilingual forms?
- **IPS in the grading:** Does the course accept IPS-aligned resources plus an optional IPS document, or does it expect the IPS document as the main output? To be confirmed with the course instructors.
- **Form renderer:** Build our own `Questionnaire` renderer, or use an existing one such as Smart Forms?

---

## Getting started

The backend runs with Docker from `apps/backend` (see [its README](apps/backend/README.md)):

```bash
cd apps/backend
docker compose up -d --build
```

Then open <http://localhost:8014/> (form preview, until the web app exists) and <http://localhost:8014/api/docs> (API).

## License

_To be decided._

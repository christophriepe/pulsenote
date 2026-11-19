# FHIR & IPS guide

The FHIR and IPS concepts PulseNote is built on, explained from the ground up and how they connect. Read it top to bottom: each section builds on the previous one.

For the project itself, see the [root README](../README.md), in particular [FHIR data model](../README.md#fhir-data-model).

> **Note on the examples:** The JSON snippets are shortened for readability and would not pass the FHIR validator as they are. The SNOMED CT codes are unverified. Check them in a SNOMED CT browser before using them.

## Contents

1. [The big picture](#1-the-big-picture)
2. [Resources and Bundles](#2-resources-and-bundles)
3. [Forms: `Questionnaire` and `QuestionnaireResponse`](#3-forms-questionnaire-and-questionnaireresponse)
4. [Clinical resources](#4-clinical-resources)
5. [Profiles and the IPS profiles](#5-profiles-and-the-ips-profiles)
6. [FHIR documents and the IPS document](#6-fhir-documents-and-the-ips-document)
7. [The mapping table](#7-the-mapping-table)
8. [Work plan](#8-work-plan)

---

## 1. The big picture

```
Questionnaire "ed-general"      the blank form
        │ physician fills it in
        ▼
QuestionnaireResponse           the answers of one case
        │ our backend extracts
        ▼
Patient, Encounter, Observation, Condition, AllergyIntolerance …   following the IPS profiles
        │ packed into a document, sorted into sections
        ▼
IPS document (Bundle)           summary for further treatment, checked by the validator
```

Every box is a FHIR resource. The sections below explain them one by one.

---

## 2. Resources and Bundles

A **resource** is the basic unit of FHIR: one JSON object with a `resourceType`, such as `Patient`, `Observation` or `Questionnaire`. FHIR R4 defines about 150 resource types, each with fixed fields.

A **`Bundle`** is a resource that packs several resources together. Its `type` says what the package is for:

| `Bundle.type` | Use                                                                           |
| ------------- | ----------------------------------------------------------------------------- |
| `document`    | a self-contained clinical document, e.g. **the IPS** (see [section 6](#6-fhir-documents-and-the-ips-document)) |
| `collection`  | just a set of resources with no special meaning, e.g. "all extracted resources of one case" |
| `transaction` | "store all of these on the server, all or nothing"                            |
| `searchset`   | the result of a search on a FHIR server                                       |

---

## 3. Forms: `Questionnaire` and `QuestionnaireResponse`

A **`Questionnaire`** is a resource that **describes a form**: its questions, their order, answer types, allowed answers and which ones are required. It holds no patient data. It is the blank form.

**`ed-general`** is the name of our first `Questionnaire`: *ed* for emergency department, *general* for the General template (internal medicine patients). It lives in `packages/form-definitions/questionnaires/ed-general.json`. `ed-surgery` and `ed-respiratory` follow later. The name is ours, not a FHIR term.

```json
{
  "resourceType": "Questionnaire",
  "url": "https://pulsenote.example/Questionnaire/ed-general",
  "version": "0.1",
  "status": "draft",
  "item": [
    {
      "linkId": "chest-pain",
      "text": "Chest pain?",
      "type": "boolean",
      "code": [{ "system": "http://snomed.info/sct", "code": "29857009", "display": "Chest pain" }]
    }
  ]
}
```

When a physician fills in the form, the answers are stored in a **`QuestionnaireResponse`**. It points to the exact `Questionnaire` version it answers:

```json
{
  "resourceType": "QuestionnaireResponse",
  "questionnaire": "https://pulsenote.example/Questionnaire/ed-general|0.1",
  "status": "completed",
  "item": [{ "linkId": "chest-pain", "answer": [{ "valueBoolean": true }] }]
}
```

The `Questionnaire` is the blank form, the `QuestionnaireResponse` is the filled-in form. Because forms are defined this way, a new form is a new JSON file, not new code.

---

## 4. Clinical resources

A `QuestionnaireResponse` is hard to reuse: to find "all patients with systolic BP above 180", a system would have to understand every form. So the backend **extracts** the answers into standard clinical resources that every FHIR system understands:

| Resource              | Holds                                            |
| --------------------- | ------------------------------------------------ |
| `Patient`             | demographics                                     |
| `Encounter`           | the ED visit itself (class `EMER`), location, time |
| `Observation`         | vital signs, symptoms, examination findings, lab results |
| `Condition`           | diagnoses, past illnesses, current problems      |
| `AllergyIntolerance`  | allergies                                        |
| `MedicationStatement` | long-term medication                             |
| `Procedure`           | past surgeries                                   |

The assignment requires at least `Patient`, `Observation`, and `Condition` or `Procedure`.

---

## 5. Profiles and the IPS profiles

Plain FHIR resources are very open: almost every field is optional and any code system is allowed. A **profile** is a set of extra rules on top of a resource, for example "this field is mandatory" or "codes must come from SNOMED CT".

The **IPS (International Patient Summary)** is an HL7 implementation guide (also ISO 27269) and defines such profiles, for example:

- **Patient (IPS):** name, date of birth and sex are required
- **Condition (IPS):** must reference a patient and must have a code, from SNOMED CT where possible
- **AllergyIntolerance (IPS):** the substance must be coded; "no known allergies" has a fixed code

**IPS-aligned** means our extracted resources follow these profiles. Each resource declares this in `meta.profile`, and a validator can check it:

```json
{
  "resourceType": "AllergyIntolerance",
  "meta": { "profile": ["http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips"] },
  "patient": { "reference": "Patient/p1" },
  "code": { "coding": [{ "system": "http://snomed.info/sct", "code": "764146007", "display": "Penicillin" }] }
}
```

The IPS defines no profile for `Questionnaire` or `QuestionnaireResponse`. Alignment happens in the extracted resources, not in the form itself. The form still has to carry the right codes, so that extraction can produce conformant resources.

---

## 6. FHIR documents and the IPS document

### FHIR documents

The FHIR specification defines a **document** as:

- a **`Bundle` with `type = "document"`**
- whose **first entry is a `Composition`**: what kind of document it is, who it is about, who wrote it, when, and its sections
- followed by **all the resources the Composition refers to**, so the document is **self-contained**: it can be sent, stored or archived as a single JSON file and still makes sense without the server it came from
- treated as a **fixed snapshot**: once issued, it is not edited in place. A correction is a new document.

### The IPS document

An **IPS document** is a FHIR document that follows the IPS rules: its own Bundle profile (`Bundle-uv-ips`), a `Composition` with type LOINC `60591-5` (*Patient summary Document*), the required sections, and the IPS profiles for the resources inside.

> **FHIR document** = Bundle of type `document` with a Composition first (general FHIR concept)
> **IPS document** = a FHIR document that follows the IPS rules

Other FHIR documents work the same way with different rules, such as a discharge letter or the German eArztbrief (doctor's letter).

The IPS summarizes a *person*, not a single visit. ED-specific content such as the physical examination has no place in it.

### IPS sections

An IPS document is organized into **sections**, like chapters, each identified by a LOINC code:

| Section                                                            | LOINC     | Required |
| ------------------------------------------------------------------ | --------- | -------- |
| Problems                                                           | `11450-4` | yes      |
| Allergies and intolerances                                         | `48765-2` | yes      |
| Medication summary                                                 | `10160-0` | yes      |
| Past illnesses, procedures, vital signs, results, social history … | various   | optional |

Required sections must be present even when there is nothing to report. The IPS defines explicit codes for that, such as "no known allergies".

### Example

```json
{
  "resourceType": "Bundle",
  "type": "document",
  "entry": [
    { "resource": {
        "resourceType": "Composition",
        "type": { "coding": [{ "system": "http://loinc.org", "code": "60591-5" }] },
        "subject": { "reference": "Patient/p1" },
        "section": [
          { "title": "Allergies",
            "code": { "coding": [{ "system": "http://loinc.org", "code": "48765-2" }] },
            "entry": [{ "reference": "AllergyIntolerance/a1" }] }
        ]
    }},
    { "resource": { "resourceType": "Patient", "id": "p1" } },
    { "resource": { "resourceType": "AllergyIntolerance", "id": "a1" } }
  ]
}
```

A real IPS document also needs `identifier`, `timestamp`, `Composition.author`, `Composition.title` and `fullUrl` references.

### What PulseNote returns

In the draft API (see [API](../README.md#api)):

- `GET /cases/{id}/fhir` returns the **patient FHIR document**: a **`document`** Bundle, the IPS, with only what belongs in a patient summary.
- Should the full case, including the physical exam, be needed as FHIR later, a **`collection`** Bundle is the fitting type.

---

## 7. The mapping table

### What it is for

The mapping table lists **every field of the form and where it ends up in FHIR**, with one row per field. It is the team's single source of truth for the data model:

- **It is a required deliverable.** The assignment asks for "data model and resource mapping". This table is that mapping, and it backs the two highest-weighted team criteria: FHIR / IPS modelling (20%) and terminologies (15%).
- **It is where the decisions get made.** Is a symptom an `Observation` or a `Condition`? How do we record "no chest pain"? How do we fill the required IPS sections when the answer is "no known allergies"? Each row forces an answer.
- **Everything else is derived from it:**

```
Mapping table
  ├─▶ Questionnaire (ed-general.json)   item codes and answer options
  ├─▶ ValueSets                         one per answer list
  ├─▶ Extraction code (backend)         which answer becomes which resource
  ├─▶ JSON examples                     one synthetic patient, fully coded
  ├─▶ IPS document                      which resource goes into which section
  └─▶ Free-text report                  field order and labels
```

- **It joins the three areas.** Medicine says *which fields*, terminology says *which codes*, and the backend says *which FHIR element*. Every row needs all three.

### Columns

| Column               | Example                            | Owner          |
| -------------------- | ---------------------------------- | -------------- |
| Form step            | Examination                        | Medical        |
| Field (`linkId`)     | `bp-systolic`                      | Medical        |
| Question text        | Systolic blood pressure            | Medical        |
| Answer type          | decimal / boolean / choice / text  | Medical        |
| FHIR resource.element | `Observation.component.valueQuantity` | Backend     |
| Code system + code   | LOINC `8480-6`                     | Terminology    |
| Unit (UCUM)          | `mm[Hg]`                           | Terminology    |
| ValueSet             | – / `vs-allergies`                 | Terminology    |
| IPS section / profile | Vital signs / Observation (vital signs) | Backend   |
| Open questions       | Panel with diastolic?              | anyone         |

### Draft for `ed-general`

A starting point: one row per field from the case form in the [README](../README.md#case-form-optimized-for-phones). Copy it into the shared sheet.

- **LOINC codes and UCUM units** for vital signs and IPS sections are standard and can be used as they are.
- **SNOMED CT codes** are not filled in yet. Each needs a lookup (see [Where to look things up](#where-to-look-things-up)).
- **"?"** marks a modelling decision the team still has to make.

**Step 1: Patient**

| Field            | FHIR resource.element                         | Code system + code                         | Unit  | ValueSet / binding                 | IPS section                      | Open questions |
| ---------------- | --------------------------------------------- | ------------------------------------------ | ----- | ---------------------------------- | -------------------------------- | -------------- |
| Sex              | `Patient.gender`                              | FHIR `AdministrativeGender`                | –     | `administrative-gender` (required) | – (`Patient`, IPS profile)       | German "divers" → `other`? |
| Name             | `Patient.name`                                | –                                          | –     | –                                  | – (`Patient`, IPS profile)       | Synthetic names only |
| Date of birth    | `Patient.birthDate`                           | –                                          | –     | –                                  | – (`Patient`, IPS profile)       | |
| Height           | `Observation.valueQuantity`                   | LOINC `8302-2`                             | `cm`  | –                                  | Vital signs (`8716-3`)           | |
| Weight           | `Observation.valueQuantity`                   | LOINC `29463-7`                            | `kg`  | –                                  | Vital signs (`8716-3`)           | |
| BMI (calculated) | `Observation.valueQuantity`                   | LOINC `39156-5`                            | `kg/m2` | –                                | Vital signs (`8716-3`)           | Calculate in form or backend? |
| Room, stretcher  | `Encounter.location` → `Location`             | –                                          | –     | –                                  | – (not in the IPS)               | |

**Step 2: History**

| Field                    | FHIR resource.element                          | Code system + code              | Unit | ValueSet / binding        | IPS section                          | Open questions |
| ------------------------ | ---------------------------------------------- | ------------------------------- | ---- | ------------------------- | ------------------------------------ | -------------- |
| Chief complaint          | `Encounter.reasonCode` and/or `Condition.code` | SNOMED CT (look up)             | –    | `vs-chief-complaint`      | Problems (`11450-4`) if `Condition`  | Free text or coded list? |
| Symptoms (chest pain, dyspnea, palpitations, syncope, …), present | `Observation.code` + `valueBoolean`, or `Condition` | SNOMED CT (look up) | – | `vs-symptoms` | Problems (`11450-4`) if `Condition` | **`Observation` or `Condition`?** |
| Symptom absent ("no chest pain") | `Observation` recording the absence    | SNOMED CT (look up)             | –    | `vs-symptoms`             | – (not in the IPS)                   | How to code negatives? |
| Allergies                | `AllergyIntolerance.code`                      | SNOMED CT substance (look up)   | –    | `vs-allergies`            | Allergies (`48765-2`, required)      | |
| No known allergies       | `AllergyIntolerance.code`                      | IPS absent/unknown code (look up) | –  | IPS absent/unknown        | Allergies (`48765-2`, required)      | |
| Past medical history     | `Condition.code`, clinical status inactive/resolved | SNOMED CT (look up), ICD-10-GM as additional coding | – | `vs-conditions` | History of past illness (`11348-0`) | Which `clinicalStatus`? |
| Past surgeries           | `Procedure.code`                               | SNOMED CT (look up)             | –    | `vs-procedures`           | History of procedures (`47519-4`)    | |
| Long-term medication     | `MedicationStatement` + `Medication.code`      | SNOMED CT or ATC (look up)      | –    | `vs-medications`          | Medication summary (`10160-0`, required) | Dose as text or structured? |
| No long-term medication  | `MedicationStatement`                          | IPS absent/unknown code (look up) | –  | IPS absent/unknown        | Medication summary (`10160-0`, required) | |
| Last meal                | `Observation.valueDateTime`                    | LOINC or SNOMED CT (look up)    | –    | –                         | – (not in the IPS)                   | |
| GP                       | `Patient.generalPractitioner` → `Practitioner` | –                               | –    | –                         | – (not in the IPS)                   | |
| Referring physician      | `Encounter` (referral) → `Practitioner`        | –                               | –    | –                         | – (not in the IPS)                   | Which element? |
| Care level (Pflegegrad)  | `Observation.valueCodeableConcept`             | German code system (look up)    | –    | `vs-care-level`           | Social history (`29762-2`)           | Which code system? |
| Legal guardian           | `Patient.contact` or `RelatedPerson`           | FHIR relationship code          | –    | `patient-contactrelationship` | – (not in the IPS)               | |
| Nursing home             | `Observation` (living situation)               | SNOMED CT (look up)             | –    | `vs-living-situation`     | Social history (`29762-2`)           | |
| Insurance                | `Coverage`                                     | –                               | –    | –                         | – (not in the IPS)                   | Needed for the prototype? |

**Step 3: Examination**

| Field                       | FHIR resource.element                       | Code system + code                     | Unit     | ValueSet / binding  | IPS section                 | Open questions |
| --------------------------- | ------------------------------------------- | -------------------------------------- | -------- | ------------------- | --------------------------- | -------------- |
| Blood pressure              | `Observation`, panel                        | LOINC `85354-9`                        | –        | –                   | Vital signs (`8716-3`)      | |
| ↳ Systolic                  | `Observation.component.valueQuantity`       | LOINC `8480-6`                         | `mm[Hg]` | –                   | Vital signs (`8716-3`)      | |
| ↳ Diastolic                 | `Observation.component.valueQuantity`       | LOINC `8462-4`                         | `mm[Hg]` | –                   | Vital signs (`8716-3`)      | |
| Heart rate                  | `Observation.valueQuantity`                 | LOINC `8867-4`                         | `/min`   | –                   | Vital signs (`8716-3`)      | |
| SpO₂                        | `Observation.valueQuantity`                 | LOINC `2708-6` + `59408-5`             | `%`      | –                   | Vital signs (`8716-3`)      | |
| Temperature                 | `Observation.valueQuantity`                 | LOINC `8310-5`                         | `Cel`    | –                   | Vital signs (`8716-3`)      | |
| Respiratory rate            | `Observation.valueQuantity`                 | LOINC `9279-1`                         | `/min`   | –                   | Vital signs (`8716-3`)      | |
| Lab findings                | `Observation` (category `laboratory`)       | LOINC per test (look up)               | UCUM per test | –              | Results (`30954-2`)         | Which tests in the prototype? |
| General condition           | `Observation.valueCodeableConcept`          | SNOMED CT (look up)                    | –        | `vs-general-condition` | – (not in the IPS)       | |
| Nutritional condition       | `Observation.valueCodeableConcept`          | SNOMED CT (look up)                    | –        | `vs-nutritional-condition` | – (not in the IPS)   | |
| Heart, lungs, abdomen, extremities | `Observation` (category `exam`), one per body system | SNOMED CT (look up)         | –        | one ValueSet per body system | – (not in the IPS) | Coded findings or free text? |
| Other findings              | `Observation.valueString`                   | –                                      | –        | –                   | – (not in the IPS)          | |

### Where to look things up

| What                                   | Where                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FHIR R4 resources and elements         | [hl7.org/fhir/R4](https://hl7.org/fhir/R4/resourcelist.html): every resource with its fields            |
| IPS profiles and sections              | [IPS implementation guide](https://hl7.org/fhir/uv/ips/): "Artifacts" lists all profiles; the Composition profile lists the sections and their LOINC codes |
| IPS absent/unknown codes               | IPS implementation guide, CodeSystem *Absent and Unknown Data* (e.g. no known allergies, no medication information) |
| Vital signs profiles                   | [FHIR R4 vital signs](https://hl7.org/fhir/R4/observation-vitalsigns.html): required LOINC codes and units |
| Forms and extraction                   | [SDC implementation guide](https://hl7.org/fhir/uv/sdc/): `Questionnaire` features and extraction        |
| SNOMED CT codes                        | [SNOMED CT browser](https://browser.ihtsdotools.org/): search a term, use the concept ID. Germany is licensed through the BfArM. |
| LOINC codes                            | [LOINC search](https://loinc.org/search/): free account required                                       |
| UCUM units                             | [UCUM](https://ucum.org/): the official unit syntax (e.g. `mm[Hg]`, `Cel`, `/min`)                      |
| ICD-10-GM, ATC                         | [BfArM](https://www.bfarm.de/): German classifications                                                  |
| Check a code or a whole resource       | [HL7 FHIR validator](https://github.com/hapifhir/org.hl7.fhir.core/releases) (`validator_cli.jar`), run with the IPS implementation guide loaded |

### Where it lives

Working on it together in a **Google Sheet** works well while the table changes daily. Two things to keep in mind:

- **The grade looks at traceable work in the repository.** Export the sheet as CSV to `docs/mapping/ed-general.csv` regularly, at least at every milestone. That gives the history and the evidence for the contribution statements.
- **The sheet is the master until the form is stable.** After that, the CSV in the repo is the master and changes go through pull requests like everything else. Otherwise the sheet, the `Questionnaire` and the extraction code drift apart.

---

## 8. Work plan

1. **Cut the scope to one form, `ed-general`, and freeze its fields.** The step table in the README (Patient → History → Examination) is the starting list. About 20–30 well-coded fields beat 80 rough ones.
2. **Fill in the [mapping table](#7-the-mapping-table).** This is the core deliverable, and everything below depends on it.
3. **Write small ValueSets** for the answer lists: symptoms, allergies, examination findings, perhaps care level. A handful of codes each is enough.
4. **Write coded JSON examples for one synthetic patient:** `Patient`, `Encounter` (class `EMER`), `Observation`s for vitals and findings, `Condition`, `AllergyIntolerance`, `MedicationStatement`, `Procedure`, and an **IPS document** built from them. **Validate** them against the IPS implementation guide with the official HL7 FHIR validator. "Validated against IPS" is the strongest evidence of IPS alignment.
5. **Write the `Questionnaire`** (`ed-general.json`) with the codes from the mapping table.
6. **Build a minimal prototype.** A demo path that fits in 5 minutes:
   1. Fill in the form on a phone.
   2. The case appears on the PC.
   3. Show the coded FHIR JSON and the IPS document.
   4. Generate the free-text report.

   This needs the form, the endpoints from the [API](../README.md#api) table, and JSON file storage. Login, offline mode and analytics are optional extras.
7. **Write the short project documentation,** mostly distilled from the README. Include security, ethics and equity, e.g. language (German or English) and personal versus hospital phones.
8. **Optional but cheap:** have a physician try the prototype and write down the feedback. That covers the *test* step of Design Thinking.

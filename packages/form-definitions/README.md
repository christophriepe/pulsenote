# packages/form-definitions

The shared form definitions: which fields each template (General, Surgery, Respiratory, …) has, their types, answer options and the code behind each answer option. They are stored as **FHIR `Questionnaire`** resources.

Used by the web app (rendering and validation) and by the backend (storage, extraction and export). This is the first contract the team agrees on.

**Owner:** Area 1 (clinical content). The codes are added together with area 3.

---

## Forms as data, not code

Each form is a FHIR `Questionnaire`, stored as a JSON file. The web app renders any `Questionnaire` generically. It does not contain a hard-coded React component per form.

A new form is therefore a new JSON file, not new code. That matters beyond the ED: the same approach works for a ward round, a GP practice or another specialty.

## Data flow

```
Questionnaire                 form definition, one per template (this package)
     │  filled in by the physician (apps/web)
     ▼
QuestionnaireResponse         raw answers of one case, including the form version
     │  extraction (FHIR SDC)
     ▼
Encounter · Patient · Observation · Condition ·
AllergyIntolerance · MedicationStatement · Procedure
     │  depending on the target
     ▼
IPS document · ISiK (HIS in German hospitals) · KBV profiles (practices) · free-text report
```

## Two layers

Both layers are needed. They answer different questions:

| Layer             | FHIR                                       | Answers                                                                 |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| **Capture**       | `Questionnaire` / `QuestionnaireResponse`  | *How* is data collected? Which fields, in which order, under which conditions? |
| **Clinical data** | `Encounter`, `Observation`, `Condition`, … | *What* has been documented medically?                                   |

A `QuestionnaireResponse` on its own is hard to reuse. A question like "all patients with systolic BP above 180" would have to understand every form separately. Extraction turns the answers into standard resources that can be searched, exported and analyzed the same way regardless of which form produced them.

## What `Questionnaire` provides

FHIR R4 and the Structured Data Capture (SDC) implementation guide already cover most of what the forms need:

| Need                                         | FHIR / SDC feature                                                    |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Answer options with codes                    | `answerOption` or `answerValueSet`, bound to ValueSets from `packages/terminology` |
| Show a question only if another is answered  | `enableWhen` (e.g. details only if "chest pain = yes")                |
| Required fields, repeating groups            | `required`, `repeats`, `group` items                                  |
| Calculated fields (e.g. BMI)                 | SDC `calculatedExpression`                                            |
| Link an item to a clinical code              | `item.code` (SNOMED CT, LOINC)                                        |
| Turn answers into resources                  | SDC extraction: observation-based (`item.code`), definition-based (`item.definition`) or StructureMap-based |

## Extraction: from answers to resources

Which answer becomes which FHIR resource, with which code, is defined field by field in the [mapping table](../../docs/fhir-ips-guide.md#7-the-mapping-table) of the FHIR & IPS guide.

Modelling negative findings cleanly is one of the most demanding parts of this project, and a good place to show terminology and modelling skills.

## The setting lives in the `Encounter`

Below the `Encounter`, vital signs, allergies and medication are modelled the same way in every setting. Only the `Encounter` and the `Questionnaire` change:

| Setting                  | `Encounter.class` | Example `Questionnaire`   |
| ------------------------ | ----------------- | ------------------------- |
| Emergency department     | `EMER`            | `ed-general`              |
| Ward round               | `IMP`             | `ward-round` _(outlook)_  |
| GP / specialist practice | `AMB`             | `practice-visit` _(outlook)_ |

## Output targets

### IPS (International Patient Summary)

An HL7 FHIR implementation guide (also ISO 27269) for a short, international summary of a person's key health data: problems, allergies and medication (required), plus results, procedures, vital signs and more. It is meant for further treatment, e.g. after transfer, at discharge or abroad.

The IPS is a *summary of the person*, not documentation of one visit, so ED-specific content such as the physical examination has no place in it. PulseNote therefore:

- builds its extracted resources on the IPS profiles wherever they fit (`Condition`, `AllergyIntolerance`, `MedicationStatement`, …), so they are **IPS-aligned**
- can generate an IPS document from them for further treatment

### ISiK (Informationstechnische Systeme in Krankenhäusern)

German FHIR specifications published by gematik on a legal mandate (SGB V). They define the FHIR interfaces that hospital information systems in Germany must offer. Vendors have to get their ISiK conformance confirmed.

- **IPS** is a *document* for further treatment, international.
- **ISiK** is an *interface* inside a German hospital, through which other systems can read data from the HIS and, depending on the module, write to it.

ISiK is split into modules, e.g. Basis (patient, encounter, diagnoses, procedures, coverage), vital signs and body measurements, medication, document exchange and scheduling. Work on a forms module based on `Questionnaire` may also be under way; check the current status.

A real path *into* a German hospital's HIS would most likely go through ISiK, not the IPS.

### KBV profiles (practices)

ISiK does not apply to doctors' practices. There, the FHIR profiles of the KBV, such as the Medical Information Objects (MIO), are the relevant specifications. This is an outlook for a later practice version.

### Free-text report

Generated from the extracted data for copy-and-paste into the HIS. Structure and wording are owned by area 1.

## Versioning

Definitions are **versioned** (`Questionnaire.version`). Each `QuestionnaireResponse` refers to the exact version it was filled in with (`questionnaire = <url>|<version>`). Drafts written offline may be sent after an app update, so the backend accepts older versions.

## Tools worth evaluating

- [Smart Forms](https://github.com/aehrc/smart-forms) (CSIRO): a `Questionnaire` renderer built in React, with SDC support. It is useful at least as a reference for what our own renderer needs to handle.
- LHC-Forms (U.S. National Library of Medicine): another widely used `Questionnaire` renderer.

## Scope for the course project

- **Build:** one `Questionnaire` (`ed-general`) end to end: rendering, `QuestionnaireResponse`, extraction, IPS-aligned resources, free-text report.
- **Outlook only:** further ED templates, the ward round and practice settings, ISiK and KBV. These belong in the presentation as "the same principle works for …", not in the prototype.

## Suggested layout

```
packages/form-definitions/
├── questionnaires/
│   ├── ed-general.json
│   ├── ed-surgery.json
│   └── ed-respiratory.json
└── README.md
```

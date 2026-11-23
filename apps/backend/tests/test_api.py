import copy

import pytest

CASE_ID = "3f2a9c1e-0b7d-4e1a-9a52-6c1d2e8f4b10"
TEST_FORM = "https://pulsenote.example/Questionnaire/test-form|1.0"


def option(form, link_id, code):
    """The answerOption coding with this code, taken from the Questionnaire itself."""
    def find(items):
        for it in items:
            if it["linkId"] == link_id:
                return it
            if found := find(it.get("item", [])):
                return found
    return next(o["valueCoding"] for o in find(form["item"])["answerOption"] if o["valueCoding"]["code"] == code)


@pytest.fixture
def surgery_case(ed_surgery):
    """Shaped like the QuestionnaireResponse that preview.html builds (no id)."""
    return {
        "resourceType": "QuestionnaireResponse",
        "questionnaire": f"{ed_surgery['url']}|{ed_surgery['version']}",
        "status": "in-progress",
        "authored": "2026-11-23T14:30:00Z",
        "item": [
            {"linkId": "patient", "text": "Patient:in", "item": [
                {"linkId": "patient-sex", "answer": [{"valueCoding": option(ed_surgery, "patient-sex", "female")}]},
                {"linkId": "patient-family-name", "answer": [{"valueString": "Muster"}]},
                {"linkId": "patient-birth-date", "answer": [{"valueDate": "1950-04-01"}]},
                {"linkId": "clinical-data", "item": [
                    {"linkId": "body-height", "answer": [{"valueDecimal": 168.5}]},
                ]},
            ]},
            {"linkId": "history", "item": [
                {"linkId": "chief-complaint-group", "item": [
                    {"linkId": "pain", "answer": [{"valueBoolean": True}]},
                    {"linkId": "pain-nrs", "answer": [{"valueInteger": 7}]},
                ]},
                {"linkId": "vegetative-history", "item": [
                    {"linkId": "bowel-movement", "answer": [
                        {"valueCoding": option(ed_surgery, "bowel-movement", "62315008")},
                        {"valueCoding": option(ed_surgery, "bowel-movement", "14760008")},
                    ]},
                ]},
            ]},
            {"linkId": "examination", "item": [
                {"linkId": "lab", "item": [
                    {"linkId": "lab-performed", "answer": [{"valueBoolean": True}]},
                    {"linkId": "lab-findings", "answer": [
                        {"valueCoding": option(ed_surgery, "lab-findings", "lab-inflammation-raised")},
                        {"valueString": "CRP 12 mg/l"},
                    ]},
                ]},
            ]},
        ],
    }


def diagnostics(response):
    assert response.json()["resourceType"] == "OperationOutcome"
    return " | ".join(i["diagnostics"] for i in response.json()["issue"])


def test_preview_served(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "QuestionnaireResponse" in r.text


def test_questionnaires(client):
    r = client.get("/api/questionnaires")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/fhir+json")
    assert {e["resource"]["id"] for e in r.json()["entry"]} == {"ed-surgery", "test-form"}
    assert client.get("/api/questionnaires/ed-surgery").json()["id"] == "ed-surgery"
    assert client.get("/api/questionnaires/ed-surgery?version=9.9").status_code == 404


def test_case_lifecycle(client, surgery_case):
    r = client.put(f"/api/cases/{CASE_ID}", json=surgery_case)
    assert r.status_code == 201, r.text
    assert r.json()["id"] == CASE_ID
    assert r.json()["meta"]["versionId"] == "1"
    assert r.headers["location"].endswith(f"/api/cases/{CASE_ID}")

    # resending (e.g. after a dropped connection) updates instead of duplicating
    r = client.put(f"/api/cases/{CASE_ID}", json={**surgery_case, "id": CASE_ID, "status": "completed"})
    assert r.status_code == 200, r.text
    assert r.json()["meta"]["versionId"] == "2"
    assert r.headers["etag"] == 'W/"2"'

    r = client.get(f"/api/cases/{CASE_ID}")
    assert r.json()["status"] == "completed"
    assert r.json()["item"] == surgery_case["item"]

    bundle = client.get("/api/cases").json()
    assert bundle["type"] == "searchset" and bundle["total"] == 1
    assert bundle["entry"][0]["fullUrl"].endswith(f"/api/cases/{CASE_ID}")
    assert client.get("/api/cases?status=in-progress").json()["total"] == 0
    assert client.get("/api/cases", params={"questionnaire": surgery_case["questionnaire"].split("|")[0]}).json()["total"] == 1

    assert client.get(f"/api/cases/{CASE_ID}/text").status_code == 501
    assert client.get(f"/api/cases/{CASE_ID}/export").status_code == 501

    assert client.delete(f"/api/cases/{CASE_ID}").status_code == 204
    r = client.get(f"/api/cases/{CASE_ID}")
    assert r.status_code == 404
    assert "not found" in diagnostics(r)
    assert client.delete(f"/api/cases/{CASE_ID}").status_code == 404
    assert client.get(f"/api/cases/{CASE_ID}/text").status_code == 404


def test_fhir_content_type_accepted(client, surgery_case):
    import json
    r = client.put(f"/api/cases/{CASE_ID}", content=json.dumps(surgery_case),
                   headers={"Content-Type": "application/fhir+json"})
    assert r.status_code == 201, r.text


@pytest.mark.parametrize("case_id", ["../etc", "a" * 65, "with space"])
def test_invalid_case_id(client, surgery_case, case_id):
    assert client.put(f"/api/cases/{case_id}", json=surgery_case).status_code in (404, 422)


def test_id_mismatch(client, surgery_case):
    r = client.put(f"/api/cases/{CASE_ID}", json={**surgery_case, "id": "other"})
    assert r.status_code == 400


def mutate(case, fn):
    case = copy.deepcopy(case)
    fn(case)
    return case


def set_answer(path, answer):
    """Replace the answer of the item at a list of indexes into nested item lists."""
    def fn(case):
        node = case
        for i in path:
            node = node["item"][i]
        node["answer"] = answer
    return fn


@pytest.mark.parametrize("change, expected", [
    (lambda c: c.update(status="bogus"), "status must be one of"),
    (lambda c: c.update(questionnaire=c["questionnaire"].split("|")[0]), "url|version"),
    (lambda c: c.update(questionnaire="https://x.example/Questionnaire/nope|1"), "Unknown Questionnaire"),
    (lambda c: c.update(authored="yesterday"), "DateTime"),
    (lambda c: c.update(foo=1), "Extra inputs"),
    (set_answer([0, 2], [{"valueDate": "1950-13-45"}]), "Date"),
    (set_answer([0, 1], [{"valueInteger": 5}]), "expects valueString"),
    (set_answer([0, 1], [{"valueString": "a", "valueInteger": 5}]), "got multiple"),
    (set_answer([0, 1], [{"valueString": "a"}, {"valueString": "b"}]), "does not repeat"),
    (set_answer([0, 0], [{"valueCoding": {"system": "http://hl7.org/fhir/administrative-gender", "code": "unknown"}}]), "not one of the answer options"),
    (set_answer([0, 3, 0], [{"valueDecimal": 400}]), "greater than the maximum"),
    (set_answer([1, 0, 0], [{"valueBoolean": False}]), "disabled by enableWhen"),
    (lambda c: c["item"][0]["item"].append({"linkId": "bogus", "answer": [{"valueString": "x"}]}), "does not exist in this Questionnaire"),
    (lambda c: c["item"][0]["item"].append({"linkId": "pain", "answer": [{"valueBoolean": True}]}), "at this position"),
    (lambda c: c["item"].reverse(), "out of order"),
    (lambda c: c["item"][0].update(answer=[{"valueString": "x"}]), "cannot have answers"),
])
def test_invalid_surgery_case(client, surgery_case, change, expected):
    r = client.put(f"/api/cases/{CASE_ID}", json=mutate(surgery_case, change))
    assert r.status_code == 422, r.text
    assert expected in diagnostics(r)
    assert client.get(f"/api/cases/{CASE_ID}").status_code == 404


def test_form_case(**items):
    return {
        "resourceType": "QuestionnaireResponse",
        "questionnaire": TEST_FORM,
        "status": "in-progress",
        "item": [{"linkId": k, **v} for k, v in items.items()],
    }


test_form_case.__test__ = False  # helper, not a test

NAME = {"answer": [{"valueString": "Anna"}]}
CODE = lambda c: {"valueCoding": {"system": "urn:test", "code": c}}  # noqa: E731


@pytest.mark.parametrize("items, expected", [
    ({"name": NAME}, None),
    ({}, "Required item 'name'"),
    ({"name": {"answer": [{"valueString": "far too long name"}]}}, "longer than 10"),
    ({"name": NAME, "symptoms": {"answer": [CODE("cough"), CODE("fever")]}}, None),
    ({"name": NAME, "symptoms": {"answer": [CODE("cough"), CODE("none")]}}, "exclusive"),
    ({"name": NAME, "color": {"answer": [CODE("blue")]}}, None),
    ({"name": NAME, "color": {"answer": [CODE("green")]}}, "not one of the answer options"),
    ({"name": NAME, "weight": {"answer": [{"valueQuantity": {"value": 70, "system": "http://unitsofmeasure.org", "code": "kg"}}]}}, None),
    ({"name": NAME, "weight": {"answer": [{"valueQuantity": {"value": 70, "system": "http://unitsofmeasure.org", "code": "[lb_av]"}}]}}, "Unit of 'weight'"),
    ({"name": NAME, "smoker": {"answer": [{"valueBoolean": False}]}}, None),
    ({"name": NAME, "smoker": {"answer": [{"valueBoolean": True}]}}, "Required item 'pack-years'"),
])
def test_test_form(client, items, expected):
    r = client.put(f"/api/cases/{CASE_ID}", json=test_form_case(**items))
    if expected is None:
        assert r.status_code in (200, 201), r.text
    else:
        assert r.status_code == 422, r.text
        assert expected in diagnostics(r)


def test_repeating_group(client):
    case = test_form_case(name=NAME)
    med = lambda n: {"linkId": "meds", "item": [{"linkId": "med-name", "answer": [{"valueString": n}]}]}  # noqa: E731
    case["item"] += [med("ASS"), med("Ramipril")]
    assert client.put(f"/api/cases/{CASE_ID}", json=case).status_code == 201

    case["item"].append({"linkId": "meds", "item": [{"linkId": "med-name"}]})
    r = client.put(f"/api/cases/{CASE_ID}", json=case)
    assert r.status_code == 422
    assert "Required item 'med-name'" in diagnostics(r)


def test_exclusive_option_in_real_form(client, surgery_case, ed_surgery):
    def fn(case):
        case["item"][1]["item"][1]["item"][0]["answer"].append(
            {"valueCoding": option(ed_surgery, "bowel-movement", "17621005")})
    r = client.put(f"/api/cases/{CASE_ID}", json=mutate(surgery_case, fn))
    assert r.status_code == 422
    assert "exclusive" in diagnostics(r)

import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

ED_SURGERY = config.QUESTIONNAIRE_DIR / "ed-surgery.json"

# Synthetic form covering features ed-surgery does not use (yet):
# required items, exclusive options, repeating groups, contained ValueSets.
TEST_FORM = {
    "resourceType": "Questionnaire",
    "id": "test-form",
    "url": "https://pulsenote.example/Questionnaire/test-form",
    "version": "1.0",
    "status": "draft",
    "contained": [{
        "resourceType": "ValueSet",
        "id": "colors",
        "status": "draft",
        "compose": {"include": [{"system": "urn:test", "concept": [{"code": "red"}, {"code": "blue"}]}]},
    }],
    "item": [
        {"linkId": "name", "type": "string", "required": True, "maxLength": 10},
        {"linkId": "symptoms", "type": "choice", "repeats": True, "answerOption": [
            {"valueCoding": {"system": "urn:test", "code": "cough"}},
            {"valueCoding": {"system": "urn:test", "code": "fever"}},
            {"valueCoding": {"system": "urn:test", "code": "none"}, "extension": [{
                "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-optionExclusive",
                "valueBoolean": True,
            }]},
        ]},
        {"linkId": "color", "type": "choice", "answerValueSet": "#colors"},
        {"linkId": "weight", "type": "quantity", "extension": [{
            "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-unit",
            "valueCoding": {"system": "http://unitsofmeasure.org", "code": "kg"},
        }]},
        {"linkId": "meds", "type": "group", "repeats": True, "item": [
            {"linkId": "med-name", "type": "string", "required": True},
        ]},
        {"linkId": "smoker", "type": "boolean"},
        {"linkId": "pack-years", "type": "integer", "required": True,
         "enableWhen": [{"question": "smoker", "operator": "=", "answerBoolean": True}]},
    ],
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    forms = tmp_path / "questionnaires"
    forms.mkdir()
    shutil.copy(ED_SURGERY, forms / "ed-surgery.json")
    (forms / "test-form.json").write_text(json.dumps(TEST_FORM))
    monkeypatch.setattr(config, "QUESTIONNAIRE_DIR", forms)
    monkeypatch.setattr(config, "CASES_DIR", tmp_path / "data" / "cases")
    with TestClient(app) as c:
        yield c


@pytest.fixture
def ed_surgery():
    return json.loads(ED_SURGERY.read_text(encoding="utf-8"))

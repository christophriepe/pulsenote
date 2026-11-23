"""Validation of an incoming QuestionnaireResponse (a case).

Two stages, all problems are collected and returned together:

1. **FHIR R4B structure** via ``fhir.resources``: known elements only, datatypes and
   their formats (dates, decimals, ...), required elements, plus the checks the
   library leaves out (``status`` code, one ``value[x]`` per answer).
2. **Against the Questionnaire** it references (``questionnaire = url|version``):
   - every ``linkId`` exists at that position and the items are in form order
   - answer type matches the item type, ``repeats`` is respected
   - choice answers are one of the answer options; exclusive options stand alone
   - ``minValue`` / ``maxValue`` / ``maxLength`` / ``minLength``, units of quantities
   - items disabled by ``enableWhen`` carry no answers
   - every enabled ``required`` item is answered (whatever the ``status``)
"""

from collections.abc import Iterator
from typing import Any

from fhir.resources.R4B.questionnaireresponse import (
    QuestionnaireResponse as QuestionnaireResponseModel,
)
from pydantic import ValidationError

from .fhir import Issue
from .questionnaires import EXT_OPTION_EXCLUSIVE, Questionnaire, QuestionnaireRegistry

QR_STATUS = {"in-progress", "completed", "amended", "entered-in-error", "stopped"}

EXT_MIN_VALUE = "http://hl7.org/fhir/StructureDefinition/minValue"
EXT_MAX_VALUE = "http://hl7.org/fhir/StructureDefinition/maxValue"
EXT_MIN_LENGTH = "http://hl7.org/fhir/StructureDefinition/minLength"
EXT_UNIT = "http://hl7.org/fhir/StructureDefinition/questionnaire-unit"
EXT_UNIT_OPTION = "http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption"

# Questionnaire item type -> allowed answer value[x] keys (choice types use their options)
VALUE_KEYS = {
    "boolean": {"valueBoolean"},
    "decimal": {"valueDecimal"},
    "integer": {"valueInteger"},
    "date": {"valueDate"},
    "dateTime": {"valueDateTime"},
    "time": {"valueTime"},
    "string": {"valueString"},
    "text": {"valueString"},
    "url": {"valueUri"},
    "attachment": {"valueAttachment"},
    "reference": {"valueReference"},
    "quantity": {"valueQuantity"},
}


def value_entries(obj: dict[str, Any], prefix: str = "value") -> list[tuple[str, Any]]:
    return [(k, v) for k, v in obj.items() if k.startswith(prefix) and k != prefix]


def ext_value(element: dict[str, Any], url: str) -> Any:
    for ext in element.get("extension", []):
        if ext.get("url") == url:
            entries = value_entries(ext)
            return entries[0][1] if entries else True
    return None


def same_value(key: str, a: Any, b: Any) -> bool:
    """Equality as used for answer options and enableWhen."""
    if key.endswith("Coding"):
        if a.get("code") != b.get("code"):
            return False
        return not (a.get("system") and b.get("system")) or a["system"] == b["system"]
    if key.endswith("Quantity"):
        return a.get("value") == b.get("value") and a.get("code") == b.get("code")
    if key.endswith("Reference"):
        return a.get("reference") == b.get("reference")
    return a == b


def compare(key: str, actual: Any, expected: Any) -> int | None:
    """-1/0/1 for ordered types, None if the values cannot be ordered."""
    if key.endswith("Quantity"):
        actual, expected = actual.get("value"), expected.get("value")
    if isinstance(actual, bool) or isinstance(expected, bool):
        return None
    if isinstance(actual, int | float) and isinstance(expected, int | float):
        return (actual > expected) - (actual < expected)
    if isinstance(actual, str) and isinstance(expected, str) and len(actual) == len(expected):
        # ISO dates/times of the same precision sort lexically
        return (actual > expected) - (actual < expected)
    return None


class ResponseValidator:
    def __init__(self, questionnaire: Questionnaire, response: dict[str, Any]):
        self.q = questionnaire
        self.qr = response
        self.issues: list[Issue] = []
        # linkId -> all answer values given anywhere in the response, as (key, value)
        self.answers: dict[str, list[tuple[str, Any]]] = {}
        for item in self._all_items(response.get("item", [])):
            for answer in item.get("answer", []):
                self.answers.setdefault(item.get("linkId"), []).extend(value_entries(answer))
        self._enabled: dict[str, bool] = {}

    def error(self, path: str, message: str, code: str = "invalid") -> None:
        self.issues.append(Issue(message, path, code))

    @classmethod
    def _all_items(cls, items: list[dict[str, Any]]) -> Iterator[dict[str, Any]]:
        for item in items:
            yield item
            yield from cls._all_items(item.get("item", []))
            for answer in item.get("answer", []):
                yield from cls._all_items(answer.get("item", []))

    # ----- enableWhen -----

    def enabled(self, link_id: str) -> bool:
        """An item is enabled if its own enableWhen holds and its parent is enabled."""
        if link_id not in self._enabled:
            self._enabled[link_id] = True  # guards against cycles
            item = self.q.items[link_id]
            parent = self.q.parents[link_id]
            own = True
            if item.get("enableWhen"):
                results = [self._condition(c) for c in item["enableWhen"]]
                own = any(results) if item.get("enableBehavior") == "any" else all(results)
            self._enabled[link_id] = own and (parent is None or self.enabled(parent))
        return self._enabled[link_id]

    def _condition(self, cond: dict[str, Any]) -> bool:
        question = cond.get("question")
        # answers to disabled questions count as not given
        given = self.answers.get(question, []) if question in self.q.items and self.enabled(
            question
        ) else []
        op = cond.get("operator")
        expected = value_entries(cond, "answer")
        if op == "exists":
            return bool(given) == bool(expected and expected[0][1])
        if not expected:
            return False
        exp_key, exp_val = expected[0]
        values = [v for k, v in given if k[len("value"):] == exp_key[len("answer"):]]
        if op == "=":
            return any(same_value(exp_key, v, exp_val) for v in values)
        if op == "!=":
            return not any(same_value(exp_key, v, exp_val) for v in values)
        ordering = {">": (1,), "<": (-1,), ">=": (0, 1), "<=": (-1, 0)}.get(op)
        if ordering is None:
            return False
        return any(compare(exp_key, v, exp_val) in ordering for v in values)

    # ----- items -----

    def run(self) -> list[Issue]:
        self.check_level(self.q.resource.get("item", []), self.qr.get("item", []), "QuestionnaireResponse")
        return self.issues

    def check_level(self, q_items: list[dict[str, Any]], r_items: list[dict[str, Any]], path: str) -> None:
        """Check the response items below one parent against the Questionnaire items there."""
        order = {it["linkId"]: n for n, it in enumerate(q_items)}
        last_pos = -1
        seen: set[str] = set()
        for n, r_item in enumerate(r_items):
            item_path = f"{path}.item[{n}]"
            link_id = r_item.get("linkId")
            if link_id not in order:
                where = "in this Questionnaire" if link_id not in self.q.items else "at this position"
                self.error(item_path, f"linkId {link_id!r} does not exist {where}", "structure")
                continue
            q_item = q_items[order[link_id]]
            if order[link_id] < last_pos:
                self.error(item_path, f"Item {link_id!r} is out of order (must follow the Questionnaire's order)", "structure")
            last_pos = order[link_id]
            if link_id in seen and not (q_item["type"] == "group" and q_item.get("repeats")):
                self.error(item_path, f"Item {link_id!r} appears more than once but is not a repeating group", "structure")
            seen.add(link_id)
            self.check_item(q_item, r_item, item_path)

        for q_item in q_items:
            link_id = q_item["linkId"]
            if q_item.get("required") and link_id not in seen and self.enabled(link_id):
                self.error(path, f"Required item {link_id!r} ({q_item.get('text', '')}) is missing", "required")

    def check_item(self, q_item: dict[str, Any], r_item: dict[str, Any], path: str) -> None:
        link_id = q_item["linkId"]
        kind = q_item["type"]
        answers = r_item.get("answer", [])
        children = r_item.get("item", [])

        if answers and not self.enabled(link_id):
            self.error(path, f"Item {link_id!r} is answered but disabled by enableWhen", "business-rule")

        if kind in ("group", "display"):
            if answers:
                self.error(path, f"{kind} item {link_id!r} cannot have answers", "structure")
            if kind == "display" and children:
                self.error(path, f"display item {link_id!r} cannot have nested items", "structure")
            if kind == "group":
                if not children and q_item.get("required"):
                    self.error(path, f"Required group {link_id!r} has no answered items", "required")
                self.check_level(q_item.get("item", []), children, path)
            return

        # question items: nested items belong below the answer, not the item
        if children:
            self.error(path, f"Question {link_id!r} must nest its child items below answer, not item", "structure")
        if not answers and q_item.get("required"):
            self.error(path, f"Required item {link_id!r} ({q_item.get('text', '')}) has no answer", "required")
        if len(answers) > 1 and not q_item.get("repeats"):
            self.error(path, f"Item {link_id!r} has {len(answers)} answers but does not repeat", "structure")

        options = self.q.answer_options(q_item) if kind in ("choice", "open-choice") else None
        exclusive_given = False
        for n, answer in enumerate(answers):
            a_path = f"{path}.answer[{n}]"
            entries = value_entries(answer)
            if len(entries) != 1:
                self.error(a_path, "An answer must have exactly one value[x]", "structure")
                continue
            key, value = entries[0]
            option = self.check_value(q_item, options, key, value, a_path)
            if option is not None and ext_value(option, EXT_OPTION_EXCLUSIVE):
                exclusive_given = True
            self.check_level(q_item.get("item", []), answer.get("item", []), a_path)
        if exclusive_given and len(answers) > 1:
            self.error(path, f"Item {link_id!r}: an exclusive option must be the only answer", "business-rule")

    def check_value(self, q_item, options, key: str, value: Any, path: str) -> dict[str, Any] | None:
        """Check one answer value. Returns the matching answer option, if any."""
        link_id = q_item["linkId"]
        kind = q_item["type"]
        if kind in ("choice", "open-choice"):
            if kind == "open-choice" and key == "valueString":
                return None  # free text ("other")
            if options is None:
                return None  # external ValueSet, cannot be expanded here
            for option in options:
                opt_entries = value_entries(option)
                if opt_entries and opt_entries[0][0] == key and same_value(key, value, opt_entries[0][1]):
                    return option
            self.error(path, f"Answer {value!r} is not one of the answer options of {link_id!r}", "code-invalid")
            return None

        allowed = VALUE_KEYS.get(kind, set())
        if key not in allowed:
            self.error(path, f"Item {link_id!r} has type {kind!r} and expects {' or '.join(sorted(allowed))}, not {key}", "value")
            return None

        for url, op, label in ((EXT_MIN_VALUE, -1, "less than the minimum"), (EXT_MAX_VALUE, 1, "greater than the maximum")):
            limit = ext_value(q_item, url)
            if limit is not None and compare(key, value, limit if key != "valueQuantity" else {"value": limit}) == op:
                self.error(path, f"Value of {link_id!r} is {label} {limit}", "value")
        if isinstance(value, str):
            if q_item.get("maxLength") and len(value) > q_item["maxLength"]:
                self.error(path, f"Value of {link_id!r} is longer than {q_item['maxLength']} characters", "value")
            min_length = ext_value(q_item, EXT_MIN_LENGTH)
            if min_length and len(value) < min_length:
                self.error(path, f"Value of {link_id!r} is shorter than {min_length} characters", "value")
        if key == "valueQuantity":
            units = [ext_value(q_item, EXT_UNIT)] + [
                e.get("valueCoding") for e in q_item.get("extension", []) if e.get("url") == EXT_UNIT_OPTION
            ]
            units = [u for u in units if u]
            if units and not any(same_value("valueCoding", {"system": value.get("system"), "code": value.get("code")}, u) for u in units):
                self.error(path, f"Unit of {link_id!r} must be one of {', '.join(u.get('code', '') for u in units)}", "value")
        return None


def fhir_structure_issues(response: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []
    try:
        QuestionnaireResponseModel.model_validate(response)
    except ValidationError as exc:
        for err in exc.errors():
            loc = "QuestionnaireResponse" + "".join(
                f"[{p}]" if isinstance(p, int) else f".{p}" for p in err["loc"]
            )
            issues.append(Issue(err["msg"], loc, "structure"))
    status = response.get("status")
    if status is not None and status not in QR_STATUS:
        issues.append(Issue(f"status must be one of {', '.join(sorted(QR_STATUS))}", "QuestionnaireResponse.status", "code-invalid"))
    return issues


def validate_response(response: Any, registry: QuestionnaireRegistry) -> tuple[list[Issue], Questionnaire | None]:
    if not isinstance(response, dict) or response.get("resourceType") != "QuestionnaireResponse":
        return [Issue("Body must be a FHIR QuestionnaireResponse", "QuestionnaireResponse.resourceType", "structure")], None

    issues = fhir_structure_issues(response)

    canonical = response.get("questionnaire")
    if not isinstance(canonical, str) or "|" not in canonical:
        issues.append(Issue(
            "questionnaire must reference the exact form version as 'url|version'",
            "QuestionnaireResponse.questionnaire", "required",
        ))
        return issues, None
    questionnaire = registry.resolve(canonical)
    if questionnaire is None:
        issues.append(Issue(f"Unknown Questionnaire {canonical!r}", "QuestionnaireResponse.questionnaire", "not-found"))
        return issues, None
    if issues:
        # the item tree is not trustworthy enough to walk
        return issues, questionnaire
    return ResponseValidator(questionnaire, response).run(), questionnaire

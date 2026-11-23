"""Registry of the Questionnaires in packages/form-definitions.

Every ``*.json`` file below the questionnaires folder whose ``resourceType`` is
``Questionnaire`` is loaded, in any subfolder. Older versions can therefore be kept
next to the current one (e.g. ``questionnaires/archive/ed-surgery-0.1.json``), so
cases written with an older app version still validate.

Loaded once at startup. Restart the server after changing a form.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fhir.resources.R4B.questionnaire import Questionnaire as QuestionnaireModel
from pydantic import ValidationError

log = logging.getLogger(__name__)

EXT_OPTION_EXCLUSIVE = "http://hl7.org/fhir/StructureDefinition/questionnaire-optionExclusive"


def version_key(version: str | None) -> tuple:
    """Sort key for versions like '0.1', '0.10', '1.2.3-draft' (numeric parts compare as numbers)."""
    parts = re.split(r"[.\-]", version or "")
    return tuple((0, int(p), "") if p.isdigit() else (1, 0, p) for p in parts)


@dataclass
class Questionnaire:
    resource: dict[str, Any]
    path: Path
    # linkId -> item, across all nesting levels (linkIds are unique per Questionnaire)
    items: dict[str, dict[str, Any]] = field(default_factory=dict)
    # linkId -> linkId of the parent item (None for top-level items)
    parents: dict[str, str | None] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._index(self.resource.get("item", []), None)

    def _index(self, items: list[dict[str, Any]], parent: str | None) -> None:
        for item in items:
            link_id = item["linkId"]
            if link_id in self.items:
                log.warning("%s: duplicate linkId %r", self.path.name, link_id)
            self.items[link_id] = item
            self.parents[link_id] = parent
            self._index(item.get("item", []), link_id)

    @property
    def id(self) -> str | None:
        return self.resource.get("id")

    @property
    def url(self) -> str:
        return self.resource["url"]

    @property
    def version(self) -> str | None:
        return self.resource.get("version")

    @property
    def canonical(self) -> str:
        return f"{self.url}|{self.version}" if self.version else self.url

    def answer_options(self, item: dict[str, Any]) -> list[dict[str, Any]] | None:
        """The allowed answer values of a choice item as ``answerOption``-like dicts.

        ``answerOption`` is used directly. ``answerValueSet`` is expanded only if it
        points to a ValueSet contained in this Questionnaire (``#id``). For an external
        ValueSet there is no terminology server, so None is returned (no check).
        """
        if item.get("answerOption"):
            return item["answerOption"]
        ref = item.get("answerValueSet")
        if not ref:
            return []
        if not ref.startswith("#"):
            return None
        vs = next(
            (
                r
                for r in self.resource.get("contained", [])
                if r.get("resourceType") == "ValueSet" and r.get("id") == ref[1:]
            ),
            None,
        )
        if vs is None:
            return None
        if "expansion" in vs:
            codings = vs["expansion"].get("contains", [])
        else:
            codings = [
                {"system": inc.get("system"), **concept}
                for inc in vs.get("compose", {}).get("include", [])
                for concept in inc.get("concept", [])
            ]
        return [
            {"valueCoding": {k: c[k] for k in ("system", "code", "display") if c.get(k)}}
            for c in codings
        ]


class QuestionnaireRegistry:
    def __init__(self, directory: Path):
        self.directory = directory
        self.by_canonical: dict[str, Questionnaire] = {}
        self.load()

    def load(self) -> None:
        self.by_canonical.clear()
        if not self.directory.is_dir():
            log.warning("Questionnaire folder %s does not exist", self.directory)
            return
        for path in sorted(self.directory.rglob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                log.error("Skipping %s: %s", path, exc)
                continue
            if not isinstance(data, dict) or data.get("resourceType") != "Questionnaire":
                continue
            try:
                QuestionnaireModel.model_validate(data)
            except ValidationError as exc:
                log.error("Skipping %s: not a valid FHIR R4B Questionnaire:\n%s", path, exc)
                continue
            if not data.get("url"):
                log.error("Skipping %s: Questionnaire.url is required", path)
                continue
            q = Questionnaire(data, path)
            if q.canonical in self.by_canonical:
                log.error(
                    "Skipping %s: %s is already defined in %s",
                    path, q.canonical, self.by_canonical[q.canonical].path,
                )
                continue
            self.by_canonical[q.canonical] = q
        log.info("Loaded %d Questionnaire(s) from %s", len(self.by_canonical), self.directory)

    def all(self) -> list[Questionnaire]:
        return sorted(self.by_canonical.values(), key=lambda q: (q.url, version_key(q.version)))

    def resolve(self, canonical: str) -> Questionnaire | None:
        """Look up ``url|version``. Without a version, the newest version of ``url``."""
        if canonical in self.by_canonical:
            return self.by_canonical[canonical]
        if "|" in canonical:
            return None
        versions = [q for q in self.by_canonical.values() if q.url == canonical]
        return max(versions, key=lambda q: version_key(q.version), default=None)

"""Small FHIR helpers shared by the routes: media type, OperationOutcome, Bundle."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from fastapi.responses import JSONResponse

FHIR_JSON = "application/fhir+json"

# FHIR R4 `id` datatype. Also keeps case ids safe to use as file names.
ID_PATTERN = r"^[A-Za-z0-9\-.]{1,64}$"
ID_RE = re.compile(ID_PATTERN)


class FhirResponse(JSONResponse):
    media_type = FHIR_JSON


@dataclass
class Issue:
    """One OperationOutcome.issue. `code` is from the FHIR IssueType value set."""

    message: str
    expression: str | None = None
    code: str = "invalid"
    severity: str = "error"

    def to_fhir(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "severity": self.severity,
            "code": self.code,
            "diagnostics": self.message,
        }
        if self.expression:
            out["expression"] = [self.expression]
        return out


class FhirError(Exception):
    """Raised by routes; rendered as an OperationOutcome with the given HTTP status."""

    def __init__(self, status_code: int, issues: list[Issue] | Issue):
        self.status_code = status_code
        self.issues = issues if isinstance(issues, list) else [issues]
        super().__init__("; ".join(i.message for i in self.issues))


def operation_outcome(issues: list[Issue]) -> dict[str, Any]:
    return {"resourceType": "OperationOutcome", "issue": [i.to_fhir() for i in issues]}


def now_instant() -> str:
    """Current time as a FHIR `instant` (UTC, millisecond precision)."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def searchset(resources: list[dict[str, Any]], full_url: callable) -> dict[str, Any]:
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "timestamp": now_instant(),
        "total": len(resources),
        "entry": [
            {"fullUrl": full_url(r), "resource": r, "search": {"mode": "match"}}
            for r in resources
        ],
    }

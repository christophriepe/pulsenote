"""Case endpoints. A case is a FHIR QuestionnaireResponse; its id is created on the phone."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Path, Query, Request, Response

from ..fhir import FHIR_JSON, ID_PATTERN, FhirError, FhirResponse, Issue, searchset
from ..validation import validate_response

router = APIRouter(prefix="/cases", tags=["cases"])

CaseId = Annotated[str, Path(pattern=ID_PATTERN, description="Case id (FHIR id), created on the phone")]

EXAMPLE = {
    "resourceType": "QuestionnaireResponse",
    "id": "3f2a9c1e-0b7d-4e1a-9a52-6c1d2e8f4b10",
    "questionnaire": "https://pulsenote.example/Questionnaire/ed-surgery|0.1",
    "status": "in-progress",
    "authored": "2026-11-23T14:30:00Z",
    "item": [
        {
            "linkId": "patient",
            "item": [{"linkId": "patient-family-name", "answer": [{"valueString": "Muster"}]}],
        }
    ],
}


def _headers(resource: dict[str, Any]) -> dict[str, str]:
    meta = resource.get("meta", {})
    return {"ETag": f'W/"{meta.get("versionId", "")}"', "Last-Modified": meta.get("lastUpdated", "")}


def _load(request: Request, case_id: str) -> dict[str, Any]:
    case = request.app.state.cases.get(case_id)
    if case is None:
        raise FhirError(404, Issue(f"Case {case_id!r} not found", code="not-found"))
    return case


@router.get("", summary="List cases", response_class=FhirResponse)
def list_cases(
    request: Request,
    questionnaire: Annotated[str | None, Query(description="Form url, or url|version")] = None,
    status: Annotated[str | None, Query(description="QuestionnaireResponse.status, e.g. in-progress")] = None,
) -> FhirResponse:
    """All cases as a FHIR searchset Bundle, newest first."""
    cases = request.app.state.cases.list()
    if questionnaire:
        cases = [
            c for c in cases
            if c.get("questionnaire") == questionnaire
            or str(c.get("questionnaire", "")).split("|")[0] == questionnaire
        ]
    if status:
        cases = [c for c in cases if c.get("status") == status]
    cases.sort(key=lambda c: c.get("meta", {}).get("lastUpdated", ""), reverse=True)
    base = str(request.url_for("get_case", case_id="_")).removesuffix("_")
    return FhirResponse(searchset(cases, lambda c: base + c["id"]))


@router.get("/{case_id}", summary="Load a case", response_class=FhirResponse)
def get_case(request: Request, case_id: CaseId) -> FhirResponse:
    case = _load(request, case_id)
    return FhirResponse(case, headers=_headers(case))


@router.put(
    "/{case_id}",
    summary="Create or update a case",
    response_class=FhirResponse,
    responses={200: {"description": "Updated"}, 201: {"description": "Created"}, 422: {"description": "Invalid (OperationOutcome)"}},
)
def put_case(
    request: Request,
    case_id: CaseId,
    resource: Annotated[dict[str, Any], Body(media_type=FHIR_JSON, examples=[EXAMPLE])],
) -> FhirResponse:
    """Store a QuestionnaireResponse under the case id.

    Sending the same id again replaces the case, so resending after a dropped
    connection never creates a duplicate. `id` may be omitted; if given it must match
    the path. `questionnaire` must name the exact form version (`url|version`); older
    versions are accepted as long as they are in `packages/form-definitions`.
    The server sets `meta.versionId` and `meta.lastUpdated`.
    """
    if "id" in resource and resource["id"] != case_id:
        raise FhirError(400, Issue(
            f"id {resource['id']!r} does not match the case id {case_id!r} in the URL",
            "QuestionnaireResponse.id",
        ))
    issues, _ = validate_response(resource, request.app.state.questionnaires)
    if issues:
        raise FhirError(422, issues)
    stored, created = request.app.state.cases.put(case_id, resource)
    headers = _headers(stored)
    if created:
        headers["Location"] = str(request.url_for("get_case", case_id=case_id))
    return FhirResponse(stored, status_code=201 if created else 200, headers=headers)


@router.delete("/{case_id}", summary="Delete a case", status_code=204)
def delete_case(request: Request, case_id: CaseId) -> Response:
    if not request.app.state.cases.delete(case_id):
        raise FhirError(404, Issue(f"Case {case_id!r} not found", code="not-found"))
    return Response(status_code=204)


@router.get(
    "/{case_id}/text",
    summary="Get the free-text report (not implemented yet)",
    responses={501: {"description": "Not implemented yet (OperationOutcome)"}},
)
def get_case_text(request: Request, case_id: CaseId) -> None:
    _load(request, case_id)
    raise FhirError(501, Issue(
        "Free-text report is not implemented yet: structure and wording are still to be agreed (area 1)",
        code="not-supported",
    ))


@router.get(
    "/{case_id}/export",
    summary="Get the patient FHIR document (not implemented yet)",
    responses={501: {"description": "Not implemented yet (OperationOutcome)"}},
)
def get_case_export(request: Request, case_id: CaseId) -> None:
    _load(request, case_id)
    raise FhirError(501, Issue(
        "FHIR export / IPS document is not implemented yet: the extraction mapping is still to be agreed",
        code="not-supported",
    ))

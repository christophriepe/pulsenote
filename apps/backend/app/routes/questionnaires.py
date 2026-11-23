"""Form definitions (FHIR Questionnaires) from packages/form-definitions, read-only."""

from typing import Annotated

from fastapi import APIRouter, Query, Request

from ..fhir import FhirError, FhirResponse, Issue, searchset
from ..questionnaires import version_key

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


@router.get("", summary="List Questionnaires", response_class=FhirResponse)
def list_questionnaires(
    request: Request,
    url: Annotated[str | None, Query(description="Only this canonical url")] = None,
    version: Annotated[str | None, Query()] = None,
) -> FhirResponse:
    """All loaded Questionnaires, every version, as a FHIR searchset Bundle."""
    forms = [
        q for q in request.app.state.questionnaires.all()
        if (url is None or q.url == url) and (version is None or q.version == version)
    ]
    base = str(request.url_for("get_questionnaire", questionnaire_id="_")).removesuffix("_")
    return FhirResponse(searchset(
        [q.resource for q in forms],
        lambda r: f"{base}{r.get('id', '')}" + (f"?version={r['version']}" if r.get("version") else ""),
    ))


@router.get("/{questionnaire_id}", summary="Get a Questionnaire", response_class=FhirResponse)
def get_questionnaire(
    request: Request,
    questionnaire_id: str,
    version: Annotated[str | None, Query(description="Defaults to the newest version")] = None,
) -> FhirResponse:
    forms = [
        q for q in request.app.state.questionnaires.all()
        if q.id == questionnaire_id and (version is None or q.version == version)
    ]
    if not forms:
        raise FhirError(404, Issue(f"Questionnaire {questionnaire_id!r} not found", code="not-found"))
    return FhirResponse(max(forms, key=lambda q: version_key(q.version)).resource)

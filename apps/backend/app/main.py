"""PulseNote backend (FastAPI).

- ``/api/...``: the REST API (cases, questionnaires), OpenAPI docs at ``/api/docs``
- ``/``: the web app from apps/web (``/src``, ``/styles``), plus the Questionnaire
  JSON files it fetches under ``/packages/form-definitions/questionnaires``
- ``/preview``: the form preview from packages/form-definitions

Errors are returned as FHIR OperationOutcome resources.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from . import config
from .fhir import FhirError, FhirResponse, Issue, operation_outcome
from .questionnaires import QuestionnaireRegistry
from .routes import cases, questionnaires
from .storage import CaseStore

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.questionnaires = QuestionnaireRegistry(config.QUESTIONNAIRE_DIR)
    app.state.cases = CaseStore(config.CASES_DIR)
    yield


app = FastAPI(
    title="PulseNote API",
    version="0.1.0",
    description="Case store for PulseNote. Cases are FHIR R4 QuestionnaireResponses.",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


@app.exception_handler(FhirError)
async def fhir_error(_: Request, exc: FhirError) -> FhirResponse:
    return FhirResponse(operation_outcome(exc.issues), status_code=exc.status_code)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException) -> FhirResponse:
    code = {404: "not-found", 405: "not-supported"}.get(exc.status_code, "processing")
    return FhirResponse(
        operation_outcome([Issue(str(exc.detail), code=code)]),
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def request_error(_: Request, exc: RequestValidationError) -> FhirResponse:
    issues = [
        Issue(err["msg"], ".".join(str(p) for p in err["loc"]), "invalid")
        for err in exc.errors()
    ]
    return FhirResponse(operation_outcome(issues), status_code=422)


api = APIRouter(prefix="/api")
api.include_router(cases.router)
api.include_router(questionnaires.router)

app.include_router(api)


NO_CACHE = {"Cache-Control": "no-cache"}


@app.get("/", include_in_schema=False)
def web_app() -> FileResponse:
    """The web app (apps/web/index.html)."""
    return FileResponse(config.WEB_DIR / "index.html", headers=NO_CACHE)


@app.get("/preview", include_in_schema=False)
def preview() -> FileResponse:
    """The Questionnaire preview from packages/form-definitions."""
    return FileResponse(config.PREVIEW_FILE, headers=NO_CACHE)


# Only the folders the web app loads, so README.md and tools/ are not served.
app.mount("/src", StaticFiles(directory=config.WEB_DIR / "src"), name="web-src")
app.mount("/styles", StaticFiles(directory=config.WEB_DIR / "styles"), name="web-styles")
# src/config.js fetches forms from ../../packages/form-definitions/questionnaires/*.json
app.mount(
    "/packages/form-definitions/questionnaires",
    StaticFiles(directory=config.QUESTIONNAIRE_DIR),
    name="questionnaire-files",
)

"""Settings from environment variables, with defaults for running from the repo."""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent.parent

# packages/form-definitions: Questionnaires (questionnaires/**/*.json) and preview.html.
# In Docker it is copied to /app/form-definitions (see Dockerfile).
FORM_DEFINITIONS_DIR = Path(
    os.environ.get("FORM_DEFINITIONS_DIR", REPO_DIR / "packages" / "form-definitions")
).resolve()
QUESTIONNAIRE_DIR = FORM_DEFINITIONS_DIR / "questionnaires"
PREVIEW_FILE = FORM_DEFINITIONS_DIR / "preview.html"

# One JSON file per case. In Docker this is a named volume mounted at /data.
DATA_DIR = Path(os.environ.get("DATA_DIR", BACKEND_DIR / "data")).resolve()
CASES_DIR = DATA_DIR / "cases"

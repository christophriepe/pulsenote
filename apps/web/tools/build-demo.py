#!/usr/bin/env python3
"""Bundle the web app into one self-contained HTML file for demos and sharing.

The app itself needs no build step (plain ES modules). This script only exists so the demo can be
opened as a single file: it inlines the CSS, the Questionnaires and all modules (import lines removed,
`export` keywords dropped, wrapped in one function scope).

Usage (from the repo root):  python3 apps/web/tools/build-demo.py  ->  apps/web/dist/pulsenote-demo.html
"""
import json
import re
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
REPO = WEB.parent.parent

# Dependency order
MODULES = [
    "src/config.js",
    "src/lib/i18n.js",
    "src/lib/dom.js",
    "src/lib/questionnaire.js",
    "src/auth/session.js",
    "src/components/lang-button.js",
    "src/components/case-summary.js",
    "src/features/case-form/forms.js",
    "src/api/mock-server.js",
    "src/api/client.js",
    "src/features/case-form/drafts.js",
    "src/features/case-form/renderer.js",
    "src/features/case-form/send.js",
    "src/features/case-form/case-list.js",
    "src/features/case-form/wizard.js",
    "src/features/dashboard/dashboard.js",
    "src/auth/login.js",
    "src/main.js",
]
FORMS = ["ed-general", "ed-surgery"]

IMPORT_RE = re.compile(r"^import\s.*?from\s+['\"][^'\"]+['\"];\s*$", re.M)


def module_source(rel):
    src = (WEB / rel).read_text(encoding="utf-8")
    src = IMPORT_RE.sub("", src)
    src = re.sub(r"^export\s+", "", src, flags=re.M)
    assert "import(" not in src and not re.search(r"^\s*import\s", src, re.M), f"unbundled import in {rel}"
    return f"// ---- {rel} ----\n{src}"


def main():
    css = (WEB / "styles/app.css").read_text(encoding="utf-8")
    forms = {f: json.loads((REPO / f"packages/form-definitions/questionnaires/{f}.json").read_text(encoding="utf-8")) for f in FORMS}
    js = "\n".join(module_source(m) for m in MODULES)
    html = (WEB / "index.html").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="styles/app.css">', f"<style>\n{css}\n</style>")
    html = re.sub(r'\s*<!--.*?-->\s*<script type="module" src="src/main.js"></script>', "", html, flags=re.S)
    forms_js = json.dumps(forms, ensure_ascii=False).replace("</", "<\\/")
    bundle = f"<script>\nwindow.PN_FORMS = {forms_js};\n(() => {{\n'use strict';\n{js}\n}})();\n</script>"
    html = html.replace("</body>", f"{bundle}\n</body>")
    out = WEB / "dist/pulsenote-demo.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.relative_to(REPO)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

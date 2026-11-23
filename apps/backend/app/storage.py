"""Case store: one JSON file per case (``<DATA_DIR>/cases/<id>.json``).

A case is a FHIR QuestionnaireResponse. The store owns ``meta.versionId`` and
``meta.lastUpdated``. Writes go to a temp file first and are then renamed, so a
crash never leaves a half-written case behind.
"""

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from .fhir import ID_RE, now_instant


class CaseStore:
    def __init__(self, directory: Path):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        # Serializes read-modify-write (versionId) between request threads.
        # One uvicorn worker only: the lock is not shared across processes.
        self._lock = threading.Lock()

    def _path(self, case_id: str) -> Path:
        if not ID_RE.fullmatch(case_id):
            raise ValueError(f"invalid case id {case_id!r}")
        return self.directory / f"{case_id}.json"

    def get(self, case_id: str) -> dict[str, Any] | None:
        try:
            return json.loads(self._path(case_id).read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None

    def list(self) -> list[dict[str, Any]]:
        cases = []
        for path in self.directory.glob("*.json"):
            try:
                cases.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue  # deleted or being replaced meanwhile
        return cases

    def put(self, case_id: str, resource: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        """Create or replace a case. Returns the stored resource and whether it was created."""
        path = self._path(case_id)
        with self._lock:
            previous = self.get(case_id)
            version = int(previous.get("meta", {}).get("versionId", "0")) + 1 if previous else 1
            meta = {**resource.get("meta", {}), "versionId": str(version), "lastUpdated": now_instant()}
            stored = {"resourceType": resource["resourceType"], "id": case_id, "meta": meta}
            stored.update({k: v for k, v in resource.items() if k not in stored})
            fd, tmp = tempfile.mkstemp(dir=self.directory, prefix=f".{case_id}.", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(stored, f, ensure_ascii=False, indent=2)
                os.replace(tmp, path)
            except BaseException:
                Path(tmp).unlink(missing_ok=True)
                raise
        return stored, previous is None

    def delete(self, case_id: str) -> bool:
        with self._lock:
            try:
                self._path(case_id).unlink()
                return True
            except FileNotFoundError:
                return False

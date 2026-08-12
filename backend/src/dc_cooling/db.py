from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .schemas import SiteAssessment


@dataclass(frozen=True)
class CacheEntry:
    provider: str
    cache_key: str
    payload: dict[str, Any]
    retrieved_at: datetime
    expires_at: datetime

    @property
    def is_fresh(self) -> bool:
        return self.expires_at > datetime.now(timezone.utc)


class Database:
    """Small SQLite repository with explicit JSON boundaries.

    A new connection is used for each operation. This keeps the repository safe
    when FastAPI handles requests from multiple worker threads.
    """

    def __init__(self, path: Path):
        self.path = path
        self._write_lock = threading.Lock()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._write_lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS source_cache (
                    provider TEXT NOT NULL,
                    cache_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    PRIMARY KEY (provider, cache_key)
                );

                CREATE TABLE IF NOT EXISTS assessments (
                    assessment_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    site_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_assessments_created_at
                    ON assessments(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_assessments_batch_id
                    ON assessments(batch_id);
                CREATE INDEX IF NOT EXISTS idx_assessments_status
                    ON assessments(status);
                """
            )

    def get_cache(self, provider: str, cache_key: str) -> CacheEntry | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT provider, cache_key, payload_json, retrieved_at, expires_at
                FROM source_cache
                WHERE provider = ? AND cache_key = ?
                """,
                (provider, cache_key),
            ).fetchone()
        if row is None:
            return None
        return CacheEntry(
            provider=row["provider"],
            cache_key=row["cache_key"],
            payload=json.loads(row["payload_json"]),
            retrieved_at=datetime.fromisoformat(row["retrieved_at"]),
            expires_at=datetime.fromisoformat(row["expires_at"]),
        )

    def put_cache(
        self,
        provider: str,
        cache_key: str,
        payload: dict[str, Any],
        retrieved_at: datetime,
        expires_at: datetime,
    ) -> None:
        serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        with self._write_lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO source_cache (
                    provider, cache_key, payload_json, retrieved_at, expires_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(provider, cache_key) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    retrieved_at = excluded.retrieved_at,
                    expires_at = excluded.expires_at
                """,
                (
                    provider,
                    cache_key,
                    serialized,
                    retrieved_at.isoformat(),
                    expires_at.isoformat(),
                ),
            )

    def latest_cached_retrieval(self, provider: str) -> datetime | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT MAX(retrieved_at) AS value FROM source_cache WHERE provider = ?",
                (provider,),
            ).fetchone()
        if row is None or row["value"] is None:
            return None
        return datetime.fromisoformat(row["value"])

    def save_assessments(self, batch_id: str, assessments: list[SiteAssessment]) -> None:
        rows = [
            (
                assessment.assessment_id,
                batch_id,
                assessment.site.id,
                assessment.status,
                assessment.model_dump_json(),
                assessment.created_at.isoformat(),
            )
            for assessment in assessments
        ]
        with self._write_lock, self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO assessments (
                    assessment_id, batch_id, site_id, status, result_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

    def existing_site_ids(self, site_ids: list[str]) -> set[str]:
        """Return exact site IDs already persisted, without applying portfolio limits."""
        if not site_ids:
            return set()
        placeholders = ",".join("?" for _ in site_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT DISTINCT site_id FROM assessments WHERE site_id IN ({placeholders})",
                site_ids,
            ).fetchall()
        return {str(row["site_id"]) for row in rows}

    def get_assessment(self, assessment_id: str) -> SiteAssessment | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT result_json FROM assessments WHERE assessment_id = ?",
                (assessment_id,),
            ).fetchone()
        if row is None:
            return None
        return SiteAssessment.model_validate_json(row["result_json"])

    def list_assessments(self, limit: int, status: str | None = None) -> list[SiteAssessment]:
        query = "SELECT result_json FROM assessments"
        params: list[Any] = []
        if status is not None:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [SiteAssessment.model_validate_json(row["result_json"]) for row in rows]

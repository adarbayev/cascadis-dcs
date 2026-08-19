#!/usr/bin/env python3
"""Export the reviewed Google assessment portfolio for the static Pages workspace."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=ROOT / "backend/data/dc_cooling.sqlite3")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data/public_portfolios/google_public_data_centers.v1.json")
    parser.add_argument("--policy", type=Path, default=ROOT / "config/decision_policy.v1.json")
    parser.add_argument("--operational-policy", type=Path, default=ROOT / "config/operational_composite.v1.json")
    parser.add_argument("--output", type=Path, default=ROOT / "dashboard/public/data/google-portfolio.2026-08-10.json")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    args = parse_args()
    manifest = load_json(args.manifest)
    policy = load_json(args.policy)
    operational_policy = load_json(args.operational_policy)
    ordered_ids = [item["id"] for item in manifest["locations"]]
    if len(ordered_ids) != manifest["record_count"] or len(set(ordered_ids)) != len(ordered_ids):
        raise SystemExit("Manifest count or site-ID uniqueness validation failed.")

    with sqlite3.connect(args.database) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT a.site_id, a.result_json, a.created_at
            FROM assessments a
            JOIN (
                SELECT site_id, MAX(created_at) AS latest_created_at
                FROM assessments
                WHERE site_id LIKE 'google-dc-%'
                GROUP BY site_id
            ) latest
              ON latest.site_id = a.site_id
             AND latest.latest_created_at = a.created_at
            """
        ).fetchall()

    by_id = {str(row["site_id"]): json.loads(row["result_json"]) for row in rows}
    missing = [site_id for site_id in ordered_ids if site_id not in by_id]
    extra = sorted(set(by_id) - set(ordered_ids))
    if missing or extra:
        raise SystemExit(f"Snapshot/manifest mismatch. Missing={missing}; extra={extra}")

    assessments = [by_id[site_id] for site_id in ordered_ids]
    signatures = {
        (
            item.get("source", {}).get("grid", {}).get("provider"),
            item.get("source", {}).get("grid", {}).get("factor_basis"),
            item.get("source", {}).get("grid", {}).get("unit"),
        )
        for item in assessments
        if item.get("source", {}).get("grid", {}).get("emissions_intensity_gco2_per_kwh") is not None
    }
    if len(signatures) != 1:
        raise SystemExit(f"Static portfolio requires one grid-factor basis; found {sorted(signatures)}")

    snapshot_at = max(item.get("created_at", "") for item in assessments)
    payload = {
        "schema_version": "1.0.0",
        "snapshot_at": snapshot_at,
        "snapshot_scope": "Read-only Google public-location screening portfolio",
        "manifest_version": manifest["version"],
        "policy": {**policy, "operational_composite": operational_policy},
        "source_status": [
            {
                "provider": "aqueduct_esri",
                "label": "WRI Aqueduct snapshot",
                "status": "snapshot",
                "mode": "published_snapshot",
                "checked_at": snapshot_at,
                "source_url": "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/aqueduct_water_risk/FeatureServer/1",
                "note": "Pinned assessment results; no live source call from GitHub Pages."
            },
            {
                "provider": "ember",
                "label": "Ember 2025 snapshot",
                "status": "snapshot",
                "mode": "published_snapshot",
                "checked_at": snapshot_at,
                "source_url": "https://ember-energy.org/data/yearly-electricity-data/",
                "note": "Pinned national lifecycle generation-intensity proxy."
            }
        ],
        "assessments": assessments,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    complete = sum(item.get("status") == "complete" for item in assessments)
    print(f"Wrote {len(assessments)} assessments ({complete} complete) to {args.output}")


if __name__ == "__main__":
    main()

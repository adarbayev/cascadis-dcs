from __future__ import annotations

import asyncio
import json

from fastapi.testclient import TestClient

from dc_cooling.main import create_app
from dc_cooling.schemas import PortfolioManifest

from conftest import FakeGridProvider, FakeWaterProvider


def test_google_manifest_is_complete_and_source_bounded(settings) -> None:
    manifest = PortfolioManifest.model_validate(
        json.loads(settings.google_portfolio_manifest_path.read_text(encoding="utf-8"))
    )
    assert manifest.record_count == 59
    assert len(manifest.locations) == 59
    assert len(manifest.excluded_unlocated) == 1
    assert sum(
        item.location_evidence.facility_status.value == "operating"
        for item in manifest.locations
    ) == 30
    assert all(
        item.location_evidence.portfolio_id == "google_public_data_centers"
        for item in manifest.locations
    )
    assert all(item.id != "google-dc-usa-ellis-county-texas" for item in manifest.locations)


def test_google_seed_is_append_only_and_idempotent(
    settings,
    base_location: dict[str, object],
) -> None:
    app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app) as client:
        unrelated = client.post(
            "/api/v1/assessments", json={"locations": [base_location]}
        )
        assert unrelated.status_code == 201

        first = asyncio.run(app.state.service.seed_google_portfolio())
        second = asyncio.run(app.state.service.seed_google_portfolio())
        portfolio = client.get("/api/v1/portfolio?limit=1000")

    assert first.inserted_count == 59
    assert first.existing_count == 0
    assert first.excluded_unlocated_count == 1
    assert second.inserted_count == 0
    assert second.existing_count == 59
    assert portfolio.json()["count"] == 60
    assert any(item["site"]["id"] == "phoenix-1" for item in portfolio.json()["assessments"])


def test_google_seed_adds_location_provenance_and_method_boundary(settings) -> None:
    app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app):
        result = asyncio.run(app.state.service.seed_google_portfolio())
        portfolio = app.state.service.get_portfolio(limit=1000, status=None)

    assert result.inserted_count == 59
    google_result = next(
        item
        for item in portfolio.assessments
        if item.site.id == "google-dc-usa-mesa-arizona"
    )
    assert google_result.site.location_evidence.facility_status.value == "under_construction"
    assert google_result.provenance[0].source_name == "Site location"
    assert google_result.provenance[0].confidence.value == "low"
    assert any("screening defaults" in warning for warning in google_result.warnings)
    assert any("regional pre-screen" in warning for warning in google_result.warnings)
    assert any(
        "not Google Water Risk Framework ratings" in note
        for note in google_result.policy_v1.methodology_notes
    )

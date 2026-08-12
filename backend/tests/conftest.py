from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dc_cooling.main import create_app
from dc_cooling.providers.base import GridProvider, WaterProvider
from dc_cooling.schemas import (
    AqueductSourceFields,
    GridSource,
    LocationInput,
    WaterGeography,
    WaterSource,
)
from dc_cooling.settings import ROOT_DIR, Settings


NOW = datetime(2026, 8, 9, 12, 0, tzinfo=timezone.utc)


def make_fields(
    *,
    bws_score: float = 5,
    bws_cat: float = 4,
    bws_label: str = "Extremely High (>80%)",
    default_score: float = 3,
    default_cat: float = 3,
    electric_score: float = 4,
    electric_cat: float = 4,
    semiconductor_score: float = 2,
    semiconductor_cat: float = 2,
) -> AqueductSourceFields:
    return AqueductSourceFields(
        bws_raw=4.2,
        bws_score=bws_score,
        bws_cat=bws_cat,
        bws_label=bws_label,
        w_awr_def_tot_raw=3.1,
        w_awr_def_tot_score=default_score,
        w_awr_def_tot_cat=default_cat,
        w_awr_def_tot_label="High",
        w_awr_def_tot_weight_fraction=1,
        w_awr_elp_qan_raw=3.8,
        w_awr_elp_qan_score=4,
        w_awr_elp_qan_cat=4,
        w_awr_elp_qan_label="Extremely High",
        w_awr_elp_tot_raw=electric_score,
        w_awr_elp_tot_score=electric_score,
        w_awr_elp_tot_cat=electric_cat,
        w_awr_elp_tot_label="Extremely High" if electric_cat >= 4 else "Low-Medium",
        w_awr_elp_tot_weight_fraction=1,
        w_awr_smc_tot_raw=semiconductor_score,
        w_awr_smc_tot_score=semiconductor_score,
        w_awr_smc_tot_cat=semiconductor_cat,
        w_awr_smc_tot_label="Medium-High" if semiconductor_cat == 2 else "Low-Medium",
        w_awr_smc_tot_weight_fraction=1,
    )


def make_water(fields: AqueductSourceFields | None = None) -> WaterSource:
    return WaterSource(
        data_status="available",
        dataset_vintage="April 2023",
        source_url="https://example.test/aqueduct/1",
        retrieved_at=NOW,
        geography=WaterGeography(
            aq30_id=1,
            pfaf_id=2,
            aqid=3,
            gid_0="USA",
            gid_1="USA.3_1",
            name_0="United States",
            name_1="Arizona",
        ),
        fields=fields or make_fields(),
        geometry={
            "type": "Polygon",
            "coordinates": [[[-113, 32], [-111, 32], [-111, 34], [-113, 32]]],
        },
    )


def make_grid(factor: float = 500) -> GridSource:
    return GridSource(
        data_status="available",
        dataset_vintage="2025",
        source_url="https://example.test/ember",
        retrieved_at=NOW,
        transport="public_csv",
        entity="United States",
        entity_code="USA",
        is_aggregate_entity=False,
        date="2025",
        emissions_intensity_gco2_per_kwh=factor,
        match_level="aqueduct_gid_0",
    )


class FakeWaterProvider(WaterProvider):
    provider_name = "aqueduct_esri"

    def __init__(self, values: dict[str, WaterSource] | None = None):
        self.values = values or {}

    async def lookup(self, location: LocationInput) -> WaterSource:
        return self.values.get(location.id, make_water()).model_copy(deep=True)


class FakeGridProvider(GridProvider):
    provider_name = "ember"

    def __init__(self, value: GridSource | None = None):
        self.value = value or make_grid()

    async def lookup(self, entity_code: str | None, match_level: str | None) -> GridSource:
        result = self.value.model_copy(deep=True)
        result.entity_code = entity_code
        result.match_level = match_level
        return result


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        db_path=tmp_path / "test.sqlite3",
        decision_policy_path=ROOT_DIR / "config" / "decision_policy.v1.json",
        ember_api_key=None,
        source_retry_attempts=1,
    )


@pytest.fixture
def client(settings: Settings):
    app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def base_location() -> dict[str, object]:
    return {
        "id": "phoenix-1",
        "name": "Phoenix candidate",
        "latitude": 33.4484,
        "longitude": -112.074,
        "project_type": "retrofit",
        "cost_priority": "constrained",
        "uptime_constraint": "no_outage",
        "growth_3y": "high",
        "pue": 1.62,
        "wue_l_per_kwh": 0.4,
        "annual_it_energy_mwh": 1000,
    }

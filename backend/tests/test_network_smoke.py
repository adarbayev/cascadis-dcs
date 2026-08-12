from __future__ import annotations

import os

import pytest

from dc_cooling.db import Database
from dc_cooling.providers.aqueduct_esri import AqueductEsriProvider
from dc_cooling.providers.ember import EmberYearlyProvider
from dc_cooling.schemas import LocationInput
from dc_cooling.settings import Settings


@pytest.mark.skipif(
    os.getenv("RUN_NETWORK_TESTS") != "1",
    reason="Set RUN_NETWORK_TESTS=1 to run live source checks",
)
@pytest.mark.asyncio
async def test_live_phoenix_source_smoke(tmp_path) -> None:
    settings = Settings(_env_file=None, db_path=tmp_path / "network.sqlite3")
    database = Database(settings.db_path)
    database.initialize()
    water_provider = AqueductEsriProvider(settings, database)
    grid_provider = EmberYearlyProvider(settings, database)
    try:
        water = await water_provider.lookup(
            LocationInput(
                id="phoenix-live",
                name="Phoenix live smoke test",
                latitude=33.4484,
                longitude=-112.074,
            )
        )
        assert water.data_status == "available"
        assert water.fields is not None
        assert water.fields.bws_label == "Extremely High (>80%)"
        assert water.geography is not None
        grid = await grid_provider.lookup(water.geography.gid_0, "aqueduct_gid_0")
        assert grid.data_status == "available"
        assert grid.emissions_intensity_gco2_per_kwh is not None
    finally:
        await water_provider.aclose()
        await grid_provider.aclose()

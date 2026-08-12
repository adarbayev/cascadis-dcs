from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest

from dc_cooling.db import Database
from dc_cooling.providers.aqueduct_esri import AqueductEsriProvider
from dc_cooling.providers.base import SourceProviderError, request_json_with_retries
from dc_cooling.providers.ember import EmberYearlyProvider
from dc_cooling.schemas import LocationInput, WaterSource


@pytest.mark.asyncio
async def test_aqueduct_query_preserves_source_fields_and_geometry(settings) -> None:
    seen_query: dict[str, list[str]] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen_query.update(parse_qs(request.url.query.decode()))
        return httpx.Response(
            200,
            json={
                "features": [
                    {
                        "attributes": {
                            "aq30_id": 12,
                            "pfaf_id": 34,
                            "aqid": 56,
                            "gid_0": "USA",
                            "name_0": "United States",
                            "bws_raw": -1,
                            "bws_score": -1,
                            "bws_cat": -1,
                            "bws_label": "Arid and Low Water Use",
                            "w_awr_def_tot_score": 3.1,
                            "w_awr_def_tot_cat": 3,
                            "w_awr_def_tot_label": "High",
                            "w_awr_def_tot_weight_fraction": 1,
                            "w_awr_elp_tot_score": 2.5,
                            "w_awr_elp_tot_cat": 2,
                            "w_awr_elp_tot_label": "Medium-High",
                            "w_awr_elp_tot_weight_fraction": 0.95,
                            "w_awr_smc_tot_score": -9999,
                            "w_awr_smc_tot_cat": -9999,
                            "w_awr_smc_tot_label": "No Data",
                            "w_awr_smc_tot_weight_fraction": 0.7,
                        },
                        "geometry": {
                            "rings": [
                                [[-113, 32], [-113, 34], [-111, 34], [-111, 32], [-113, 32]]
                            ]
                        },
                    }
                ]
            },
        )

    database = Database(settings.db_path)
    database.initialize()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = AqueductEsriProvider(settings, database, client)
        source = await provider.lookup(
            LocationInput(
                id="phoenix",
                name="Phoenix",
                latitude=33.4484,
                longitude=-112.074,
            )
        )
    assert source.data_status == "available"
    assert source.fields is not None
    assert source.fields.bws_score == -1
    assert source.fields.w_awr_smc_tot_score == -9999
    assert source.fields.w_awr_elp_tot_weight_fraction == 0.95
    assert source.geometry is not None
    assert seen_query["returnGeometry"] == ["true"]
    assert seen_query["outSR"] == ["4326"]


@pytest.mark.asyncio
async def test_aqueduct_ambiguous_intersection_is_not_auto_selected(settings) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "features": [
                    {"attributes": {}, "geometry": {"rings": []}},
                    {"attributes": {}, "geometry": {"rings": []}},
                ]
            },
        )

    database = Database(settings.db_path)
    database.initialize()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = await AqueductEsriProvider(settings, database, client).lookup(
            LocationInput(id="boundary", name="Boundary", latitude=0, longitude=0)
        )
    assert source.data_status == "unavailable"
    assert source.fields is None
    assert "ambiguous" in (source.error or "")


@pytest.mark.asyncio
async def test_aqueduct_expired_cache_is_marked_stale_on_failure(settings) -> None:
    database = Database(settings.db_path)
    database.initialize()
    location = LocationInput(id="cached", name="Cached", latitude=1, longitude=2)
    cached_source = WaterSource(
        data_status="available",
        dataset_vintage="April 2023",
        source_url="https://example.test/aqueduct",
        retrieved_at=datetime.now(timezone.utc) - timedelta(days=10),
    )
    database.put_cache(
        "aqueduct_esri",
        "1.00000,2.00000",
        cached_source.model_dump(mode="json"),
        datetime.now(timezone.utc) - timedelta(days=10),
        datetime.now(timezone.utc) - timedelta(days=3),
    )

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = await AqueductEsriProvider(settings, database, client).lookup(location)
    assert source.cache.hit is True
    assert source.cache.stale is True
    assert source.data_status == "available"


@pytest.mark.asyncio
async def test_ember_public_csv_fallback_selects_country_total_generation(settings) -> None:
    csv_text = (
        Path(__file__).parent / "fixtures" / "ember_yearly.csv"
    ).read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=csv_text)

    database = Database(settings.db_path)
    database.initialize()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = await EmberYearlyProvider(settings, database, client).lookup(
            "USA", "aqueduct_gid_0"
        )
    assert source.data_status == "available"
    assert source.transport == "public_csv"
    assert source.date == "2025"
    assert source.emissions_intensity_gco2_per_kwh == 384.403
    assert source.emissions_intensity_gco2_per_kwh != 999


@pytest.mark.asyncio
async def test_source_errors_do_not_leak_query_secrets() -> None:
    secret = "do-not-leak-this-api-key"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(SourceProviderError) as error:
            await request_json_with_retries(
                client,
                "https://example.test/data",
                params={"api_key": secret},
                attempts=1,
            )
    assert secret not in str(error.value)
    assert str(error.value) == "Source request failed with HTTP 500"


@pytest.mark.asyncio
async def test_ember_api_failure_uses_public_csv_without_leaking_key(settings) -> None:
    secret = "private-ember-key"
    configured = settings.model_copy(update={"ember_api_key": secret})
    csv_text = (
        Path(__file__).parent / "fixtures" / "ember_yearly.csv"
    ).read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        if "carbon-intensity" in str(request.url):
            return httpx.Response(503, request=request)
        return httpx.Response(200, text=csv_text, request=request)

    database = Database(configured.db_path)
    database.initialize()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = await EmberYearlyProvider(configured, database, client).lookup(
            "USA", "aqueduct_gid_0"
        )
    assert source.data_status == "available"
    assert source.transport == "public_csv"
    assert source.emissions_intensity_gco2_per_kwh == 384.403
    assert source.cache.fallback_reason is not None
    assert secret not in source.cache.fallback_reason

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from ..db import Database
from ..schemas import (
    AqueductSourceFields,
    CacheMetadata,
    LocationInput,
    WaterGeography,
    WaterSource,
)
from ..settings import Settings
from .base import SourceProviderError, WaterProvider, request_json_with_retries


AQUEDUCT_FIELDS = (
    "aq30_id",
    "pfaf_id",
    "aqid",
    "gid_0",
    "gid_1",
    "name_0",
    "name_1",
    "bws_raw",
    "bws_score",
    "bws_cat",
    "bws_label",
    "w_awr_def_tot_raw",
    "w_awr_def_tot_score",
    "w_awr_def_tot_cat",
    "w_awr_def_tot_label",
    "w_awr_def_tot_weight_fraction",
    "w_awr_elp_qan_raw",
    "w_awr_elp_qan_score",
    "w_awr_elp_qan_cat",
    "w_awr_elp_qan_label",
    "w_awr_elp_tot_raw",
    "w_awr_elp_tot_score",
    "w_awr_elp_tot_cat",
    "w_awr_elp_tot_label",
    "w_awr_elp_tot_weight_fraction",
    "w_awr_smc_tot_raw",
    "w_awr_smc_tot_score",
    "w_awr_smc_tot_cat",
    "w_awr_smc_tot_label",
    "w_awr_smc_tot_weight_fraction",
)


def _ring_area(ring: list[list[float]]) -> float:
    return sum(
        ring[index][0] * ring[(index + 1) % len(ring)][1]
        - ring[(index + 1) % len(ring)][0] * ring[index][1]
        for index in range(len(ring))
    ) / 2.0


def esri_geometry_to_geojson(geometry: dict[str, Any] | None) -> dict[str, Any] | None:
    if not geometry or not isinstance(geometry.get("rings"), list):
        return None
    rings = [ring for ring in geometry["rings"] if isinstance(ring, list) and len(ring) >= 4]
    if not rings:
        return None

    # ArcGIS polygon outer rings are clockwise; holes are counter-clockwise.
    polygons: list[list[list[list[float]]]] = []
    for ring in rings:
        normalized = [list(point[:2]) for point in ring]
        if normalized[0] != normalized[-1]:
            normalized.append(normalized[0])
        if _ring_area(normalized) < 0 or not polygons:
            polygons.append([normalized])
        else:
            polygons[-1].append(normalized)

    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


class AqueductEsriProvider(WaterProvider):
    provider_name = "aqueduct_esri"

    def __init__(
        self,
        settings: Settings,
        database: Database,
        client: httpx.AsyncClient | None = None,
    ):
        self.settings = settings
        self.database = database
        self._owns_client = client is None
        self.client = client or httpx.AsyncClient(timeout=settings.request_timeout_seconds)

    async def aclose(self) -> None:
        if self._owns_client:
            await self.client.aclose()

    async def lookup(self, location: LocationInput) -> WaterSource:
        cache_key = f"{location.latitude:.5f},{location.longitude:.5f}"
        cached = self.database.get_cache(self.provider_name, cache_key)
        if cached and cached.is_fresh:
            source = WaterSource.model_validate(cached.payload)
            source.cache = CacheMetadata(hit=True, stale=False, expires_at=cached.expires_at)
            return source

        try:
            source = await self._fetch(location)
        except SourceProviderError as exc:
            if cached:
                source = WaterSource.model_validate(cached.payload)
                source.cache = CacheMetadata(
                    hit=True,
                    stale=True,
                    expires_at=cached.expires_at,
                    fallback_reason=str(exc),
                )
                return source
            return WaterSource(
                data_status="unavailable",
                dataset_vintage=self.settings.aqueduct_dataset_vintage,
                source_url=self.settings.aqueduct_url.rsplit("/query", 1)[0],
                error=str(exc),
            )

        retrieved_at = source.retrieved_at or datetime.now(timezone.utc)
        expires_at = retrieved_at + timedelta(hours=self.settings.aqueduct_cache_ttl_hours)
        source.cache = CacheMetadata(hit=False, stale=False, expires_at=expires_at)
        self.database.put_cache(
            self.provider_name,
            cache_key,
            source.model_dump(mode="json"),
            retrieved_at,
            expires_at,
        )
        return source

    async def _fetch(self, location: LocationInput) -> WaterSource:
        payload = await request_json_with_retries(
            self.client,
            self.settings.aqueduct_url,
            params={
                "where": "1=1",
                "geometry": f"{location.longitude},{location.latitude}",
                "geometryType": "esriGeometryPoint",
                "inSR": "4326",
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": ",".join(AQUEDUCT_FIELDS),
                "returnGeometry": "true",
                "outSR": "4326",
                "geometryPrecision": "4",
                "maxAllowableOffset": "0.005",
                "f": "json",
            },
            attempts=self.settings.source_retry_attempts,
        )
        if "error" in payload:
            message = payload.get("error", {}).get("message", "ArcGIS service error")
            raise SourceProviderError(f"Aqueduct Esri error: {message}")

        features = payload.get("features")
        if not isinstance(features, list):
            raise SourceProviderError("Aqueduct Esri response omitted the features array")
        retrieved_at = datetime.now(timezone.utc)
        source_url = self.settings.aqueduct_url.rsplit("/query", 1)[0]
        if not features:
            return WaterSource(
                data_status="no_data",
                dataset_vintage=self.settings.aqueduct_dataset_vintage,
                source_url=source_url,
                retrieved_at=retrieved_at,
                error="No Aqueduct basin intersected the supplied coordinate",
            )

        if len(features) != 1:
            return WaterSource(
                data_status="unavailable",
                dataset_vintage=self.settings.aqueduct_dataset_vintage,
                source_url=source_url,
                retrieved_at=retrieved_at,
                error=(
                    f"Aqueduct returned {len(features)} intersecting features; the point is ambiguous "
                    "and no feature was selected automatically"
                ),
            )

        feature = features[0]
        attributes = feature.get("attributes")
        if not isinstance(attributes, dict):
            raise SourceProviderError("Aqueduct Esri feature omitted attributes")
        fields = AqueductSourceFields.model_validate(
            {field: attributes.get(field) for field in AqueductSourceFields.model_fields}
        )
        geography = WaterGeography.model_validate(
            {field: attributes.get(field) for field in WaterGeography.model_fields}
        )
        bws_no_data = (
            fields.bws_score == -9999
            or fields.bws_cat == -9999
            or (fields.bws_label or "").strip().lower() == "no data"
        )
        return WaterSource(
            data_status="no_data" if bws_no_data else "available",
            dataset_vintage=self.settings.aqueduct_dataset_vintage,
            source_url=source_url,
            retrieved_at=retrieved_at,
            geography=geography,
            fields=fields,
            geometry=esri_geometry_to_geojson(feature.get("geometry")),
            error="WRI returned the No Data sentinel (-9999)" if bws_no_data else None,
        )

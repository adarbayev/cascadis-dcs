from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone

import httpx

from ..db import Database
from ..schemas import CacheMetadata, GridSource
from ..settings import Settings
from .base import GridProvider, SourceProviderError, request_json_with_retries


class EmberYearlyProvider(GridProvider):
    provider_name = "ember"

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
        self._public_csv_rows: list[dict[str, str]] | None = None
        self._public_csv_lock = asyncio.Lock()

    async def aclose(self) -> None:
        if self._owns_client:
            await self.client.aclose()

    async def lookup(self, entity_code: str | None, match_level: str | None) -> GridSource:
        if not entity_code:
            return GridSource(
                data_status="no_data",
                dataset_vintage=str(self.settings.ember_data_year),
                source_url=self.settings.ember_url,
                match_level=match_level,
                error="Country ISO3 code could not be resolved from the Aqueduct feature",
            )

        normalized_code = entity_code.strip().upper()
        api_configured = bool(
            self.settings.ember_api_key and self.settings.ember_api_key.strip()
        )
        preferred_transport = "api" if api_configured else "public_csv"
        cache_key = (
            f"{normalized_code}:{self.settings.ember_data_year}:{preferred_transport}"
        )
        cached = self.database.get_cache(self.provider_name, cache_key)
        if cached and cached.is_fresh:
            source = GridSource.model_validate(cached.payload)
            source.cache = CacheMetadata(hit=True, stale=False, expires_at=cached.expires_at)
            return source

        try:
            if api_configured:
                try:
                    source = await self._fetch_api(normalized_code, match_level)
                except SourceProviderError as api_error:
                    source = await self._fetch_public_csv(normalized_code, match_level)
                    source.cache.fallback_reason = (
                        f"Ember API unavailable ({api_error}); public CSV fallback used"
                    )
            else:
                source = await self._fetch_public_csv(normalized_code, match_level)
        except SourceProviderError as exc:
            if cached:
                source = GridSource.model_validate(cached.payload)
                source.cache = CacheMetadata(
                    hit=True,
                    stale=True,
                    expires_at=cached.expires_at,
                    fallback_reason=str(exc),
                )
                return source
            return GridSource(
                data_status="unavailable",
                dataset_vintage=str(self.settings.ember_data_year),
                source_url=(
                    self.settings.ember_url
                    if api_configured
                    else self.settings.ember_public_csv_url
                ),
                transport="api" if api_configured else "public_csv",
                entity_code=normalized_code,
                match_level=match_level,
                error=str(exc),
            )

        retrieved_at = source.retrieved_at or datetime.now(timezone.utc)
        expires_at = retrieved_at + timedelta(hours=self.settings.grid_cache_ttl_hours)
        fallback_reason = source.cache.fallback_reason
        source.cache = CacheMetadata(
            hit=False,
            stale=False,
            expires_at=expires_at,
            fallback_reason=fallback_reason,
        )
        self.database.put_cache(
            self.provider_name,
            cache_key,
            source.model_dump(mode="json"),
            retrieved_at,
            expires_at,
        )
        return source

    async def _fetch_api(self, entity_code: str, match_level: str | None) -> GridSource:
        year = self.settings.ember_data_year
        payload = await request_json_with_retries(
            self.client,
            self.settings.ember_url,
            params={
                "entity_code": entity_code,
                "start_date": year,
                "end_date": year,
                "api_key": self.settings.ember_api_key,
            },
            attempts=self.settings.source_retry_attempts,
        )
        rows = payload.get("data")
        if not isinstance(rows, list):
            raise SourceProviderError("Ember response omitted the data array")
        candidates = [
            row
            for row in rows
            if isinstance(row, dict)
            and str(row.get("entity_code", "")).upper() == entity_code
            and str(row.get("date", "")).startswith(str(year))
        ]
        retrieved_at = datetime.now(timezone.utc)
        if not candidates:
            return GridSource(
                data_status="no_data",
                dataset_vintage=str(year),
                source_url=self.settings.ember_url,
                retrieved_at=retrieved_at,
                entity_code=entity_code,
                match_level=match_level,
                error=f"Ember returned no yearly carbon-intensity record for {entity_code} in {year}",
            )
        row = max(candidates, key=lambda value: str(value.get("date", "")))
        factor = row.get("emissions_intensity_gco2_per_kwh")
        if factor is None:
            return GridSource(
                data_status="no_data",
                dataset_vintage=str(year),
                source_url=self.settings.ember_url,
                retrieved_at=retrieved_at,
                entity=str(row.get("entity")) if row.get("entity") is not None else None,
                entity_code=entity_code,
                date=str(row.get("date")) if row.get("date") is not None else None,
                match_level=match_level,
                error="Ember returned a null emissions-intensity value",
            )
        try:
            numeric_factor = float(factor)
        except (TypeError, ValueError) as exc:
            raise SourceProviderError("Ember returned a non-numeric emissions-intensity value") from exc
        if numeric_factor < 0:
            raise SourceProviderError("Ember returned a negative emissions-intensity value")
        return GridSource(
            data_status="available",
            dataset_vintage=str(year),
            source_url=self.settings.ember_url,
            retrieved_at=retrieved_at,
            transport="api",
            entity=str(row.get("entity")) if row.get("entity") is not None else None,
            entity_code=str(row.get("entity_code")) if row.get("entity_code") is not None else entity_code,
            is_aggregate_entity=row.get("is_aggregate_entity"),
            date=str(row.get("date")) if row.get("date") is not None else str(year),
            emissions_intensity_gco2_per_kwh=numeric_factor,
            match_level=match_level,
        )

    async def _fetch_public_csv(
        self,
        entity_code: str,
        match_level: str | None,
    ) -> GridSource:
        rows = await self._load_public_csv_rows()
        target_year = self.settings.ember_data_year
        candidates = [
            row
            for row in rows
            if row.get("ISO 3 code", "").strip().upper() == entity_code
            and row.get("Area type", "").strip() == "Country or economy"
            and row.get("Electricity source", "").strip() == "Total generation"
        ]
        eligible: list[tuple[int, dict[str, str]]] = []
        for row in candidates:
            try:
                year = int(row.get("Year", ""))
            except ValueError:
                continue
            if year <= target_year:
                eligible.append((year, row))
        retrieved_at = datetime.now(timezone.utc)
        if not eligible:
            return GridSource(
                data_status="no_data",
                dataset="Ember Yearly Electricity Data",
                dataset_vintage=str(target_year),
                source_url=self.settings.ember_public_csv_url,
                retrieved_at=retrieved_at,
                transport="public_csv",
                entity_code=entity_code,
                match_level=match_level,
                error=(
                    f"Ember public CSV returned no Total generation record for {entity_code} "
                    f"at or before {target_year}"
                ),
            )
        year, row = max(eligible, key=lambda item: item[0])
        raw_factor = row.get("Emissions intensity (gCO2e/kWh)", "").strip()
        if not raw_factor:
            return GridSource(
                data_status="no_data",
                dataset="Ember Yearly Electricity Data",
                dataset_vintage=str(year),
                source_url=self.settings.ember_public_csv_url,
                retrieved_at=retrieved_at,
                transport="public_csv",
                entity=row.get("Area") or None,
                entity_code=entity_code,
                date=str(year),
                match_level=match_level,
                error="Ember public CSV returned a blank emissions-intensity value",
            )
        try:
            factor = float(raw_factor)
        except ValueError as exc:
            raise SourceProviderError(
                "Ember public CSV returned a non-numeric emissions-intensity value"
            ) from exc
        if factor < 0:
            raise SourceProviderError("Ember public CSV returned a negative emissions-intensity value")
        return GridSource(
            data_status="available",
            dataset="Ember Yearly Electricity Data",
            dataset_vintage=str(year),
            source_url=self.settings.ember_public_csv_url,
            retrieved_at=retrieved_at,
            transport="public_csv",
            entity=row.get("Area") or None,
            entity_code=entity_code,
            is_aggregate_entity=False,
            date=str(year),
            emissions_intensity_gco2_per_kwh=factor,
            match_level=match_level,
        )

    async def _load_public_csv_rows(self) -> list[dict[str, str]]:
        if self._public_csv_rows is not None:
            return self._public_csv_rows
        async with self._public_csv_lock:
            if self._public_csv_rows is not None:
                return self._public_csv_rows
            last_error: Exception | None = None
            for attempt in range(self.settings.source_retry_attempts):
                try:
                    response = await self.client.get(self.settings.ember_public_csv_url)
                    response.raise_for_status()
                    reader = csv.DictReader(io.StringIO(response.text.lstrip("\ufeff")))
                    required = {
                        "Area",
                        "ISO 3 code",
                        "Year",
                        "Area type",
                        "Electricity source",
                        "Emissions intensity (gCO2e/kWh)",
                    }
                    if reader.fieldnames is None or not required.issubset(reader.fieldnames):
                        raise SourceProviderError("Ember public CSV schema is not recognised")
                    self._public_csv_rows = [dict(row) for row in reader]
                    return self._public_csv_rows
                except (httpx.HTTPError, SourceProviderError) as exc:
                    last_error = exc
                    if attempt < self.settings.source_retry_attempts - 1:
                        await asyncio.sleep(0.2 * (2**attempt))
            raise SourceProviderError(
                f"Ember public CSV request failed: {last_error or 'unknown error'}"
            )

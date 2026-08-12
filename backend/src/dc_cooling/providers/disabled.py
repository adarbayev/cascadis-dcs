from __future__ import annotations

from ..schemas import GridSource, LocationInput, WaterSource
from .base import GridProvider, ProviderDisabled, WaterProvider


class AqueductLocalProvider(WaterProvider):
    """Contract placeholder for a pinned local Aqueduct 4.0 GeoPackage."""

    provider_name = "aqueduct_local"
    enabled = False

    async def lookup(self, location: LocationInput) -> WaterSource:
        raise ProviderDisabled(
            "aqueduct_local is disabled until a pinned Aqueduct 4.0 GeoPackage is configured"
        )


class IeaAnnualFileProvider(GridProvider):
    """Contract placeholder for a separately licensed IEA annual factors file."""

    provider_name = "iea_annual_file"
    enabled = False

    async def lookup(self, entity_code: str | None, match_level: str | None) -> GridSource:
        raise ProviderDisabled(
            "iea_annual_file is disabled until a licensed source file is configured"
        )

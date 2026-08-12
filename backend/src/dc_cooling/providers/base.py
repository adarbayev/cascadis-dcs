from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any

import httpx

from ..schemas import GridSource, LocationInput, WaterSource


class SourceProviderError(RuntimeError):
    pass


class ProviderDisabled(SourceProviderError):
    pass


class WaterProvider(ABC):
    provider_name: str

    @abstractmethod
    async def lookup(self, location: LocationInput) -> WaterSource:
        raise NotImplementedError


class GridProvider(ABC):
    provider_name: str

    @abstractmethod
    async def lookup(self, entity_code: str | None, match_level: str | None) -> GridSource:
        raise NotImplementedError


async def request_json_with_retries(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, Any],
    attempts: int,
) -> dict[str, Any]:
    last_error = "Source request failed"
    for attempt in range(attempts):
        try:
            response = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            # Exception strings can contain full URLs, including query credentials.
            last_error = f"Source transport failure ({type(exc).__name__})"
            retryable = True
        else:
            status = response.status_code
            if status >= 400:
                last_error = f"Source request failed with HTTP {status}"
                retryable = status == 429 or status >= 500
            else:
                try:
                    payload = response.json()
                except ValueError:
                    last_error = "Source returned invalid JSON"
                    retryable = True
                else:
                    if not isinstance(payload, dict):
                        last_error = "Source returned a non-object JSON response"
                        retryable = True
                    else:
                        return payload
        if attempt == attempts - 1 or not retryable:
            break
        if attempt < attempts - 1:
            await asyncio.sleep(0.2 * (2**attempt))
    raise SourceProviderError(last_error)

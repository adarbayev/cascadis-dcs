from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from .db import Database
from .policy import DecisionPolicy
from .providers import AqueductEsriProvider, EmberYearlyProvider
from .providers.base import GridProvider, WaterProvider
from .schemas import (
    AssessmentBatchResponse,
    AssessmentRequest,
    HealthResponse,
    PortfolioResponse,
    SiteAssessment,
    SourcesStatusResponse,
)
from .service import AssessmentService
from .settings import Settings


def create_app(
    settings: Settings | None = None,
    *,
    water_provider: WaterProvider | None = None,
    grid_provider: GridProvider | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    database = Database(resolved_settings.db_path)
    database.initialize()
    policy = DecisionPolicy(resolved_settings.decision_policy_path)
    operational_policy = json.loads(
        resolved_settings.operational_policy_path.read_text(encoding="utf-8")
    )
    resolved_water_provider = water_provider or AqueductEsriProvider(
        resolved_settings, database
    )
    resolved_grid_provider = grid_provider or EmberYearlyProvider(
        resolved_settings, database
    )
    service = AssessmentService(
        resolved_settings,
        database,
        policy,
        resolved_water_provider,
        resolved_grid_provider,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        for provider in (resolved_water_provider, resolved_grid_provider):
            close = getattr(provider, "aclose", None)
            if close is not None:
                await close()

    app = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
        description=(
            "Source-backed screening API. Results do not replace engineering cooling design."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.allowed_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.state.service = service
    app.state.settings = resolved_settings
    app.state.policy = policy

    prefix = resolved_settings.api_prefix

    @app.get(f"{prefix}/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(
            service=resolved_settings.app_name,
            version=resolved_settings.app_version,
            policy_version=policy.version,
            timestamp=datetime.now(timezone.utc),
        )

    @app.post(
        f"{prefix}/assessments",
        response_model=AssessmentBatchResponse,
        status_code=201,
    )
    async def create_assessments(payload: AssessmentRequest) -> AssessmentBatchResponse:
        return await service.assess(payload)

    @app.get(f"{prefix}/assessments/{{assessment_id}}", response_model=SiteAssessment)
    async def get_assessment(assessment_id: str) -> SiteAssessment:
        assessment = service.get_assessment(assessment_id)
        if assessment is None:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return assessment

    @app.get(f"{prefix}/portfolio", response_model=PortfolioResponse)
    async def get_portfolio(
        limit: int = Query(default=100, ge=1, le=1000),
        status: Literal["complete", "partial", "unscored"] | None = None,
    ) -> PortfolioResponse:
        return service.get_portfolio(limit=limit, status=status)

    @app.get(f"{prefix}/policy", response_model=dict[str, Any])
    async def get_policy() -> dict[str, Any]:
        return {**policy.document, "operational_composite": operational_policy}

    @app.get(f"{prefix}/sources/status", response_model=SourcesStatusResponse)
    async def get_sources_status() -> SourcesStatusResponse:
        return service.source_status()

    return app


app = create_app()

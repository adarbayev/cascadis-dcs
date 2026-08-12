from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from uuid import uuid4

from .db import Database
from .policy import DecisionPolicy
from .providers.base import GridProvider, SourceProviderError, WaterProvider
from .schemas import (
    AssessmentBatchResponse,
    AssessmentRequest,
    GridSource,
    PortfolioManifest,
    PortfolioResponse,
    PortfolioSeedResult,
    ProvenanceRecord,
    SiteAssessment,
    SourceBundle,
    SourceProviderStatus,
    SourcesStatusResponse,
    WaterSource,
    WaterView,
)
from .settings import Settings


class AssessmentService:
    def __init__(
        self,
        settings: Settings,
        database: Database,
        policy: DecisionPolicy,
        water_provider: WaterProvider,
        grid_provider: GridProvider,
    ):
        self.settings = settings
        self.database = database
        self.policy = policy
        self.water_provider = water_provider
        self.grid_provider = grid_provider
        self._seed_lock = asyncio.Lock()

    async def assess(self, request: AssessmentRequest) -> AssessmentBatchResponse:
        created_at = datetime.now(timezone.utc)
        batch_id = str(uuid4())
        semaphore = asyncio.Semaphore(self.settings.assessment_concurrency)

        async def bounded_assessment(index: int) -> tuple[int, SiteAssessment]:
            async with semaphore:
                assessment = await self._assess_site(
                    request.locations[index],
                    request,
                    created_at,
                )
                return index, assessment

        indexed = await asyncio.gather(
            *(bounded_assessment(index) for index in range(len(request.locations)))
        )
        assessments = [assessment for _, assessment in sorted(indexed)]
        self._apply_portfolio_ranks(assessments)
        self.database.save_assessments(batch_id, assessments)
        return AssessmentBatchResponse(
            batch_id=batch_id,
            created_at=created_at,
            weights=request.weights,
            water_view=request.water_view,
            assessments=assessments,
        )

    async def _assess_site(
        self,
        site,
        request: AssessmentRequest,
        created_at: datetime,
    ) -> SiteAssessment:
        try:
            water = await self.water_provider.lookup(site)
        except SourceProviderError as exc:
            water = WaterSource(
                data_status="unavailable",
                dataset_vintage=self.settings.aqueduct_dataset_vintage,
                source_url=self.settings.aqueduct_url.rsplit("/query", 1)[0],
                error=str(exc),
            )

        entity_code = water.geography.gid_0 if water.geography else None
        match_level = "aqueduct_gid_0" if entity_code else None
        try:
            grid = await self.grid_provider.lookup(entity_code, match_level)
        except SourceProviderError as exc:
            grid = GridSource(
                data_status="unavailable",
                dataset_vintage=str(self.settings.ember_data_year),
                source_url=self.settings.ember_url,
                entity_code=entity_code,
                match_level=match_level,
                error=str(exc),
            )

        policy_result, warnings = self.policy.evaluate(
            site,
            water,
            grid,
            request.weights,
            request.water_view,
        )
        if water.error:
            warnings.append(f"Water source: {water.error}")
        if grid.error:
            warnings.append(f"Grid source: {grid.error}")
        composite = policy_result.scores.environmental_priority
        if composite is not None:
            status = "complete"
        elif water.data_status == "available" or grid.data_status == "available":
            status = "partial"
        else:
            status = "unscored"

        provenance = [
            ProvenanceRecord(
                source_name="Water risk",
                provider=water.provider,
                dataset=water.dataset,
                source_url=water.source_url,
                retrieved_at=water.retrieved_at,
                dataset_vintage=water.dataset_vintage,
                basis="WRI Aqueduct 4.0 Baseline Annual point-in-polygon lookup",
                attribution=water.attribution,
                cache_hit=water.cache.hit,
                stale=water.cache.stale,
            ),
            ProvenanceRecord(
                source_name="Grid carbon",
                provider=grid.provider,
                dataset=grid.dataset,
                source_url=grid.source_url,
                retrieved_at=grid.retrieved_at,
                dataset_vintage=grid.dataset_vintage,
                basis=grid.factor_basis,
                attribution=grid.attribution,
                cache_hit=grid.cache.hit,
                stale=grid.cache.stale,
            ),
        ]
        evidence = site.location_evidence
        if evidence is not None:
            provenance.insert(
                0,
                ProvenanceRecord(
                    source_name="Site location",
                    provider=evidence.operator,
                    dataset=evidence.facility_source_title,
                    source_url=evidence.facility_source_url,
                    retrieved_at=datetime.combine(
                        evidence.source_checked_at,
                        datetime.min.time(),
                        tzinfo=timezone.utc,
                    ),
                    dataset_vintage=evidence.source_checked_at.isoformat(),
                    basis=(
                        "Public operator location directory; coordinate basis: "
                        f"{evidence.coordinate_basis.value}"
                    ),
                    attribution=f"Source: {evidence.operator} public location directory",
                    cache_hit=False,
                    stale=False,
                    coordinate_basis=evidence.coordinate_basis,
                    confidence=evidence.coordinate_confidence,
                    note=evidence.note,
                ),
            )
            if evidence.business_inputs_basis.value == "screening_defaults":
                warnings.append(
                    "Project type, cost, uptime and growth values are tool screening defaults, not operator disclosures."
                )
            if evidence.portfolio_id == "google_public_data_centers":
                warnings.append(
                    "Aqueduct is a regional pre-screen. Google's published Water Risk Framework requires source-specific local data and expert review before cooling selection."
                )
                policy_result.methodology_notes.append(
                    "For Google public locations, High, Extremely High or Arid Aqueduct results act as a provisional local-source diligence gate; they are not Google Water Risk Framework ratings."
                )
        return SiteAssessment(
            assessment_id=str(uuid4()),
            status=status,
            site=site,
            source=SourceBundle(water=water, grid=grid),
            policy_v1=policy_result,
            warnings=list(dict.fromkeys(warnings)),
            provenance=provenance,
            created_at=created_at,
        )

    async def seed_google_portfolio(self, *, dry_run: bool = False) -> PortfolioSeedResult:
        """Append missing public Google locations from the versioned manifest."""
        async with self._seed_lock:
            payload = json.loads(
                self.settings.google_portfolio_manifest_path.read_text(encoding="utf-8")
            )
            manifest = PortfolioManifest.model_validate(payload)
            site_ids = [location.id for location in manifest.locations]
            existing_ids = self.database.existing_site_ids(site_ids)
            missing = [
                location for location in manifest.locations if location.id not in existing_ids
            ]
            if dry_run or not missing:
                return PortfolioSeedResult(
                    dataset_id=manifest.dataset_id,
                    version=manifest.version,
                    manifest_count=manifest.record_count,
                    existing_count=len(existing_ids),
                    inserted_count=0,
                    pending_count=len(missing),
                    excluded_unlocated_count=len(manifest.excluded_unlocated),
                    inserted_site_ids=[] if not dry_run else [site.id for site in missing],
                    dry_run=dry_run,
                )

            response = await self.assess(
                AssessmentRequest(
                    locations=missing,
                    weights=manifest.weights,
                    water_view=manifest.water_view,
                )
            )
            return PortfolioSeedResult(
                dataset_id=manifest.dataset_id,
                version=manifest.version,
                manifest_count=manifest.record_count,
                existing_count=len(existing_ids),
                inserted_count=len(response.assessments),
                pending_count=0,
                excluded_unlocated_count=len(manifest.excluded_unlocated),
                batch_id=response.batch_id,
                inserted_site_ids=[item.site.id for item in response.assessments],
                dry_run=False,
            )

    @staticmethod
    def _apply_portfolio_ranks(assessments: list[SiteAssessment]) -> None:
        rank_warning = (
            "Portfolio rank changes across Aqueduct views; review the proxy choice before prioritisation."
        )
        mixed_basis_warning = (
            "Combined portfolio ranking is blocked because scored results use different "
            "grid-factor providers, bases or units. Review each basis separately."
        )
        for assessment in assessments:
            assessment.policy_v1.scores.rank_by_view = {}
            assessment.policy_v1.scores.rank_reversal_warning = False
            assessment.warnings = [
                warning
                for warning in assessment.warnings
                if warning not in {rank_warning, mixed_basis_warning}
            ]
        if len(assessments) < 2:
            return

        scored_grid_bases = {
            (
                assessment.source.grid.provider,
                assessment.source.grid.factor_basis,
                assessment.source.grid.unit,
            )
            for assessment in assessments
            if any(
                detail.environmental_priority is not None
                for detail in assessment.policy_v1.scores.sensitivity.values()
            )
        }
        if len(scored_grid_bases) > 1:
            for assessment in assessments:
                assessment.warnings.append(mixed_basis_warning)
                assessment.warnings = list(dict.fromkeys(assessment.warnings))
            return

        for view in WaterView:
            scored = [
                (
                    index,
                    assessment.policy_v1.scores.sensitivity[view].environmental_priority,
                )
                for index, assessment in enumerate(assessments)
                if assessment.policy_v1.scores.sensitivity[view].environmental_priority
                is not None
            ]
            scored.sort(key=lambda item: (-float(item[1]), item[0]))
            previous_score: float | None = None
            previous_rank = 0
            for position, (index, score) in enumerate(scored, start=1):
                numeric_score = float(score)
                rank = previous_rank if previous_score == numeric_score else position
                assessments[index].policy_v1.scores.rank_by_view[view] = rank
                previous_score = numeric_score
                previous_rank = rank
            for index, assessment in enumerate(assessments):
                if not any(item[0] == index for item in scored):
                    assessment.policy_v1.scores.rank_by_view[view] = None

        for assessment in assessments:
            ranks = {
                rank
                for rank in assessment.policy_v1.scores.rank_by_view.values()
                if rank is not None
            }
            if len(ranks) > 1:
                assessment.policy_v1.scores.rank_reversal_warning = True
                assessment.warnings.append(rank_warning)
                assessment.warnings = list(dict.fromkeys(assessment.warnings))

    def get_assessment(self, assessment_id: str) -> SiteAssessment | None:
        return self.database.get_assessment(assessment_id)

    def get_portfolio(self, limit: int, status: str | None) -> PortfolioResponse:
        assessments = self.database.list_assessments(limit=limit, status=status)
        self._apply_portfolio_ranks(assessments)
        return PortfolioResponse(count=len(assessments), assessments=assessments)

    def source_status(self) -> SourcesStatusResponse:
        api_configured = bool(
            self.settings.ember_api_key and self.settings.ember_api_key.strip()
        )
        return SourcesStatusResponse(
            sources=[
                SourceProviderStatus(
                    provider="aqueduct_esri",
                    enabled=True,
                    configured=True,
                    mode="live_api_with_sqlite_cache",
                    source_url=self.settings.aqueduct_url.rsplit("/query", 1)[0],
                    latest_cached_retrieval=self.database.latest_cached_retrieval(
                        "aqueduct_esri"
                    ),
                    note="Public Esri Living Atlas service backed by WRI Aqueduct 4.0.",
                ),
                SourceProviderStatus(
                    provider="aqueduct_local",
                    enabled=False,
                    configured=False,
                    mode="disabled_contract",
                    note="Requires a pinned Aqueduct 4.0 GeoPackage before production use.",
                ),
                SourceProviderStatus(
                    provider="ember",
                    enabled=True,
                    configured=True,
                    mode=(
                        "api_preferred_with_public_csv_fallback"
                        if api_configured
                        else "public_csv_with_sqlite_cache"
                    ),
                    source_url=(
                        self.settings.ember_url
                        if api_configured
                        else self.settings.ember_public_csv_url
                    ),
                    latest_cached_retrieval=self.database.latest_cached_retrieval("ember"),
                    note=(
                        "Uses the authenticated yearly API when configured; otherwise uses Ember's public yearly CSV."
                    ),
                ),
                SourceProviderStatus(
                    provider="iea_annual_file",
                    enabled=False,
                    configured=False,
                    mode="disabled_contract",
                    note="Requires a separately licensed IEA factors file.",
                ),
            ],
            checked_at=datetime.now(timezone.utc),
        )

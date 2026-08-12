from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ProjectType(str, Enum):
    RETROFIT = "retrofit"
    EXPANSION = "expansion"
    GREENFIELD = "greenfield"


class CostPriority(str, Enum):
    CONSTRAINED = "constrained"
    BALANCED = "balanced"
    INVESTMENT_READY = "investment_ready"


class UptimeConstraint(str, Enum):
    NO_OUTAGE = "no_outage"
    MAINTENANCE_WINDOW = "maintenance_window"
    MAJOR_WORKS_ALLOWED = "major_works_allowed"


class GrowthLevel(str, Enum):
    STABLE = "stable"
    MODERATE = "moderate"
    HIGH = "high"


class WaterView(str, Enum):
    BASELINE_WATER_STRESS = "baseline_water_stress"
    DEFAULT_OVERALL = "default_overall"
    ELECTRIC_POWER = "electric_power"
    SEMICONDUCTOR = "semiconductor"


class FacilityStatus(str, Enum):
    OPERATING = "operating"
    IN_DEVELOPMENT = "in_development"
    UNDER_CONSTRUCTION = "under_construction"
    ANNOUNCED = "announced"
    UNKNOWN = "unknown"


class CoordinateBasis(str, Enum):
    OPERATOR_PUBLISHED_POINT = "operator_published_point"
    PUBLISHED_ADDRESS_GEOCODE = "published_address_geocode"
    PUBLISHED_LOCALITY_GEOCODE = "published_locality_geocode"
    LOCALITY_CENTROID = "locality_centroid"


class CoordinateConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class BusinessInputsBasis(str, Enum):
    OPERATOR_DISCLOSED = "operator_disclosed"
    SCREENING_DEFAULTS = "screening_defaults"


class LocationEvidence(StrictModel):
    portfolio_id: str = Field(min_length=1, max_length=100)
    portfolio_version: str = Field(min_length=1, max_length=50)
    operator: str = Field(min_length=1, max_length=100)
    facility_status: FacilityStatus = FacilityStatus.UNKNOWN
    facility_source_title: str = Field(min_length=1, max_length=200)
    facility_source_url: str = Field(min_length=1, max_length=500)
    source_checked_at: date
    coordinate_source_url: str = Field(min_length=1, max_length=500)
    coordinate_basis: CoordinateBasis
    coordinate_confidence: CoordinateConfidence
    business_inputs_basis: BusinessInputsBasis = BusinessInputsBasis.SCREENING_DEFAULTS
    methodology_reference_url: str | None = Field(default=None, max_length=500)
    asset_scope: str | None = Field(default=None, max_length=100)
    known_facility_labels: list[str] = Field(default_factory=list, max_length=20)
    known_facility_count: int | None = Field(default=None, ge=1, le=100)
    note: str | None = Field(default=None, max_length=500)


class LocationInput(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    project_type: ProjectType = ProjectType.RETROFIT
    cost_priority: CostPriority = CostPriority.BALANCED
    uptime_constraint: UptimeConstraint = UptimeConstraint.MAINTENANCE_WINDOW
    growth_3y: GrowthLevel = GrowthLevel.MODERATE
    pue: float | None = Field(default=None, ge=1, le=5)
    wue_l_per_kwh: float | None = Field(default=None, ge=0, le=100)
    it_load_utilization_pct: float | None = Field(default=None, ge=0, le=100)
    annual_it_energy_mwh: float | None = Field(default=None, gt=0)
    location_evidence: LocationEvidence | None = None


class AssessmentWeights(StrictModel):
    water: float = Field(default=0.5, ge=0, le=1)
    carbon: float = Field(default=0.5, ge=0, le=1)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "AssessmentWeights":
        if abs((self.water + self.carbon) - 1.0) > 1e-6:
            raise ValueError("water and carbon weights must sum to 1.0")
        return self


class AssessmentRequest(StrictModel):
    locations: list[LocationInput] = Field(min_length=1, max_length=100)
    weights: AssessmentWeights = Field(default_factory=AssessmentWeights)
    water_view: WaterView = WaterView.BASELINE_WATER_STRESS

    @model_validator(mode="after")
    def location_ids_are_unique(self) -> "AssessmentRequest":
        ids = [location.id for location in self.locations]
        if len(ids) != len(set(ids)):
            raise ValueError("location ids must be unique within a batch")
        return self


class CacheMetadata(StrictModel):
    hit: bool = False
    stale: bool = False
    expires_at: datetime | None = None
    fallback_reason: str | None = None


class WaterGeography(StrictModel):
    aq30_id: float | int | str | None = None
    pfaf_id: float | int | str | None = None
    aqid: float | int | str | None = None
    gid_0: str | None = None
    gid_1: str | None = None
    name_0: str | None = None
    name_1: str | None = None


class AqueductSourceFields(StrictModel):
    bws_raw: float | None = None
    bws_score: float | None = None
    bws_cat: float | None = None
    bws_label: str | None = None
    w_awr_def_tot_raw: float | None = None
    w_awr_def_tot_score: float | None = None
    w_awr_def_tot_cat: float | None = None
    w_awr_def_tot_label: str | None = None
    w_awr_def_tot_weight_fraction: float | None = None
    w_awr_elp_qan_raw: float | None = None
    w_awr_elp_qan_score: float | None = None
    w_awr_elp_qan_cat: float | None = None
    w_awr_elp_qan_label: str | None = None
    w_awr_elp_tot_raw: float | None = None
    w_awr_elp_tot_score: float | None = None
    w_awr_elp_tot_cat: float | None = None
    w_awr_elp_tot_label: str | None = None
    w_awr_elp_tot_weight_fraction: float | None = None
    w_awr_smc_tot_raw: float | None = None
    w_awr_smc_tot_score: float | None = None
    w_awr_smc_tot_cat: float | None = None
    w_awr_smc_tot_label: str | None = None
    w_awr_smc_tot_weight_fraction: float | None = None


class WaterSource(StrictModel):
    provider: Literal["aqueduct_esri", "aqueduct_local"] = "aqueduct_esri"
    data_status: Literal["available", "no_data", "unavailable", "disabled"]
    dataset: str = "WRI Aqueduct 4.0 Baseline Annual"
    dataset_vintage: str | None = None
    source_url: str
    attribution: str = "Source: WRI Aqueduct"
    retrieved_at: datetime | None = None
    cache: CacheMetadata = Field(default_factory=CacheMetadata)
    geography: WaterGeography | None = None
    fields: AqueductSourceFields | None = None
    geometry: dict[str, Any] | None = None
    error: str | None = None


class GridSource(StrictModel):
    provider: Literal["ember", "iea_annual_file"] = "ember"
    data_status: Literal["available", "no_data", "unavailable", "not_configured", "disabled"]
    dataset: str = "Ember Yearly Carbon Intensity"
    dataset_vintage: str | None = None
    source_url: str
    attribution: str = "Public proxy — Ember (CC BY 4.0)"
    factor_basis: str = "national lifecycle generation intensity"
    unit: str = "gCO2e/kWh"
    transport: Literal["api", "public_csv", "local_file"] = "api"
    retrieved_at: datetime | None = None
    cache: CacheMetadata = Field(default_factory=CacheMetadata)
    entity: str | None = None
    entity_code: str | None = None
    is_aggregate_entity: bool | None = None
    date: str | None = None
    emissions_intensity_gco2_per_kwh: float | None = None
    match_level: str | None = None
    error: str | None = None


class SourceBundle(StrictModel):
    water: WaterSource
    grid: GridSource


class ScoreDetail(StrictModel):
    source_score: float | None = None
    source_category: float | None = None
    source_label: str | None = None
    source_weight_fraction: float | None = None
    normalized: float | None = None
    environmental_priority: float | None = None
    status: Literal["scored", "arid_policy_override", "no_data", "unavailable"]


class SensitivityRange(StrictModel):
    minimum: float | None = None
    maximum: float | None = None


class PolicyScores(StrictModel):
    selected_water_view: WaterView
    water_normalized: float | None = None
    carbon_normalized: float | None = None
    environmental_priority: float | None = None
    sensitivity: dict[WaterView, ScoreDetail]
    sensitivity_range: SensitivityRange
    rank_by_view: dict[WaterView, int | None] = Field(default_factory=dict)
    material_divergence_warning: bool = False
    rank_reversal_warning: bool = False


class MatrixCell(StrictModel):
    id: str
    label: str
    water_band: Literal["low", "medium_high", "high_or_arid", "unknown"]
    carbon_band: Literal["low", "moderate", "high", "unknown"]


class EnergyProcurementLever(StrictModel):
    category: str = "Renewable power purchase agreement assessment"
    priority: Literal["opportunity", "medium", "high", "unrated"]
    affects_location_based_score: bool = False
    rationale: str


class Recommendations(StrictModel):
    preferred: list[str]
    conditional: list[str]
    excluded: list[str]
    energy_procurement_lever: EnergyProcurementLever


class DeliveryPlan(StrictModel):
    immediate: list[str]
    maintenance_window: list[str]
    expansion: list[str]


class ProxyMetrics(StrictModel):
    cue_location_based_kgco2e_per_kwh_it: float | None = None
    annual_operational_emissions_tco2e: float | None = None
    annual_water_use_m3: float | None = None
    factor_basis: str | None = None


class PolicyResult(StrictModel):
    version: str
    confidence: Literal["high", "medium", "low", "unavailable"]
    scores: PolicyScores
    matrix_cell: MatrixCell
    recommendations: Recommendations
    delivery: DeliveryPlan
    business_tradeoffs: list[str]
    proxy_metrics: ProxyMetrics
    methodology_notes: list[str]


class ProvenanceRecord(StrictModel):
    source_name: str
    provider: str
    dataset: str
    source_url: str
    retrieved_at: datetime | None = None
    dataset_vintage: str | None = None
    basis: str
    attribution: str
    cache_hit: bool
    stale: bool
    coordinate_basis: CoordinateBasis | None = None
    confidence: CoordinateConfidence | None = None
    note: str | None = None


class SiteAssessment(StrictModel):
    assessment_id: str
    status: Literal["complete", "partial", "unscored"]
    site: LocationInput
    source: SourceBundle
    policy_v1: PolicyResult
    warnings: list[str]
    provenance: list[ProvenanceRecord]
    created_at: datetime


class AssessmentBatchResponse(StrictModel):
    batch_id: str
    created_at: datetime
    weights: AssessmentWeights
    water_view: WaterView
    assessments: list[SiteAssessment]


class PortfolioResponse(StrictModel):
    count: int
    assessments: list[SiteAssessment]


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    policy_version: str
    timestamp: datetime


class SourceProviderStatus(StrictModel):
    provider: str
    enabled: bool
    configured: bool
    mode: str
    source_url: str | None = None
    latest_cached_retrieval: datetime | None = None
    note: str


class SourcesStatusResponse(StrictModel):
    sources: list[SourceProviderStatus]
    checked_at: datetime


class PortfolioManifest(StrictModel):
    dataset_id: str = Field(min_length=1, max_length=100)
    version: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=200)
    scope: str = Field(min_length=1, max_length=1000)
    official_source_url: str = Field(min_length=1, max_length=500)
    source_checked_at: date
    methodology_reference_url: str = Field(min_length=1, max_length=500)
    record_count: int = Field(ge=1, le=100)
    weights: AssessmentWeights = Field(default_factory=AssessmentWeights)
    water_view: WaterView = WaterView.BASELINE_WATER_STRESS
    locations: list[LocationInput] = Field(min_length=1, max_length=100)
    excluded_unlocated: list["UnlocatedPortfolioRecord"] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_manifest(self) -> "PortfolioManifest":
        if len(self.locations) != self.record_count:
            raise ValueError("record_count must match the number of locations")
        ids = [location.id for location in self.locations]
        if len(ids) != len(set(ids)):
            raise ValueError("location ids must be unique within the manifest")
        for location in self.locations:
            evidence = location.location_evidence
            if evidence is None:
                raise ValueError(f"location {location.id} is missing location_evidence")
            if evidence.portfolio_id != self.dataset_id:
                raise ValueError(
                    f"location {location.id} portfolio_id does not match dataset_id"
                )
            if evidence.portfolio_version != self.version:
                raise ValueError(
                    f"location {location.id} portfolio_version does not match version"
                )
        return self


class UnlocatedPortfolioRecord(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    operator: str = Field(min_length=1, max_length=100)
    facility_status: FacilityStatus
    facility_source_url: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=500)


class PortfolioSeedResult(StrictModel):
    dataset_id: str
    version: str
    manifest_count: int
    existing_count: int
    inserted_count: int
    pending_count: int = 0
    excluded_unlocated_count: int = 0
    batch_id: str | None = None
    inserted_site_ids: list[str] = Field(default_factory=list)
    dry_run: bool = False

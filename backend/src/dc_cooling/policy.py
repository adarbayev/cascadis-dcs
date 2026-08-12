from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .schemas import (
    AssessmentWeights,
    CacheMetadata,
    CostPriority,
    DeliveryPlan,
    EnergyProcurementLever,
    GridSource,
    GrowthLevel,
    LocationInput,
    MatrixCell,
    PolicyResult,
    PolicyScores,
    ProjectType,
    ProxyMetrics,
    Recommendations,
    ScoreDetail,
    SensitivityRange,
    UptimeConstraint,
    WaterSource,
    WaterView,
)


VIEW_FIELDS: dict[WaterView, tuple[str, str, str]] = {
    WaterView.BASELINE_WATER_STRESS: ("bws_score", "bws_cat", "bws_label"),
    WaterView.DEFAULT_OVERALL: (
        "w_awr_def_tot_score",
        "w_awr_def_tot_cat",
        "w_awr_def_tot_label",
    ),
    WaterView.ELECTRIC_POWER: (
        "w_awr_elp_tot_score",
        "w_awr_elp_tot_cat",
        "w_awr_elp_tot_label",
    ),
    WaterView.SEMICONDUCTOR: (
        "w_awr_smc_tot_score",
        "w_awr_smc_tot_cat",
        "w_awr_smc_tot_label",
    ),
}

VIEW_WEIGHT_FRACTIONS: dict[WaterView, str | None] = {
    WaterView.BASELINE_WATER_STRESS: None,
    WaterView.DEFAULT_OVERALL: "w_awr_def_tot_weight_fraction",
    WaterView.ELECTRIC_POWER: "w_awr_elp_tot_weight_fraction",
    WaterView.SEMICONDUCTOR: "w_awr_smc_tot_weight_fraction",
}


class DecisionPolicy:
    def __init__(self, path: Path):
        self.path = path
        with path.open("r", encoding="utf-8") as handle:
            self.document: dict[str, Any] = json.load(handle)
        self._validate_document()

    @property
    def version(self) -> str:
        return str(self.document["version"])

    def _validate_document(self) -> None:
        required = {
            "version",
            "default_weights",
            "anchors",
            "carbon_bands",
            "cooling_matrix",
            "delivery_actions",
            "disclaimers",
        }
        missing = required - set(self.document)
        if missing:
            raise ValueError(f"Decision policy is missing keys: {', '.join(sorted(missing))}")
        anchor = self.document["anchors"].get("carbon_gco2e_per_kwh")
        if not isinstance(anchor, (int, float)) or anchor <= 0:
            raise ValueError("Decision policy carbon anchor must be positive")

    def evaluate(
        self,
        site: LocationInput,
        water: WaterSource,
        grid: GridSource,
        weights: AssessmentWeights,
        selected_view: WaterView,
    ) -> tuple[PolicyResult, list[str]]:
        warnings: list[str] = []
        anchor = float(self.document["anchors"]["carbon_gco2e_per_kwh"])
        carbon_normalized = self._carbon_normalized(grid, anchor)

        sensitivity: dict[WaterView, ScoreDetail] = {}
        for view in WaterView:
            detail = self._water_detail(water, view)
            if detail.normalized is not None and carbon_normalized is not None:
                detail.environmental_priority = round(
                    100
                    * (
                        weights.water * detail.normalized
                        + weights.carbon * carbon_normalized
                    ),
                    2,
                )
            sensitivity[view] = detail

        selected = sensitivity[selected_view]
        scores_available = [
            detail.environmental_priority
            for detail in sensitivity.values()
            if detail.environmental_priority is not None
        ]
        score_range = SensitivityRange(
            minimum=min(scores_available) if scores_available else None,
            maximum=max(scores_available) if scores_available else None,
        )
        material_threshold = float(
            self.document.get("sensitivity_material_divergence_points", 10.0)
        )
        material_divergence = (
            score_range.minimum is not None
            and score_range.maximum is not None
            and score_range.maximum - score_range.minimum >= material_threshold
        )

        if selected.status == "arid_policy_override":
            warnings.append(
                "WRI classifies this location as Arid and Low Water Use. The policy assigns "
                "water_normalized = 1.0 for critical review while preserving the WRI -1 source value."
            )
        if selected.status in {"no_data", "unavailable"}:
            warnings.append(
                "The selected Aqueduct view has no usable score; automatic composite scoring is blocked."
            )
        if carbon_normalized is None:
            warnings.append(
                "A usable grid-carbon factor is unavailable; automatic composite scoring is blocked."
            )
        if water.cache.stale:
            warnings.append("Aqueduct data came from an expired cache after a source failure.")
        if grid.cache.stale:
            warnings.append("Grid-carbon data came from an expired cache after a source failure.")
        elif grid.cache.fallback_reason:
            warnings.append(f"Grid-carbon fallback: {grid.cache.fallback_reason}.")
        if material_divergence:
            warnings.append(
                "Aqueduct sensitivity views differ materially for this site; review the proxy choice."
            )
        if (
            selected.source_weight_fraction is not None
            and selected.source_weight_fraction < 0.999
        ):
            warnings.append(
                "The selected Aqueduct sector score uses a partial indicator weight fraction; interpret it with reduced confidence."
            )
        warnings.append(
            "Electric Power and Semiconductor views are proxy sensitivities, not WRI Data Center presets."
        )
        if site.it_load_utilization_pct is None:
            warnings.append(
                "IT-load utilisation is unavailable. Verify load-to-cooling alignment before treating it as a root cause."
            )

        # Cooling suitability is always grounded in direct Baseline Water Stress.
        # Alternative WRI views affect score sensitivity and ranking only.
        water_band = self._water_band(sensitivity[WaterView.BASELINE_WATER_STRESS])
        carbon_band = self._carbon_band(grid.emissions_intensity_gco2_per_kwh)
        cell_id = self._matrix_cell_id(water_band, carbon_band)
        cell = self.document["cooling_matrix"][cell_id]
        matrix_cell = MatrixCell(
            id=cell_id,
            label=cell["label"],
            water_band=water_band,
            carbon_band=carbon_band,
        )
        ppa = self._ppa_lever(carbon_band)
        recommendations = Recommendations(
            preferred=list(cell["preferred"]),
            conditional=list(cell["conditional"]),
            excluded=list(cell["excluded"]),
            energy_procurement_lever=ppa,
        )
        delivery, tradeoffs = self._delivery(site)
        proxy_metrics = self._proxy_metrics(site, grid)
        confidence = self._confidence(selected, grid, water.cache, grid.cache)
        if (
            selected.source_weight_fraction is not None
            and selected.source_weight_fraction < 0.999
            and confidence == "high"
        ):
            confidence = "medium"
        scores = PolicyScores(
            selected_water_view=selected_view,
            water_normalized=selected.normalized,
            carbon_normalized=carbon_normalized,
            environmental_priority=selected.environmental_priority,
            sensitivity=sensitivity,
            sensitivity_range=score_range,
            material_divergence_warning=material_divergence,
        )
        methodology_notes = [
            "environmental_priority = 100 × (water_weight × water_normalized + carbon_weight × carbon_normalized)",
            f"carbon_normalized is capped at 1.0 using an internal policy anchor of {anchor:g} gCO2e/kWh.",
            *self.document["disclaimers"],
        ]
        return (
            PolicyResult(
                version=self.version,
                confidence=confidence,
                scores=scores,
                matrix_cell=matrix_cell,
                recommendations=recommendations,
                delivery=delivery,
                business_tradeoffs=tradeoffs,
                proxy_metrics=proxy_metrics,
                methodology_notes=methodology_notes,
            ),
            warnings,
        )

    def _water_detail(self, source: WaterSource, view: WaterView) -> ScoreDetail:
        if source.data_status == "no_data":
            return ScoreDetail(status="no_data")
        if source.data_status in {"unavailable", "disabled"} or source.fields is None:
            status = "no_data" if source.data_status == "no_data" else "unavailable"
            return ScoreDetail(status=status)
        score_field, category_field, label_field = VIEW_FIELDS[view]
        weight_fraction_field = VIEW_WEIGHT_FRACTIONS[view]
        score = getattr(source.fields, score_field)
        category = getattr(source.fields, category_field)
        label = getattr(source.fields, label_field)
        weight_fraction = (
            getattr(source.fields, weight_fraction_field)
            if weight_fraction_field is not None
            else None
        )
        label_normalized = (label or "").strip().lower()
        if score == -9999 or category == -9999 or label_normalized == "no data":
            return ScoreDetail(
                source_score=score,
                source_category=category,
                source_label=label,
                source_weight_fraction=weight_fraction,
                status="no_data",
            )
        is_arid = score == -1 or category == -1 or "arid" in label_normalized
        if is_arid:
            return ScoreDetail(
                source_score=score,
                source_category=category,
                source_label=label,
                source_weight_fraction=weight_fraction,
                normalized=1.0,
                status="arid_policy_override",
            )
        if score is None or score < 0 or score > 5:
            return ScoreDetail(
                source_score=score,
                source_category=category,
                source_label=label,
                source_weight_fraction=weight_fraction,
                status="unavailable",
            )
        return ScoreDetail(
            source_score=score,
            source_category=category,
            source_label=label,
            source_weight_fraction=weight_fraction,
            normalized=round(score / 5.0, 6),
            status="scored",
        )

    @staticmethod
    def _carbon_normalized(source: GridSource, anchor: float) -> float | None:
        factor = source.emissions_intensity_gco2_per_kwh
        if source.data_status != "available" or factor is None:
            return None
        return round(min(max(factor / anchor, 0.0), 1.0), 6)

    @staticmethod
    def _water_band(detail: ScoreDetail) -> str:
        if detail.status in {"no_data", "unavailable"}:
            return "unknown"
        if detail.status == "arid_policy_override":
            return "high_or_arid"
        category = detail.source_category
        if category is None:
            if detail.normalized is None:
                return "unknown"
            category = detail.normalized * 5
        if category >= 3:
            return "high_or_arid"
        if category >= 2:
            return "medium_high"
        return "low"

    def _carbon_band(self, factor: float | None) -> str:
        if factor is None:
            return "unknown"
        for band in self.document["carbon_bands"]:
            minimum = float(band["minimum_inclusive"])
            maximum = band["maximum_exclusive"]
            if factor >= minimum and (maximum is None or factor < float(maximum)):
                return str(band["id"])
        return "unknown"

    @staticmethod
    def _matrix_cell_id(water_band: str, carbon_band: str) -> str:
        if water_band == "high_or_arid":
            return "high_or_arid"
        if water_band == "medium_high":
            return "medium_high"
        if water_band == "low" and carbon_band == "high":
            return "low_high_carbon"
        if water_band == "low" and carbon_band in {"low", "moderate"}:
            return "low_low_or_moderate_carbon"
        return "unknown"

    @staticmethod
    def _ppa_lever(carbon_band: str) -> EnergyProcurementLever:
        priority_by_band = {
            "high": "high",
            "moderate": "medium",
            "low": "opportunity",
            "unknown": "unrated",
        }
        rationale_by_band = {
            "high": "High grid intensity increases the value of a commercial PPA assessment.",
            "moderate": "A PPA may reduce market-based emissions subject to commercial and contractual review.",
            "low": "Retain PPA assessment as a procurement opportunity after efficiency and resilience needs.",
            "unknown": "Obtain a grid factor before prioritising the procurement lever.",
        }
        return EnergyProcurementLever(
            priority=priority_by_band[carbon_band],
            rationale=(
                rationale_by_band[carbon_band]
                + " It does not change the location-based factor or location-based CUE."
            ),
        )

    def _delivery(self, site: LocationInput) -> tuple[DeliveryPlan, list[str]]:
        actions = self.document["delivery_actions"]
        immediate = list(actions["base_immediate"])
        maintenance = list(actions["base_maintenance_window"])
        expansion: list[str] = []
        tradeoffs = [
            "Business constraints change delivery sequencing; the Location Exposure Score remains unchanged."
        ]
        if site.uptime_constraint == UptimeConstraint.NO_OUTAGE:
            immediate.extend(actions["no_outage_immediate"])
            maintenance.extend(actions["no_outage_maintenance_window"])
            tradeoffs.append(
                "The no-outage constraint moves intrusive retrofit work into an approved window and uses redundant-capacity pilots."
            )
        if site.cost_priority == CostPriority.CONSTRAINED:
            immediate.extend(actions["constrained_cost_immediate"])
            tradeoffs.append(
                "The cost constraint stages capital work after low-disruption efficiency measures and commercial assessment."
            )
        if site.growth_3y == GrowthLevel.HIGH:
            expansion.extend(actions["high_growth_expansion"])
            tradeoffs.append(
                "High growth directs the preferred architecture into planned capacity, limiting disruption to live halls."
            )
        elif site.project_type in {ProjectType.EXPANSION, ProjectType.GREENFIELD}:
            expansion.append(
                "Embed the screened cooling architecture in concept design and validate it through engineering modelling"
            )
        if site.it_load_utilization_pct is None:
            immediate.append(
                "Verify IT-load utilisation and load-to-cooling alignment before confirming the root-cause hypothesis"
            )
        elif site.it_load_utilization_pct < 40:
            immediate.append(
                "Test low IT-load utilisation as a potential driver of cooling-system inefficiency"
            )
        return (
            DeliveryPlan(
                immediate=list(dict.fromkeys(immediate)),
                maintenance_window=list(dict.fromkeys(maintenance)),
                expansion=list(dict.fromkeys(expansion)),
            ),
            tradeoffs,
        )

    @staticmethod
    def _proxy_metrics(site: LocationInput, grid: GridSource) -> ProxyMetrics:
        factor = (
            grid.emissions_intensity_gco2_per_kwh
            if grid.data_status == "available"
            else None
        )
        cue = None
        emissions = None
        water_use = None
        if factor is not None and site.pue is not None:
            cue = round(site.pue * factor / 1000.0, 6)
            if site.annual_it_energy_mwh is not None:
                emissions = round(site.annual_it_energy_mwh * site.pue * factor / 1000.0, 3)
        if site.wue_l_per_kwh is not None and site.annual_it_energy_mwh is not None:
            water_use = round(site.wue_l_per_kwh * site.annual_it_energy_mwh, 3)
        return ProxyMetrics(
            cue_location_based_kgco2e_per_kwh_it=cue,
            annual_operational_emissions_tco2e=emissions,
            annual_water_use_m3=water_use,
            factor_basis=grid.factor_basis if factor is not None else None,
        )

    @staticmethod
    def _confidence(
        selected: ScoreDetail,
        grid: GridSource,
        water_cache: CacheMetadata,
        grid_cache: CacheMetadata,
    ) -> str:
        if selected.normalized is None or grid.emissions_intensity_gco2_per_kwh is None:
            return "unavailable"
        if water_cache.stale or grid_cache.stale:
            return "medium"
        if grid.data_status == "available":
            return "high"
        return "low"

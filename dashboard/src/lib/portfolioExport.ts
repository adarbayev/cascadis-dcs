import type { AssessmentResult, OperationalProfile, OperationalScenario, PortfolioFilters, RankingMetric, SensitivityView } from "../types";
import {
  countryName,
  decision,
  environmentalScore,
  gridFactor,
  gridSource,
  hasMixedGridBasis,
  waterLabel,
  waterScore,
  waterSource,
} from "./assessment";
import { rowsToCsv } from "./csv";

const viewNames: Record<SensitivityView, string> = {
  bws: "Baseline Water Stress",
  default: "Default Overall Water Risk",
  elp: "Electric Power proxy",
  smc: "Semiconductor proxy",
};

interface PortfolioExportOptions {
  profiles?: Map<string, OperationalProfile>;
  rankingMetric?: RankingMetric;
  scenario?: OperationalScenario;
  filters?: PortfolioFilters;
  snapshotAt?: string;
}

export function buildPortfolioCsv(results: AssessmentResult[], view: SensitivityView, options: PortfolioExportOptions = {}): string {
  const rankingBlocked = hasMixedGridBasis(results, view);
  const rankingScore = (result: AssessmentResult) => options.rankingMetric === "composite"
    ? options.profiles?.get(result.assessment_id)?.composite_score ?? null
    : environmentalScore(result, view);
  const ordered = rankingBlocked
    ? [...results]
    : [...results].sort((first, second) =>
        (rankingScore(second) ?? -1) - (rankingScore(first) ?? -1),
      );
  const ranks = new Map<string, number | null>();
  let previousScore: number | null = null;
  let previousRank = 0;
  ordered.forEach((result, index) => {
    const score = rankingScore(result);
    if (rankingBlocked || score === null) {
      ranks.set(result.assessment_id, null);
      return;
    }
    const rank = previousScore === score ? previousRank : index + 1;
    ranks.set(result.assessment_id, rank);
    previousScore = score;
    previousRank = rank;
  });
  const headers = ["rank", "ranking_metric", "snapshot_at", "site_id", "site_name", "portfolio_id", "operator", "facility_status", "asset_scope", "latitude", "longitude", "coordinate_basis", "coordinate_confidence", "location_source_url", "location_source_checked_at", "business_inputs_basis", "known_facility_labels", "country", "water_view", "water_provider", "water_dataset_vintage", "water_score", "water_label", "grid_provider", "grid_factor_gco2e_per_kwh", "grid_year", "grid_unit", "grid_factor_basis", "location_exposure_score", "composite_priority_score", "pue", "pue_basis", "pue_detail", "pue_source_url", "wue_l_per_kwh", "wue_basis", "wue_detail", "wue_source_url", "cue_kgco2e_per_kwh_it", "cue_basis", "cue_detail", "cue_source_url", "facility_weight", "water_weight", "grid_weight", "pue_target", "pue_upper", "wue_target_l_per_kwh", "wue_upper_l_per_kwh", "grid_anchor_gco2e_per_kwh", "exposure_filter_min", "exposure_filter_max", "composite_filter_min", "composite_filter_max", "pue_filter_min", "pue_filter_max", "wue_filter_min", "wue_filter_max", "cue_filter_min", "cue_filter_max", "water_stress_filter", "include_unscored_filter", "decision_cell", "preferred_cooling", "warnings", "water_source_url", "water_attribution", "water_retrieved_at", "grid_source_url", "grid_attribution", "grid_retrieved_at"];
  const rows = ordered.map((result) => {
    const water = waterSource(result);
    const grid = gridSource(result);
    const evidence = result.site.location_evidence;
    const profile = options.profiles?.get(result.assessment_id);
    return [
      ranks.get(result.assessment_id) ?? "",
      options.rankingMetric ?? "exposure",
      options.snapshotAt,
      result.site.id,
      result.site.name,
      evidence?.portfolio_id,
      evidence?.operator,
      evidence?.facility_status,
      evidence?.asset_scope,
      result.site.latitude,
      result.site.longitude,
      evidence?.coordinate_basis,
      evidence?.coordinate_confidence,
      evidence?.facility_source_url,
      evidence?.source_checked_at,
      evidence?.business_inputs_basis,
      evidence?.known_facility_labels?.join(" | "),
      countryName(result),
      viewNames[view],
      water?.provider,
      water?.dataset_vintage,
      waterScore(result, view),
      waterLabel(result, view),
      grid?.provider,
      gridFactor(result),
      grid?.date ?? grid?.year ?? grid?.dataset_vintage,
      grid?.unit,
      grid?.factor_basis ?? grid?.basis,
      environmentalScore(result, view),
      profile?.composite_score,
      profile?.pue.value,
      profile?.pue.basis,
      profile?.pue.detail,
      profile?.pue.source_url,
      profile?.wue.value,
      profile?.wue.basis,
      profile?.wue.detail,
      profile?.wue.source_url,
      profile?.cue.value,
      profile?.cue.basis,
      profile?.cue.detail,
      profile?.cue.source_url,
      profile?.normalized_weights.facility ?? options.scenario?.weights.facility,
      profile?.normalized_weights.water ?? options.scenario?.weights.water,
      profile?.normalized_weights.carbon ?? options.scenario?.weights.carbon,
      options.scenario?.anchors.pue_target,
      options.scenario?.anchors.pue_upper,
      options.scenario?.anchors.wue_target_l_per_kwh,
      options.scenario?.anchors.wue_l_per_kwh,
      options.scenario?.anchors.grid_gco2e_per_kwh,
      options.filters?.exposure_min,
      options.filters?.exposure_max,
      options.filters?.composite_min,
      options.filters?.composite_max,
      options.filters?.pue_min,
      options.filters?.pue_max,
      options.filters?.wue_min,
      options.filters?.wue_max,
      options.filters?.cue_min,
      options.filters?.cue_max,
      options.filters?.water_stress,
      options.filters?.include_unscored,
      decision(result).matrix_cell,
      (decision(result).preferred ?? decision(result).preferred_cooling ?? []).join(" | "),
      (result.warnings ?? []).join(" | "),
      water?.source_url,
      water?.attribution,
      water?.retrieved_at,
      grid?.source_url,
      grid?.attribution,
      grid?.retrieved_at,
    ];
  });
  return rowsToCsv(headers, rows);
}

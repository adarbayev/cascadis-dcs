import type { AssessmentResult, SensitivityView } from "../types";
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

export function buildPortfolioCsv(results: AssessmentResult[], view: SensitivityView): string {
  const rankingBlocked = hasMixedGridBasis(results, view);
  const ordered = rankingBlocked
    ? [...results]
    : [...results].sort((first, second) =>
        (environmentalScore(second, view) ?? -1) - (environmentalScore(first, view) ?? -1),
      );
  const ranks = new Map<string, number | null>();
  let previousScore: number | null = null;
  let previousRank = 0;
  ordered.forEach((result, index) => {
    const score = environmentalScore(result, view);
    if (rankingBlocked || score === null) {
      ranks.set(result.assessment_id, null);
      return;
    }
    const rank = previousScore === score ? previousRank : index + 1;
    ranks.set(result.assessment_id, rank);
    previousScore = score;
    previousRank = rank;
  });
  const headers = ["rank", "site_id", "site_name", "portfolio_id", "operator", "facility_status", "asset_scope", "latitude", "longitude", "coordinate_basis", "coordinate_confidence", "location_source_url", "location_source_checked_at", "business_inputs_basis", "known_facility_labels", "country", "water_view", "water_provider", "water_dataset_vintage", "water_score", "water_label", "grid_provider", "grid_factor_gco2e_per_kwh", "grid_year", "grid_unit", "grid_factor_basis", "location_exposure_score", "decision_cell", "preferred_cooling", "warnings", "water_source_url", "water_attribution", "water_retrieved_at", "grid_source_url", "grid_attribution", "grid_retrieved_at"];
  const rows = ordered.map((result) => {
    const water = waterSource(result);
    const grid = gridSource(result);
    const evidence = result.site.location_evidence;
    return [
      ranks.get(result.assessment_id) ?? "",
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

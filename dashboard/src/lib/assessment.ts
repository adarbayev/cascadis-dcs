import type {
  ApiWaterView,
  AssessmentResult,
  GeoJsonGeometry,
  GridSource,
  PolicyDecision,
  SensitivityView,
  WaterSource,
} from "../types";

export const apiViewKey: Record<SensitivityView, ApiWaterView> = {
  bws: "baseline_water_stress",
  default: "default_overall",
  elp: "electric_power",
  smc: "semiconductor",
};

const numeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const nestedNumber = (source: Record<string, unknown> | null | undefined, keys: string[]): number | null => {
  for (const key of keys) {
    const value = source?.[key];
    const direct = numeric(value);
    if (direct !== null) return direct;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const embedded = numeric(record.score ?? record.value ?? record.raw);
      if (embedded !== null) return embedded;
    }
  }
  return null;
};

const nestedText = (source: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  for (const key of keys) {
    const value = source?.[key];
    const direct = text(value);
    if (direct) return direct;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const embedded = text(record.label ?? record.name ?? record.value);
      if (embedded) return embedded;
    }
  }
  return null;
};

export function waterSource(result: AssessmentResult): WaterSource | null {
  return result.source?.water ?? null;
}

export function gridSource(result: AssessmentResult): GridSource | null {
  return result.source?.grid ?? null;
}

export function waterScore(result: AssessmentResult, view: SensitivityView): number | null {
  const detail = result.policy_v1?.scores?.sensitivity?.[apiViewKey[view]];
  if (detail?.status === "no_data" || detail?.status === "unavailable") return null;
  const policyScore = numeric(detail?.source_score);
  if (policyScore !== null) return policyScore;

  const source = waterSource(result);
  const water = (source?.fields ?? source) as Record<string, unknown> | null;
  const fields: Record<SensitivityView, string[]> = {
    bws: ["bws_score", "bws", "baseline_water_stress"],
    default: ["w_awr_def_tot_score", "default_overall", "default_overall_score"],
    elp: ["w_awr_elp_tot_score", "electric_power_overall", "elp_overall_score"],
    smc: ["w_awr_smc_tot_score", "semiconductor_overall", "smc_overall_score"],
  };
  const score = nestedNumber(water, fields[view]);
  return score === -9999 ? null : score;
}

export function waterLabel(result: AssessmentResult, view: SensitivityView): string | null {
  const detail = result.policy_v1?.scores?.sensitivity?.[apiViewKey[view]];
  const policyLabel = text(detail?.source_label);
  if (policyLabel) return policyLabel;
  const source = waterSource(result);
  const water = (source?.fields ?? source) as Record<string, unknown> | null;
  const fields: Record<SensitivityView, string[]> = {
    bws: ["bws_label", "bws", "baseline_water_stress"],
    default: ["w_awr_def_tot_label", "default_overall", "default_overall_label"],
    elp: ["w_awr_elp_tot_label", "electric_power_overall", "elp_overall_label"],
    smc: ["w_awr_smc_tot_label", "semiconductor_overall", "smc_overall_label"],
  };
  return nestedText(water, fields[view]);
}

export function bwsCategory(result: AssessmentResult): number | null {
  const policyCategory = numeric(result.policy_v1?.scores?.sensitivity?.baseline_water_stress?.source_category);
  if (policyCategory !== null) return policyCategory === -9999 ? null : policyCategory;
  const source = waterSource(result);
  const water = (source?.fields ?? source) as Record<string, unknown> | null;
  const category = nestedNumber(water, ["bws_cat", "bws_category", "bws"]);
  return category === -9999 ? null : category;
}

export function gridFactor(result: AssessmentResult): number | null {
  return nestedNumber(gridSource(result) as Record<string, unknown> | null, [
    "emissions_intensity_gco2_per_kwh",
    "factor_gco2e_per_kwh",
    "carbon_intensity",
    "value",
  ]);
}

export function countryIso3(result: AssessmentResult): string | null {
  return (
    nestedText(gridSource(result) as Record<string, unknown> | null, ["entity_code", "iso3", "country_code"]) ??
    nestedText(waterSource(result)?.geography as Record<string, unknown> | null, ["gid_0"]) ??
    text(result.site.iso3)
  )?.toUpperCase() ?? null;
}

export function countryName(result: AssessmentResult): string | null {
  return (
    nestedText(gridSource(result) as Record<string, unknown> | null, ["entity", "country_name", "country"]) ??
    nestedText(waterSource(result)?.geography as Record<string, unknown> | null, ["name_0"]) ??
    text(result.site.country_name)
  );
}

export function environmentalScore(result: AssessmentResult, view: SensitivityView): number | null {
  const scores = result.policy_v1?.scores;
  const canonicalDetail = scores?.sensitivity?.[apiViewKey[view]];
  if (canonicalDetail) return numeric(canonicalDetail.environmental_priority);
  const viewScore = scores?.views?.[view]?.environmental_priority;
  const normalizedViewScore = numeric(viewScore);
  if (normalizedViewScore !== null) return normalizedViewScore;

  const flatKey = `${view}_environmental_priority`;
  const flatScore = numeric(scores?.[flatKey]);
  if (flatScore !== null) return flatScore;

  if (view === "bws") return numeric(scores?.environmental_priority);
  return null;
}

function normaliseBasisPart(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "[missing]";
}

export function gridBasisSignature(result: AssessmentResult): string {
  const grid = gridSource(result);
  return [grid?.provider, grid?.factor_basis ?? grid?.basis, grid?.unit].map(normaliseBasisPart).join("|");
}

export function hasMixedGridBasis(results: AssessmentResult[], view?: SensitivityView): boolean {
  const views: SensitivityView[] = ["bws", "default", "elp", "smc"];
  const scored = results.filter((result) =>
    view ? environmentalScore(result, view) !== null : views.some((candidate) => environmentalScore(result, candidate) !== null),
  );
  return new Set(scored.map(gridBasisSignature)).size > 1;
}

export function sensitivitySpread(
  result: AssessmentResult,
): { min: number; max: number; materialDivergence: boolean } | null {
  const sourceRange = result.policy_v1?.scores?.sensitivity_range;
  const sourceMin = numeric(sourceRange?.minimum);
  const sourceMax = numeric(sourceRange?.maximum);
  if (sourceMin !== null && sourceMax !== null) {
    return {
      min: sourceMin,
      max: sourceMax,
      materialDivergence: result.policy_v1?.scores?.material_divergence_warning ?? sourceMax - sourceMin >= 10,
    };
  }
  const values = (["bws", "default", "elp", "smc"] as SensitivityView[])
    .map((view) => environmentalScore(result, view))
    .filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, materialDivergence: max - min >= 10 };
}

export function hasPortfolioRankReversal(results: AssessmentResult[]): boolean {
  if (results.length < 2) return false;
  if (hasMixedGridBasis(results)) return false;
  if (results.some((result) => result.policy_v1?.scores?.rank_reversal_warning)) return true;
  const views = (["bws", "default", "elp", "smc"] as SensitivityView[])
    .map((view) => ({
      view,
      ranking: results
        .map((result) => ({ id: result.assessment_id, score: environmentalScore(result, view) }))
        .filter((item): item is { id: string; score: number } => item.score !== null)
        .sort((a, b) => b.score - a.score),
    }))
    .filter(({ ranking }) => ranking.length === results.length);

  for (let first = 0; first < views.length; first += 1) {
    for (let second = first + 1; second < views.length; second += 1) {
      const firstPositions = new Map(views[first].ranking.map((item, index) => [item.id, index]));
      const changed = views[second].ranking.some((item, index) => firstPositions.get(item.id) !== index);
      if (changed) return true;
    }
  }
  return false;
}

export function decision(result: AssessmentResult): PolicyDecision {
  const policy = result.policy_v1;
  if (policy?.decision) return policy.decision;
  return {
    matrix_cell: policy?.matrix_cell?.label ?? policy?.matrix_cell?.id,
    title: policy?.matrix_cell?.label,
    preferred: policy?.recommendations?.preferred ?? [],
    conditional: policy?.recommendations?.conditional ?? [],
    excluded: policy?.recommendations?.excluded ?? [],
    immediate_actions: policy?.delivery?.immediate ?? [],
    maintenance_window_actions: policy?.delivery?.maintenance_window ?? [],
    expansion_actions: policy?.delivery?.expansion ?? [],
    business_tradeoffs: policy?.business_tradeoffs ?? [],
    ppa_priority: policy?.recommendations?.energy_procurement_lever?.priority,
    confidence: policy?.confidence,
  };
}

export function preferredCooling(result: AssessmentResult): string[] {
  const value = decision(result).preferred ?? decision(result).preferred_cooling;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function priorityBand(score: number | null): "critical" | "high" | "moderate" | "lower" | "unscored" {
  if (score === null) return "unscored";
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "moderate";
  return "lower";
}

export function sourceGeometry(
  result: AssessmentResult,
  source: "water" | "grid",
): GeoJsonGeometry | null {
  const record = result.source?.[source] as Record<string, unknown> | null | undefined;
  const candidate = record?.[source === "water" ? "basin_geometry" : "country_geometry"] ?? record?.geometry;
  if (!candidate || typeof candidate !== "object") return null;
  const geometry = candidate as GeoJsonGeometry;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  return geometry;
}

export function formatNumber(value: number | null, digits = 0): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(value?: string): string {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

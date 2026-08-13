import type {
  AssessmentResult,
  OperationalMetricValue,
  OperationalProfile,
  OperationalScenario,
  PolicyDocument,
  PortfolioFilters,
  SensitivityView,
} from "../types";
import { environmentalScore, gridFactor, gridSource, waterCategory, waterScore } from "./assessment";
import { googlePueForSite } from "./googlePue";

export const DEFAULT_OPERATIONAL_SCENARIO: OperationalScenario = {
  fallback_pue: 1.09,
  use_reported_google_pue: true,
  fallback_wue_l_per_kwh: 1.15,
  fixed_cue_kgco2e_per_kwh_it: null,
  weights: { facility: 0.3, water: 0.4, carbon: 0.3 },
  anchors: {
    pue_target: 1.4,
    pue_upper: 2,
    wue_target_l_per_kwh: 1.5,
    wue_l_per_kwh: 3,
    grid_gco2e_per_kwh: 800,
  },
};

export const DEFAULT_PORTFOLIO_FILTERS: PortfolioFilters = {
  exposure_min: 0,
  exposure_max: 100,
  composite_min: 0,
  composite_max: 100,
  pue_min: null,
  pue_max: null,
  wue_min: null,
  wue_max: null,
  cue_min: null,
  cue_max: null,
  water_stress: "all",
  include_unscored: true,
};

const configuredNumber = (value: unknown, fallback: number, minimum = 0): number =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum ? value : fallback;

export function operationalScenarioFromPolicy(policy: PolicyDocument): OperationalScenario {
  const configured = policy.operational_composite;
  if (!configured) return DEFAULT_OPERATIONAL_SCENARIO;
  return {
    fallback_pue: configuredNumber(configured.default_assumptions?.pue, DEFAULT_OPERATIONAL_SCENARIO.fallback_pue, 1),
    use_reported_google_pue: true,
    fallback_wue_l_per_kwh: configuredNumber(configured.default_assumptions?.wue_l_per_kwh, DEFAULT_OPERATIONAL_SCENARIO.fallback_wue_l_per_kwh),
    fixed_cue_kgco2e_per_kwh_it: configured.default_assumptions?.fixed_cue_kgco2e_per_kwh_it ?? null,
    weights: {
      facility: configuredNumber(configured.default_weights?.facility_efficiency, DEFAULT_OPERATIONAL_SCENARIO.weights.facility),
      water: configuredNumber(configured.default_weights?.water_stress, DEFAULT_OPERATIONAL_SCENARIO.weights.water),
      carbon: configuredNumber(configured.default_weights?.grid_carbon, DEFAULT_OPERATIONAL_SCENARIO.weights.carbon),
    },
    anchors: {
      pue_target: configuredNumber(configured.anchors?.pue_target, DEFAULT_OPERATIONAL_SCENARIO.anchors.pue_target, 1),
      pue_upper: configuredNumber(configured.anchors?.pue_upper, DEFAULT_OPERATIONAL_SCENARIO.anchors.pue_upper, 1),
      wue_target_l_per_kwh: configuredNumber(configured.anchors?.wue_target_l_per_kwh, DEFAULT_OPERATIONAL_SCENARIO.anchors.wue_target_l_per_kwh),
      wue_l_per_kwh: configuredNumber(configured.anchors?.wue_upper_l_per_kwh, DEFAULT_OPERATIONAL_SCENARIO.anchors.wue_l_per_kwh),
      grid_gco2e_per_kwh: configuredNumber(configured.anchors?.grid_gco2e_per_kwh, DEFAULT_OPERATIONAL_SCENARIO.anchors.grid_gco2e_per_kwh),
    },
  };
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

function metric(value: number | null, basis: OperationalMetricValue["basis"], detail: string, source_url?: string): OperationalMetricValue {
  return { value, basis, detail, source_url };
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeScenarioWeights(weights: OperationalScenario["weights"]): OperationalProfile["normalized_weights"] {
  const safe = {
    facility: Math.max(weights.facility, 0),
    water: Math.max(weights.water, 0),
    carbon: Math.max(weights.carbon, 0),
  };
  const total = safe.facility + safe.water + safe.carbon;
  if (total <= 0) return { facility: 0, water: 0, carbon: 0 };
  return {
    facility: safe.facility / total,
    water: safe.water / total,
    carbon: safe.carbon / total,
  };
}

export function buildOperationalProfile(
  result: AssessmentResult,
  scenario: OperationalScenario,
  view: SensitivityView = "bws",
): OperationalProfile {
  const sitePue = positive(result.site.pue);
  const publishedPue = googlePueForSite(result.site.id);
  const isGooglePortfolio = result.site.location_evidence?.portfolio_id === "google_public_data_centers";
  const pue = sitePue !== null
    ? metric(sitePue, "site_input", "Site input")
    : publishedPue && scenario.use_reported_google_pue
      ? metric(publishedPue.value, "operator_reported", publishedPue.detail, publishedPue.source_url)
      : isGooglePortfolio && scenario.fallback_pue === 1.09
        ? metric(scenario.fallback_pue, "fleet_proxy", "Google 2025 fleet-wide PUE proxy", "https://datacenters.google/intl/en/efficiency/")
        : metric(scenario.fallback_pue, "scenario_assumption", "User scenario assumption");

  const siteWue = positive(result.site.wue_l_per_kwh);
  const wue = siteWue !== null
    ? metric(siteWue, "site_input", "Site input")
    : isGooglePortfolio && scenario.fallback_wue_l_per_kwh === 1.15
      ? metric(scenario.fallback_wue_l_per_kwh, "fleet_proxy", "Google 2024 fleet proxy for data centers supporting LLM models; no site-level public WUE match", "https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf")
      : metric(scenario.fallback_wue_l_per_kwh, "scenario_assumption", "User scenario assumption; no site-level public WUE match");

  const factor = gridFactor(result);
  const fixedCue = scenario.fixed_cue_kgco2e_per_kwh_it;
  const derivedCue = pue.value !== null && factor !== null ? pue.value * factor / 1000 : null;
  const cue = fixedCue !== null
    ? metric(fixedCue, "scenario_assumption", "Fixed scenario override")
    : metric(derivedCue, "derived", "PUE × national Ember grid factor; location-based proxy", gridSource(result)?.source_url);

  const stress = waterScore(result, view);
  const pueAnchorRange = scenario.anchors.pue_upper - scenario.anchors.pue_target;
  const wueAnchorRange = scenario.anchors.wue_l_per_kwh - scenario.anchors.wue_target_l_per_kwh;
  const pueGap = pue.value !== null && pueAnchorRange > 0 ? clamp01((pue.value - scenario.anchors.pue_target) / pueAnchorRange) : null;
  const wueGap = wue.value !== null && wueAnchorRange > 0 ? clamp01((wue.value - scenario.anchors.wue_target_l_per_kwh) / wueAnchorRange) : null;
  const components = {
    facility: pueGap !== null && wueGap !== null ? 0.5 * pueGap + 0.5 * wueGap : null,
    pue_gap: pueGap,
    wue_gap: wueGap,
    water: stress !== null ? clamp01(stress / 5) : null,
    // CUE is retained as a derived operating KPI and filter. The composite uses
    // the underlying grid factor here because adding CUE beside PUE would count
    // the PUE term twice.
    carbon: factor !== null && scenario.anchors.grid_gco2e_per_kwh > 0
      ? clamp01(factor / scenario.anchors.grid_gco2e_per_kwh)
      : null,
  };
  const normalizedWeights = normalizeScenarioWeights(scenario.weights);
  const complete = [components.facility, components.water, components.carbon].every((value) => value !== null);
  const validWeights = normalizedWeights.facility + normalizedWeights.water + normalizedWeights.carbon > 0;
  const compositeScore = complete && validWeights
    ? 100 * (
      (components.facility as number) * normalizedWeights.facility
      + (components.water as number) * normalizedWeights.water
      + (components.carbon as number) * normalizedWeights.carbon
    )
    : null;

  return {
    pue,
    wue,
    cue,
    water_stress_score: stress,
    components,
    normalized_weights: normalizedWeights,
    composite_score: compositeScore,
  };
}

export function profileMatchesFilters(
  result: AssessmentResult,
  profile: OperationalProfile,
  filters: PortfolioFilters,
  view: SensitivityView,
): boolean {
  const exposure = environmentalScore(result, view);
  if (exposure === null) {
    if (!filters.include_unscored || filters.exposure_min > 0 || filters.exposure_max < 100) return false;
  } else if (exposure < filters.exposure_min || exposure > filters.exposure_max) return false;
  if (profile.composite_score === null) {
    if (!filters.include_unscored || filters.composite_min > 0 || filters.composite_max < 100) return false;
  } else if (profile.composite_score < filters.composite_min || profile.composite_score > filters.composite_max) return false;
  if (filters.pue_min !== null && (profile.pue.value === null || profile.pue.value < filters.pue_min)) return false;
  if (filters.pue_max !== null && (profile.pue.value === null || profile.pue.value > filters.pue_max)) return false;
  if (filters.wue_min !== null && (profile.wue.value === null || profile.wue.value < filters.wue_min)) return false;
  if (filters.wue_max !== null && (profile.wue.value === null || profile.wue.value > filters.wue_max)) return false;
  if (filters.cue_min !== null && (profile.cue.value === null || profile.cue.value < filters.cue_min)) return false;
  if (filters.cue_max !== null && (profile.cue.value === null || profile.cue.value > filters.cue_max)) return false;
  if (filters.water_stress !== "all") {
    const categories = {
      arid: -1,
      low: 0,
      low_medium: 1,
      medium_high: 2,
      high: 3,
      extremely_high: 4,
    } as const;
    const category = waterCategory(result, "bws");
    if (filters.water_stress === "no_data" ? category !== null : category !== categories[filters.water_stress]) return false;
  }
  return true;
}

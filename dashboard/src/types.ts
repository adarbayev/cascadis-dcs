export type ProjectType = "retrofit" | "expansion" | "greenfield";
export type CostPriority = "constrained" | "balanced" | "investment_ready";
export type UptimeConstraint = "no_outage" | "maintenance_window" | "major_works_allowed";
export type GrowthRate = "stable" | "moderate" | "high";
export type SensitivityView = "bws" | "default" | "elp" | "smc";
export type ApiWaterView = "baseline_water_stress" | "default_overall" | "electric_power" | "semiconductor";
export type MapLayer = "water" | "carbon" | "recommendation";
export type RankingMetric = "composite" | "exposure";

export interface OperationalScenario {
  fallback_pue: number;
  use_reported_google_pue: boolean;
  fallback_wue_l_per_kwh: number;
  fixed_cue_kgco2e_per_kwh_it: number | null;
  weights: {
    facility: number;
    water: number;
    carbon: number;
  };
  anchors: {
    pue_target: number;
    pue_upper: number;
    wue_target_l_per_kwh: number;
    wue_l_per_kwh: number;
    grid_gco2e_per_kwh: number;
  };
}

export type OperationalMetricBasis = "site_input" | "operator_reported" | "fleet_proxy" | "scenario_assumption" | "derived";

export interface OperationalMetricValue {
  value: number | null;
  basis: OperationalMetricBasis;
  detail: string;
  source_url?: string;
}

export interface OperationalProfile {
  pue: OperationalMetricValue;
  wue: OperationalMetricValue;
  cue: OperationalMetricValue;
  water_stress_score: number | null;
  components: {
    facility: number | null;
    pue_gap: number | null;
    wue_gap: number | null;
    water: number | null;
    carbon: number | null;
  };
  normalized_weights: {
    facility: number;
    water: number;
    carbon: number;
  };
  composite_score: number | null;
}

export interface PortfolioFilters {
  exposure_min: number;
  exposure_max: number;
  composite_min: number;
  composite_max: number;
  pue_min: number | null;
  pue_max: number | null;
  wue_min: number | null;
  wue_max: number | null;
  cue_min: number | null;
  cue_max: number | null;
  include_unscored: boolean;
}

export interface LocationEvidence {
  portfolio_id: string;
  portfolio_version: string;
  operator: string;
  facility_status: "operating" | "in_development" | "under_construction" | "announced" | "unknown";
  facility_source_title: string;
  facility_source_url: string;
  source_checked_at: string;
  coordinate_source_url: string;
  coordinate_basis: "operator_published_point" | "published_address_geocode" | "published_locality_geocode" | "locality_centroid";
  coordinate_confidence: "high" | "medium" | "low";
  business_inputs_basis: "operator_disclosed" | "screening_defaults";
  methodology_reference_url?: string | null;
  asset_scope?: string | null;
  known_facility_labels?: string[];
  known_facility_count?: number | null;
  note?: string | null;
}

export interface LocationInput {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  project_type: ProjectType;
  cost_priority: CostPriority;
  uptime_constraint: UptimeConstraint;
  growth_3y: GrowthRate;
  pue?: number | null;
  wue_l_per_kwh?: number | null;
  it_load_utilization_pct?: number | null;
  annual_it_energy_mwh?: number | null;
  location_evidence?: LocationEvidence | null;
}

export interface AssessmentRequest {
  locations: LocationInput[];
  weights: {
    water: number;
    carbon: number;
  };
  water_view?: ApiWaterView;
}

export interface SourceMetric {
  raw?: number | null;
  score?: number | null;
  cat?: number | null;
  label?: string | null;
  units?: string | null;
}

export interface WaterSource {
  provider?: string;
  dataset?: string;
  dataset_vintage?: string;
  retrieved_at?: string;
  stale?: boolean;
  data_status?: "available" | "no_data" | "unavailable" | "disabled";
  source_url?: string;
  attribution?: string;
  cache?: { hit?: boolean; stale?: boolean; expires_at?: string | null; fallback_reason?: string | null };
  geography?: {
    aq30_id?: string | number | null;
    pfaf_id?: string | number | null;
    aqid?: string | number | null;
    gid_0?: string | null;
    gid_1?: string | null;
    name_0?: string | null;
    name_1?: string | null;
  } | null;
  fields?: Record<string, number | string | null> | null;
  basin_name?: string | null;
  basin_id?: string | number | null;
  geometry?: GeoJsonGeometry | null;
  basin_geometry?: GeoJsonGeometry | null;
  bws?: SourceMetric;
  bws_raw?: number | null;
  bws_score?: number | null;
  bws_cat?: number | null;
  bws_label?: string | null;
  default_overall?: SourceMetric;
  electric_power_quantity?: SourceMetric;
  electric_power_overall?: SourceMetric;
  semiconductor_overall?: SourceMetric;
  [key: string]: unknown;
}

export interface GridSource {
  provider?: string;
  dataset?: string;
  year?: number | string;
  retrieved_at?: string;
  stale?: boolean;
  data_status?: "available" | "no_data" | "unavailable" | "not_configured" | "disabled";
  source_url?: string;
  attribution?: string;
  factor_basis?: string;
  unit?: string;
  transport?: "api" | "public_csv" | "local_file";
  cache?: { hit?: boolean; stale?: boolean; expires_at?: string | null; fallback_reason?: string | null };
  entity?: string | null;
  entity_code?: string | null;
  date?: string | null;
  emissions_intensity_gco2_per_kwh?: number | null;
  iso3?: string | null;
  country_name?: string | null;
  match_level?: string | null;
  factor_gco2e_per_kwh?: number | null;
  carbon_intensity?: number | null;
  units?: string | null;
  basis?: string | null;
  geometry?: GeoJsonGeometry | null;
  country_geometry?: GeoJsonGeometry | null;
  [key: string]: unknown;
}

export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface PolicyScoreView {
  environmental_priority?: number | null;
  water_normalized?: number | null;
  carbon_normalized?: number | null;
  water_score?: number | null;
  source_score?: number | null;
  source_category?: number | null;
  source_label?: string | null;
  source_weight_fraction?: number | null;
  normalized?: number | null;
  status?: "scored" | "arid_policy_override" | "no_data" | "unavailable";
}

export interface PolicyScores extends PolicyScoreView {
  views?: Partial<Record<SensitivityView, PolicyScoreView>>;
  selected_water_view?: ApiWaterView;
  sensitivity?: Partial<Record<ApiWaterView, PolicyScoreView>>;
  sensitivity_range?: { minimum?: number | null; maximum?: number | null };
  rank_by_view?: Partial<Record<ApiWaterView, number | null>>;
  material_divergence_warning?: boolean;
  rank_reversal_warning?: boolean;
  sensitivity_min?: number | null;
  sensitivity_max?: number | null;
  [key: string]: unknown;
}

export interface PolicyDecision {
  matrix_cell?: string;
  title?: string;
  summary?: string;
  preferred?: string[];
  preferred_cooling?: string[];
  conditional?: string[];
  excluded?: string[];
  immediate_actions?: string[];
  maintenance_window_actions?: string[];
  expansion_actions?: string[];
  business_tradeoffs?: string[];
  ppa_priority?: string;
  confidence?: string;
  [key: string]: unknown;
}

export interface AssessmentResult {
  assessment_id: string;
  status?: string;
  site: LocationInput & {
    iso3?: string | null;
    country_name?: string | null;
    [key: string]: unknown;
  };
  source?: {
    water?: WaterSource | null;
    grid?: GridSource | null;
  };
  policy_v1?: {
    version?: string;
    confidence?: string;
    scores?: PolicyScores;
    decision?: PolicyDecision;
    matrix_cell?: { id?: string; label?: string; water_band?: string; carbon_band?: string };
    recommendations?: {
      preferred?: string[];
      conditional?: string[];
      excluded?: string[];
      energy_procurement_lever?: {
        category?: string;
        priority?: string;
        affects_location_based_score?: boolean;
        rationale?: string;
      };
    };
    delivery?: { immediate?: string[]; maintenance_window?: string[]; expansion?: string[] };
    business_tradeoffs?: string[];
    proxy_metrics?: Record<string, number | string | null>;
    methodology_notes?: string[];
  };
  warnings?: string[];
  provenance?: Array<Record<string, unknown>> | Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface AssessmentResponse {
  assessments: AssessmentResult[];
  policy_version?: string;
}

export interface StaticPortfolioSnapshot {
  schema_version: string;
  snapshot_at: string;
  snapshot_scope: string;
  manifest_version: string;
  policy: PolicyDocument;
  source_status: SourceStatus[];
  assessments: AssessmentResult[];
}

export interface SourceStatus {
  id?: string;
  provider?: string;
  label?: string;
  status?: "available" | "ok" | "stale" | "unavailable" | "not_configured" | "disabled" | string;
  detail?: string;
  checked_at?: string;
  dataset_vintage?: string;
  required?: boolean;
  enabled?: boolean;
  configured?: boolean;
  mode?: string;
  source_url?: string | null;
  latest_cached_retrieval?: string | null;
  note?: string;
}

export interface PolicyDocument {
  version?: string;
  carbon_anchor_gco2e_per_kwh?: number;
  anchors?: { carbon_gco2e_per_kwh?: number };
  carbon_bands?: Record<string, number | string>;
  default_weights?: { water: number; carbon: number };
  operational_composite?: {
    default_assumptions?: { pue?: number; wue_l_per_kwh?: number; fixed_cue_kgco2e_per_kwh_it?: number | null };
    anchors?: { pue_target?: number; pue_upper?: number; wue_target_l_per_kwh?: number; wue_upper_l_per_kwh?: number; grid_gco2e_per_kwh?: number };
    default_weights?: { facility_efficiency?: number; water_stress?: number; grid_carbon?: number };
  };
  [key: string]: unknown;
}

export interface DraftForm {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  project_type: ProjectType;
  cost_priority: CostPriority;
  uptime_constraint: UptimeConstraint;
  growth_3y: GrowthRate;
  pue: string;
  wue_l_per_kwh: string;
  it_load_utilization_pct: string;
  annual_it_energy_mwh: string;
}

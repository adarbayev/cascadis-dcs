import { describe, expect, it } from "vitest";
import { assessmentFixture } from "../test/fixtures";
import {
  buildOperationalProfile,
  DEFAULT_OPERATIONAL_SCENARIO,
  DEFAULT_PORTFOLIO_FILTERS,
  normalizeScenarioWeights,
  operationalScenarioFromPolicy,
  profileMatchesFilters,
} from "./operationalScore";

describe("operational scenario score", () => {
  it("derives CUE once from PUE and the grid factor", () => {
    const profile = buildOperationalProfile(assessmentFixture(), DEFAULT_OPERATIONAL_SCENARIO);
    expect(profile.pue.value).toBe(1.62);
    expect(profile.pue.basis).toBe("site_input");
    expect(profile.wue.value).toBe(0.4);
    expect(profile.cue.value).toBeCloseTo(1.62 * 367 / 1000, 6);
    expect(profile.cue.basis).toBe("derived");
    expect(profile.composite_score).not.toBeNull();
  });

  it("does not renormalize a composite with missing source evidence", () => {
    const result = assessmentFixture();
    result.source!.grid = null;
    const profile = buildOperationalProfile(result, DEFAULT_OPERATIONAL_SCENARIO);
    expect(profile.cue.value).toBeNull();
    expect(profile.composite_score).toBeNull();
  });

  it("normalizes user weights and applies range filters", () => {
    expect(normalizeScenarioWeights({ facility: 2, water: 4, carbon: 4 })).toEqual({ facility: 0.2, water: 0.4, carbon: 0.4 });
    const result = assessmentFixture();
    const profile = buildOperationalProfile(result, DEFAULT_OPERATIONAL_SCENARIO);
    expect(profileMatchesFilters(result, profile, DEFAULT_PORTFOLIO_FILTERS, "bws")).toBe(true);
    expect(profileMatchesFilters(result, profile, { ...DEFAULT_PORTFOLIO_FILTERS, exposure_max: 50 }, "bws")).toBe(false);
    expect(profileMatchesFilters(result, profile, { ...DEFAULT_PORTFOLIO_FILTERS, pue_max: 1.4 }, "bws")).toBe(false);
  });

  it("uses published Google PUE matches and keeps generic fallbacks as assumptions", () => {
    const google = assessmentFixture();
    google.site.id = "google-dc-usa-mesa-arizona";
    google.site.pue = null;
    google.site.location_evidence = { portfolio_id: "google_public_data_centers" } as typeof google.site.location_evidence;
    const googleProfile = buildOperationalProfile(google, DEFAULT_OPERATIONAL_SCENARIO);
    expect(googleProfile.pue.value).toBe(1.22);
    expect(googleProfile.pue.basis).toBe("operator_reported");

    const generic = assessmentFixture();
    generic.site.pue = null;
    generic.site.wue_l_per_kwh = null;
    generic.site.location_evidence = null;
    const genericProfile = buildOperationalProfile(generic, DEFAULT_OPERATIONAL_SCENARIO);
    expect(genericProfile.pue.basis).toBe("scenario_assumption");
    expect(genericProfile.wue.basis).toBe("scenario_assumption");
  });

  it("reads the published operational policy schema", () => {
    const scenario = operationalScenarioFromPolicy({
      operational_composite: {
        default_assumptions: { pue: 1.2, wue_l_per_kwh: 0.8 },
        default_weights: { facility_efficiency: 0.2, water_stress: 0.5, grid_carbon: 0.3 },
        anchors: { pue_target: 1.3, pue_upper: 1.9, wue_target_l_per_kwh: 1.2, wue_upper_l_per_kwh: 2.5, grid_gco2e_per_kwh: 700 },
      },
    });
    expect(scenario.fallback_pue).toBe(1.2);
    expect(scenario.weights).toEqual({ facility: 0.2, water: 0.5, carbon: 0.3 });
    expect(scenario.anchors.wue_l_per_kwh).toBe(2.5);
  });
});

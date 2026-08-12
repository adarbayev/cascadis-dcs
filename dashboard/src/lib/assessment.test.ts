import { describe, expect, it } from "vitest";
import { assessmentFixture } from "../test/fixtures";
import {
  decision,
  environmentalScore,
  gridFactor,
  hasMixedGridBasis,
  hasPortfolioRankReversal,
  sensitivitySpread,
  waterLabel,
  waterScore,
} from "./assessment";

describe("assessment contract normalisation", () => {
  it("reads canonical nested backend fields", () => {
    const result = assessmentFixture();
    expect(waterScore(result, "bws")).toBe(5);
    expect(waterLabel(result, "smc")).toBe("Medium-High");
    expect(gridFactor(result)).toBe(367);
    expect(environmentalScore(result, "elp")).toBe(54.24);
    expect(decision(result).preferred).toEqual(["Dry cooling systems"]);
    expect(decision(result).immediate_actions).toEqual(["Validate sub-metered cooling energy and water use"]);
  });

  it("keeps no-data unscored and preserves the arid source value", () => {
    const noData = assessmentFixture();
    noData.policy_v1!.scores!.sensitivity!.baseline_water_stress = {
      source_score: -9999,
      source_category: -9999,
      source_label: "No Data",
      environmental_priority: null,
      status: "no_data",
    };
    expect(waterScore(noData, "bws")).toBeNull();
    expect(environmentalScore(noData, "bws")).toBeNull();

    const arid = assessmentFixture();
    arid.policy_v1!.scores!.sensitivity!.baseline_water_stress = {
      source_score: -1,
      source_category: -1,
      source_label: "Arid and Low Water Use",
      normalized: 1,
      environmental_priority: 72.94,
      status: "arid_policy_override",
    };
    expect(waterScore(arid, "bws")).toBe(-1);
    expect(environmentalScore(arid, "bws")).toBe(72.94);
  });

  it("uses backend sensitivity metadata and true rank warnings", () => {
    const result = assessmentFixture();
    expect(sensitivitySpread(result)).toEqual({ min: 46.04, max: 72.94, materialDivergence: true });
    expect(hasPortfolioRankReversal([result])).toBe(false);

    const second = assessmentFixture({ assessment_id: "second" });
    second.policy_v1!.scores!.rank_reversal_warning = true;
    expect(hasPortfolioRankReversal([result, second])).toBe(true);
  });

  it("blocks cross-basis comparison before rank-reversal logic", () => {
    const ember = assessmentFixture({ assessment_id: "ember" });
    const iea = assessmentFixture({ assessment_id: "iea" });
    iea.source!.grid!.provider = "iea_annual_file";
    iea.source!.grid!.factor_basis = "country production emissions";
    iea.source!.grid!.unit = "kgCO2e/kWh";
    iea.policy_v1!.scores!.rank_reversal_warning = true;

    expect(hasMixedGridBasis([ember, iea], "bws")).toBe(true);
    expect(hasPortfolioRankReversal([ember, iea])).toBe(false);
    expect(hasMixedGridBasis([ember, assessmentFixture({ assessment_id: "ember-2" })], "bws")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { assessmentFixture, googleLocationEvidence } from "../test/fixtures";
import { buildPortfolioCsv } from "./portfolioExport";

function setPriority(result: ReturnType<typeof assessmentFixture>, value: number): void {
  result.policy_v1!.scores!.sensitivity!.baseline_water_stress!.environmental_priority = value;
  result.policy_v1!.scores!.environmental_priority = value;
}

describe("portfolio CSV ranking guard", () => {
  it("preserves input order and leaves ranks blank for mixed grid bases", () => {
    const first = assessmentFixture({ assessment_id: "first" });
    first.site.id = "first-site";
    first.site.name = "First input";
    setPriority(first, 20);
    const second = assessmentFixture({ assessment_id: "second" });
    second.site.id = "second-site";
    second.site.name = "Second input";
    setPriority(second, 90);
    second.source!.grid!.provider = "iea_annual_file";
    second.source!.grid!.factor_basis = "country production emissions";

    const lines = buildPortfolioCsv([first, second], "bws").split("\n");
    expect(lines[1].startsWith(",exposure,,first-site,First input,")).toBe(true);
    expect(lines[2].startsWith(",exposure,,second-site,Second input,")).toBe(true);
  });

  it("keeps score ordering and numeric ranks for a single basis", () => {
    const lower = assessmentFixture({ assessment_id: "lower" });
    lower.site.id = "lower-site";
    setPriority(lower, 20);
    const higher = assessmentFixture({ assessment_id: "higher" });
    higher.site.id = "higher-site";
    setPriority(higher, 90);

    const lines = buildPortfolioCsv([lower, higher], "bws").split("\n");
    expect(lines[1].startsWith("1,exposure,,higher-site,")).toBe(true);
    expect(lines[2].startsWith("2,exposure,,lower-site,")).toBe(true);
  });

  it("exports curated location provenance", () => {
    const google = assessmentFixture({ assessment_id: "google" });
    google.site = { ...google.site, id: "google-dc-usa-mesa-arizona", name: "Mesa, Arizona", location_evidence: googleLocationEvidence };
    const csv = buildPortfolioCsv([google], "bws");

    expect(csv).toContain("portfolio_id,operator,facility_status,asset_scope");
    expect(csv).toContain("google_public_data_centers,Google,under_construction,google_public_data_center_location");
    expect(csv).toContain("locality_centroid,low,https://www.datacenters.google/locations/");
  });
});

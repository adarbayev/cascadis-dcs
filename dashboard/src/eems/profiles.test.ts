import { describe, expect, it } from "vitest";

import { assessmentFixture } from "../test/fixtures";
import {
  buildEemsPortfolio,
  createGapAssessmentProfile,
  EEMS_ARCHETYPE_PROFILES,
  getEemsProfile,
  RECORD_REVIEW_LABEL,
} from "./profiles";

const expectedProfiles = new Map([
  ["google-dc-irl-dublin-ireland", "owned_mature"],
  ["google-dc-usa-central-ohio", "owned_expansion"],
  ["google-dc-tha-chonburi-thailand", "owned_development"],
  ["google-dc-nld-groningen-netherlands", "build_to_suit"],
  ["google-dc-usa-northern-virginia", "colocation"],
  ["google-dc-gbr-waltham-cross-united-kingdom", "partner_transition"],
]);

describe("EEMS archetype profiles", () => {
  it("defines exactly six unique mapped archetypes", () => {
    expect(EEMS_ARCHETYPE_PROFILES).toHaveLength(6);
    expect(new Set(EEMS_ARCHETYPE_PROFILES.map((profile) => profile.siteId)).size).toBe(6);
    expect(new Set(EEMS_ARCHETYPE_PROFILES.map((profile) => profile.archetype)).size).toBe(6);

    for (const profile of EEMS_ARCHETYPE_PROFILES) {
      expect(profile.archetype).toBe(expectedProfiles.get(profile.siteId));
      expect(profile.recordReview.label).toBe(RECORD_REVIEW_LABEL);
      expect(profile.permits.length).toBeGreaterThan(0);
      expect(profile.aspects.length).toBeGreaterThan(0);
      expect(profile.checklists.length).toBeGreaterThan(0);
      expect(profile.actions.length).toBeGreaterThan(0);
      expect(profile.audits.length).toBeGreaterThan(0);
    }
  });

  it("keeps operational PUE and WUE records internally consistent", () => {
    const operationalProfiles = EEMS_ARCHETYPE_PROFILES.filter(
      (profile) => profile.metrics.facilityEnergyMWh.kind === "actual",
    );

    for (const profile of operationalProfiles) {
      const facilityEnergy = profile.metrics.facilityEnergyMWh.value;
      const itEnergy = profile.metrics.itEnergyMWh.value;
      const water = profile.metrics.waterConsumptionM3.value;
      expect(facilityEnergy).not.toBeNull();
      expect(itEnergy).not.toBeNull();
      expect(water).not.toBeNull();
      expect(profile.metrics.pue.value).toBeCloseTo(facilityEnergy! / itEnergy!, 2);
      expect(profile.metrics.wueLPerKwh.value).toBeCloseTo(water! / itEnergy!, 2);
    }
  });

  it("marks development and build-to-suit performance values as targets", () => {
    for (const archetype of ["owned_development", "build_to_suit"]) {
      const profile = EEMS_ARCHETYPE_PROFILES.find((item) => item.archetype === archetype);
      expect(profile?.metrics.pue.kind).toBe("target");
      expect(profile?.metrics.wueLPerKwh.kind).toBe("target");
      expect(profile?.metrics.facilityEnergyMWh.kind).toBe("not_available");
    }
  });
});

describe("generic EEMS onboarding profile", () => {
  it("creates a gap-assessment record without inventing site-controlled registers", () => {
    const base = assessmentFixture();
    const assessment = assessmentFixture({
      assessment_id: "assessment-new-site",
      site: {
        ...base.site,
        id: "new-site",
        name: "New site",
        pue: 1.31,
        wue_l_per_kwh: null,
        annual_it_energy_mwh: 12_000,
        location_evidence: {
          ...base.site.location_evidence!,
          facility_status: "in_development",
        },
      },
    });

    const profile = createGapAssessmentProfile(assessment);

    expect(profile.archetype).toBeNull();
    expect(profile.lifecycle.primaryPhase).toBe("planning");
    expect(profile.lifecycle.concurrentPhases).toEqual([]);
    expect(profile.status.eemsStage).toBe("gap_assessment");
    expect(profile.recordReview.label).toBe("Awaiting site-owner confirmation");
    expect(profile.metrics.pue).toMatchObject({ value: 1.31, kind: "actual" });
    expect(profile.metrics.itEnergyMWh).toMatchObject({ value: 12_000, kind: "actual" });
    expect(profile.metrics.wueLPerKwh.kind).toBe("not_available");
    expect(profile.permits).toEqual([]);
    expect(profile.coolingAssets).toEqual([]);
    expect(profile.checklists).toHaveLength(1);
    expect(profile.actions).toHaveLength(1);
  });

  it("uses a deep profile when mapped and preserves portfolio order", () => {
    const base = assessmentFixture();
    const dublin = assessmentFixture({
      assessment_id: "snapshot-dublin-id",
      site: {
        ...base.site,
        id: "google-dc-irl-dublin-ireland",
        name: "Dublin, Ireland",
      },
    });
    const other = assessmentFixture({
      assessment_id: "snapshot-other-id",
      site: { ...base.site, id: "portfolio-other", name: "Portfolio other" },
    });

    expect(getEemsProfile(dublin).archetype).toBe("owned_mature");
    expect(buildEemsPortfolio([other, dublin]).map((profile) => profile.siteId)).toEqual([
      "portfolio-other",
      "google-dc-irl-dublin-ireland",
    ]);
  });

  it("reconciles mapped-site CUE with the current PUE and grid factor", () => {
    const base = assessmentFixture();
    const dublin = assessmentFixture({
      assessment_id: "snapshot-dublin-id",
      site: {
        ...base.site,
        id: "google-dc-irl-dublin-ireland",
        name: "Dublin, Ireland",
      },
      source: {
        ...base.source!,
        grid: {
          ...base.source!.grid,
          emissions_intensity_gco2_per_kwh: 367,
        },
      },
    });

    const profile = getEemsProfile(dublin);
    expect(profile.metrics.cueKgCo2ePerKwh.value).toBeCloseTo(1.25 * 367 / 1000, 6);

    const withoutGrid = getEemsProfile({
      ...dublin,
      source: { ...dublin.source!, grid: { ...dublin.source!.grid, emissions_intensity_gco2_per_kwh: null, factor_gco2e_per_kwh: null, carbon_intensity: null } },
    });
    expect(withoutGrid.metrics.cueKgCo2ePerKwh).toMatchObject({ value: null, kind: "not_available" });
  });

  it("uses the published location label when source layers do not resolve a country", () => {
    const base = assessmentFixture();
    const selangor = assessmentFixture({
      assessment_id: "snapshot-selangor-id",
      site: {
        ...base.site,
        id: "google-dc-mys-selangor-malaysia",
        name: "Selangor, Malaysia",
      },
      source: {
        water: undefined,
        grid: undefined,
      },
    });

    expect(createGapAssessmentProfile(selangor).location.countryName).toBe("Malaysia");
  });
});

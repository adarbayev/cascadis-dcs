import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { assessmentFixture } from "../test/fixtures";
import { PortfolioTable } from "./PortfolioTable";
import { buildOperationalProfile, DEFAULT_OPERATIONAL_SCENARIO } from "../lib/operationalScore";

describe("portfolio table grid-basis guard", () => {
  it("shows source order without numeric ranks when bases differ", () => {
    const first = assessmentFixture({ assessment_id: "first" });
    first.site.name = "First input";
    first.policy_v1!.scores!.sensitivity!.baseline_water_stress!.environmental_priority = 20;
    const second = assessmentFixture({ assessment_id: "second" });
    second.site.name = "Second input";
    second.policy_v1!.scores!.sensitivity!.baseline_water_stress!.environmental_priority = 90;
    second.source!.grid!.provider = "iea_annual_file";
    second.source!.grid!.factor_basis = "country production emissions";
    second.source!.grid!.unit = "kgCO2e/kWh";

    render(
      <PortfolioTable
        results={[first, second]}
        selectedId={null}
        onSelect={vi.fn()}
        view="bws"
        compareIds={[]}
        onToggleCompare={vi.fn()}
        profiles={new Map([[first.assessment_id, buildOperationalProfile(first, DEFAULT_OPERATIONAL_SCENARIO)], [second.assessment_id, buildOperationalProfile(second, DEFAULT_OPERATIONAL_SCENARIO)]])}
        rankingMetric="exposure"
      />,
    );

    expect(screen.getByText(/Ranking blocked:/i)).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("First input")).toBeInTheDocument();
    expect(within(rows[1]).getByText("—")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Second input")).toBeInTheDocument();
    expect(within(rows[2]).getByText("kgCO2e/kWh · Iea Annual File")).toBeInTheDocument();
  });

  it("uses tie-aware exposure ranks", () => {
    const first = assessmentFixture({ assessment_id: "first" });
    first.site.name = "First tie";
    const second = assessmentFixture({ assessment_id: "second" });
    second.site.name = "Second tie";

    render(
      <PortfolioTable
        results={[first, second]}
        selectedId={null}
        onSelect={vi.fn()}
        view="bws"
        compareIds={[]}
        onToggleCompare={vi.fn()}
        profiles={new Map([[first.assessment_id, buildOperationalProfile(first, DEFAULT_OPERATIONAL_SCENARIO)], [second.assessment_id, buildOperationalProfile(second, DEFAULT_OPERATIONAL_SCENARIO)]])}
        rankingMetric="exposure"
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("1")).toBeInTheDocument();
  });
});

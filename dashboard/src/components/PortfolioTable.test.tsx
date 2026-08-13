import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { assessmentFixture } from "../test/fixtures";
import type { AssessmentResult, OperationalProfile, RankingMetric } from "../types";
import { PortfolioTable } from "./PortfolioTable";
import { buildOperationalProfile, DEFAULT_OPERATIONAL_SCENARIO } from "../lib/operationalScore";

function profilesFor(results: AssessmentResult[]): Map<string, OperationalProfile> {
  return new Map(results.map((result) => [
    result.assessment_id,
    buildOperationalProfile(result, DEFAULT_OPERATIONAL_SCENARIO),
  ]));
}

function renderTable(
  results: AssessmentResult[],
  profiles = profilesFor(results),
  rankingMetric: RankingMetric = "exposure",
) {
  return render(
    <PortfolioTable
      results={results}
      selectedId={null}
      onSelect={vi.fn()}
      view="bws"
      compareIds={[]}
      onToggleCompare={vi.fn()}
      profiles={profiles}
      rankingMetric={rankingMetric}
    />,
  );
}

function tableRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

function setExposure(result: AssessmentResult, value: number) {
  result.policy_v1!.scores!.sensitivity!.baseline_water_stress!.environmental_priority = value;
}

describe("portfolio table sorting", () => {
  it("keeps cross-basis ranking blocked while allowing independent metric sorting", async () => {
    const first = assessmentFixture({ assessment_id: "first" });
    first.site = { ...first.site, name: "First input", pue: 1.1 };
    setExposure(first, 20);
    const second = assessmentFixture({ assessment_id: "second" });
    second.site = { ...second.site, name: "Second input", pue: 1.8 };
    setExposure(second, 90);
    second.source!.grid!.provider = "iea_annual_file";
    second.source!.grid!.factor_basis = "country production emissions";
    second.source!.grid!.unit = "kgCO2e/kWh";

    renderTable([first, second]);

    expect(screen.getByText(/Ranking blocked:/i)).toBeInTheDocument();
    expect(within(tableRows()[0]).getByText("First input")).toBeInTheDocument();
    expect(within(tableRows()[0]).getByText("—")).toBeInTheDocument();
    expect(within(tableRows()[1]).getByText("Second input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sort by Location exposure/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sort by Sustainability priority/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sort by CUE/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sort by Grid carbon/ })).toBeDisabled();

    const pueSort = screen.getByRole("button", { name: "Sort by PUE" });
    expect(pueSort).toBeEnabled();
    await userEvent.click(pueSort);

    expect(within(tableRows()[0]).getByText("Second input")).toBeInTheDocument();
    expect(within(tableRows()[0]).getByText("—")).toBeInTheDocument();
    expect(within(tableRows()[1]).getByText("First input")).toBeInTheDocument();
  });

  it("keeps competition ranks immutable when rows are sorted by another metric", async () => {
    const firstTie = assessmentFixture({ assessment_id: "first-tie" });
    firstTie.site = { ...firstTie.site, name: "First tie", pue: 1.1 };
    setExposure(firstTie, 90);
    const secondTie = assessmentFixture({ assessment_id: "second-tie" });
    secondTie.site = { ...secondTie.site, name: "Second tie", pue: 1.8 };
    setExposure(secondTie, 90);
    const lower = assessmentFixture({ assessment_id: "lower" });
    lower.site = { ...lower.site, name: "Lower score", pue: 2 };
    setExposure(lower, 50);

    renderTable([firstTie, secondTie, lower]);

    let rows = tableRows();
    expect(within(rows[0]).getByText("First tie")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Second tie")).toBeInTheDocument();
    expect(within(rows[1]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Lower score")).toBeInTheDocument();
    expect(within(rows[2]).getByText("3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sort by PUE" }));
    rows = tableRows();
    expect(within(rows[0]).getByText("Lower score")).toBeInTheDocument();
    expect(within(rows[0]).getByText("3")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Second tie")).toBeInTheDocument();
    expect(within(rows[1]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("First tie")).toBeInTheDocument();
    expect(within(rows[2]).getByText("1")).toBeInTheDocument();
  });

  it("sorts stably and keeps null values last in both directions", async () => {
    const highFirst = assessmentFixture({ assessment_id: "high-first" });
    highFirst.site = { ...highFirst.site, name: "High first", pue: 1.8 };
    const highSecond = assessmentFixture({ assessment_id: "high-second" });
    highSecond.site = { ...highSecond.site, name: "High second", pue: 1.8 };
    const low = assessmentFixture({ assessment_id: "low" });
    low.site = { ...low.site, name: "Low", pue: 1.1 };
    const missing = assessmentFixture({ assessment_id: "missing" });
    missing.site = { ...missing.site, name: "Missing" };
    const results = [highFirst, highSecond, low, missing];
    const profiles = profilesFor(results);
    profiles.get(missing.assessment_id)!.pue = {
      ...profiles.get(missing.assessment_id)!.pue,
      value: null,
    };

    renderTable(results, profiles);
    const pueSort = screen.getByRole("button", { name: "Sort by PUE" });
    await userEvent.click(pueSort);

    let rows = tableRows();
    expect(rows[0]).toHaveTextContent("High first");
    expect(rows[1]).toHaveTextContent("High second");
    expect(rows[2]).toHaveTextContent("Low");
    expect(rows[3]).toHaveTextContent("Missing");
    expect(screen.getByRole("columnheader", { name: /PUE/ })).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(pueSort);
    rows = tableRows();
    expect(rows[0]).toHaveTextContent("Low");
    expect(rows[1]).toHaveTextContent("High first");
    expect(rows[2]).toHaveTextContent("High second");
    expect(rows[3]).toHaveTextContent("Missing");
    expect(screen.getByRole("columnheader", { name: /PUE/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("renders separate PUE, WUE, and CUE columns with metric basis labels", () => {
    const result = assessmentFixture();
    renderTable([result]);

    expect(screen.getByRole("button", { name: "Sort by PUE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by WUE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by CUE" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sort mobile portfolio by")).toBeInTheDocument();

    const cells = within(tableRows()[0]).getAllByRole("cell");
    expect(cells).toHaveLength(10);
    expect(cells[3]).toHaveTextContent("1.62");
    expect(cells[3]).toHaveTextContent("Site Input");
    expect(cells[4]).toHaveTextContent("0.4");
    expect(cells[4]).toHaveTextContent("Site Input");
    expect(cells[5]).toHaveTextContent("0.59");
    expect(cells[5]).toHaveTextContent("Derived");
  });

  it("uses the mobile sort control and shares the resulting row order", async () => {
    const zebra = assessmentFixture({ assessment_id: "zebra" });
    zebra.site = { ...zebra.site, name: "Zebra" };
    const alpha = assessmentFixture({ assessment_id: "alpha" });
    alpha.site = { ...alpha.site, name: "Alpha" };

    renderTable([zebra, alpha]);
    const mobileSort = screen.getByLabelText("Sort mobile portfolio by");
    await userEvent.selectOptions(mobileSort, "site");

    expect(mobileSort).toHaveValue("site");
    expect(within(tableRows()[0]).getByText("Alpha")).toBeInTheDocument();
    expect(within(tableRows()[1]).getByText("Zebra")).toBeInTheDocument();
  });
});

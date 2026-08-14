import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { assessmentFixture, googleLocationEvidence } from "./test/fixtures";

vi.mock("./components/PortfolioMap", () => ({
  PortfolioMap: ({ results }: { results: Array<{ assessment_id: string; site: { name: string } }> }) => (
    <div data-count={results.length} data-testid="portfolio-map">
      {results.map((result) => <span key={result.assessment_id}>{result.site.name}</span>)}
    </div>
  ),
}));

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("dashboard shell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/portfolio")) return jsonResponse({ count: 0, assessments: [] });
      if (url.endsWith("/sources/status")) return jsonResponse({ checked_at: "2026-08-09T12:00:00Z", sources: [
        { provider: "aqueduct_esri", enabled: true, configured: true, mode: "live_api_with_sqlite_cache", note: "WRI Aqueduct source" },
        { provider: "ember", enabled: true, configured: true, mode: "public_csv_with_sqlite_cache", note: "Ember public proxy" },
      ] });
      if (url.endsWith("/policy")) return jsonResponse({ version: "1.0.0", default_weights: { water: 0.5, carbon: 0.5 }, anchors: { carbon_gco2e_per_kwh: 800 } });
      return jsonResponse({ detail: "Not found" }, 404);
    }));
  });

  it("renders an honest empty state and source-backed framing", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /cascadis/i })).toBeInTheDocument();
    expect(await screen.findByText("No locations assessed yet")).toBeInTheDocument();
    expect(screen.getByText(/No official data-center preset/i)).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-map")).toBeInTheDocument();
  });

  it("uses the Cascadis product hierarchy", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Cascadis" })).toBeInTheDocument();
    expect(screen.getByText(/DCSS · Data Center Sustainability Scoring/i)).toBeInTheDocument();
    expect(await screen.findByText("No locations assessed yet")).toBeInTheDocument();
  });

  it("keeps the map card aligned to its own content instead of stretching to the decision desk", async () => {
    render(<App />);
    const map = await screen.findByTestId("portfolio-map");
    expect(map.closest("section")).toHaveClass("items-start");
  });

  it("separates overview filters from scoring methodology controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("PUE minimum")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-map")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fallback PUE")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Scoring methodology" }));
    expect(screen.getByRole("tab", { name: "Scoring methodology" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Fallback PUE")).toBeInTheDocument();
    expect(screen.getByLabelText("WRI water view")).toBeInTheDocument();
    expect(screen.queryByLabelText("PUE minimum")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portfolio-map")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByLabelText("PUE minimum")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-map")).toBeInTheDocument();
  });

  it("queues a validated manual site without fabricating a result", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText("No locations assessed yet")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Add location/i }));
    await user.type(screen.getByLabelText(/Site name/i), "London candidate");
    await user.type(screen.getByLabelText(/Site ID/i), "london-1");
    await user.type(screen.getByLabelText(/^Latitude/i), "51.5074");
    await user.type(screen.getByLabelText(/^Longitude/i), "-0.1278");
    await user.click(screen.getByRole("button", { name: /Add site to assessment/i }));
    expect(screen.getByText("London candidate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assess 1 site/i })).toBeEnabled();
    expect(screen.getByText("No locations assessed yet")).toBeInTheDocument();
  });

  it("opens methodology with the configured policy anchor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Method" }));
    expect(await screen.findByRole("dialog", { name: "Methodology" })).toBeInTheDocument();
    expect(screen.getByText(/selected WRI score \/ 5/i)).toBeInTheDocument();
    expect(screen.getByText(/internal, configurable policy value/i)).toBeInTheDocument();
  });

  it("blocks the highest-priority summary for mixed scored grid bases", async () => {
    const ember = assessmentFixture({ assessment_id: "ember" });
    const iea = assessmentFixture({ assessment_id: "iea" });
    iea.source!.grid!.provider = "iea_annual_file";
    iea.source!.grid!.factor_basis = "country production emissions";
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/portfolio")) return jsonResponse({ count: 2, assessments: [ember, iea] });
      if (url.endsWith("/sources/status")) return jsonResponse({ checked_at: "2026-08-09T12:00:00Z", sources: [] });
      if (url.endsWith("/policy")) return jsonResponse({ version: "1.0.0", default_weights: { water: 0.5, carbon: 0.5 }, anchors: { carbon_gco2e_per_kwh: 800 } });
      return jsonResponse({ detail: "Not found" }, 404);
    }));

    render(<App />);
    expect(await screen.findByText("Portfolio ranking blocked")).toBeInTheDocument();
    const highestPriority = screen.getByText("Highest composite");
    expect(within(highestPriority.parentElement!).getByText("N/A")).toBeInTheDocument();
  });

  it("defaults to the Google public-location scope when seeded rows exist", async () => {
    const google = assessmentFixture({ assessment_id: "google" });
    google.site = { ...google.site, id: "google-dc-usa-mesa-arizona", name: "Mesa, Arizona", location_evidence: googleLocationEvidence };
    const other = assessmentFixture({ assessment_id: "other" });
    other.site = { ...other.site, id: "user-site", name: "User site" };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/portfolio")) return jsonResponse({ count: 2, assessments: [other, google] });
      if (url.endsWith("/sources/status")) return jsonResponse({ checked_at: "2026-08-10T12:00:00Z", sources: [] });
      if (url.endsWith("/policy")) return jsonResponse({ version: "1.0.0", default_weights: { water: 0.5, carbon: 0.5 }, anchors: { carbon_gco2e_per_kwh: 800 } });
      return jsonResponse({ detail: "Not found" }, 404);
    }));

    render(<App />);
    expect(await screen.findByText("Google public-location screening portfolio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Google public locations 1/i })).toHaveAttribute("data-active", "true");
    expect(screen.getAllByText("Mesa, Arizona").length).toBeGreaterThan(0);
    expect(screen.queryByText("User site")).not.toBeInTheDocument();
  });

  it("uses an inclusive PUE minimum across the map, summary, and portfolio table", async () => {
    const below = assessmentFixture({ assessment_id: "below-pue" });
    below.site = { ...below.site, id: "below-pue", name: "Below threshold", pue: 1.49 };
    const boundary = assessmentFixture({ assessment_id: "boundary-pue" });
    boundary.site = { ...boundary.site, id: "boundary-pue", name: "At threshold", pue: 1.5 };
    const above = assessmentFixture({ assessment_id: "above-pue" });
    above.site = { ...above.site, id: "above-pue", name: "Above threshold", pue: 1.65 };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/portfolio")) return jsonResponse({ count: 3, assessments: [below, boundary, above] });
      if (url.endsWith("/sources/status")) return jsonResponse({ checked_at: "2026-08-13T12:00:00Z", sources: [] });
      if (url.endsWith("/policy")) return jsonResponse({ version: "1.0.0", default_weights: { water: 0.5, carbon: 0.5 }, anchors: { carbon_gco2e_per_kwh: 800 } });
      return jsonResponse({ detail: "Not found" }, 404);
    }));

    const user = userEvent.setup();
    render(<App />);
    const map = await screen.findByTestId("portfolio-map");
    await waitFor(() => expect(map).toHaveAttribute("data-count", "3"));
    await user.type(screen.getByLabelText("PUE minimum"), "1.5");

    await waitFor(() => expect(map).toHaveAttribute("data-count", "2"));
    expect(within(map).queryByText("Below threshold")).not.toBeInTheDocument();
    expect(within(map).getByText("At threshold")).toBeInTheDocument();
    expect(within(map).getByText("Above threshold")).toBeInTheDocument();
    expect(screen.queryAllByText("Below threshold")).toHaveLength(0);
    expect(screen.getAllByText("At threshold").length).toBeGreaterThan(1);
    const locationsInView = screen.getByText("Locations in view");
    expect(within(locationsInView.parentElement!).getByText("2")).toBeInTheDocument();
  });

  it("filters the map and portfolio by Baseline Water Stress level", async () => {
    const extreme = assessmentFixture({ assessment_id: "extreme-water" });
    extreme.site = { ...extreme.site, id: "extreme-water", name: "Extreme water" };
    const low = assessmentFixture({ assessment_id: "low-water" });
    low.site = { ...low.site, id: "low-water", name: "Low water" };
    low.policy_v1!.scores!.sensitivity!.baseline_water_stress!.source_category = 0;
    low.policy_v1!.scores!.sensitivity!.baseline_water_stress!.source_score = 0;
    low.policy_v1!.scores!.sensitivity!.baseline_water_stress!.source_label = "Low (<10%)";
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/portfolio")) return jsonResponse({ count: 2, assessments: [extreme, low] });
      if (url.endsWith("/sources/status")) return jsonResponse({ checked_at: "2026-08-13T12:00:00Z", sources: [] });
      if (url.endsWith("/policy")) return jsonResponse({ version: "1.0.0", default_weights: { water: 0.5, carbon: 0.5 }, anchors: { carbon_gco2e_per_kwh: 800 } });
      return jsonResponse({ detail: "Not found" }, 404);
    }));

    const user = userEvent.setup();
    render(<App />);
    const map = await screen.findByTestId("portfolio-map");
    await waitFor(() => expect(map).toHaveAttribute("data-count", "2"));
    await user.selectOptions(screen.getByLabelText("Baseline water stress level"), "extremely_high");

    await waitFor(() => expect(map).toHaveAttribute("data-count", "1"));
    expect(within(map).getByText("Extreme water")).toBeInTheDocument();
    expect(within(map).queryByText("Low water")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Low water")).toHaveLength(0);
  });
});

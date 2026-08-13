import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { assessmentFixture, googleLocationEvidence } from "./test/fixtures";

vi.mock("./components/PortfolioMap", () => ({
  PortfolioMap: () => <div data-testid="portfolio-map">Map</div>,
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
});

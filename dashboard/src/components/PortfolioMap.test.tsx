import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EEMS_ARCHETYPE_PROFILES } from "../eems/profiles";
import type { SiteEemsProfile } from "../eems/types";
import { assessmentFixture } from "../test/fixtures";
import type { MapLayer } from "../types";
import { OPENFREEMAP_ATTRIBUTION, OPENFREEMAP_STYLE_URL, PortfolioMap } from "./PortfolioMap";

const leafletMocks = vi.hoisted(() => {
  const glMap = { on: vi.fn(), off: vi.fn() };
  const vectorLayer = {
    addTo: vi.fn(),
    getMaplibreMap: vi.fn(() => glMap),
  };
  const map = {
    fitBounds: vi.fn(),
    hasLayer: vi.fn(() => true),
    removeLayer: vi.fn(),
    setView: vi.fn(),
  };
  return {
    glMap,
    map,
    maplibreGL: vi.fn(() => vectorLayer),
    vectorLayer,
  };
});

vi.mock("leaflet", () => ({
  default: {
    latLngBounds: vi.fn((points: unknown) => points),
    maplibreGL: leafletMocks.maplibreGL,
  },
}));

vi.mock("@maplibre/maplibre-gl-leaflet", () => ({}));

vi.mock("react-leaflet", async () => {
  const React = await import("react");
  return {
    MapContainer: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div data-testid="map-container" aria-label={String(props["aria-label"] ?? "")}>{children}</div>
    ),
    CircleMarker: ({ children, pathOptions }: React.PropsWithChildren<Record<string, unknown>>) => {
      const options = pathOptions as { fillColor?: string } | undefined;
      return <div data-testid="map-marker" data-fill-colour={options?.fillColor}>{children}</div>;
    },
    GeoJSON: () => <div data-testid="map-geometry" />,
    Popup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    useMap: () => leafletMocks.map,
    useMapEvents: vi.fn(),
  };
});

function renderMap(
  layer: MapLayer = "recommendation",
  eemsProfiles?: SiteEemsProfile[] | Map<string, SiteEemsProfile>,
) {
  const first = assessmentFixture({ assessment_id: "first" });
  first.site = { ...first.site, id: "first", name: "First visible site" };
  const second = assessmentFixture({ assessment_id: "second" });
  second.site = { ...second.site, id: "second", name: "Second visible site", latitude: 51.5, longitude: -0.12 };

  render(
    <PortfolioMap
      results={[first, second]}
      eemsProfiles={eemsProfiles}
      selectedId={null}
      onSelect={vi.fn()}
      onMapClick={vi.fn()}
      draftCoordinate={null}
      layer={layer}
      view="bws"
    />,
  );
}

describe("portfolio map evidence framing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures the OpenFreeMap Positron vector basemap with complete attribution", () => {
    renderMap();

    expect(leafletMocks.maplibreGL).toHaveBeenCalledWith({
      style: OPENFREEMAP_STYLE_URL,
      attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
    });
    expect(OPENFREEMAP_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/positron");
    expect(OPENFREEMAP_ATTRIBUTION).toContain("https://openfreemap.org");
    expect(OPENFREEMAP_ATTRIBUTION).toContain("https://www.openmaptiles.org/");
    expect(OPENFREEMAP_ATTRIBUTION).toContain("https://www.openstreetmap.org/copyright");
    expect(leafletMocks.vectorLayer.addTo).toHaveBeenCalledWith(leafletMocks.map);
  });

  it("keeps evidence markers available when the vector basemap cannot be added", () => {
    leafletMocks.vectorLayer.addTo.mockImplementationOnce(() => {
      throw new Error("WebGL unavailable");
    });

    renderMap();

    expect(screen.getByRole("status")).toHaveTextContent("Basemap unavailable · evidence overlays remain active");
    expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
  });

  it("shows the visible result count, active signal, and complete exposure legend", () => {
    renderMap();

    const footer = screen.getByLabelText("Map evidence");
    expect(within(footer).getByText("2 sites visible")).toBeInTheDocument();
    expect(within(footer).getByText("Location exposure")).toBeInTheDocument();

    const legend = screen.getByLabelText("Location exposure thresholds");
    for (const label of ["Lower", "Moderate", "High", "Critical", "No data"]) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
  });

  it("updates the evidence signal and threshold label with the active layer", () => {
    renderMap("water");

    expect(screen.getByText("Water stress")).toBeInTheDocument();
    const legend = screen.getByLabelText("Water stress thresholds");
    expect(legend).toBeInTheDocument();
    expect(within(legend).getByText("Arid review")).toBeInTheDocument();
  });

  it("renders one site marker for every filtered result passed by the overview", () => {
    renderMap();

    const markers = screen.getAllByTestId("map-marker");
    expect(markers).toHaveLength(2);
    expect(within(markers[0]).getByText("First visible site")).toBeInTheDocument();
    expect(within(markers[1]).getByText("Second visible site")).toBeInTheDocument();
  });

  it.each([
    ["lifecycle", "Lifecycle phase", "Construction", "primary lifecycle phase"],
    ["compliance", "Compliance status", "Review required", "permit and obligation"],
    ["eems", "EEMS implementation", "Controls design", "implementation stage"],
    ["energy", "Energy performance", "Lower overhead", "PUE bands"],
  ] as const)("presents the %s working-record map mode", (layer, signal, legendItem, basis) => {
    renderMap(layer);

    expect(screen.getByText(signal)).toBeInTheDocument();
    expect(within(screen.getByLabelText(`${signal} thresholds`)).getByText(legendItem)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(basis, "i"))).toBeInTheDocument();
  });

  it("joins a working record by stable site id and exposes its management context", () => {
    const profile: SiteEemsProfile = {
      ...EEMS_ARCHETYPE_PROFILES[0],
      assessmentId: "first",
      siteId: "first",
      name: "First working site",
    };

    renderMap("lifecycle", new Map([[profile.siteId, profile]]));

    const markers = screen.getAllByTestId("map-marker");
    expect(markers[0]).toHaveAttribute("data-fill-colour", "#2e8b78");
    expect(within(markers[0]).getByText("First working site")).toBeInTheDocument();
    expect(within(markers[0]).getByText(profile.operatingModel.label)).toBeInTheDocument();
    expect(within(markers[0]).getByText("Verification Due")).toBeInTheDocument();
    expect(within(markers[0]).getByText(profile.recordReview.label)).toBeInTheDocument();

    expect(markers[1]).toHaveAttribute("data-fill-colour", "#7b8b87");
    expect(within(markers[1]).getByText(/record has not been connected/i)).toBeInTheDocument();
  });
});

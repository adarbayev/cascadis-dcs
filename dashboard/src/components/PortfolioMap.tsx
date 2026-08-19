import { useEffect, useMemo, useState } from "react";
import type { Feature as GeoFeature, FeatureCollection, Geometry } from "geojson";
import L, { type PathOptions } from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { CircleMarker, GeoJSON, MapContainer, Popup, useMap, useMapEvents } from "react-leaflet";
import countries110m from "world-atlas/countries-110m.json";
import countryRecords from "world-countries";
import type { SiteEemsProfile } from "../eems/types";
import type { AssessmentResult, EemsMapLayer, MapLayer, SensitivityView } from "../types";
import {
  bwsCategory,
  countryIso3,
  countryName,
  environmentalScore,
  formatNumber,
  gridFactor,
  priorityBand,
  sourceGeometry,
  waterLabel,
  waterScore,
} from "../lib/assessment";

interface PortfolioMapProps {
  results: AssessmentResult[];
  eemsProfiles?: SiteEemsProfile[] | Map<string, SiteEemsProfile>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMapClick: (latitude: number, longitude: number) => void;
  draftCoordinate: { latitude: number; longitude: number } | null;
  layer: MapLayer;
  view: SensitivityView;
}

interface WorldCountry {
  cca3: string;
  ccn3?: string;
  name: { common: string };
}

const countryByNumeric = new Map(
  (countryRecords as WorldCountry[])
    .filter((country) => country.ccn3)
    .map((country) => [Number(country.ccn3), country]),
);

const topology = countries110m as unknown as Topology<{ countries: GeometryCollection }>;
const rawCountries = feature(topology, topology.objects.countries) as unknown as FeatureCollection;
const worldCountries: FeatureCollection = {
  ...rawCountries,
  features: rawCountries.features.map((country) => {
    const record = countryByNumeric.get(Number(country.id));
    return {
      ...country,
      properties: {
        ...(country.properties ?? {}),
        iso3: record?.cca3,
        name: record?.name.common ?? country.properties?.name,
      },
    };
  }),
};

const palette = {
  critical: "#b42318",
  high: "#e76f24",
  moderate: "#e1aa19",
  lower: "#2e8b78",
  unscored: "#7b8b87",
};

export const OPENFREEMAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
export const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">&copy; OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

type BasemapStatus = "loading" | "ready" | "unavailable";

interface LegendItem {
  label: string;
  threshold: string;
  colour: string;
}

const signalLabels: Record<MapLayer, string> = {
  recommendation: "Location exposure",
  water: "Water stress",
  carbon: "Grid carbon",
  lifecycle: "Lifecycle phase",
  compliance: "Compliance status",
  eems: "EEMS implementation",
  energy: "Energy performance",
};

const waterViewLabels: Record<SensitivityView, string> = {
  bws: "Baseline Water Stress",
  default: "Default Overall Water Risk",
  elp: "Electric Power proxy",
  smc: "Semiconductor proxy",
};

const exposureLegend: LegendItem[] = [
  { label: "Lower", threshold: "<35", colour: palette.lower },
  { label: "Moderate", threshold: "35–54", colour: palette.moderate },
  { label: "High", threshold: "55–74", colour: palette.high },
  { label: "Critical", threshold: "≥75", colour: palette.critical },
  { label: "No data", threshold: "", colour: palette.unscored },
];

const waterLegend: LegendItem[] = [
  { label: "Lower", threshold: "<2", colour: palette.lower },
  { label: "Moderate", threshold: "2–<3", colour: palette.moderate },
  { label: "High", threshold: "3–<4", colour: palette.high },
  { label: "Critical", threshold: "≥4", colour: palette.critical },
  { label: "No data", threshold: "", colour: palette.unscored },
];

const aridReviewLegendItem: LegendItem = {
  label: "Arid review",
  threshold: "flag",
  colour: "#7c3aed",
};

const carbonLegend: LegendItem[] = [
  { label: "Lower", threshold: "<150", colour: palette.lower },
  { label: "Moderate", threshold: "150–399", colour: palette.moderate },
  { label: "Critical", threshold: "≥400", colour: palette.critical },
  { label: "No data", threshold: "", colour: palette.unscored },
];

const lifecycleColours: Record<SiteEemsProfile["lifecycle"]["primaryPhase"], string> = {
  planning: "#64748b",
  permitting: "#7c3aed",
  construction: "#e76f24",
  commissioning: "#d99b1f",
  operational: palette.lower,
  expansion: "#2563a7",
  decommissioning: palette.critical,
};

const lifecycleLegend: LegendItem[] = [
  { label: "Planning", threshold: "", colour: lifecycleColours.planning },
  { label: "Permitting", threshold: "", colour: lifecycleColours.permitting },
  { label: "Construction", threshold: "", colour: lifecycleColours.construction },
  { label: "Commissioning", threshold: "", colour: lifecycleColours.commissioning },
  { label: "Operational", threshold: "", colour: lifecycleColours.operational },
  { label: "Expansion", threshold: "", colour: lifecycleColours.expansion },
  { label: "Decommissioning", threshold: "", colour: lifecycleColours.decommissioning },
  { label: "Record unavailable", threshold: "", colour: palette.unscored },
];

const complianceColours: Record<SiteEemsProfile["status"]["compliance"], string> = {
  not_assessed: palette.unscored,
  active: palette.lower,
  due_soon: palette.moderate,
  expired: palette.critical,
  review_required: palette.high,
};

const complianceLegend: LegendItem[] = [
  { label: "Active", threshold: "", colour: complianceColours.active },
  { label: "Due soon", threshold: "", colour: complianceColours.due_soon },
  { label: "Review required", threshold: "", colour: complianceColours.review_required },
  { label: "Expired", threshold: "", colour: complianceColours.expired },
  { label: "Not assessed", threshold: "", colour: complianceColours.not_assessed },
];

const eemsColours: Record<SiteEemsProfile["status"]["eemsStage"], string> = {
  not_onboarded: palette.unscored,
  gap_assessment: palette.moderate,
  controls_design: "#2563a7",
  implementation: "#7c3aed",
  operating: palette.lower,
  assurance: "#0e7490",
};

const eemsLegend: LegendItem[] = [
  { label: "Not onboarded", threshold: "", colour: eemsColours.not_onboarded },
  { label: "Gap assessment", threshold: "", colour: eemsColours.gap_assessment },
  { label: "Controls design", threshold: "", colour: eemsColours.controls_design },
  { label: "Implementation", threshold: "", colour: eemsColours.implementation },
  { label: "Operating", threshold: "", colour: eemsColours.operating },
  { label: "Assurance", threshold: "", colour: eemsColours.assurance },
];

const energyTargetColour = "#2563a7";

const energyLegend: LegendItem[] = [
  { label: "Lower overhead", threshold: "PUE ≤1.20", colour: palette.lower },
  { label: "Moderate overhead", threshold: "1.21–1.35", colour: palette.moderate },
  { label: "Elevated overhead", threshold: "1.36–1.50", colour: palette.high },
  { label: "High overhead", threshold: "PUE >1.50", colour: palette.critical },
  { label: "Target / design", threshold: "", colour: energyTargetColour },
  { label: "Not recorded", threshold: "", colour: palette.unscored },
];

function OpenFreeMapLayer({ onStatusChange }: { onStatusChange: (status: BasemapStatus) => void }) {
  const map = useMap();

  useEffect(() => {
    let active = true;
    let loaded = false;
    onStatusChange("loading");
    map.attributionControl?.addAttribution(OPENFREEMAP_ATTRIBUTION);

    const removeAttribution = () => {
      map.attributionControl?.removeAttribution(OPENFREEMAP_ATTRIBUTION);
    };

    if (typeof L.maplibreGL !== "function") {
      onStatusChange("unavailable");
      return removeAttribution;
    }

    let layer: L.MaplibreGL | null = null;

    try {
      layer = L.maplibreGL({
        style: OPENFREEMAP_STYLE_URL,
        attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
      });
      layer.addTo(map);
      const glMap = layer.getMaplibreMap();
      const handleLoad = () => {
        loaded = true;
        if (active) onStatusChange("ready");
      };
      const handleError = () => {
        if (active && !loaded) onStatusChange("unavailable");
      };

      glMap.on("load", handleLoad);
      glMap.on("error", handleError);

      return () => {
        active = false;
        glMap.off("load", handleLoad);
        glMap.off("error", handleError);
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
        removeAttribution();
      };
    } catch {
      if (active) onStatusChange("unavailable");
      return () => {
        active = false;
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
        removeAttribution();
      };
    }
  }, [map, onStatusChange]);

  return null;
}

function waterColour(result: AssessmentResult, view: SensitivityView): string {
  const category = view === "bws" ? bwsCategory(result) : null;
  if (category === -1) return "#7c3aed";
  const score = waterScore(result, view);
  if (score === null) return palette.unscored;
  if (score >= 4) return palette.critical;
  if (score >= 3) return palette.high;
  if (score >= 2) return palette.moderate;
  return palette.lower;
}

function carbonColour(factor: number | null): string {
  if (factor === null) return palette.unscored;
  if (factor >= 400) return palette.critical;
  if (factor >= 150) return palette.moderate;
  return palette.lower;
}

function isEemsLayer(layer: MapLayer): layer is EemsMapLayer {
  return layer === "lifecycle" || layer === "compliance" || layer === "eems" || layer === "energy";
}

function energyColour(profile: SiteEemsProfile | undefined): string {
  const pue = profile?.metrics.pue;
  if (!pue || pue.value === null || pue.kind === "not_available" || pue.kind === "not_applicable") {
    return palette.unscored;
  }
  if (pue.kind === "target") return energyTargetColour;
  if (pue.value > 1.5) return palette.critical;
  if (pue.value > 1.35) return palette.high;
  if (pue.value > 1.2) return palette.moderate;
  return palette.lower;
}

function eemsMarkerColour(profile: SiteEemsProfile | undefined, layer: EemsMapLayer): string {
  if (!profile) return palette.unscored;
  if (layer === "lifecycle") return lifecycleColours[profile.lifecycle.primaryPhase];
  if (layer === "compliance") return complianceColours[profile.status.compliance];
  if (layer === "eems") return eemsColours[profile.status.eemsStage];
  return energyColour(profile);
}

function markerColour(
  result: AssessmentResult,
  layer: MapLayer,
  view: SensitivityView,
  profile?: SiteEemsProfile,
): string {
  if (layer === "water") return waterColour(result, view);
  if (layer === "carbon") return carbonColour(gridFactor(result));
  if (isEemsLayer(layer)) return eemsMarkerColour(profile, layer);
  return palette[priorityBand(environmentalScore(result, view))];
}

function workingLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function workingMetric(profile: SiteEemsProfile, key: "pue" | "wueLPerKwh" | "cueKgCo2ePerKwh", digits = 2): string {
  const metric = profile.metrics[key];
  if (metric.value === null) return "Not recorded";
  const value = new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(metric.value);
  return `${value}${metric.unit === "ratio" ? "" : ` ${metric.unit}`}`;
}

function EemsPopup({ profile, result }: { profile?: SiteEemsProfile; result: AssessmentResult }) {
  if (!profile) {
    return (
      <div className="min-w-[230px] font-sans">
        <p className="atlas-kicker text-tide">Working site record</p>
        <p className="mt-2 font-display text-xl leading-tight text-ink">{result.site.name}</p>
        <p className="mt-3 text-xs leading-5 text-slate-600">EEMS record has not been connected for this mapped location.</p>
      </div>
    );
  }

  const primaryFlag = profile.status.flags[0] ?? "No management flag recorded";
  const pueKind = profile.metrics.pue.kind === "actual"
    ? "Current period"
    : workingLabel(profile.metrics.pue.kind);

  return (
    <div className="min-w-[250px] font-sans">
      <p className="atlas-kicker text-tide">Working site record</p>
      <p className="mt-2 font-display text-xl leading-tight text-ink">{profile.name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {profile.location.countryName} · {profile.lifecycle.concurrentPhases.length
          ? `${workingLabel(profile.lifecycle.primaryPhase)} + ${profile.lifecycle.concurrentPhases.map(workingLabel).join(", ")}`
          : workingLabel(profile.lifecycle.primaryPhase)}
      </p>

      <dl className="mt-3 divide-y divide-ink/10 border-y border-ink/15 text-xs">
        <div className="grid grid-cols-[92px_1fr] gap-3 py-2">
          <dt className="text-slate-400">Operating model</dt>
          <dd className="font-medium text-ink">{profile.operatingModel.label}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-3 py-2">
          <dt className="text-slate-400">EEMS stage</dt>
          <dd className="font-medium text-ink">{workingLabel(profile.status.eemsStage)}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-3 py-2">
          <dt className="text-slate-400">Compliance</dt>
          <dd className="font-medium text-ink">{workingLabel(profile.status.compliance)}</dd>
        </div>
        <div className="grid grid-cols-[92px_1fr] gap-3 py-2">
          <dt className="text-slate-400">Action health</dt>
          <dd className="font-medium text-ink">{workingLabel(profile.status.actionHealth)}</dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-3 divide-x divide-ink/15 border-y border-ink/15">
        <div className="py-2 pr-2">
          <p className="atlas-kicker text-slate-400">PUE</p>
          <p className="atlas-marker-index mt-1 font-semibold text-ink">{workingMetric(profile, "pue")}</p>
        </div>
        <div className="px-2 py-2">
          <p className="atlas-kicker text-slate-400">WUE</p>
          <p className="atlas-marker-index mt-1 font-semibold text-ink">{workingMetric(profile, "wueLPerKwh")}</p>
        </div>
        <div className="py-2 pl-2">
          <p className="atlas-kicker text-slate-400">CUE</p>
          <p className="atlas-marker-index mt-1 font-semibold text-ink">{workingMetric(profile, "cueKgCo2ePerKwh", 3)}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{profile.metrics.period} · PUE {pueKind}</p>
      <p className="mt-3 text-xs font-medium leading-5 text-slate-600">{primaryFlag}</p>
      <p className="mt-2 text-[10px] text-slate-400">{profile.recordReview.label}</p>
    </div>
  );
}

function MapClickHandler({ onMapClick }: Pick<PortfolioMapProps, "onMapClick">) {
  useMapEvents({
    click: (event) => onMapClick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function FitResults({ results }: { results: AssessmentResult[] }) {
  const map = useMap();
  const signature = results.map((result) => `${result.site.latitude}:${result.site.longitude}`).join("|");

  useEffect(() => {
    const points = results
      .map((result) => [result.site.latitude, result.site.longitude] as [number, number])
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
    if (points.length === 1) map.setView(points[0], 5, { animate: true });
    if (points.length > 1) {
      const mapWidth = map.getSize?.().x ?? 1024;
      const fitPadding = mapWidth < 480 ? 8 : mapWidth < 768 ? 24 : 40;
      map.fitBounds(L.latLngBounds(points), {
        maxZoom: 6,
        paddingTopLeft: [fitPadding, fitPadding],
        paddingBottomRight: [fitPadding + (mapWidth < 480 ? 2 : 0), fitPadding],
      });
    }
  }, [map, signature, results]);
  return null;
}

export function PortfolioMap({
  results,
  eemsProfiles,
  selectedId,
  onSelect,
  onMapClick,
  draftCoordinate,
  layer,
  view,
}: PortfolioMapProps) {
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");
  const eemsProfileBySiteId = useMemo(() => {
    if (!eemsProfiles) return new Map<string, SiteEemsProfile>();
    if (eemsProfiles instanceof Map) return eemsProfiles;
    return new Map(eemsProfiles.map((profile) => [profile.siteId, profile]));
  }, [eemsProfiles]);
  const carbonByIso3 = useMemo(() => {
    const values = new Map<string, number>();
    for (const result of results) {
      const iso3 = countryIso3(result);
      const factor = gridFactor(result);
      if (iso3 && factor !== null) values.set(iso3, factor);
    }
    return values;
  }, [results]);
  const carbonSignature = useMemo(
    () => [...carbonByIso3.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([iso3, factor]) => `${iso3}:${factor}`).join("|"),
    [carbonByIso3],
  );

  const countryStyle = (country?: GeoFeature<Geometry>): PathOptions => {
    const iso3 = String(country?.properties?.iso3 ?? "");
    const factor = carbonByIso3.get(iso3) ?? null;
    return {
      fillColor: carbonColour(factor),
      fillOpacity: factor === null ? 0.05 : 0.28,
      color: factor === null ? "#9da9a6" : carbonColour(factor),
      opacity: factor === null ? 0.15 : 0.55,
      weight: factor === null ? 0.5 : 1,
    };
  };

  const basinFeatures: FeatureCollection = useMemo(
    () => ({
      type: "FeatureCollection",
      features: results.flatMap((result) => {
        const geometry = sourceGeometry(result, "water");
        return geometry
          ? [{ type: "Feature" as const, geometry, properties: { id: result.assessment_id } }]
          : [];
      }),
    }),
    [results],
  );
  const basinSignature = useMemo(
    () => basinFeatures.features.map((basin) => String(basin.properties?.id ?? "")).join("|"),
    [basinFeatures],
  );

  const signalLabel = layer === "water" && view !== "bws" ? waterViewLabels[view] : signalLabels[layer];
  const legend = (() => {
    if (layer === "water") {
      return view === "bws"
        ? [...waterLegend.slice(0, -1), aridReviewLegendItem, waterLegend.at(-1)!]
        : waterLegend;
    }
    if (layer === "carbon") return carbonLegend;
    if (layer === "recommendation") return exposureLegend;
    if (layer === "lifecycle") return lifecycleLegend;
    if (layer === "compliance") return complianceLegend;
    if (layer === "eems") return eemsLegend;
    return energyLegend;
  })();
  const sourceBasis = (() => {
    if (layer === "water") return `${waterViewLabels[view]} · WRI Aqueduct 4.0`;
    if (layer === "carbon") return "National lifecycle generation intensity (gCO₂e/kWh) · Ember public proxy";
    if (layer === "recommendation") return `Exposure score (/100) · ${waterViewLabels[view]} + Ember public proxy`;
    if (layer === "lifecycle") return "Working-record primary lifecycle phase and concurrent delivery status";
    if (layer === "compliance") return "Working-record permit and obligation review status";
    if (layer === "eems") return "Working-record implementation stage and action health";
    return "Working-record PUE bands · target and design values are shown separately";
  })();

  return (
    <div className="bg-[#d8ddd8]">
      <div className="atlas-map relative h-[440px] overflow-hidden lg:h-[clamp(500px,58vh,620px)]">
        <MapContainer
          center={[20, 5]}
          zoom={2}
          minZoom={1}
          maxBoundsViscosity={0.8}
          scrollWheelZoom
          className="h-full w-full"
          aria-label="Candidate location map"
        >
        <OpenFreeMapLayer onStatusChange={setBasemapStatus} />
        <MapClickHandler onMapClick={onMapClick} />
        <FitResults results={results} />

        {layer === "carbon" && carbonByIso3.size > 0 ? (
          <GeoJSON key={`countries-${carbonSignature}`} data={worldCountries} style={countryStyle} interactive={false} />
        ) : null}

        {layer === "water" && basinFeatures.features.length > 0 ? (
          <GeoJSON
            key={`basins-${basinSignature}`}
            data={basinFeatures}
            interactive={false}
            style={{ color: "#2563a7", weight: 1.5, fillColor: "#4593c7", fillOpacity: 0.16 }}
          />
        ) : null}

        {draftCoordinate ? (
          <CircleMarker
            center={[draftCoordinate.latitude, draftCoordinate.longitude]}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#102521", fillOpacity: 0.95 }}
          >
            <Popup>Draft coordinate — complete the site form to assess it.</Popup>
          </CircleMarker>
        ) : null}

        {results.map((result) => {
          const score = environmentalScore(result, view);
          const water = waterLabel(result, view);
          const carbon = gridFactor(result);
          const eemsProfile = eemsProfileBySiteId.get(result.site.id);
          const selected = result.assessment_id === selectedId;
          return (
            <CircleMarker
              key={result.assessment_id}
              center={[result.site.latitude, result.site.longitude]}
              radius={selected ? 11 : 8}
              pathOptions={{
                className: selected ? "atlas-marker-selected" : undefined,
                color: "#ffffff",
                weight: 3,
                fillColor: markerColour(result, layer, view, eemsProfile),
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(result.assessment_id) }}
            >
              <Popup>
                {isEemsLayer(layer) ? (
                  <EemsPopup profile={eemsProfile} result={result} />
                ) : (
                  <div className="min-w-[220px] font-sans">
                    <p className="atlas-kicker text-tide">Mapped location</p>
                    <p className="mt-2 font-display text-xl leading-tight text-ink">{result.site.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {countryName(result) ?? "Country unresolved"} · {result.site.latitude.toFixed(3)}, {result.site.longitude.toFixed(3)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 divide-x divide-ink/15 border-y border-ink/15">
                      <div className="py-2 pr-2">
                        <p className="atlas-kicker text-slate-400">Exposure</p>
                        <p className="atlas-marker-index mt-1 font-semibold text-ink">{formatNumber(score, 0)}</p>
                      </div>
                      <div className="py-2 pl-2">
                        <p className="atlas-kicker text-slate-400">Grid</p>
                        <p className="atlas-marker-index mt-1 font-semibold text-ink">{carbon === null ? "N/A" : `${formatNumber(carbon, 0)} g`}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-slate-600">{water ?? "Water score unavailable"}</p>
                  </div>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
        </MapContainer>
      </div>

      <footer aria-label="Map evidence" className="grid gap-3 border-t atlas-rule bg-paper px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.55fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="atlas-kicker text-tide">{signalLabel}</p>
          <ul aria-label={`${signalLabel} thresholds`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-ink/15" style={{ backgroundColor: item.colour }} />
                <span>{item.label}</span>
                {item.threshold ? <span className="atlas-marker-index text-slate-400">{item.threshold}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 border-t atlas-rule pt-2 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="atlas-kicker text-slate-400">Source basis</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-600">{sourceBasis}</p>
          {basemapStatus === "unavailable" ? (
            <p role="status" className="mt-1 text-[10px] font-semibold text-[#a5482c]">Basemap unavailable · evidence overlays remain active</p>
          ) : basemapStatus === "loading" ? (
            <p role="status" className="mt-1 text-[10px] text-slate-400">Loading basemap · OpenFreeMap</p>
          ) : (
            <p className="mt-1 text-[10px] text-slate-400">Positron basemap · OpenFreeMap</p>
          )}
        </div>
        <p className="atlas-marker-index whitespace-nowrap text-[11px] font-semibold text-ink">
          {results.length} {results.length === 1 ? "site" : "sites"} visible
        </p>
      </footer>
    </div>
  );
}

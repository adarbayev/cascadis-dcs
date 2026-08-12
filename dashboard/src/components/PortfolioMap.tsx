import { useEffect, useMemo } from "react";
import type { Feature as GeoFeature, FeatureCollection, Geometry } from "geojson";
import L, { type PathOptions } from "leaflet";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import countries110m from "world-atlas/countries-110m.json";
import countryRecords from "world-countries";
import type { AssessmentResult, MapLayer, SensitivityView } from "../types";
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

function markerColour(result: AssessmentResult, layer: MapLayer, view: SensitivityView): string {
  if (layer === "water") return waterColour(result, view);
  if (layer === "carbon") return carbonColour(gridFactor(result));
  return palette[priorityBand(environmentalScore(result, view))];
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
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 6 });
  }, [map, signature, results]);
  return null;
}

export function PortfolioMap({
  results,
  selectedId,
  onSelect,
  onMapClick,
  draftCoordinate,
  layer,
  view,
}: PortfolioMapProps) {
  const carbonByIso3 = useMemo(() => {
    const values = new Map<string, number>();
    for (const result of results) {
      const iso3 = countryIso3(result);
      const factor = gridFactor(result);
      if (iso3 && factor !== null) values.set(iso3, factor);
    }
    return values;
  }, [results]);

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

  return (
    <div className="atlas-map relative h-[440px] overflow-hidden bg-[#d8ddd8] lg:h-[510px]">
      <MapContainer
        center={[20, 5]}
        zoom={2}
        minZoom={2}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        className="h-full w-full"
        aria-label="Candidate location map"
      >
        <TileLayer
          attribution='Map &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={onMapClick} />
        <FitResults results={results} />

        {layer === "carbon" && carbonByIso3.size > 0 ? (
          <GeoJSON key={`countries-${carbonByIso3.size}`} data={worldCountries} style={countryStyle} />
        ) : null}

        {layer === "water" && basinFeatures.features.length > 0 ? (
          <GeoJSON
            key={`basins-${basinFeatures.features.length}`}
            data={basinFeatures}
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
          const selected = result.assessment_id === selectedId;
          return (
            <CircleMarker
              key={result.assessment_id}
              center={[result.site.latitude, result.site.longitude]}
              radius={selected ? 11 : 8}
              pathOptions={{
                color: selected ? "#102521" : "#ffffff",
                weight: selected ? 4 : 3,
                fillColor: markerColour(result, layer, view),
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(result.assessment_id) }}
            >
              <Popup>
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
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[calc(100%-1.5rem)] border border-ink/25 bg-paper/95 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
        {layer === "carbon"
          ? "Country fill: Ember national lifecycle generation intensity."
          : layer === "water"
            ? basinFeatures.features.length
              ? "Basin boundary returned by the water source."
              : "Basin boundary unavailable; markers show point results."
            : "Markers show the Location Exposure Score."}
      </div>
    </div>
  );
}

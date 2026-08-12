import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  Leaf,
  LoaderCircle,
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { createAssessment, getPolicy, getPortfolio, getSourceStatus } from "./api";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { DecisionInspector } from "./components/DecisionInspector";
import { InfoDrawer } from "./components/InfoDrawer";
import { PortfolioMap } from "./components/PortfolioMap";
import { PortfolioTable } from "./components/PortfolioTable";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { SiteInputPanel } from "./components/SiteInputPanel";
import { Notice } from "./components/Notice";
import {
  bwsCategory,
  apiViewKey,
  countryName,
  environmentalScore,
  formatNumber,
  gridFactor,
  hasMixedGridBasis,
  hasPortfolioRankReversal,
  waterScore,
} from "./lib/assessment";
import { downloadText, parseLocationCsv, rowsToCsv } from "./lib/csv";
import { buildPortfolioCsv } from "./lib/portfolioExport";
import type {
  AssessmentResult,
  DraftForm,
  LocationInput,
  MapLayer,
  PolicyDocument,
  SensitivityView,
  SourceStatus,
} from "./types";

const emptyForm = (): DraftForm => ({
  id: "",
  name: "",
  latitude: "",
  longitude: "",
  project_type: "retrofit",
  cost_priority: "balanced",
  uptime_constraint: "maintenance_window",
  growth_3y: "moderate",
  pue: "",
  wue_l_per_kwh: "",
  it_load_utilization_pct: "",
  annual_it_energy_mwh: "",
});

const viewLabels: Record<SensitivityView, { short: string; long: string }> = {
  bws: { short: "Water Stress", long: "Baseline Water Stress" },
  default: { short: "Default", long: "Default Overall Water Risk" },
  elp: { short: "Electric Power", long: "Electric Power proxy" },
  smc: { short: "Semiconductor", long: "Semiconductor proxy" },
};

const layerLabels: Record<MapLayer, string> = {
  water: "Water stress",
  carbon: "Grid carbon",
  recommendation: "Recommendation",
};

function optionalMetric(value: string, label: string, rule: (number: number) => boolean, message: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !rule(parsed)) throw new Error(`${label} ${message}.`);
  return parsed;
}

function formToLocation(form: DraftForm): LocationInput {
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  if (!form.id.trim() || !form.name.trim()) throw new Error("Site ID and site name are required.");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude must be between -90 and 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Longitude must be between -180 and 180.");

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    latitude,
    longitude,
    project_type: form.project_type,
    cost_priority: form.cost_priority,
    uptime_constraint: form.uptime_constraint,
    growth_3y: form.growth_3y,
    pue: optionalMetric(form.pue, "PUE", (value) => value >= 1, "must be at least 1"),
    wue_l_per_kwh: optionalMetric(form.wue_l_per_kwh, "WUE", (value) => value >= 0, "cannot be negative"),
    it_load_utilization_pct: optionalMetric(
      form.it_load_utilization_pct,
      "IT load utilisation",
      (value) => value >= 0 && value <= 100,
      "must be between 0 and 100",
    ),
    annual_it_energy_mwh: optionalMetric(
      form.annual_it_energy_mwh,
      "Annual IT energy",
      (value) => value > 0,
      "must be greater than zero",
    ),
  };
}

function sourceTone(status?: string): string {
  const normalized = status?.toLowerCase();
  if (normalized === "available" || normalized === "ok") return "bg-emerald-400";
  if (normalized === "configured") return "bg-sky-300";
  if (normalized === "stale") return "bg-amber-400";
  if (normalized === "unavailable") return "bg-red-400";
  return "bg-slate-400";
}

function leadingResultId(items: AssessmentResult[], view: SensitivityView = "bws"): string | null {
  const scored = items
    .map((item) => ({ id: item.assessment_id, score: environmentalScore(item, view) }))
    .filter((item): item is { id: string; score: number } => item.score !== null)
    .sort((first, second) => second.score - first.score);
  return scored[0]?.id ?? items[0]?.assessment_id ?? null;
}

function App() {
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [queued, setQueued] = useState<LocationInput[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [view, setView] = useState<SensitivityView>("bws");
  const [mapLayer, setMapLayer] = useState<MapLayer>("recommendation");
  const [weights, setWeights] = useState({ water: 0.5, carbon: 0.5 });
  const [portfolioScope, setPortfolioScope] = useState<"google" | "all" | "other">("all");
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [facilityStatus, setFacilityStatus] = useState<"all" | "operating" | "in_development" | "under_construction" | "announced">("all");
  const [sourceStatus, setSourceStatus] = useState<SourceStatus[]>([]);
  const [policy, setPolicy] = useState<PolicyDocument | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"methodology" | "sources" | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const loadSources = async () => {
    setSourceLoading(true);
    setSourceError(null);
    const [status, policyResult] = await Promise.allSettled([getSourceStatus(), getPolicy()]);
    if (status.status === "fulfilled") setSourceStatus(status.value);
    else setSourceError(status.reason instanceof Error ? status.reason.message : "Source status is unavailable.");
    if (policyResult.status === "fulfilled") {
      setPolicy(policyResult.value);
      if (policyResult.value.default_weights) setWeights(policyResult.value.default_weights);
    }
    setSourceLoading(false);
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      const portfolio = await Promise.allSettled([getPortfolio()]);
      if (!active) return;
      const outcome = portfolio[0];
      if (outcome.status === "fulfilled") {
        setResults(outcome.value);
        const googleResults = outcome.value.filter(
          (item) => item.site.location_evidence?.portfolio_id === "google_public_data_centers",
        );
        if (googleResults.length) {
          setPortfolioScope("google");
          setSelectedId(leadingResultId(googleResults));
        } else if (outcome.value[0]) {
          setSelectedId(leadingResultId(outcome.value));
        }
      } else {
        setPortfolioError(outcome.reason instanceof Error ? outcome.reason.message : "Portfolio is unavailable.");
      }
      setPortfolioLoading(false);
      await loadSources();
    };
    void bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!intakeOpen && !drawer) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIntakeOpen(false);
      setDrawer(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawer, intakeOpen]);

  const scopedResults = useMemo(() => {
    if (portfolioScope === "google") {
      return results.filter(
        (result) => result.site.location_evidence?.portfolio_id === "google_public_data_centers",
      );
    }
    if (portfolioScope === "other") {
      return results.filter(
        (result) => result.site.location_evidence?.portfolio_id !== "google_public_data_centers",
      );
    }
    return results;
  }, [portfolioScope, results]);

  const visibleResults = useMemo(() => {
    const query = portfolioQuery.trim().toLowerCase();
    return scopedResults.filter((result) => {
      const status = result.site.location_evidence?.facility_status;
      if (facilityStatus !== "all" && status !== facilityStatus) return false;
      if (!query) return true;
      return [
        result.site.name,
        result.site.id,
        countryName(result),
        result.site.location_evidence?.operator,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [facilityStatus, portfolioQuery, scopedResults]);

  useEffect(() => {
    if (!selectedId || !visibleResults.some((result) => result.assessment_id === selectedId)) {
      setSelectedId(leadingResultId(visibleResults, view));
    }
  }, [visibleResults, selectedId, view]);

  const selected = visibleResults.find((result) => result.assessment_id === selectedId) ?? null;
  const compared = compareIds.map((id) => visibleResults.find((result) => result.assessment_id === id)).filter((item): item is AssessmentResult => Boolean(item));
  const mixedGridBasis = useMemo(() => hasMixedGridBasis(visibleResults, view), [visibleResults, view]);
  const scoredResults = visibleResults.filter((result) => environmentalScore(result, view) !== null);
  const topScore = !mixedGridBasis && scoredResults.length ? Math.max(...scoredResults.map((result) => environmentalScore(result, view) as number)) : null;
  const highWater = visibleResults.filter((result) => {
    const category = bwsCategory(result);
    return category === -1 || (category !== null && category >= 3);
  }).length;
  const highCarbon = visibleResults.filter((result) => {
    const value = gridFactor(result);
    return value !== null && value >= 400;
  }).length;
  const fullCoverage = visibleResults.filter((result) => waterScore(result, view) !== null && gridFactor(result) !== null).length;
  const rankReversal = useMemo(() => hasPortfolioRankReversal(visibleResults), [visibleResults]);
  const googleCount = results.filter(
    (result) => result.site.location_evidence?.portfolio_id === "google_public_data_centers",
  ).length;
  const otherCount = results.length - googleCount;

  const handleAdd = () => {
    try {
      const site = formToLocation(form);
      if (queued.some((item) => item.id === site.id)) throw new Error(`Site ID ${site.id} is already queued.`);
      if (queued.length >= 100) throw new Error("The assessment limit is 100 sites.");
      setQueued((current) => [...current, site]);
      setForm((current) => ({ ...emptyForm(), project_type: current.project_type, cost_priority: current.cost_priority, uptime_constraint: current.uptime_constraint, growth_3y: current.growth_3y }));
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The site could not be added.");
    }
  };

  const handleCsv = async (file: File) => {
    try {
      const imported = parseLocationCsv(await file.text());
      if (queued.length + imported.length > 100) throw new Error("The combined queue exceeds the 100-site limit.");
      const existingIds = new Set(queued.map((site) => site.id));
      const duplicate = imported.find((site) => existingIds.has(site.id));
      if (duplicate) throw new Error(`Site ID ${duplicate.id} is already queued.`);
      setQueued((current) => [...current, ...imported]);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The CSV could not be imported.");
    }
  };

  const handleAssess = async () => {
    if (!queued.length) return;
    setAssessing(true);
    setFormError(null);
    try {
      const response = await createAssessment({ locations: queued, weights, water_view: apiViewKey[view] });
      const byId = new Map(results.map((result) => [result.assessment_id, result]));
      for (const result of response.assessments) byId.set(result.assessment_id, result);
      const next = Array.from(byId.values());
      setResults(next);
      setPortfolioScope("all");
      setSelectedId(response.assessments[0]?.assessment_id ?? selectedId);
      setQueued([]);
      setIntakeOpen(false);
      setPortfolioError(null);
      void loadSources();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The assessment could not be completed.");
    } finally {
      setAssessing(false);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length < 3 ? [...current, id] : current;
    });
  };

  const downloadTemplate = () => {
    const template = rowsToCsv(
      ["id", "name", "latitude", "longitude", "project_type", "cost_priority", "uptime_constraint", "growth_3y", "pue", "wue_l_per_kwh", "it_load_utilization_pct", "annual_it_energy_mwh"],
      [["site-1", "Example candidate", 51.5074, -0.1278, "retrofit", "balanced", "maintenance_window", "moderate", "", "", "", ""]],
    );
    downloadText("cascadis-location-template.csv", template, "text/csv;charset=utf-8");
  };

  const exportJson = () => downloadText(
    "cascadis-location-assessments.json",
    JSON.stringify({ exported_at: new Date().toISOString(), active_water_view: view, policy_version: policy?.version, portfolio_scope: portfolioScope, assessments: visibleResults }, null, 2),
    "application/json;charset=utf-8",
  );

  const exportCsv = () => {
    downloadText("cascadis-location-ranking.csv", buildPortfolioCsv(visibleResults, view), "text/csv;charset=utf-8");
  };

  return (
    <div className="atlas-grid min-h-screen text-ink">
      <div className="border-b border-white/10 bg-ink px-4 py-2 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-4">
          <p className="atlas-kicker text-white/60">Cascadis · independent sustainability decision support</p>
          <div className="hidden items-center gap-4 md:flex">
            {sourceStatus.length ? sourceStatus.slice(0, 3).map((source, index) => (
              <span key={source.id ?? source.provider ?? index} className="flex items-center gap-2 text-[11px] text-white/70">
                <span className={`h-1.5 w-1.5 ${sourceTone(source.status)}`} />
                {source.label ?? source.provider ?? source.id}
              </span>
            )) : <span className="text-[11px] text-white/50">{sourceLoading ? "Reading source configuration…" : sourceError ?? "Source status unavailable"}</span>}
            <button type="button" onClick={() => void loadSources()} disabled={sourceLoading} className="text-white/50 hover:text-white" aria-label="Refresh source configuration"><RefreshCw size={13} className={sourceLoading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </div>

      <header className="border-b atlas-rule bg-paper/95">
        <div className="mx-auto flex max-w-[1640px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center border border-ink bg-signal text-ink"><Leaf size={21} strokeWidth={1.8} /></span>
            <div>
              <p className="atlas-kicker text-tide">DCSS · Data Center Sustainability Scoring</p>
              <h1 className="mt-1 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.035em] text-ink">Cascadis</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="max-w-md text-xs leading-5 text-slate-600">Location screening for water exposure, grid carbon, cooling options, and delivery constraints.</p>
            <nav className="flex items-center gap-4" aria-label="Reference panels">
              <button type="button" onClick={() => setDrawer("methodology")} className="flex items-center gap-2 border-b border-ink/30 py-1 text-xs font-semibold hover:border-ink"><BookOpen size={14} /> Method</button>
              <button type="button" onClick={() => setDrawer("sources")} className="flex items-center gap-2 border-b border-ink/30 py-1 text-xs font-semibold hover:border-ink"><Database size={14} /> Sources</button>
              <button type="button" onClick={() => setIntakeOpen(true)} className="flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-tide"><Plus size={15} /> Add location</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1640px] px-4 pb-10 pt-7 sm:px-6 lg:px-8">
        <section className="border-y atlas-rule bg-paper/70" aria-label="Portfolio summary">
          <dl className="grid grid-cols-2 divide-x divide-y divide-ink/15 sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Locations in view", value: portfolioLoading ? "—" : String(visibleResults.length), detail: `${fullCoverage} source-complete` },
              { label: "Highest exposure", value: mixedGridBasis ? "N/A" : formatNumber(topScore, 0), detail: viewLabels[view].long },
              { label: "Water gate", value: String(highWater), detail: "high, extreme, or arid" },
              { label: "Carbon attention", value: String(highCarbon), detail: "≥400 gCO₂e/kWh" },
            ].map(({ label, value, detail }) => (
              <div key={label} className="px-4 py-4 sm:px-5">
                <dt className="atlas-kicker text-slate-500">{label}</dt>
                <dd className="mt-2 flex items-baseline gap-3"><span className="atlas-marker-index text-2xl font-semibold text-ink">{value}</span><span className="hidden text-[11px] text-slate-500 xl:inline">{detail}</span></dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 border-b atlas-rule pb-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="atlas-kicker text-tide">Portfolio / evidence controls</p>
              <div className="mt-3 flex flex-wrap gap-x-5" aria-label="Portfolio scope selector">
                {[
                  { id: "google" as const, label: "Google public locations", count: googleCount },
                  { id: "other" as const, label: "Other assessments", count: otherCount },
                  { id: "all" as const, label: "All saved", count: results.length },
                ].map((option) => (
                  <button key={option.id} type="button" onClick={() => setPortfolioScope(option.id)} className="atlas-tab text-sm font-semibold" data-active={portfolioScope === option.id}>
                    {option.label} <span className="atlas-marker-index ml-1 text-xs text-slate-400">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <label>
                <span className="atlas-kicker block text-slate-500">Find location</span>
                <span className="mt-2 flex min-w-52 items-center gap-2 border-b border-ink/40 py-1.5 focus-within:border-tide">
                  <Search size={14} className="text-slate-400" aria-hidden="true" />
                  <input
                    value={portfolioQuery}
                    onChange={(event) => setPortfolioQuery(event.target.value)}
                    placeholder="City, country, or site ID"
                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                    aria-label="Find location"
                  />
                </span>
              </label>
              <label>
                <span className="atlas-kicker block text-slate-500">Facility status</span>
                <select value={facilityStatus} onChange={(event) => setFacilityStatus(event.target.value as typeof facilityStatus)} className="mt-2 min-w-40 border-0 border-b border-ink/40 bg-transparent py-1.5 pr-8 text-sm font-semibold outline-none focus:border-tide">
                  <option value="all">All statuses</option>
                  <option value="operating">Operating</option>
                  <option value="in_development">In development</option>
                  <option value="under_construction">Under construction</option>
                  <option value="announced">Announced</option>
                </select>
              </label>
              <label>
                <span className="atlas-kicker block text-slate-500">Water view</span>
                <select value={view} onChange={(event) => setView(event.target.value as SensitivityView)} className="mt-2 min-w-48 border-0 border-b border-ink/40 bg-transparent py-1.5 pr-8 text-sm font-semibold outline-none focus:border-tide">
                  {(Object.keys(viewLabels) as SensitivityView[]).map((item) => <option key={item} value={item}>{viewLabels[item].long}</option>)}
                </select>
              </label>
              <div>
                <span className="atlas-kicker block text-slate-500">Map signal</span>
                <div className="mt-1 flex gap-4" aria-label="Map layer selector">
                  {(Object.keys(layerLabels) as MapLayer[]).map((layer) => (
                    <button key={layer} type="button" onClick={() => setMapLayer(layer)} className="atlas-tab text-xs font-semibold" data-active={mapLayer === layer}>{layerLabels[layer]}</button>
                  ))}
                </div>
              </div>
              <details className="group relative">
                <summary className="cursor-pointer list-none border border-ink/30 px-3 py-2 text-xs font-semibold text-ink hover:border-ink">Weights {Math.round(weights.water * 100)} / {Math.round(weights.carbon * 100)}</summary>
                <div className="absolute right-0 z-[500] mt-2 w-72 border border-ink bg-paper p-4 shadow-[8px_8px_0_rgba(20,33,29,0.12)]">
                  <p className="atlas-kicker text-slate-500">Apply on next assessment</p>
                  <div className="mt-4 space-y-4">
                    <label className="grid grid-cols-[48px_1fr_36px] items-center gap-3 text-xs"><span>Water</span><input aria-label="Water weight" type="range" min="0" max="1" step="0.05" value={weights.water} onChange={(event) => { const water = Number(event.target.value); setWeights({ water, carbon: Number((1 - water).toFixed(2)) }); }} /><span className="atlas-marker-index text-right">{Math.round(weights.water * 100)}%</span></label>
                    <label className="grid grid-cols-[48px_1fr_36px] items-center gap-3 text-xs"><span>Carbon</span><input aria-label="Carbon weight" type="range" min="0" max="1" step="0.05" value={weights.carbon} onChange={(event) => { const carbon = Number(event.target.value); setWeights({ carbon, water: Number((1 - carbon).toFixed(2)) }); }} /><span className="atlas-marker-index text-right">{Math.round(weights.carbon * 100)}%</span></label>
                  </div>
                </div>
              </details>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">No official data-center preset. Electric Power and Semiconductor remain separate WRI sensitivity views.</p>
        </section>

        {portfolioScope === "google" && results.length ? (
          <section className="mt-5 grid gap-3 border-y atlas-rule bg-paper/75 px-1 py-4 text-slate-700 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-ink">Google public-location screening portfolio</p>
              <p className="mt-1 max-w-5xl text-xs leading-5">Independent public-data screening; no Google endorsement. Public location units may contain several facilities. Locality centroids and public map markers make Aqueduct outputs regional proxies.</p>
            </div>
            <a href="https://www.datacenters.google/locations/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-tide underline underline-offset-4">Official directory <ArrowUpRight size={13} /></a>
          </section>
        ) : null}

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="atlas-panel overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b atlas-rule px-4 py-3 sm:px-5">
              <div>
                <p className="atlas-kicker text-tide">Atlas plate / {mapLayer}</p>
                <h2 className="mt-1 font-display text-2xl leading-none text-ink">Regional evidence map</h2>
              </div>
              <p className="max-w-md text-right text-[11px] leading-5 text-slate-500">Click the map to begin a new assessment. Select a marker to read the decision desk.</p>
            </div>
            <PortfolioMap
              results={visibleResults}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMapClick={(latitude, longitude) => {
                setForm((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
                setIntakeOpen(true);
              }}
              draftCoordinate={form.latitude && form.longitude && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) ? { latitude: Number(form.latitude), longitude: Number(form.longitude) } : null}
              layer={mapLayer}
              view={view}
            />
          </div>
          <DecisionInspector result={selected} view={view} onOpenEvidence={() => document.getElementById("selected-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
        </section>

        <div className="mt-5 space-y-3">
          {portfolioError ? (
            <Notice role="alert" tone="warning" title="Portfolio could not be loaded"><p>{portfolioError} New submissions require the local API.</p></Notice>
          ) : null}
          {mixedGridBasis ? (
            <Notice role="alert" tone="critical" title="Portfolio ranking blocked"><p>The evidence set mixes grid providers, factor bases, or units. Scores remain visible; ranking requires a common basis.</p></Notice>
          ) : null}
          {rankReversal ? (
            <Notice tone="sensitivity" title="Sensitivity rank reversal detected"><p>At least one location changes rank across complete WRI views. Review the proxy choice before approving the queue.</p></Notice>
          ) : null}
        </div>

        <section className="mt-10">
          {portfolioLoading ? (
            <div className="atlas-panel flex min-h-52 items-center justify-center"><LoaderCircle className="animate-spin text-tide" /><span className="ml-3 text-sm font-semibold text-slate-500">Loading saved assessments…</span></div>
          ) : visibleResults.length ? (
            <div className="space-y-8">
              <PortfolioTable results={visibleResults} selectedId={selectedId} onSelect={setSelectedId} view={view} compareIds={compareIds} onToggleCompare={toggleCompare} />
              <ComparisonPanel results={compared} view={view} onRemove={toggleCompare} />
              {selected ? <div id="selected-analysis" className="scroll-mt-5"><RecommendationPanel result={selected} view={view} /></div> : null}
            </div>
          ) : (
            <section className="atlas-panel px-6 py-14 text-center">
              <MapPinned size={24} className="mx-auto text-tide" />
              <h2 className="mt-4 font-display text-2xl text-ink">{results.length ? "No locations match this view" : "No locations assessed yet"}</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{results.length ? "Clear the search or status filter, or choose another portfolio scope." : "Click the map or open Add location to build a source-backed assessment."}</p>
              {!results.length ? <button type="button" onClick={() => setIntakeOpen(true)} className="mt-5 border border-ink bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-tide">Add first location</button> : null}
            </section>
          )}
        </section>

        {visibleResults.length ? (
          <section className="mt-8 flex flex-col gap-4 border-y atlas-rule py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-ink">Evidence export</p><p className="mt-1 text-xs text-slate-500">Source fields, policy outputs, warnings, and retrieval timestamps.</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={exportCsv} className="flex items-center gap-2 border border-ink/30 px-4 py-2.5 text-xs font-semibold hover:border-ink"><Download size={14} /> CSV</button>
              <button type="button" onClick={exportJson} className="flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-tide"><Download size={14} /> JSON</button>
            </div>
          </section>
        ) : null}

        <footer className="flex flex-col gap-3 py-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Screening support only. Final cooling design requires engineering and commercial validation.</p>
          <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-tide" /> Policy {policy?.version ?? "version unavailable"} · data refreshed per assessment</p>
        </footer>
      </main>

      {intakeOpen ? (
        <div className="fixed inset-0 z-[900] flex justify-end bg-ink/45" role="dialog" aria-modal="true" aria-label="Add locations" onMouseDown={() => setIntakeOpen(false)}>
          <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-ink bg-paper shadow-lift" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b atlas-rule bg-paper px-5 py-4">
              <div><p className="atlas-kicker text-tide">Cascadis assessment intake</p><p className="mt-1 text-sm text-slate-600">Manual coordinate or CSV portfolio</p></div>
              <button type="button" onClick={() => setIntakeOpen(false)} className="border border-ink/30 p-2 hover:border-ink" aria-label="Close location intake"><X size={17} /></button>
            </div>
            <SiteInputPanel
              form={form}
              setForm={setForm}
              queued={queued}
              onAdd={handleAdd}
              onRemove={(id) => setQueued((current) => current.filter((site) => site.id !== id))}
              onAssess={handleAssess}
              onCsv={handleCsv}
              onDownloadTemplate={downloadTemplate}
              busy={assessing}
              error={formError}
            />
          </div>
        </div>
      ) : null}

      <InfoDrawer mode={drawer} onClose={() => setDrawer(null)} policy={policy} sourceStatus={sourceStatus} />
    </div>
  );
}

export default App;

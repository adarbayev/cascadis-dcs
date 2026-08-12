import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  Droplets,
  Factory,
  Gauge,
  ExternalLink,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import type { AssessmentResult, SensitivityView } from "../types";
import {
  bwsCategory,
  countryName,
  decision,
  environmentalScore,
  formatDate,
  formatNumber,
  gridFactor,
  gridSource,
  humanize,
  preferredCooling,
  sensitivitySpread,
  waterLabel,
  waterScore,
  waterSource,
} from "../lib/assessment";

interface RecommendationPanelProps {
  result: AssessmentResult;
  view: SensitivityView;
}

function ActionList({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof Clock3 }) {
  if (!items.length) return null;
  return (
    <div className="border-t-2 border-tide bg-[#f1efe7] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-slate-500">
        <Icon size={15} className="text-forest-600" /> {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-slate-700">
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-forest-500" /> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceCard({
  title,
  value,
  detail,
  meta,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  meta: string;
  icon: typeof Droplets;
}) {
  return (
    <div className="border-y border-ink/15 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
        </div>
        <span className="border border-ink/15 p-2 text-tide"><Icon size={18} /></span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-700">{detail}</p>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">{meta}</p>
    </div>
  );
}

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function RecommendationPanel({ result, view }: RecommendationPanelProps) {
  const recommendation = decision(result);
  const water = waterSource(result);
  const grid = gridSource(result);
  const waterValue = waterScore(result, view);
  const gridValue = gridFactor(result);
  const score = environmentalScore(result, view);
  const spread = sensitivitySpread(result);
  const preferred = preferredCooling(result);
  const conditional = asStringList(recommendation.conditional);
  const excluded = asStringList(recommendation.excluded);
  const immediate = asStringList(recommendation.immediate_actions);
  const maintenance = asStringList(recommendation.maintenance_window_actions);
  const expansion = asStringList(recommendation.expansion_actions);
  const tradeoffs = asStringList(recommendation.business_tradeoffs);
  const derived = result.policy_v1?.proxy_metrics;
  const specialArid = bwsCategory(result) === -1;
  const locationEvidence = result.site.location_evidence;
  const isGooglePortfolio = locationEvidence?.portfolio_id === "google_public_data_centers";
  const provenanceRows: Array<Record<string, unknown>> = Array.isArray(result.provenance) && result.provenance.length
    ? result.provenance
    : [
        {
          source_name: "Water risk",
          provider: water?.provider,
          dataset: water?.dataset,
          source_url: water?.source_url,
          retrieved_at: water?.retrieved_at,
          dataset_vintage: water?.dataset_vintage,
          basis: "WRI Aqueduct 4.0 Baseline Annual point-in-polygon lookup",
          attribution: water?.attribution,
          stale: water?.cache?.stale,
        },
        {
          source_name: "Grid carbon",
          provider: grid?.provider,
          dataset: grid?.dataset,
          source_url: grid?.source_url,
          retrieved_at: grid?.retrieved_at,
          dataset_vintage: grid?.dataset_vintage,
          basis: grid?.factor_basis,
          attribution: grid?.attribution,
          stale: grid?.cache?.stale,
        },
      ];

  return (
    <section className="atlas-panel overflow-hidden">
      <div className="bg-ink px-5 py-6 text-white sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="atlas-kicker text-signal">Evidence record / selected site</p>
            <h2 className="mt-2 truncate font-display text-3xl">{result.site.name}</h2>
            <p className="mt-1 text-sm text-white/60">
              {countryName(result) ?? "Country unresolved"} · {result.site.latitude.toFixed(4)}, {result.site.longitude.toFixed(4)}
            </p>
          </div>
          <div className="shrink-0 border border-white/25 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">Location exposure</p>
            <p className="mt-1 font-display text-3xl font-bold">{formatNumber(score, 0)}<span className="text-sm text-white/50"> / 100</span></p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[locationEvidence?.operator, locationEvidence?.facility_status, result.site.project_type, result.site.cost_priority, result.site.uptime_constraint, `${result.site.growth_3y} growth`].filter((item): item is string => Boolean(item)).map((item) => (
            <span key={item} className="border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">
              {humanize(item)}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {isGooglePortfolio ? (
          <div className="border border-sky-200 bg-sky-50 p-4 text-sky-950 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold">Google Water Risk Framework handoff</p>
                <p className="mt-2 text-xs leading-5 text-sky-800">This result is an external regional pre-screen. Google’s published Responsible Use gate evaluates current and future scarcity, chronic and acute depletion, and curtailment for the actual freshwater source. Any High KPI excludes that freshwater source from evaporative cooling for new capacity. Google then reviews source quantity, discharge, WASH, local sentiment and regulatory risk. Public numeric thresholds are incomplete, so this tool does not reproduce Google’s rating.</p>
              </div>
              <a href={locationEvidence?.methodology_reference_url ?? "https://www.gstatic.com/gumdrop/sustainability/2023-data-center-water-risk-framework-whitepaper.pdf"} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs font-bold text-sky-800 underline decoration-sky-300 underline-offset-4">Framework <ExternalLink size={12} /></a>
            </div>
          </div>
        ) : null}

        {specialArid ? (
          <div className="flex gap-3 border border-violet-200 bg-violet-50 p-4 text-violet-900">
            <AlertTriangle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Critical review: Arid and Low Water Use</p>
              <p className="mt-1 text-xs leading-5 text-violet-700">WRI treats this special category as a top-priority screening condition. It is not interpreted as low risk.</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <SourceCard
            title="Water view"
            value={waterValue === null ? "N/A" : formatNumber(waterValue, 2)}
            detail={waterLabel(result, view) ?? "Source result unavailable"}
            meta={`WRI Aqueduct 4.0 · dimensionless risk score · ${water?.dataset_vintage ?? "vintage unavailable"} · retrieved ${formatDate(water?.retrieved_at)}${water?.cache?.stale ? " · stale cache" : ""}`}
            icon={Droplets}
          />
          <SourceCard
            title="Grid carbon"
            value={gridValue === null ? "N/A" : formatNumber(gridValue, 0)}
            detail={gridValue === null ? "Factor unavailable" : (grid?.unit ?? "gCO₂e/kWh")}
            meta={`Public proxy — Ember · ${grid?.date ?? grid?.year ?? grid?.dataset_vintage ?? "year unavailable"} · ${grid?.factor_basis ?? grid?.basis ?? "national lifecycle generation intensity"} · retrieved ${formatDate(grid?.retrieved_at)}${grid?.cache?.stale ? " · stale cache" : ""}`}
            icon={Factory}
          />
          <SourceCard
            title="Sensitivity"
            value={spread ? `${formatNumber(spread.min, 0)}–${formatNumber(spread.max, 0)}` : "N/A"}
            detail={spread?.materialDivergence ? "Material score divergence" : "Across available WRI views"}
            meta="Default, Electric Power and Semiconductor are separate sensitivity views; none is an official data-center preset."
            icon={Gauge}
          />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-forest-600">Evidence provenance</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {provenanceRows.map((record, index) => {
              const sourceUrl = typeof record.source_url === "string" ? record.source_url : null;
              const sourceName = String(record.source_name ?? record.provider ?? `Source ${index + 1}`);
              const provider = String(record.provider ?? "Provider unavailable");
              const dataset = String(record.dataset ?? "Dataset unavailable");
              const attribution = String(record.attribution ?? "Attribution unavailable");
              const basis = String(record.basis ?? "Basis unavailable");
              const retrievedAt = typeof record.retrieved_at === "string" ? record.retrieved_at : undefined;
              const vintage = record.dataset_vintage == null ? "Vintage unavailable" : String(record.dataset_vintage);
              const confidence = typeof record.confidence === "string" ? record.confidence : null;
              const coordinateBasis = typeof record.coordinate_basis === "string" ? record.coordinate_basis : null;
              const note = typeof record.note === "string" ? record.note : null;
              return (
                <article key={`${sourceName}-${index}`} className="border border-ink/15 bg-[#f1efe7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{sourceName}</p>
                      <p className="mt-1 text-xs text-slate-500">{dataset} · {vintage}</p>
                    </div>
                    {sourceUrl ? (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 border border-ink/20 bg-paper px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-tide hover:border-tide">
                        Source <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
                    <div><dt className="inline font-bold text-slate-700">Provider: </dt><dd className="inline">{provider}</dd></div>
                    <div><dt className="inline font-bold text-slate-700">Basis: </dt><dd className="inline">{basis}</dd></div>
                    <div><dt className="inline font-bold text-slate-700">Attribution: </dt><dd className="inline">{attribution}</dd></div>
                    <div><dt className="inline font-bold text-slate-700">Retrieved: </dt><dd className="inline">{formatDate(retrievedAt)}{record.stale ? " · stale cache" : ""}</dd></div>
                    {coordinateBasis ? <div><dt className="inline font-bold text-slate-700">Coordinate basis: </dt><dd className="inline">{humanize(coordinateBasis)}{confidence ? ` · ${humanize(confidence)} confidence` : ""}</dd></div> : null}
                    {note ? <div><dt className="inline font-bold text-slate-700">Note: </dt><dd className="inline">{note}</dd></div> : null}
                  </dl>
                </article>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-forest-600">Cooling shortlist</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="border-t-4 border-emerald-700 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 size={17} /> Preferred</div>
              {preferred.length ? <ul className="mt-3 space-y-2 text-sm leading-5 text-emerald-900">{preferred.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-3 text-sm text-emerald-700">No preferred category returned.</p>}
            </div>
            <div className="border-t-4 border-amber-600 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800"><ShieldCheck size={17} /> Conditional</div>
              {conditional.length ? <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-900">{conditional.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-3 text-sm text-amber-700">No conditional category returned.</p>}
            </div>
            <div className="border-t-4 border-slate-500 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><CircleSlash2 size={17} /> Excluded / defer</div>
              {excluded.length ? <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-700">{excluded.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No excluded category returned.</p>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-forest-600">Delivery sequence</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <ActionList title="Immediate" items={immediate} icon={BatteryCharging} />
            <ActionList title="Maintenance window" items={maintenance} icon={Clock3} />
            <ActionList title="Growth / expansion" items={expansion} icon={Leaf} />
          </div>
          {!immediate.length && !maintenance.length && !expansion.length ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">The policy service did not return a delivery sequence for this site.</p>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="bg-sand p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Business trade-offs</p>
            {tradeoffs.length ? (
              <ul className="mt-3 space-y-2">
                {tradeoffs.map((item) => {
                  const displayItem = item.replace(/environmental priority score/gi, "Location Exposure Score");
                  return <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><ArrowRight size={14} className="mt-1 shrink-0 text-forest-600" />{displayItem}</li>;
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">No explicit trade-off note was returned. Review cost, uptime and growth inputs before treating the shortlist as implementation-ready.</p>
            )}
          </div>
          <div className="border border-sky-200 bg-sky-50 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">Energy procurement lever</p>
            <p className="mt-3 text-sm font-bold text-sky-950">PPA priority: {recommendation.ppa_priority ? humanize(recommendation.ppa_priority) : "Assessment required"}</p>
            <p className="mt-2 text-xs leading-5 text-sky-800">{result.policy_v1?.recommendations?.energy_procurement_lever?.rationale ?? "A PPA is assessed separately from cooling efficiency and does not alter the location-based grid factor or location-based CUE."}</p>
          </div>
        </div>

        {derived && Object.keys(derived).length ? (
          <div className="border border-ink/15 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Calculated operating proxies</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {Object.entries(derived).map(([key, value]) => (
                <div key={key} className="border-t-2 border-ink/20 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanize(key)}</p>
                  <p className="mt-1 text-sm font-bold text-ink">{typeof value === "number" ? formatNumber(value, 2) : String(value ?? "N/A")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {result.warnings?.length ? (
          <div className="border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle size={17} /> Screening warnings</p>
            <ul className="mt-2 space-y-1 text-sm leading-5 text-amber-800">{result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

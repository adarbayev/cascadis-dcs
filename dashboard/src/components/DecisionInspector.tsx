import { ArrowDownRight, Droplets, Factory, LocateFixed } from "lucide-react";
import type { AssessmentResult, SensitivityView } from "../types";
import {
  bwsCategory,
  countryName,
  decision,
  environmentalScore,
  formatNumber,
  gridFactor,
  gridSource,
  humanize,
  preferredCooling,
  waterLabel,
  waterScore,
  waterSource,
} from "../lib/assessment";

interface DecisionInspectorProps {
  result: AssessmentResult | null;
  view: SensitivityView;
  onOpenEvidence: () => void;
}

function MetricLine({
  label,
  value,
  detail,
  proportion,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  proportion: number | null;
  icon: typeof Droplets;
}) {
  const width = proportion === null ? 0 : Math.max(0, Math.min(100, proportion * 100));
  return (
    <div className="border-t atlas-rule py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon size={16} className="mt-0.5 shrink-0 text-tide" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="atlas-kicker text-slate-500">{label}</p>
            <p className="mt-1 truncate text-xs text-slate-600">{detail}</p>
          </div>
        </div>
        <p className="atlas-marker-index shrink-0 text-lg font-semibold text-ink">{value}</p>
      </div>
      <div className="mt-3 h-1 bg-[#d8d8cf]" aria-hidden="true">
        <span className="block h-full bg-tide" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function DecisionInspector({ result, view, onOpenEvidence }: DecisionInspectorProps) {
  if (!result) {
    return (
      <aside className="atlas-panel flex min-h-[510px] flex-col justify-between p-6">
        <div>
          <p className="atlas-kicker text-tide">Decision desk / no selection</p>
          <h2 className="mt-4 max-w-xs font-display text-3xl leading-[1.05] text-ink">Select a mapped location.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">The desk will show the water gate, carbon context, and cooling direction for one site.</p>
        </div>
        <div className="border-t atlas-rule pt-4 text-xs leading-5 text-slate-500">Map markers and portfolio rows share the same selection.</div>
      </aside>
    );
  }

  const score = environmentalScore(result, view);
  const water = waterScore(result, view);
  const carbon = gridFactor(result);
  const source = waterSource(result);
  const grid = gridSource(result);
  const geography = source?.geography;
  const recommendation = decision(result);
  const preferred = preferredCooling(result);
  const isArid = bwsCategory(result) === -1;
  const waterDetail = isArid ? "Arid — critical review" : (waterLabel(result, view) ?? "Source label unavailable");
  const subregion = geography?.name_1 ?? source?.basin_name ?? countryName(result) ?? "Region unresolved";
  const unitId = geography?.aq30_id ?? geography?.pfaf_id ?? source?.basin_id;
  const gridYear = grid?.date ?? grid?.year ?? grid?.dataset_vintage;
  const gridYearLabel = typeof gridYear === "string" || typeof gridYear === "number" ? String(gridYear) : "year unavailable";

  return (
    <aside className="atlas-panel flex min-h-[510px] flex-col bg-paper">
      <div className="border-b atlas-rule px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="atlas-kicker text-tide">Location review / selected site</p>
          <span className="atlas-marker-index border border-ink/20 px-2 py-1 text-[10px] text-slate-500">
            {result.site.latitude.toFixed(2)} / {result.site.longitude.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rust">
          {result.site.location_evidence?.facility_status ? humanize(result.site.location_evidence.facility_status) : humanize(result.site.project_type)}
        </p>
        <h2 className="mt-2 font-display text-[2.15rem] leading-[0.98] text-ink">{result.site.name}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <LocateFixed size={14} className="text-tide" /> {subregion}{unitId ? ` · WRI unit ${unitId}` : ""}
        </p>

        <div className="mt-6 grid grid-cols-[auto_1fr] items-end gap-4 border-y atlas-rule py-4">
          <p className="font-display text-6xl leading-none text-ink">{formatNumber(score, 0)}</p>
          <div className="pb-1">
            <p className="atlas-kicker text-slate-500">Location Exposure Score</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Screening index / 100. Cooling selection follows the water gate.</p>
          </div>
        </div>

        <MetricLine
          label="Water signal"
          value={water === null ? "N/A" : formatNumber(water, 2)}
          detail={waterDetail}
          proportion={water === null ? null : water / 5}
          icon={Droplets}
        />
        <div className="border-t atlas-rule py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Factory size={16} className="mt-0.5 shrink-0 text-tide" strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="atlas-kicker text-slate-500">Grid carbon intensity</p>
                <p className="mt-1 text-xs text-slate-600">National lifecycle proxy · Ember · {gridYearLabel}</p>
              </div>
            </div>
            <p className="shrink-0 text-right text-ink">
              <span className="atlas-marker-index text-lg font-semibold">{carbon === null ? "N/A" : formatNumber(carbon, 0)}</span>
              {carbon !== null ? <span className="ml-1 text-xs text-slate-500">gCO₂e/kWh</span> : null}
            </p>
          </div>
          <div className="mt-3 h-1 bg-[#d8d8cf]" aria-hidden="true">
            <span className="block h-full bg-tide" style={{ width: `${carbon === null ? 0 : Math.max(0, Math.min(100, (carbon / 800) * 100))}%` }} />
          </div>
        </div>

        <div className="border-y border-ink/15 bg-[#f1e9df] px-4 py-4">
          <span className="inline-flex border border-rust/30 bg-paper px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rust">Cooling direction</span>
          <p className="mt-2 text-lg font-semibold leading-6 text-ink">
            {recommendation.matrix_cell ? humanize(String(recommendation.matrix_cell)) : "Engineering review required"}
          </p>
          {preferred.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-700">
              {preferred.slice(0, 2).map((item) => <li key={item}>— {item}</li>)}
            </ul>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenEvidence}
        className="mt-auto flex w-full items-center justify-between border-t border-ink bg-ink px-5 py-4 text-left text-sm font-semibold text-white transition hover:bg-tide"
      >
        Open full evidence record
        <ArrowDownRight size={18} />
      </button>
    </aside>
  );
}

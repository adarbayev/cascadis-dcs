import { X } from "lucide-react";
import type { AssessmentResult, OperationalProfile, SensitivityView } from "../types";
import {
  countryName,
  decision,
  environmentalScore,
  formatNumber,
  gridFactor,
  humanize,
  waterLabel,
  waterScore,
} from "../lib/assessment";

export function ComparisonPanel({
  results,
  view,
  onRemove,
  profiles,
}: {
  results: AssessmentResult[];
  view: SensitivityView;
  onRemove: (id: string) => void;
  profiles?: Map<string, OperationalProfile>;
}) {
  if (results.length < 2) return null;
  const rows = [
    { label: "Location exposure", value: (item: AssessmentResult) => formatNumber(environmentalScore(item, view), 0) },
    { label: "Composite priority", value: (item: AssessmentResult) => formatNumber(profiles?.get(item.assessment_id)?.composite_score ?? null, 0) },
    { label: "PUE", value: (item: AssessmentResult) => formatNumber(profiles?.get(item.assessment_id)?.pue.value ?? null, 2) },
    { label: "WUE", value: (item: AssessmentResult) => profiles?.get(item.assessment_id)?.wue.value == null ? "Not available" : `${formatNumber(profiles.get(item.assessment_id)?.wue.value ?? null, 2)} L/kWh` },
    { label: "CUE", value: (item: AssessmentResult) => profiles?.get(item.assessment_id)?.cue.value == null ? "Not available" : `${formatNumber(profiles.get(item.assessment_id)?.cue.value ?? null, 2)} kgCO₂e/kWh IT` },
    { label: "Water score", value: (item: AssessmentResult) => formatNumber(waterScore(item, view), 2) },
    { label: "Water label", value: (item: AssessmentResult) => waterLabel(item, view) ?? "Not available" },
    { label: "Grid factor", value: (item: AssessmentResult) => gridFactor(item) === null ? "Not available" : `${formatNumber(gridFactor(item), 0)} gCO₂e/kWh` },
    { label: "Decision cell", value: (item: AssessmentResult) => decision(item).matrix_cell ? humanize(String(decision(item).matrix_cell)) : "Not available" },
    { label: "Cost priority", value: (item: AssessmentResult) => humanize(item.site.cost_priority) },
    { label: "Uptime", value: (item: AssessmentResult) => humanize(item.site.uptime_constraint) },
    { label: "Growth", value: (item: AssessmentResult) => humanize(item.site.growth_3y) },
  ];

  return (
    <section className="atlas-panel overflow-hidden bg-[#e7efeb]">
      <div className="border-b atlas-rule px-5 py-5 sm:px-6">
        <p className="atlas-kicker text-tide">Side-by-side / decision variance</p>
        <h2 className="mt-2 font-display text-3xl leading-none text-ink">Comparison view</h2>
      </div>
      <div className="overflow-x-auto p-4 sm:p-6">
        <table className="w-full min-w-[680px] table-fixed border-collapse border border-ink/15 bg-paper">
          <thead>
            <tr>
              <th className="w-48 border-b border-r border-slate-100 bg-slate-50 p-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Metric</th>
              {results.map((item) => (
                <th key={item.assessment_id} className="border-b border-r border-slate-100 p-3 text-left last:border-r-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{item.site.name}</p>
                      <p className="mt-0.5 truncate text-xs font-normal text-slate-500">{countryName(item) ?? "Country unresolved"}</p>
                    </div>
                    <button type="button" onClick={() => onRemove(item.assessment_id)} className="p-1 text-slate-400 hover:text-slate-700" aria-label={`Remove ${item.site.name} from comparison`}><X size={14} /></button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label}>
                <th className={`border-r border-slate-100 bg-slate-50 p-3 text-left text-xs font-bold text-slate-500 ${index < rows.length - 1 ? "border-b" : ""}`}>{row.label}</th>
                {results.map((item) => (
                  <td key={item.assessment_id} className={`border-r border-slate-100 p-3 text-sm font-medium text-slate-700 last:border-r-0 ${index < rows.length - 1 ? "border-b" : ""}`}>{row.value(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

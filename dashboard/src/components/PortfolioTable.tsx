import { AlertTriangle, ArrowDown, Check, GitCompareArrows } from "lucide-react";
import type { AssessmentResult, SensitivityView } from "../types";
import {
  countryName,
  decision,
  environmentalScore,
  formatNumber,
  gridFactor,
  gridSource,
  hasMixedGridBasis,
  humanize,
  priorityBand,
  waterLabel,
  waterScore,
} from "../lib/assessment";

interface PortfolioTableProps {
  results: AssessmentResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  view: SensitivityView;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
}

const bandClass = {
  critical: "border-red-300 bg-red-50 text-red-800",
  high: "border-orange-300 bg-orange-50 text-orange-800",
  moderate: "border-amber-300 bg-amber-50 text-amber-900",
  lower: "border-emerald-300 bg-emerald-50 text-emerald-800",
  unscored: "border-slate-300 bg-slate-100 text-slate-500",
};

export function PortfolioTable({
  results,
  selectedId,
  onSelect,
  view,
  compareIds,
  onToggleCompare,
}: PortfolioTableProps) {
  const rankingBlocked = hasMixedGridBasis(results, view);
  const ranked = rankingBlocked
    ? [...results]
    : [...results].sort((first, second) => {
        const a = environmentalScore(first, view);
        const b = environmentalScore(second, view);
        if (a === null && b === null) return first.site.name.localeCompare(second.site.name);
        if (a === null) return 1;
        if (b === null) return -1;
        return b - a;
      });
  const displayRanks = new Map<string, number | null>();
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((result, index) => {
    const score = environmentalScore(result, view);
    if (rankingBlocked || score === null) {
      displayRanks.set(result.assessment_id, null);
      return;
    }
    const rank = previousScore === score ? previousRank : index + 1;
    displayRanks.set(result.assessment_id, rank);
    previousScore = score;
    previousRank = rank;
  });

  return (
    <section className="atlas-panel">
      <div className="flex flex-col gap-3 border-b atlas-rule px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="atlas-kicker text-tide">Decision queue / portfolio ledger</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink">Exposure ranking</h2>
          <p className="mt-1 text-sm text-slate-500">Location Exposure Score supports screening; the cooling matrix applies the water gate. Select a row for detail.</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <GitCompareArrows size={15} className="text-tide" /> {compareIds.length}/3 selected
        </span>
      </div>

      {rankingBlocked ? (
        <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-red-800 sm:px-6">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-5"><strong>Ranking blocked:</strong> rows remain in source order because scored results use mixed grid providers, factor bases or units.</p>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              <th className="px-6 py-3">{rankingBlocked ? "Input order / site" : "Rank / site"}</th>
              <th className="px-4 py-3">Exposure {!rankingBlocked ? <ArrowDown size={12} className="inline" /> : null}</th>
              <th className="px-4 py-3">Water view</th>
              <th className="px-4 py-3">Grid carbon</th>
              <th className="px-4 py-3">Decision cell</th>
              <th className="px-4 py-3 text-center">Compare</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((result, index) => {
              const score = environmentalScore(result, view);
              const band = priorityBand(score);
              const water = waterScore(result, view);
              const factor = gridFactor(result);
              const grid = gridSource(result);
              const isSelected = selectedId === result.assessment_id;
              const isCompared = compareIds.includes(result.assessment_id);
              return (
                <tr
                  key={result.assessment_id}
                  className={`cursor-pointer border-b border-ink/10 transition last:border-b-0 ${
                    isSelected ? "bg-[#e7efeb]" : "hover:bg-[#f1efe7]"
                  }`}
                  onClick={() => onSelect(result.assessment_id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="atlas-marker-index flex h-8 w-8 shrink-0 items-center justify-center border border-ink/20 text-xs font-semibold text-slate-500">
                        {displayRanks.get(result.assessment_id) ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate text-sm font-bold text-ink">{result.site.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{countryName(result) ?? "Country unresolved"}{result.site.location_evidence?.facility_status ? ` · ${humanize(result.site.location_evidence.facility_status)}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`atlas-marker-index inline-flex border px-2.5 py-1 text-xs font-semibold ${bandClass[band]}`}>
                      {formatNumber(score, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-ink">{water === null ? "Not available" : formatNumber(water, 2)}</p>
                    <p className="mt-0.5 max-w-[170px] truncate text-xs text-slate-500">{waterLabel(result, view) ?? "No source label"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-ink">{factor === null ? "Not available" : formatNumber(factor, 0)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{grid?.unit ?? "Unit unavailable"} · {grid?.provider ? humanize(grid.provider) : "Provider unavailable"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-[210px] text-sm font-medium text-slate-700">
                      {decision(result).matrix_cell ? humanize(decision(result).matrix_cell as string) : "Decision unavailable"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      aria-label={`${isCompared ? "Remove" : "Add"} ${result.site.name} ${isCompared ? "from" : "to"} comparison`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCompare(result.assessment_id);
                      }}
                      disabled={!isCompared && compareIds.length >= 3}
                      className={`inline-flex h-8 w-8 items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        isCompared
                          ? "border-forest-600 bg-forest-600 text-white"
                          : "border-slate-200 bg-white text-slate-400 hover:border-forest-400 hover:text-forest-600"
                      }`}
                    >
                      {isCompared ? <Check size={15} /> : <GitCompareArrows size={14} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {ranked.map((result, index) => {
          const score = environmentalScore(result, view);
          const band = priorityBand(score);
          const isCompared = compareIds.includes(result.assessment_id);
          return (
            <button
              type="button"
              key={result.assessment_id}
              onClick={() => onSelect(result.assessment_id)}
              className={`w-full border p-4 text-left ${
                selectedId === result.assessment_id ? "border-tide bg-[#e7efeb]" : "border-ink/20 bg-paper"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400">{rankingBlocked ? "Rank blocked" : displayRanks.get(result.assessment_id) ? `#${displayRanks.get(result.assessment_id)}` : "Unranked"}</p>
                  <p className="mt-1 truncate font-bold text-ink">{result.site.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{countryName(result) ?? "Country unresolved"}</p>
                </div>
                <span className={`atlas-marker-index border px-2.5 py-1 text-xs font-semibold ${bandClass[band]}`}>
                  {formatNumber(score, 0)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">{waterLabel(result, view) ?? "Water unavailable"}</p>
                <span
                  role="checkbox"
                  aria-checked={isCompared}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCompare(result.assessment_id);
                  }}
                  className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    isCompared ? "bg-forest-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Compare
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

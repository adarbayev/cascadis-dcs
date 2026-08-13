import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronsUpDown, GitCompareArrows } from "lucide-react";
import type { AssessmentResult, OperationalProfile, RankingMetric, SensitivityView } from "../types";
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
  profiles: Map<string, OperationalProfile>;
  rankingMetric: RankingMetric;
}

type SortKey = "site" | "composite" | "exposure" | "pue" | "wue" | "cue" | "water" | "grid" | "decision";
type SortDirection = "asc" | "desc";
type SortValue = number | string | null;

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const sortLabels: Record<SortKey, string> = {
  site: "Site",
  composite: "Sustainability priority",
  exposure: "Location exposure",
  pue: "PUE",
  wue: "WUE",
  cue: "CUE",
  water: "WRI water score",
  grid: "Grid carbon",
  decision: "Decision cell",
};

const sortUnits: Partial<Record<SortKey, string>> = {
  composite: "/ 100",
  exposure: "/ 100",
  pue: "ratio",
  wue: "L/kWh",
  cue: "kgCO₂e/kWh IT",
};

const basisDependentSorts = new Set<SortKey>(["composite", "exposure", "cue", "grid"]);
const textSorts = new Set<SortKey>(["site", "decision"]);

const bandClass = {
  critical: "border-red-300 bg-red-50 text-red-800",
  high: "border-orange-300 bg-orange-50 text-orange-800",
  moderate: "border-amber-300 bg-amber-50 text-amber-900",
  lower: "border-emerald-300 bg-emerald-50 text-emerald-800",
  unscored: "border-slate-300 bg-slate-100 text-slate-500",
};

function defaultDirection(key: SortKey): SortDirection {
  return textSorts.has(key) ? "asc" : "desc";
}

function metricBasis(profile: OperationalProfile | undefined, metric: "pue" | "wue" | "cue"): string {
  return profile ? humanize(profile[metric].basis) : "Basis unavailable";
}

function sortValue(
  result: AssessmentResult,
  key: SortKey,
  profiles: Map<string, OperationalProfile>,
  view: SensitivityView,
): SortValue {
  const profile = profiles.get(result.assessment_id);
  switch (key) {
    case "site": return result.site.name;
    case "composite": return profile?.composite_score ?? null;
    case "exposure": return environmentalScore(result, view);
    case "pue": return profile?.pue.value ?? null;
    case "wue": return profile?.wue.value ?? null;
    case "cue": return profile?.cue.value ?? null;
    case "water": return waterScore(result, view);
    case "grid": return gridFactor(result);
    case "decision": return decision(result).matrix_cell ? humanize(decision(result).matrix_cell as string) : null;
  }
}

function stableSort(
  results: AssessmentResult[],
  key: SortKey,
  direction: SortDirection,
  profiles: Map<string, OperationalProfile>,
  view: SensitivityView,
): AssessmentResult[] {
  return results
    .map((result, index) => ({ result, index, value: sortValue(result, key, profiles, view) }))
    .sort((first, second) => {
      if (first.value === null && second.value === null) return first.index - second.index;
      if (first.value === null) return 1;
      if (second.value === null) return -1;

      const comparison = typeof first.value === "number" && typeof second.value === "number"
        ? first.value - second.value
        : String(first.value).localeCompare(String(second.value), undefined, { sensitivity: "base" });
      if (comparison === 0) return first.index - second.index;
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ result }) => result);
}

interface SortHeaderProps {
  sortKey: SortKey;
  state: SortState;
  disabled: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
  label?: string;
}

function SortHeader({ sortKey, state, disabled, onSort, className = "", label }: SortHeaderProps) {
  const active = state.key === sortKey && !disabled;
  const ariaSort = active ? (state.direction === "asc" ? "ascending" : "descending") : "none";
  const visibleLabel = label ?? sortLabels[sortKey];
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${sortLabels[sortKey]}${disabled ? " (unavailable while grid bases differ)" : ""}`}
        title={disabled ? "Comparable sorting requires one grid provider, factor basis, and unit." : undefined}
        className="group inline-flex items-center gap-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>
          {visibleLabel}
          {sortUnits[sortKey] ? <span className="ml-1 font-medium normal-case tracking-normal text-slate-400">{sortUnits[sortKey]}</span> : null}
        </span>
        {active
          ? state.direction === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />
          : <ChevronsUpDown size={12} aria-hidden="true" className="opacity-50 group-hover:opacity-100" />}
      </button>
    </th>
  );
}

export function PortfolioTable({
  results,
  selectedId,
  onSelect,
  view,
  compareIds,
  onToggleCompare,
  profiles,
  rankingMetric,
}: PortfolioTableProps) {
  const [sortState, setSortState] = useState<SortState>({ key: rankingMetric, direction: "desc" });
  const rankingBlocked = hasMixedGridBasis(results, view);
  const selectedSortBlocked = rankingBlocked && basisDependentSorts.has(sortState.key);

  useEffect(() => {
    setSortState({ key: rankingMetric, direction: "desc" });
  }, [rankingMetric]);

  const handleSort = (key: SortKey) => {
    if (rankingBlocked && basisDependentSorts.has(key)) return;
    setSortState((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: defaultDirection(key) });
  };

  const displayRanks = useMemo(() => {
    const ranks = new Map<string, number | null>(results.map((result) => [result.assessment_id, null]));
    if (rankingBlocked) return ranks;

    const rankingKey: SortKey = rankingMetric;
    const rankingOrder = stableSort(results, rankingKey, "desc", profiles, view);
    let previousScore: number | null = null;
    let previousRank = 0;
    rankingOrder.forEach((result, index) => {
      const score = sortValue(result, rankingKey, profiles, view);
      if (typeof score !== "number") return;
      const rank = previousScore === score ? previousRank : index + 1;
      ranks.set(result.assessment_id, rank);
      previousScore = score;
      previousRank = rank;
    });
    return ranks;
  }, [profiles, rankingBlocked, rankingMetric, results, view]);

  const sortedRows = useMemo(
    () => selectedSortBlocked ? [...results] : stableSort(results, sortState.key, sortState.direction, profiles, view),
    [profiles, results, selectedSortBlocked, sortState, view],
  );

  return (
    <section className="atlas-panel">
      <div className="flex flex-col gap-3 border-b atlas-rule px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="atlas-kicker text-tide">Decision queue / portfolio ledger</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink">{rankingMetric === "composite" ? "Sustainability priority ranking" : "Location exposure ranking"}</h2>
          <p className="mt-1 text-sm text-slate-500">{rankingMetric === "composite" ? "Scenario facility gaps, WRI water stress, and grid carbon drive this ranking." : "Location Exposure Score combines WRI water and national grid carbon."} Select a row for detail.</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <GitCompareArrows size={15} className="text-tide" /> {compareIds.length}/3 selected
        </span>
      </div>

      {rankingBlocked ? (
        <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-red-800 sm:px-6">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-5"><strong>Ranking blocked:</strong> grid-dependent scores are not comparable across mixed providers, factor bases, or units. Site, PUE, WUE, WRI water, and decision sorting remain available.</p>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1580px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              <SortHeader sortKey="site" state={sortState} disabled={false} onSort={handleSort} label={rankingBlocked ? "Rank unavailable / site" : "Rank / site"} className="px-6 py-3" />
              <SortHeader sortKey="composite" state={sortState} disabled={rankingBlocked} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="exposure" state={sortState} disabled={rankingBlocked} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="pue" state={sortState} disabled={false} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="wue" state={sortState} disabled={false} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="cue" state={sortState} disabled={rankingBlocked} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="water" state={sortState} disabled={false} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="grid" state={sortState} disabled={rankingBlocked} onSort={handleSort} className="px-4 py-3" />
              <SortHeader sortKey="decision" state={sortState} disabled={false} onSort={handleSort} className="px-4 py-3" />
              <th scope="col" className="px-4 py-3 text-center">Compare</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((result) => {
              const exposure = environmentalScore(result, view);
              const profile = profiles.get(result.assessment_id);
              const score = profile?.composite_score ?? null;
              const compositeClass = score === null ? bandClass.unscored : "border-ink/25 bg-paper text-ink";
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
                    <span className={`atlas-marker-index inline-flex border px-2.5 py-1 text-xs font-semibold ${compositeClass}`}>
                      {formatNumber(score, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="atlas-marker-index text-sm font-bold text-ink">{formatNumber(exposure, 0)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Location score</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="atlas-marker-index whitespace-nowrap text-sm font-semibold text-ink">{formatNumber(profile?.pue.value ?? null, 2)}</p>
                    <p className="mt-0.5 max-w-[130px] text-[10px] text-slate-500">{metricBasis(profile, "pue")}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="atlas-marker-index whitespace-nowrap text-sm font-semibold text-ink">{formatNumber(profile?.wue.value ?? null, 2)}</p>
                    <p className="mt-0.5 max-w-[130px] text-[10px] text-slate-500">{metricBasis(profile, "wue")}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="atlas-marker-index whitespace-nowrap text-sm font-semibold text-ink">{formatNumber(profile?.cue.value ?? null, 2)}</p>
                    <p className="mt-0.5 max-w-[130px] text-[10px] text-slate-500">{metricBasis(profile, "cue")}</p>
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

      <div className="p-4 md:hidden">
        <div className="mb-3 grid grid-cols-[1fr_auto] items-end gap-2 border border-ink/15 bg-paper p-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Sort portfolio by
            <select
              aria-label="Sort mobile portfolio by"
              value={sortState.key}
              onChange={(event) => {
                const key = event.target.value as SortKey;
                if (rankingBlocked && basisDependentSorts.has(key)) return;
                setSortState({ key, direction: defaultDirection(key) });
              }}
              className="mt-1.5 w-full border border-ink/25 bg-paper px-3 py-2 text-xs font-semibold normal-case tracking-normal text-ink"
            >
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key} disabled={rankingBlocked && basisDependentSorts.has(key)}>{sortLabels[key]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={selectedSortBlocked}
            onClick={() => setSortState((current) => ({ ...current, direction: current.direction === "asc" ? "desc" : "asc" }))}
            aria-label={`Sort ${sortState.direction === "asc" ? "descending" : "ascending"}`}
            className="flex h-[34px] items-center gap-1 border border-ink/25 px-3 text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sortState.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {sortState.direction === "asc" ? "Asc" : "Desc"}
          </button>
        </div>

        <div className="space-y-3">
          {sortedRows.map((result) => {
            const exposure = environmentalScore(result, view);
            const profile = profiles.get(result.assessment_id);
            const score = profile?.composite_score ?? null;
            const scoreClass = rankingMetric === "composite"
              ? score === null ? bandClass.unscored : "border-ink/25 bg-paper text-ink"
              : bandClass[priorityBand(exposure)];
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
                  <span className={`atlas-marker-index border px-2.5 py-1 text-xs font-semibold ${scoreClass}`}>
                    {formatNumber(rankingMetric === "composite" ? score : exposure, 0)}
                  </span>
                </div>
                <p className="mt-3 atlas-marker-index text-xs text-slate-600">Composite {formatNumber(score, 0)} · Exposure {formatNumber(exposure, 0)} · PUE {formatNumber(profile?.pue.value ?? null, 2)} · WUE {formatNumber(profile?.wue.value ?? null, 2)} · CUE {formatNumber(profile?.cue.value ?? null, 2)}</p>
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
      </div>
    </section>
  );
}

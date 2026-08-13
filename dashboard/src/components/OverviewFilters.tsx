import { Filter, RotateCcw } from "lucide-react";
import type { PortfolioFilters, WaterStressFilter } from "../types";

interface OverviewFiltersProps {
  filters: PortfolioFilters;
  matchedCount: number;
  totalCount: number;
  onChange: (next: PortfolioFilters) => void;
  onReset: () => void;
}

const numericInput = "mt-1.5 w-full border border-ink/25 bg-paper px-2.5 py-2 text-sm font-semibold tabular-nums outline-none focus:border-tide";

const boundedNumber = (value: string, fallback: number, minimum: number, maximum: number): number => {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const boundedNumberOrNull = (value: string, minimum: number, maximum: number): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : null;
};

const waterStressOptions: Array<{ value: WaterStressFilter; label: string }> = [
  { value: "all", label: "All levels" },
  { value: "arid", label: "Arid / critical review" },
  { value: "extremely_high", label: "Extremely high" },
  { value: "high", label: "High" },
  { value: "medium_high", label: "Medium-high" },
  { value: "low_medium", label: "Low-medium" },
  { value: "low", label: "Low" },
  { value: "no_data", label: "No data" },
];

export function OverviewFilters({ filters, matchedCount, totalCount, onChange, onReset }: OverviewFiltersProps) {
  const invalidRange = filters.exposure_min > filters.exposure_max
    || filters.composite_min > filters.composite_max
    || (filters.pue_min !== null && filters.pue_max !== null && filters.pue_min > filters.pue_max)
    || (filters.wue_min !== null && filters.wue_max !== null && filters.wue_min > filters.wue_max)
    || (filters.cue_min !== null && filters.cue_max !== null && filters.cue_min > filters.cue_max);

  return (
    <section className="mt-5 border-y atlas-rule bg-paper/80 px-4 py-5 sm:px-5" aria-label="Portfolio filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="atlas-kicker flex items-center gap-2 text-tide"><Filter size={13} /> Portfolio filters</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">Limit the overview without changing the methodology</h2>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-600">Every bound is inclusive and uses the effective values shown in the table. The map, summary, comparison set, and exports update together.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-semibold text-slate-500"><strong className="text-ink">{matchedCount}</strong> / {totalCount} locations</span>
          <button type="button" onClick={onReset} className="flex items-center gap-2 border border-ink/30 px-3 py-2 text-xs font-semibold hover:border-ink"><RotateCcw size={14} /> Clear filters</button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr_0.8fr]">
        <fieldset>
          <legend className="atlas-kicker text-slate-500">Operating metrics</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
            <label className="text-xs font-semibold text-slate-600">PUE ≥<input aria-label="PUE minimum" type="number" min="1" max="3" step="0.01" value={filters.pue_min ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, pue_min: boundedNumberOrNull(event.target.value, 1, 3) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">PUE ≤<input aria-label="PUE maximum" type="number" min="1" max="3" step="0.01" value={filters.pue_max ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, pue_max: boundedNumberOrNull(event.target.value, 1, 3) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">WUE ≥<input aria-label="WUE minimum" type="number" min="0" max="10" step="0.05" value={filters.wue_min ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, wue_min: boundedNumberOrNull(event.target.value, 0, 10) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">WUE ≤<input aria-label="WUE maximum" type="number" min="0" max="10" step="0.05" value={filters.wue_max ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, wue_max: boundedNumberOrNull(event.target.value, 0, 10) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">CUE ≥<input aria-label="CUE minimum" type="number" min="0" max="5" step="0.01" value={filters.cue_min ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, cue_min: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">CUE ≤<input aria-label="CUE maximum" type="number" min="0" max="5" step="0.01" value={filters.cue_max ?? ""} placeholder="Any" onChange={(event) => onChange({ ...filters, cue_max: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} /></label>
          </div>
        </fieldset>

        <fieldset className="border-y border-ink/15 py-4 xl:border-x xl:border-y-0 xl:px-5 xl:py-0">
          <legend className="atlas-kicker text-slate-500">Priority scores</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <label className="text-xs font-semibold text-slate-600">Composite ≥<input aria-label="Composite minimum" type="number" min="0" max="100" step="1" value={filters.composite_min} onChange={(event) => onChange({ ...filters, composite_min: boundedNumber(event.target.value, filters.composite_min, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Composite ≤<input aria-label="Composite maximum" type="number" min="0" max="100" step="1" value={filters.composite_max} onChange={(event) => onChange({ ...filters, composite_max: boundedNumber(event.target.value, filters.composite_max, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Exposure ≥<input aria-label="Exposure minimum" type="number" min="0" max="100" step="1" value={filters.exposure_min} onChange={(event) => onChange({ ...filters, exposure_min: boundedNumber(event.target.value, filters.exposure_min, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Exposure ≤<input aria-label="Exposure maximum" type="number" min="0" max="100" step="1" value={filters.exposure_max} onChange={(event) => onChange({ ...filters, exposure_max: boundedNumber(event.target.value, filters.exposure_max, 0, 100) })} className={numericInput} /></label>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">Composite is a higher-is-higher-priority pressure score. It is not an efficiency performance rating.</p>
        </fieldset>

        <fieldset>
          <legend className="atlas-kicker text-slate-500">Water evidence</legend>
          <label className="mt-3 block text-xs font-semibold text-slate-600">Baseline water stress<select aria-label="Baseline water stress level" value={filters.water_stress} onChange={(event) => onChange({ ...filters, water_stress: event.target.value as WaterStressFilter })} className={numericInput}>{waterStressOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-slate-600"><input aria-label="Include unscored locations" type="checkbox" checked={filters.include_unscored} onChange={(event) => onChange({ ...filters, include_unscored: event.target.checked })} className="mt-0.5" /><span>Include unscored locations when score bounds are unchanged.</span></label>
        </fieldset>
      </div>

      {invalidRange ? <p role="alert" className="mt-3 text-[11px] font-semibold text-red-700">Each minimum must be at or below its corresponding maximum.</p> : null}
    </section>
  );
}

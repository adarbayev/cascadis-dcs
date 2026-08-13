import { ArrowUpRight, RotateCcw } from "lucide-react";
import { GOOGLE_PUE_SOURCE_URL } from "../lib/googlePue";
import { normalizeScenarioWeights } from "../lib/operationalScore";
import type { OperationalScenario, PortfolioFilters, RankingMetric } from "../types";

interface ScenarioControlsProps {
  scenario: OperationalScenario;
  filters: PortfolioFilters;
  rankingMetric: RankingMetric;
  onScenarioChange: (next: OperationalScenario) => void;
  onFiltersChange: (next: PortfolioFilters) => void;
  onRankingMetricChange: (next: RankingMetric) => void;
  onReset: () => void;
}

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

const numericInput = "mt-1.5 w-full border border-ink/25 bg-paper px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-tide";

export function ScenarioControls({
  scenario,
  filters,
  rankingMetric,
  onScenarioChange,
  onFiltersChange,
  onRankingMetricChange,
  onReset,
}: ScenarioControlsProps) {
  const normalized = normalizeScenarioWeights(scenario.weights);
  const updateWeight = (key: keyof OperationalScenario["weights"], value: number) => {
    onScenarioChange({ ...scenario, weights: { ...scenario.weights, [key]: Math.min(Math.max(value, 0), 1) } });
  };
  const invalidExposureRange = filters.exposure_min > filters.exposure_max;
  const invalidCompositeRange = filters.composite_min > filters.composite_max;
  const invalidPueRange = filters.pue_min !== null && filters.pue_max !== null && filters.pue_min > filters.pue_max;
  const invalidWueRange = filters.wue_min !== null && filters.wue_max !== null && filters.wue_min > filters.wue_max;
  const invalidCueRange = filters.cue_min !== null && filters.cue_max !== null && filters.cue_min > filters.cue_max;
  const invalidRange = invalidExposureRange || invalidCompositeRange || invalidPueRange || invalidWueRange || invalidCueRange;

  return (
    <section className="mt-5 border-y atlas-rule bg-paper/80 px-4 py-5 sm:px-5" aria-label="Operational scenario and portfolio filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="atlas-kicker text-tide">Scenario score / portfolio filters</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">Set operating assumptions and score bounds</h2>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-600">
            Directly matched Google PUE is used first. Missing PUE and WUE use the editable fallback values below. CUE is derived from PUE × national grid factor unless a fixed scenario value is entered.
          </p>
        </div>
        <button type="button" onClick={onReset} className="flex shrink-0 items-center gap-2 border border-ink/30 px-3 py-2 text-xs font-semibold hover:border-ink">
          <RotateCcw size={14} /> Reset scenario
        </button>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.25fr_1fr]">
        <fieldset>
          <legend className="atlas-kicker text-slate-500">Fallback metrics</legend>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              PUE
              <input aria-label="Fallback PUE" type="number" min="1" max="3" step="0.01" value={scenario.fallback_pue} onChange={(event) => onScenarioChange({ ...scenario, fallback_pue: boundedNumber(event.target.value, scenario.fallback_pue, 1, 3) })} className={numericInput} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              WUE · L/kWh
              <input aria-label="Fallback WUE" type="number" min="0" max="10" step="0.05" value={scenario.fallback_wue_l_per_kwh} onChange={(event) => onScenarioChange({ ...scenario, fallback_wue_l_per_kwh: boundedNumber(event.target.value, scenario.fallback_wue_l_per_kwh, 0, 10) })} className={numericInput} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Fixed CUE · optional
              <input aria-label="Fixed CUE" type="number" min="0" max="5" step="0.01" value={scenario.fixed_cue_kgco2e_per_kwh_it ?? ""} placeholder="Derived" onChange={(event) => onScenarioChange({ ...scenario, fixed_cue_kgco2e_per_kwh_it: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-slate-600">
            <input aria-label="Use reported Google PUE" type="checkbox" checked={scenario.use_reported_google_pue} onChange={(event) => onScenarioChange({ ...scenario, use_reported_google_pue: event.target.checked })} className="mt-0.5" />
            <span>Use directly matched Google PUE where available; clear to apply the scenario PUE to every location.</span>
          </label>
          <a href={GOOGLE_PUE_SOURCE_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-tide underline underline-offset-4">
            Google PUE disclosure <ArrowUpRight size={12} />
          </a>
        </fieldset>

        <fieldset className="border-y border-ink/15 py-4 xl:border-x xl:border-y-0 xl:px-6 xl:py-0">
          <legend className="atlas-kicker text-slate-500">Composite weights</legend>
          <div className="mt-3 space-y-3">
            {([
              ["facility", "Facility PUE/WUE gap"],
              ["water", "WRI water stress"],
              ["carbon", "Grid carbon"],
            ] as const).map(([key, label]) => (
              <label key={key} className="grid grid-cols-[120px_1fr_42px] items-center gap-3 text-xs text-slate-600">
                <span className="font-semibold">{label}</span>
                <input aria-label={`${label} weight`} type="range" min="0" max="1" step="0.05" value={scenario.weights[key]} onChange={(event) => updateWeight(key, Number(event.target.value))} />
                <span className="atlas-marker-index text-right font-semibold text-ink">{Math.round(normalized[key] * 100)}%</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">Facility gap gives equal internal weight to PUE above 1.40 and WUE above 1.50. CUE remains visible and filterable; grid carbon is used directly to avoid double counting.</p>
        </fieldset>

        <fieldset>
          <legend className="atlas-kicker text-slate-500">Ranking and bounds</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs font-semibold text-slate-600">
              Rank portfolio by
              <select aria-label="Rank portfolio by" value={rankingMetric} onChange={(event) => onRankingMetricChange(event.target.value as RankingMetric)} className={numericInput}>
                <option value="composite">Sustainability composite</option>
                <option value="exposure">Location exposure</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Exposure min<input aria-label="Exposure minimum" type="number" min="0" max="100" step="1" value={filters.exposure_min} onChange={(event) => onFiltersChange({ ...filters, exposure_min: boundedNumber(event.target.value, filters.exposure_min, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Exposure max<input aria-label="Exposure maximum" type="number" min="0" max="100" step="1" value={filters.exposure_max} onChange={(event) => onFiltersChange({ ...filters, exposure_max: boundedNumber(event.target.value, filters.exposure_max, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Composite min<input aria-label="Composite minimum" type="number" min="0" max="100" step="1" value={filters.composite_min} onChange={(event) => onFiltersChange({ ...filters, composite_min: boundedNumber(event.target.value, filters.composite_min, 0, 100) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">Composite max<input aria-label="Composite maximum" type="number" min="0" max="100" step="1" value={filters.composite_max} onChange={(event) => onFiltersChange({ ...filters, composite_max: boundedNumber(event.target.value, filters.composite_max, 0, 100) })} className={numericInput} /></label>
            <p className="col-span-2 mt-1 text-[11px] leading-4 text-slate-500">Metric bounds use the effective scenario values shown in the portfolio. Minimum means at least (≥); maximum means at most (≤). Leave a bound blank for any value.</p>
            <label className="text-xs font-semibold text-slate-600">PUE min · ≥<input aria-label="PUE minimum" type="number" min="1" max="3" step="0.01" value={filters.pue_min ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, pue_min: boundedNumberOrNull(event.target.value, 1, 3) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">PUE max · ≤<input aria-label="PUE maximum" type="number" min="1" max="3" step="0.01" value={filters.pue_max ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, pue_max: boundedNumberOrNull(event.target.value, 1, 3) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">WUE min · ≥<input aria-label="WUE minimum" type="number" min="0" max="10" step="0.05" value={filters.wue_min ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, wue_min: boundedNumberOrNull(event.target.value, 0, 10) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">WUE max · ≤<input aria-label="WUE maximum" type="number" min="0" max="10" step="0.05" value={filters.wue_max ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, wue_max: boundedNumberOrNull(event.target.value, 0, 10) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">CUE min · ≥<input aria-label="CUE minimum" type="number" min="0" max="5" step="0.01" value={filters.cue_min ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, cue_min: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} /></label>
            <label className="text-xs font-semibold text-slate-600">CUE max · ≤<input aria-label="CUE maximum" type="number" min="0" max="5" step="0.01" value={filters.cue_max ?? ""} placeholder="Any" onChange={(event) => onFiltersChange({ ...filters, cue_max: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} /></label>
            <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input aria-label="Include unscored locations" type="checkbox" checked={filters.include_unscored} onChange={(event) => onFiltersChange({ ...filters, include_unscored: event.target.checked })} />
              Include unscored locations when score bounds are unchanged
            </label>
          </div>
          {invalidRange ? <p role="alert" className="mt-2 text-[11px] font-semibold text-red-700">Each minimum must be at or below its corresponding maximum.</p> : null}
        </fieldset>
      </div>
    </section>
  );
}

import { ArrowUpRight, RotateCcw } from "lucide-react";
import { GOOGLE_PUE_SOURCE_URL } from "../lib/googlePue";
import { normalizeScenarioWeights } from "../lib/operationalScore";
import type { OperationalScenario, RankingMetric, SensitivityView } from "../types";

interface ScoringMethodologyProps {
  scenario: OperationalScenario;
  rankingMetric: RankingMetric;
  waterView: SensitivityView;
  assessmentWeights: { water: number; carbon: number };
  showAssessmentWeights: boolean;
  onScenarioChange: (next: OperationalScenario) => void;
  onRankingMetricChange: (next: RankingMetric) => void;
  onWaterViewChange: (next: SensitivityView) => void;
  onAssessmentWeightsChange: (next: { water: number; carbon: number }) => void;
  onReset: () => void;
}

const numericInput = "mt-1.5 w-full border border-ink/25 bg-paper px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-tide";

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

const viewOptions: Array<{ value: SensitivityView; label: string }> = [
  { value: "bws", label: "Baseline Water Stress" },
  { value: "default", label: "Default Overall Water Risk" },
  { value: "elp", label: "Electric Power proxy" },
  { value: "smc", label: "Semiconductor proxy" },
];

export function ScoringMethodology({
  scenario,
  rankingMetric,
  waterView,
  assessmentWeights,
  showAssessmentWeights,
  onScenarioChange,
  onRankingMetricChange,
  onWaterViewChange,
  onAssessmentWeightsChange,
  onReset,
}: ScoringMethodologyProps) {
  const normalized = normalizeScenarioWeights(scenario.weights);
  const invalidPueAnchors = scenario.anchors.pue_target >= scenario.anchors.pue_upper;
  const invalidWueAnchors = scenario.anchors.wue_target_l_per_kwh >= scenario.anchors.wue_l_per_kwh;
  const updateWeight = (key: keyof OperationalScenario["weights"], value: number) => {
    onScenarioChange({ ...scenario, weights: { ...scenario.weights, [key]: Math.min(Math.max(value, 0), 1) } });
  };

  return (
    <section className="mt-6" aria-label="Scoring methodology controls">
      <div className="border-y atlas-rule bg-paper/80 px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="atlas-kicker text-tide">Scoring methodology</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">Configure calculation assumptions and weights</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">Changes in this workspace recalculate the composite priority score. Overview filters select sites from the resulting portfolio and do not modify the calculation.</p>
          </div>
          <button type="button" onClick={onReset} className="flex shrink-0 items-center gap-2 border border-ink/30 px-3 py-2 text-xs font-semibold hover:border-ink"><RotateCcw size={14} /> Reset methodology</button>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-2">
          <fieldset className="border-b border-ink/15 pb-6 xl:border-r xl:pr-7">
            <legend className="atlas-kicker text-slate-500">Metric assumptions</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">Fallback PUE<input aria-label="Fallback PUE" type="number" min="1" max="3" step="0.01" value={scenario.fallback_pue} onChange={(event) => onScenarioChange({ ...scenario, fallback_pue: boundedNumber(event.target.value, scenario.fallback_pue, 1, 3) })} className={numericInput} /></label>
              <label className="text-xs font-semibold text-slate-600">Fallback WUE · L/kWh<input aria-label="Fallback WUE" type="number" min="0" max="10" step="0.05" value={scenario.fallback_wue_l_per_kwh} onChange={(event) => onScenarioChange({ ...scenario, fallback_wue_l_per_kwh: boundedNumber(event.target.value, scenario.fallback_wue_l_per_kwh, 0, 10) })} className={numericInput} /></label>
              <label className="text-xs font-semibold text-slate-600">Fixed CUE · optional<input aria-label="Fixed CUE" type="number" min="0" max="5" step="0.01" value={scenario.fixed_cue_kgco2e_per_kwh_it ?? ""} placeholder="Derived" onChange={(event) => onScenarioChange({ ...scenario, fixed_cue_kgco2e_per_kwh_it: boundedNumberOrNull(event.target.value, 0, 5) })} className={numericInput} /></label>
            </div>
            <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><input aria-label="Use reported Google PUE" type="checkbox" checked={scenario.use_reported_google_pue} onChange={(event) => onScenarioChange({ ...scenario, use_reported_google_pue: event.target.checked })} className="mt-1" /><span>Use directly matched Google PUE where available. Clear the option to apply the fallback PUE across the portfolio.</span></label>
            <a href={GOOGLE_PUE_SOURCE_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-tide underline underline-offset-4">Google PUE disclosure <ArrowUpRight size={12} /></a>
          </fieldset>

          <fieldset className="border-b border-ink/15 pb-6">
            <legend className="atlas-kicker text-slate-500">Evidence view and factor weights</legend>
            <label className="mt-4 block max-w-sm text-xs font-semibold text-slate-600">WRI water view<select aria-label="WRI water view" value={waterView} onChange={(event) => onWaterViewChange(event.target.value as SensitivityView)} className={numericInput}>{viewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <div className="mt-5 space-y-4">
              {([
                ["facility", "Facility PUE/WUE gap"],
                ["water", `Selected WRI view · ${viewOptions.find((option) => option.value === waterView)?.label ?? "Water evidence"}`],
                ["carbon", "Grid carbon"],
              ] as const).map(([key, label]) => (
                <label key={key} className="grid grid-cols-[150px_1fr_48px] items-center gap-3 text-xs text-slate-600"><span className="font-semibold">{label}</span><input aria-label={`${label} weight`} type="range" min="0" max="1" step="0.05" value={scenario.weights[key]} onChange={(event) => updateWeight(key, Number(event.target.value))} /><span className="atlas-marker-index text-right font-semibold text-ink">{Math.round(normalized[key] * 100)}%</span></label>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Weights are normalized to 100%. CUE remains a displayed consequence of PUE × grid factor and receives no direct weight.</p>
          </fieldset>

          <fieldset className="xl:border-r xl:pr-7">
            <legend className="atlas-kicker text-slate-500">Normalization anchors</legend>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className="text-xs font-semibold text-slate-600">PUE target<input aria-label="PUE target" type="number" min="1" max="3" step="0.01" value={scenario.anchors.pue_target} onChange={(event) => onScenarioChange({ ...scenario, anchors: { ...scenario.anchors, pue_target: boundedNumber(event.target.value, scenario.anchors.pue_target, 1, 3) } })} className={numericInput} /></label>
              <label className="text-xs font-semibold text-slate-600">PUE upper<input aria-label="PUE upper anchor" type="number" min="1" max="3" step="0.01" value={scenario.anchors.pue_upper} onChange={(event) => onScenarioChange({ ...scenario, anchors: { ...scenario.anchors, pue_upper: boundedNumber(event.target.value, scenario.anchors.pue_upper, 1, 3) } })} className={numericInput} /></label>
              <label className="text-xs font-semibold text-slate-600">WUE target<input aria-label="WUE target" type="number" min="0" max="10" step="0.05" value={scenario.anchors.wue_target_l_per_kwh} onChange={(event) => onScenarioChange({ ...scenario, anchors: { ...scenario.anchors, wue_target_l_per_kwh: boundedNumber(event.target.value, scenario.anchors.wue_target_l_per_kwh, 0, 10) } })} className={numericInput} /></label>
              <label className="text-xs font-semibold text-slate-600">WUE upper<input aria-label="WUE upper anchor" type="number" min="0" max="10" step="0.05" value={scenario.anchors.wue_l_per_kwh} onChange={(event) => onScenarioChange({ ...scenario, anchors: { ...scenario.anchors, wue_l_per_kwh: boundedNumber(event.target.value, scenario.anchors.wue_l_per_kwh, 0, 10) } })} className={numericInput} /></label>
              <label className="col-span-2 text-xs font-semibold text-slate-600 sm:col-span-1">Grid anchor<input aria-label="Grid carbon anchor" type="number" min="1" max="2000" step="10" value={scenario.anchors.grid_gco2e_per_kwh} onChange={(event) => onScenarioChange({ ...scenario, anchors: { ...scenario.anchors, grid_gco2e_per_kwh: boundedNumber(event.target.value, scenario.anchors.grid_gco2e_per_kwh, 1, 2000) } })} className={numericInput} /></label>
            </div>
            {invalidPueAnchors || invalidWueAnchors ? <p role="alert" className="mt-3 text-xs font-semibold text-red-700">Each upper anchor must be greater than its target.</p> : null}
            <div className="mt-5 border-t border-ink/15 pt-4 text-xs leading-6 text-slate-600">
              <p><strong>Facility gap</strong> = 50% normalized PUE gap + 50% normalized WUE gap.</p>
              <p><strong>Composite priority</strong> = weighted facility gap + selected WRI view + grid carbon, scaled to 100.</p>
            </div>
          </fieldset>

          <fieldset>
            <legend className="atlas-kicker text-slate-500">Portfolio output behavior</legend>
            <label className="mt-4 block max-w-sm text-xs font-semibold text-slate-600">Default portfolio ranking<select aria-label="Rank portfolio by" value={rankingMetric} onChange={(event) => onRankingMetricChange(event.target.value as RankingMetric)} className={numericInput}><option value="composite">Composite priority</option><option value="exposure">Location exposure</option></select></label>
            <p className="mt-3 text-xs leading-5 text-slate-500">The table opens with this ranking. Every visible table column can then be sorted directly from Overview.</p>
            {showAssessmentWeights ? (
              <div className="mt-6 border-t border-ink/15 pt-5">
                <p className="atlas-kicker text-slate-500">New live assessment weights</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">These weights apply only when the local API creates a new assessment; existing snapshot scores remain unchanged.</p>
                <div className="mt-4 space-y-4">
                  <label className="grid grid-cols-[80px_1fr_48px] items-center gap-3 text-xs"><span className="font-semibold">Water</span><input aria-label="Water weight" type="range" min="0" max="1" step="0.05" value={assessmentWeights.water} onChange={(event) => { const water = Number(event.target.value); onAssessmentWeightsChange({ water, carbon: Number((1 - water).toFixed(2)) }); }} /><span className="atlas-marker-index text-right">{Math.round(assessmentWeights.water * 100)}%</span></label>
                  <label className="grid grid-cols-[80px_1fr_48px] items-center gap-3 text-xs"><span className="font-semibold">Carbon</span><input aria-label="Carbon weight" type="range" min="0" max="1" step="0.05" value={assessmentWeights.carbon} onChange={(event) => { const carbon = Number(event.target.value); onAssessmentWeightsChange({ carbon, water: Number((1 - carbon).toFixed(2)) }); }} /><span className="atlas-marker-index text-right">{Math.round(assessmentWeights.carbon * 100)}%</span></label>
                </div>
              </div>
            ) : null}
          </fieldset>
        </div>
      </div>
    </section>
  );
}

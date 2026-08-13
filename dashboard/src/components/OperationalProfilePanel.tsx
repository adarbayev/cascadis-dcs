import { formatNumber } from "../lib/assessment";
import type { OperationalMetricValue, OperationalProfile } from "../types";

interface OperationalProfilePanelProps {
  profile: OperationalProfile;
}

const basisLabel: Record<OperationalMetricValue["basis"], string> = {
  site_input: "Site input",
  operator_reported: "Reported",
  fleet_proxy: "Fleet proxy",
  scenario_assumption: "Assumed",
  derived: "Derived",
};

function MetricCard({ label, unit, metric }: { label: string; unit: string; metric: OperationalMetricValue }) {
  return (
    <div className="border-t border-ink/20 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="atlas-kicker text-slate-500">{label}</p>
        <span className="border border-ink/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{basisLabel[metric.basis]}</span>
      </div>
      <p className="mt-2 atlas-marker-index text-2xl font-semibold text-ink">{formatNumber(metric.value, 2)} <span className="text-xs font-medium text-slate-500">{unit}</span></p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{metric.detail}</p>
    </div>
  );
}

const componentLabel = (value: number | null): string =>
  value === null ? "Not available" : `${formatNumber(value * 100, 0)} component`;

export function OperationalProfilePanel({ profile }: OperationalProfilePanelProps) {
  return (
    <section className="atlas-panel p-5 sm:p-6" aria-label="Operational sustainability scenario">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-start">
        <div>
          <p className="atlas-kicker text-tide">Scenario composite</p>
          <p className="mt-2 atlas-marker-index text-5xl font-semibold tracking-[-0.04em] text-ink">{formatNumber(profile.composite_score, 0)}</p>
          <p className="mt-1 text-xs text-slate-500">Sustainability pressure / 100</p>
          <div className="mt-4 space-y-1 text-[11px] text-slate-500">
            <p>Facility efficiency · {componentLabel(profile.components.facility)}</p>
            <p>Water stress · {componentLabel(profile.components.water)}</p>
            <p>Grid carbon · {componentLabel(profile.components.carbon)}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="PUE" unit="ratio" metric={profile.pue} />
          <MetricCard label="WUE" unit="L/kWh" metric={profile.wue} />
          <MetricCard label="CUE" unit="kgCO₂e/kWh IT" metric={profile.cue} />
        </div>
      </div>
      <p className="mt-5 border-t border-ink/15 pt-3 text-[11px] leading-5 text-slate-500">The scenario score combines a facility-efficiency gap (equal PUE/WUE subweights), WRI water stress, and grid carbon. A facility component of zero means both operating metrics are below the internal intervention thresholds. CUE is shown as the PUE × grid-factor consequence and is not added again.</p>
    </section>
  );
}

import { BookOpen, Database, ExternalLink, X } from "lucide-react";
import type { PolicyDocument, SourceStatus } from "../types";
import { formatDate, humanize } from "../lib/assessment";

interface InfoDrawerProps {
  mode: "methodology" | "sources" | null;
  onClose: () => void;
  policy: PolicyDocument | null;
  sourceStatus: SourceStatus[];
}

export function InfoDrawer({ mode, onClose, policy, sourceStatus }: InfoDrawerProps) {
  if (!mode) return null;
  const waterWeight = policy?.default_weights?.water;
  const carbonWeight = policy?.default_weights?.carbon;
  const anchor = policy?.anchors?.carbon_gco2e_per_kwh ?? policy?.carbon_anchor_gco2e_per_kwh;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-ink/45" role="dialog" aria-modal="true" aria-label={mode === "methodology" ? "Methodology" : "Data sources"} onMouseDown={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-ink bg-paper p-6 shadow-lift sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="atlas-kicker text-tide">Reference record</p>
            <h2 className="mt-2 font-display text-3xl text-ink">{mode === "methodology" ? "Methodology" : "Data sources"}</h2>
          </div>
          <button type="button" onClick={onClose} className="border border-ink/25 p-2 text-slate-500 hover:border-ink hover:text-ink" aria-label="Close panel"><X size={18} /></button>
        </div>

        {mode === "methodology" ? (
          <div className="mt-8 space-y-6">
            <section>
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><BookOpen size={17} className="text-forest-600" /> Location Exposure Score</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">The backend normalises the selected WRI water score and the grid factor, then applies the policy weights. Missing source values remain unscored. The interface reads policy-generated scores and does not silently replace them.</p>
              <div className="mt-3 border-t-4 border-signal bg-ink p-4 font-mono text-xs leading-6 text-white/80">
                water_normalised = selected WRI score / 5<br />
                carbon_normalised = min(grid factor / {anchor ?? "policy anchor"}, 1)<br />
                priority = 100 × ({waterWeight ?? "water weight"} × water + {carbonWeight ?? "carbon weight"} × carbon)
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">The carbon anchor is an internal, configurable policy value. It is not presented as an external standard.</p>
            </section>
            <section>
              <h3 className="text-sm font-bold text-ink">Water sensitivity</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Baseline Water Stress is the primary cooling view. Default Overall Water Risk, Electric Power and Semiconductor are displayed separately. WRI does not publish an official data-center sector preset; Electric Power and Semiconductor are proxy sensitivity views.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Arid and Low Water Use</strong> receives a critical-review flag. <strong>No Data</strong> blocks composite scoring.</p>
            </section>
            <section>
              <h3 className="text-sm font-bold text-ink">Business adaptation</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Cost, uptime and growth constraints change delivery sequence while preserving the Location Exposure Score. No-outage sites start with controls and pilots on redundant capacity. Constrained-cost sites stage capital works. High-growth sites apply the preferred architecture to planned capacity.</p>
            </section>
            <section className="border border-sky-200 bg-sky-50 p-4">
              <h3 className="text-sm font-bold text-sky-950">Google-aligned water gate</h3>
              <p className="mt-2 text-sm leading-6 text-sky-800">Google publishes a two-tier Water Risk Framework rather than one water-carbon composite. Its first tier applies a non-compensatory Responsible Use gate to the actual freshwater source. Its second tier reviews mitigable quantity, discharge, WASH, sentiment and regulatory risks. Aqueduct is described as regional screening evidence; exact KPI thresholds are not fully public.</p>
              <a className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-800 underline decoration-sky-300 underline-offset-4" href="https://www.gstatic.com/gumdrop/sustainability/2023-data-center-water-risk-framework-whitepaper.pdf" target="_blank" rel="noreferrer">Google Water Risk Framework <ExternalLink size={12} /></a>
            </section>
            <section className="border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-bold text-amber-900">Decision boundary</h3>
              <p className="mt-2 text-sm leading-6 text-amber-800">This tool supports location screening. Cooling design still requires engineering validation of climate, power, hydraulics, redundancy, water availability and lifecycle cost.</p>
            </section>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section>
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><Database size={17} className="text-forest-600" /> Provider configuration</div>
              <div className="mt-3 space-y-2">
                {sourceStatus.length ? sourceStatus.map((source, index) => (
                  <div key={source.id ?? source.provider ?? index} className="border border-ink/15 bg-paper p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-ink">{source.label ?? source.provider ?? source.id ?? "Source"}</p>
                      <span className="border border-ink/15 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{humanize(source.status ?? "unknown")}</span>
                    </div>
                    {source.detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p> : null}
                    <p className="mt-2 text-[11px] text-slate-400">Checked {formatDate(source.checked_at)}</p>
                  </div>
                )) : <p className="bg-slate-100 p-4 text-sm text-slate-500">Source readiness has not been returned by the backend.</p>}
              </div>
            </section>
            <section className="space-y-3">
              <a className="block border border-ink/15 bg-paper p-4 transition hover:border-tide" href="https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/aqueduct_water_risk/FeatureServer/1" target="_blank" rel="noreferrer">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-ink">WRI Aqueduct 4.0 via Esri</p><ExternalLink size={15} className="text-slate-400" /></div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Baseline Annual Layer 1. Point-level water indicators and sector sensitivity scores.</p>
              </a>
              <a className="block border border-ink/15 bg-paper p-4 transition hover:border-tide" href="https://api.ember-energy.org/v1/docs" target="_blank" rel="noreferrer">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-ink">Ember Yearly Carbon Intensity API</p><ExternalLink size={15} className="text-slate-400" /></div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Public proxy: national lifecycle generation intensity by country and year. This is not an IEA factor or a formal Scope 2 reporting factor.</p>
              </a>
              <div className="border border-ink/15 bg-slate-50 p-4">
                <p className="text-sm font-bold text-ink">IEA annual file adapter</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Disabled until appropriately licensed data are configured. Licensed IEA files are not bundled with this application.</p>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

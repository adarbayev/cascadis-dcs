import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Factory,
  Gauge,
  MapPin,
  ShieldCheck,
  Snowflake,
  Zap,
} from "lucide-react";
import type { MetricValue, PartyControl, SiteEemsProfile } from "../types";

type WorkspaceSection = "overview" | "compliance" | "environment" | "energy" | "actions";

interface SiteWorkspaceProps {
  profile: SiteEemsProfile | null;
  onClose?: () => void;
  initialSection?: WorkspaceSection;
}

const sections: Array<{ id: WorkspaceSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "compliance", label: "Compliance & permits" },
  { id: "environment", label: "Aspects & controls" },
  { id: "energy", label: "Energy & utilities" },
  { id: "actions", label: "Actions & assurance" },
];

const statusTone: Record<string, string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  closed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  complete: "border-emerald-300 bg-emerald-50 text-emerald-800",
  on_track: "border-emerald-300 bg-emerald-50 text-emerald-800",
  low: "border-emerald-300 bg-emerald-50 text-emerald-800",
  operating: "border-emerald-300 bg-emerald-50 text-emerald-800",
  due_soon: "border-amber-300 bg-amber-50 text-amber-900",
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  verification_due: "border-amber-300 bg-amber-50 text-amber-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  assigned: "border-sky-300 bg-sky-50 text-sky-900",
  in_progress: "border-sky-300 bg-sky-50 text-sky-900",
  scheduled: "border-sky-300 bg-sky-50 text-sky-900",
  submitted: "border-violet-300 bg-violet-50 text-violet-900",
  under_review: "border-violet-300 bg-violet-50 text-violet-900",
  review_required: "border-orange-300 bg-orange-50 text-orange-900",
  handover_due: "border-orange-300 bg-orange-50 text-orange-900",
  follow_up_due: "border-orange-300 bg-orange-50 text-orange-900",
  high: "border-orange-300 bg-orange-50 text-orange-900",
  expired: "border-red-300 bg-red-50 text-red-800",
  overdue: "border-red-300 bg-red-50 text-red-800",
  blocked: "border-red-300 bg-red-50 text-red-800",
  critical: "border-red-300 bg-red-50 text-red-800",
  draft: "border-slate-300 bg-slate-100 text-slate-600",
  not_assessed: "border-slate-300 bg-slate-100 text-slate-600",
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatusTag({ value }: { value: string }) {
  return (
    <span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusTone[value] ?? "border-ink/20 bg-paper text-slate-600"}`}>
      {label(value)}
    </span>
  );
}

function formatDate(value?: string): string {
  if (!value) return "Not scheduled";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function formatMetric(metric: MetricValue, digits = 1): string {
  if (metric.value === null) return "Not recorded";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(metric.value)} ${metric.unit}`.trim();
}

const metricKindLabel: Record<MetricValue["kind"], string> = {
  actual: "Current period",
  target: "Target",
  not_available: "Not recorded",
  not_applicable: "Not applicable",
};

function GapState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border border-dashed border-ink/30 bg-paper px-5 py-8">
      <ClipboardCheck size={20} className="text-tide" strokeWidth={1.8} aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function MetricCard({ title, metric, icon: Icon, digits = 1 }: { title: string; metric: MetricValue; icon: typeof Gauge; digits?: number }) {
  return (
    <div className="border-t atlas-rule pt-4">
      <div className="flex items-start justify-between gap-3">
        <p className="atlas-kicker text-slate-500">{title}</p>
        <Icon size={16} className="text-tide" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="atlas-marker-index mt-3 text-xl font-semibold text-ink">{formatMetric(metric, digits)}</p>
      <p className="mt-1 text-[11px] text-slate-500">{metric.period} · {metricKindLabel[metric.kind]}</p>
    </div>
  );
}

const responsibilityLabels: Array<[keyof SiteEemsProfile["responsibilities"], string]> = [
  ["assetOwner", "Asset owner"],
  ["facilitiesOperator", "Facilities operator"],
  ["itOperator", "IT operator"],
  ["coolingOperator", "Cooling operator"],
  ["utilityAccountHolder", "Utility account holder"],
  ["permitHolder", "Permit holder"],
  ["dataProvider", "Data provider"],
  ["actionApprover", "Action approver"],
];

function PartyTag({ value }: { value: PartyControl }) {
  return <span className="border border-ink/20 bg-paper px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600">{label(value)}</span>;
}

export function SiteWorkspace({ profile, onClose, initialSection = "overview" }: SiteWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection, profile?.id]);

  if (!profile) {
    return (
      <section className="atlas-panel min-h-[540px] p-6" aria-label="Site workspace">
        <p className="atlas-kicker text-tide">Site workspace</p>
        <h2 className="mt-3 font-display text-3xl leading-none text-ink">Select a site to open its management record.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Lifecycle, permits, environmental aspects, utility performance and assigned work will appear here.</p>
      </section>
    );
  }

  const genericGap = profile.archetype === null || ["not_onboarded", "gap_assessment"].includes(profile.status.eemsStage);

  return (
    <section className="atlas-panel" aria-labelledby="site-workspace-heading">
      <header className="border-b atlas-rule">
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {onClose ? (
                <button type="button" onClick={onClose} className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-tide hover:text-ink">
                  <ArrowLeft size={14} aria-hidden="true" /> Portfolio
                </button>
              ) : null}
              <StatusTag value={profile.lifecycle.primaryPhase} />
              <StatusTag value={profile.status.eemsStage} />
              <StatusTag value={profile.status.compliance} />
            </div>
            <h2 id="site-workspace-heading" className="mt-3 font-display text-4xl leading-none text-ink">{profile.name}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <MapPin size={13} className="text-tide" aria-hidden="true" />
              {profile.location.countryName}
              <span aria-hidden="true">·</span>
              {profile.operatingModel.label}
              <span aria-hidden="true">·</span>
              {profile.archetypeLabel}
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">{profile.recordReview.label}</p>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 border border-ink/20 bg-paper">
            <div className="border-r border-ink/15 px-4 py-3">
              <p className="atlas-kicker text-slate-500">Phase gate</p>
              <p className="mt-1 text-xs font-semibold text-ink">{profile.lifecycle.phaseGate}</p>
              <p className="mt-1 text-[10px] text-slate-500">{formatDate(profile.lifecycle.targetGateDate)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="atlas-kicker text-slate-500">Checklist completion</p>
              <p className="atlas-marker-index mt-1 text-lg font-semibold text-ink">{profile.status.checklistCompletionPct}%</p>
              <div className="mt-2 h-1 bg-[#d8d8cf]" aria-hidden="true">
                <span className="block h-full bg-tide" style={{ width: `${profile.status.checklistCompletionPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <nav className="overflow-x-auto px-5 sm:px-6" aria-label="Site workspace sections" role="tablist">
          <div className="flex min-w-max gap-6">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                id={`${section.id}-site-tab`}
                aria-controls={`${section.id}-site-panel`}
                aria-selected={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
                className="atlas-tab text-xs font-semibold"
                data-active={activeSection === section.id}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {genericGap ? (
        <div className="border-b border-violet-200 bg-violet-50 px-5 py-3 sm:px-6">
          <div className="flex items-start gap-3">
            <ClipboardCheck size={17} className="mt-0.5 shrink-0 text-violet-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-violet-950">Gap assessment open</p>
              <p className="mt-0.5 text-xs leading-5 text-violet-900/75">Confirm the operating model, assign accountable roles and complete the first control review before moving this site to implementation.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-5 sm:p-6">
        {activeSection === "overview" ? (
          <div id="overview-site-panel" role="tabpanel" aria-labelledby="overview-site-tab" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div>
                <div className="flex items-end justify-between gap-4 border-b atlas-rule pb-3">
                  <div>
                    <p className="atlas-kicker text-tide">Operating model</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{profile.operatingModel.label}</h3>
                  </div>
                  <StatusTag value={profile.status.actionHealth} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{profile.operatingModel.summary}</p>

                <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {responsibilityLabels.map(([key, title]) => (
                    <div key={key} className="flex items-center justify-between gap-3 border-t atlas-rule pt-3">
                      <p className="text-xs text-slate-600">{title}</p>
                      <PartyTag value={profile.responsibilities[key]} />
                    </div>
                  ))}
                </div>
              </div>

              <aside className="border border-ink/20 bg-[#f1efe7] p-5">
                <p className="atlas-kicker text-rust">Open attention</p>
                <p className="atlas-marker-index mt-3 text-4xl font-semibold text-ink">{profile.status.openHighPriorityActions}</p>
                <p className="mt-1 text-xs text-slate-500">High-priority actions</p>
                <div className="mt-5 space-y-2 border-t atlas-rule pt-4">
                  {profile.status.flags.length ? profile.status.flags.map((flag) => (
                    <div key={flag} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rust" aria-hidden="true" />
                      <span>{flag}</span>
                    </div>
                  )) : (
                    <div className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span>No portfolio flags are open for this site.</span>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <div>
              <div className="border-b atlas-rule pb-3">
                <p className="atlas-kicker text-tide">Cooling asset register</p>
                <p className="mt-1 text-xs text-slate-500">Installed, commissioned and planned heat-rejection systems.</p>
              </div>
              {profile.coolingAssets.length ? (
                <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
                  {profile.coolingAssets.map((asset) => (
                    <div key={asset.id} className="border border-ink/20 bg-paper p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Snowflake size={18} className="text-tide" aria-hidden="true" />
                        <StatusTag value={asset.operationalStatus} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink">{asset.name}</p>
                      <p className="mt-1 text-xs text-slate-600">{asset.technology}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <StatusTag value={asset.waterMode} />
                        <PartyTag value={asset.controlOwner} />
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-slate-500">{asset.notes}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="pt-4"><GapState title="Cooling asset review pending" detail="Record installed technology, operating mode, control ownership and current condition during the site assessment." /></div>}
            </div>
          </div>
        ) : null}

        {activeSection === "compliance" ? (
          <div id="compliance-site-panel" role="tabpanel" aria-labelledby="compliance-site-tab">
            <div className="flex items-end justify-between gap-4 border-b atlas-rule pb-3">
              <div>
                <p className="atlas-kicker text-tide">Compliance register</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">Permits and operating obligations</h3>
              </div>
              <StatusTag value={profile.status.compliance} />
            </div>
            {profile.permits.length ? (
              <div className="mt-4 overflow-x-auto border border-ink/20">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead><tr className="border-b border-ink/15 bg-[#f1efe7] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-4 py-3">Permit / obligation</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Holder</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Review / due</th>
                  </tr></thead>
                  <tbody>{profile.permits.map((permit) => (
                    <tr key={permit.id} className="border-b border-ink/10 last:border-b-0">
                      <td className="px-4 py-4"><p className="text-xs font-semibold text-ink">{permit.title}</p><p className="mt-1 text-[11px] text-slate-500">{permit.conditions.join(" · ") || "Conditions review pending"}</p></td>
                      <td className="px-4 py-4"><StatusTag value={permit.category} /></td>
                      <td className="px-4 py-4"><PartyTag value={permit.holder} /></td>
                      <td className="px-4 py-4"><StatusTag value={permit.status} /></td>
                      <td className="px-4 py-4 text-xs text-slate-700">{permit.ownerRole}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{formatDate(permit.reviewDate)}{permit.dueDate ? <span className="block mt-1 text-slate-500">Due {formatDate(permit.dueDate)}</span> : null}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="mt-4"><GapState title="Compliance identification in progress" detail="Complete applicability screening, add permit holders and schedule the first formal review." /></div>}
          </div>
        ) : null}

        {activeSection === "environment" ? (
          <div id="environment-site-panel" role="tabpanel" aria-labelledby="environment-site-tab">
            <div className="border-b atlas-rule pb-3">
              <p className="atlas-kicker text-tide">Environmental register</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Activities, aspects, impacts and controls</h3>
            </div>
            {profile.aspects.length ? (
              <div className="mt-4 overflow-x-auto border border-ink/20">
                <table className="w-full min-w-[1080px] border-collapse text-left">
                  <thead><tr className="border-b border-ink/15 bg-[#f1efe7] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-4 py-3">Activity</th><th className="px-4 py-3">Aspect</th><th className="px-4 py-3">Impact</th><th className="px-4 py-3">Condition</th><th className="px-4 py-3">Significance</th><th className="px-4 py-3">Control</th><th className="px-4 py-3">Residual risk</th>
                  </tr></thead>
                  <tbody>{profile.aspects.map((aspect) => (
                    <tr key={aspect.id} className="border-b border-ink/10 last:border-b-0">
                      <td className="px-4 py-4 text-xs font-semibold text-ink">{aspect.activity}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{aspect.aspect}</td>
                      <td className="px-4 py-4 text-xs text-slate-700">{aspect.impact}</td>
                      <td className="px-4 py-4"><StatusTag value={aspect.condition} /></td>
                      <td className="px-4 py-4"><StatusTag value={aspect.significance} /></td>
                      <td className="max-w-[300px] px-4 py-4 text-xs leading-5 text-slate-700">{aspect.control}</td>
                      <td className="px-4 py-4"><StatusTag value={aspect.residualRisk} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="mt-4"><GapState title="Aspect and impact review pending" detail="Identify site activities, operating conditions, impacts, controls and residual risk before approving the environmental register." /></div>}
          </div>
        ) : null}

        {activeSection === "energy" ? (
          <div id="energy-site-panel" role="tabpanel" aria-labelledby="energy-site-tab" className="space-y-6">
            <div className="border-b atlas-rule pb-3">
              <p className="atlas-kicker text-tide">Energy review</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Utilities and operating performance</h3>
              <p className="mt-1 text-xs text-slate-500">Reporting period: {profile.metrics.period}</p>
            </div>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard title="Facility electricity" metric={profile.metrics.facilityEnergyMWh} icon={Factory} digits={0} />
              <MetricCard title="IT electricity" metric={profile.metrics.itEnergyMWh} icon={Zap} digits={0} />
              <MetricCard title="PUE" metric={profile.metrics.pue} icon={Gauge} digits={2} />
              <MetricCard title="Water consumption" metric={profile.metrics.waterConsumptionM3} icon={Droplets} digits={0} />
              <MetricCard title="WUE" metric={profile.metrics.wueLPerKwh} icon={Droplets} digits={2} />
              <MetricCard title="CUE" metric={profile.metrics.cueKgCo2ePerKwh} icon={Gauge} digits={3} />
            </div>
            <div className="border border-ink/20 bg-[#f1efe7] px-5 py-4">
              <div className="flex items-start gap-3">
                <Gauge size={17} className="mt-0.5 shrink-0 text-tide" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-ink">Energy review control</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Use IT load, weather, cooling mode and maintenance events as relevant variables when reviewing deviations from the energy baseline.</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "actions" ? (
          <div id="actions-site-panel" role="tabpanel" aria-labelledby="actions-site-tab" className="space-y-7">
            <div>
              <div className="flex items-end justify-between gap-4 border-b atlas-rule pb-3">
                <div><p className="atlas-kicker text-tide">Operational controls</p><h3 className="mt-2 text-xl font-semibold text-ink">Contributor checklists</h3></div>
                <span className="atlas-marker-index text-sm font-semibold text-ink">{profile.status.checklistCompletionPct}% complete</span>
              </div>
              {profile.checklists.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">{profile.checklists.map((checklist) => (
                  <div key={checklist.id} className="border border-ink/20 bg-paper p-4">
                    <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-ink">{checklist.title}</p><StatusTag value={checklist.status} /></div>
                    <p className="mt-2 text-[11px] text-slate-500">{checklist.ownerRole} · Due {formatDate(checklist.dueDate)}</p>
                    <div className="mt-4 flex items-center gap-3"><div className="h-1 flex-1 bg-[#d8d8cf]"><span className="block h-full bg-tide" style={{ width: `${checklist.completionPct}%` }} /></div><span className="atlas-marker-index text-xs font-semibold text-ink">{checklist.completedItems}/{checklist.totalItems}</span></div>
                  </div>
                ))}</div>
              ) : <div className="mt-4"><GapState title="Contributor checklists not assigned" detail="Assign the onboarding, permit, utilities and operating-control checklists to the responsible site roles." /></div>}
            </div>

            <div>
              <div className="border-b atlas-rule pb-3"><p className="atlas-kicker text-rust">Improvement programme</p><h3 className="mt-2 text-xl font-semibold text-ink">Actions and corrective work</h3></div>
              {profile.actions.length ? (
                <div className="mt-4 overflow-x-auto border border-ink/20"><table className="w-full min-w-[920px] border-collapse text-left">
                  <thead><tr className="border-b border-ink/15 bg-[#f1efe7] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500"><th className="px-4 py-3">Action</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner / due</th><th className="px-4 py-3">Next step</th></tr></thead>
                  <tbody>{profile.actions.map((action) => (
                    <tr key={action.id} className="border-b border-ink/10 last:border-b-0"><td className="px-4 py-4 text-xs font-semibold text-ink">{action.title}</td><td className="px-4 py-4"><StatusTag value={action.category} /></td><td className="px-4 py-4"><StatusTag value={action.severity} /></td><td className="px-4 py-4"><StatusTag value={action.status} /></td><td className="px-4 py-4 text-xs text-slate-700">{action.ownerRole}<span className="mt-1 block text-slate-500">{formatDate(action.dueDate)}</span></td><td className="max-w-[320px] px-4 py-4 text-xs leading-5 text-slate-700">{action.nextStep}</td></tr>
                  ))}</tbody>
                </table></div>
              ) : <div className="mt-4"><GapState title="Action plan awaiting assessment findings" detail="Approved gaps and performance deviations will create accountable actions with due dates and verification steps." /></div>}
            </div>

            <div>
              <div className="border-b atlas-rule pb-3"><p className="atlas-kicker text-tide">Assurance</p><h3 className="mt-2 text-xl font-semibold text-ink">Audit and management review</h3></div>
              {profile.audits.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">{profile.audits.map((audit) => (
                  <div key={audit.id} className="border border-ink/20 bg-paper p-4"><div className="flex items-start justify-between gap-3"><ShieldCheck size={18} className="text-tide" aria-hidden="true" /><StatusTag value={audit.status} /></div><p className="mt-3 text-sm font-semibold text-ink">{audit.title}</p><p className="mt-1 text-[11px] text-slate-500">{label(audit.type)} · {formatDate(audit.scheduledDate)}</p><p className="mt-3 text-xs leading-5 text-slate-600">{audit.summary}</p><p className="atlas-marker-index mt-3 text-xs font-semibold text-ink">{audit.openFindings} open findings</p></div>
                ))}</div>
              ) : <div className="mt-4"><GapState title="Assurance schedule not established" detail="Schedule the initial internal audit and management review after the first operating-control cycle is complete." /></div>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

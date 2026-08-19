import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  ShieldAlert,
} from "lucide-react";
import type { AssessmentResult } from "../../types";
import type { SiteEemsProfile } from "../types";

interface EemsCommandCenterProps {
  results: AssessmentResult[];
  profiles: SiteEemsProfile[];
  selectedId: string | null;
  onSelect: (assessmentId: string) => void;
  onOpenSite: (assessmentId: string) => void;
  mapNode: ReactNode;
}

const statusTone: Record<string, string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  operating: "border-emerald-300 bg-emerald-50 text-emerald-800",
  on_track: "border-emerald-300 bg-emerald-50 text-emerald-800",
  assurance: "border-emerald-300 bg-emerald-50 text-emerald-800",
  due_soon: "border-amber-300 bg-amber-50 text-amber-900",
  verification_due: "border-amber-300 bg-amber-50 text-amber-900",
  implementation: "border-sky-300 bg-sky-50 text-sky-900",
  controls_design: "border-sky-300 bg-sky-50 text-sky-900",
  gap_assessment: "border-violet-300 bg-violet-50 text-violet-900",
  review_required: "border-orange-300 bg-orange-50 text-orange-900",
  expired: "border-red-300 bg-red-50 text-red-800",
  overdue: "border-red-300 bg-red-50 text-red-800",
  blocked: "border-red-300 bg-red-50 text-red-800",
  not_assessed: "border-slate-300 bg-slate-100 text-slate-600",
  not_onboarded: "border-slate-300 bg-slate-100 text-slate-600",
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

function MetricTile({
  labelText,
  value,
  detail,
  icon: Icon,
  attention = false,
}: {
  labelText: string;
  value: string;
  detail: string;
  icon: typeof Factory;
  attention?: boolean;
}) {
  return (
    <div className="border-r border-ink/15 px-4 py-4 last:border-r-0 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <p className="atlas-kicker text-slate-500">{labelText}</p>
        <Icon size={16} className={attention ? "text-rust" : "text-tide"} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className={`atlas-marker-index mt-3 text-3xl font-semibold tracking-[-0.04em] ${attention ? "text-rust" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function attentionPriority(profile: SiteEemsProfile): [number, number, number, number] {
  const compliancePriority: Record<string, number> = {
    expired: 5,
    review_required: 4,
    due_soon: 3,
    not_assessed: 2,
    active: 0,
  };
  const actionPriority: Record<string, number> = {
    blocked: 4,
    overdue: 3,
    verification_due: 2,
    on_track: 0,
  };
  return [
    compliancePriority[profile.status.compliance] ?? 0,
    actionPriority[profile.status.actionHealth] ?? 0,
    profile.status.openHighPriorityActions,
    ["not_onboarded", "gap_assessment"].includes(profile.status.eemsStage) ? 1 : 0,
  ];
}

function compareAttention(first: SiteEemsProfile, second: SiteEemsProfile): number {
  const firstPriority = attentionPriority(first);
  const secondPriority = attentionPriority(second);
  for (let index = 0; index < firstPriority.length; index += 1) {
    if (firstPriority[index] !== secondPriority[index]) {
      return secondPriority[index] - firstPriority[index];
    }
  }
  return first.name.localeCompare(second.name);
}

export function EemsCommandCenter({
  results,
  profiles,
  selectedId,
  onSelect,
  onOpenSite,
  mapNode,
}: EemsCommandCenterProps) {
  const attentionProfiles = [...profiles]
    .filter((profile) => attentionPriority(profile).some((priority) => priority > 0))
    .sort(compareAttention);
  const complianceAttention = profiles.filter((profile) =>
    ["due_soon", "expired", "review_required"].includes(profile.status.compliance),
  ).length;
  const gapAssessments = profiles.filter((profile) =>
    ["not_onboarded", "gap_assessment"].includes(profile.status.eemsStage),
  ).length;
  const openHighPriorityActions = profiles.reduce(
    (total, profile) => total + profile.status.openHighPriorityActions,
    0,
  );
  const checklistCoverage = profiles.length
    ? Math.round(profiles.reduce((total, profile) => total + profile.status.checklistCompletionPct, 0) / profiles.length)
    : 0;

  return (
    <section className="min-w-0 max-w-full space-y-4" aria-labelledby="eems-command-center-heading">
      <div className="atlas-panel min-w-0 max-w-full">
        <div className="flex flex-col gap-4 border-b atlas-rule px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="atlas-kicker text-tide">Environmental &amp; energy management</p>
            <h2 id="eems-command-center-heading" className="mt-2 font-display text-3xl leading-none text-ink">
              Portfolio command center
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Site lifecycle, compliance obligations, operating controls and energy performance in one management view.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">
              {profiles.length} managed workspaces · {results.length} portfolio sites
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
              Working scenario records · confirmation pending
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b atlas-rule lg:grid-cols-5">
          <MetricTile labelText="Portfolio sites" value={String(results.length)} detail="Current portfolio scope" icon={Factory} />
          <MetricTile labelText="Compliance attention" value={String(complianceAttention)} detail="Due, expired or under review" icon={ShieldAlert} attention={complianceAttention > 0} />
          <MetricTile labelText="Gap assessments" value={String(gapAssessments)} detail="Onboarding work in progress" icon={ClipboardCheck} />
          <MetricTile labelText="Priority actions" value={String(openHighPriorityActions)} detail="Open high-priority actions" icon={AlertTriangle} attention={openHighPriorityActions > 0} />
          <MetricTile labelText="Checklist coverage" value={`${checklistCoverage}%`} detail="Average completion across sites" icon={CheckCircle2} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.7fr)]">
          <div className="min-h-[430px] overflow-hidden border-b atlas-rule lg:border-b-0 lg:border-r">
            {mapNode}
          </div>

          <aside className="flex min-h-[430px] flex-col" aria-label="Management attention queue">
            <div className="border-b atlas-rule px-5 py-4">
              <p className="atlas-kicker text-rust">Management attention</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Compliance exceptions appear first, followed by blocked or overdue work, verification, priority actions and open gap assessments.</p>
            </div>

            <div className="max-h-[520px] flex-1 overflow-y-auto">
              {attentionProfiles.length ? attentionProfiles.slice(0, 8).map((profile) => {
                const selected = selectedId === profile.assessmentId;
                const flag = profile.status.flags[0];
                return (
                  <button
                    key={profile.assessmentId}
                    type="button"
                    onClick={() => onSelect(profile.assessmentId)}
                    aria-pressed={selected}
                    className={`w-full border-b border-ink/10 px-5 py-4 text-left transition ${selected ? "bg-[#e7efeb]" : "hover:bg-[#f1efe7]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{profile.name}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-500">{profile.location.countryName} · {profile.operatingModel.label}</p>
                      </div>
                      <span className="atlas-marker-index shrink-0 text-sm font-semibold text-rust">
                        {profile.status.openHighPriorityActions}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusTag value={profile.status.compliance} />
                      <StatusTag value={profile.status.actionHealth} />
                    </div>
                    {flag ? <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-600">{flag}</p> : null}
                  </button>
                );
              }) : (
                <div className="p-5">
                  <p className="text-sm font-semibold text-ink">No active exceptions</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">The current portfolio has no overdue, blocked or review-required records.</p>
                </div>
              )}
            </div>

            {selectedId ? (
              <button
                type="button"
                onClick={() => onOpenSite(selectedId)}
                className="mt-auto flex w-full items-center justify-between border-t border-ink bg-ink px-5 py-4 text-left text-sm font-semibold text-white transition hover:bg-tide"
              >
                Open selected site workspace
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="atlas-panel min-w-0 max-w-full overflow-hidden">
        <div className="border-b atlas-rule px-5 py-4 sm:px-6">
          <p className="atlas-kicker text-tide">Portfolio operating view</p>
          <p className="mt-1 text-xs text-slate-500">Select a row for map context. Open a workspace to inspect obligations, controls and actions.</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <th scope="col" className="px-6 py-3">Site</th>
                <th scope="col" className="px-4 py-3">Operating model</th>
                <th scope="col" className="px-4 py-3">Lifecycle</th>
                <th scope="col" className="px-4 py-3">EEMS stage</th>
                <th scope="col" className="px-4 py-3">Compliance</th>
                <th scope="col" className="px-4 py-3">Checklists</th>
                <th scope="col" className="px-4 py-3">Priority actions</th>
                <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const selected = selectedId === profile.assessmentId;
                return (
                  <tr
                    key={profile.assessmentId}
                    className={`cursor-pointer border-b border-ink/10 last:border-b-0 ${selected ? "bg-[#e7efeb]" : "hover:bg-[#f1efe7]"}`}
                    onClick={() => onSelect(profile.assessmentId)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-ink">{profile.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{profile.location.countryName}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-700">{profile.operatingModel.label}</td>
                    <td className="px-4 py-4"><StatusTag value={profile.lifecycle.primaryPhase} /></td>
                    <td className="px-4 py-4"><StatusTag value={profile.status.eemsStage} /></td>
                    <td className="px-4 py-4"><StatusTag value={profile.status.compliance} /></td>
                    <td className="px-4 py-4">
                      <p className="atlas-marker-index text-xs font-semibold text-ink">{profile.status.checklistCompletionPct}%</p>
                      <div className="mt-2 h-1 w-24 bg-[#d8d8cf]" aria-hidden="true">
                        <span className="block h-full bg-tide" style={{ width: `${profile.status.checklistCompletionPct}%` }} />
                      </div>
                    </td>
                    <td className="atlas-marker-index px-4 py-4 text-sm font-semibold text-ink">{profile.status.openHighPriorityActions}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenSite(profile.assessmentId);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-tide underline decoration-tide/40 underline-offset-4 hover:text-ink"
                      >
                        Workspace <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

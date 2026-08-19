import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown, Search } from "lucide-react";
import type { SiteEemsProfile } from "../types";

export type EemsRegisterKind = "compliance" | "environment" | "energy" | "actions";

interface EemsRegisterViewProps {
  profiles: SiteEemsProfile[];
  initialRegister?: EemsRegisterKind;
  showRegisterNav?: boolean;
  onSelect?: (assessmentId: string) => void;
  onOpenSite?: (assessmentId: string) => void;
}

interface RegisterRow {
  id: string;
  assessmentId: string;
  site: string;
  country: string;
  values: Record<string, string | number | null>;
}

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  status?: boolean;
}

const registerLabels: Record<EemsRegisterKind, { title: string; description: string }> = {
  compliance: { title: "Compliance & permits", description: "Operating obligations, holders, review dates and current status." },
  environment: { title: "Environmental aspects", description: "Significant activities, impacts, controls and residual risk across the portfolio." },
  energy: { title: "Energy & utilities", description: "Comparable facility, IT, water and efficiency measures by reporting period." },
  actions: { title: "Actions & assurance", description: "Improvement actions, contributor checklists and assurance activity requiring follow-up." },
};

const statusTone: Record<string, string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  closed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  complete: "border-emerald-300 bg-emerald-50 text-emerald-800",
  low: "border-emerald-300 bg-emerald-50 text-emerald-800",
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
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function statusCell(value: string) {
  return <span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusTone[value] ?? "border-ink/20 bg-paper text-slate-600"}`}>{label(value)}</span>;
}

function metric(value: number | null, digits: number, unit: string): string {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function buildComplianceRows(profiles: SiteEemsProfile[]): RegisterRow[] {
  return profiles.flatMap((profile) => profile.permits.map((permit) => ({
    id: `${profile.assessmentId}-${permit.id}`,
    assessmentId: profile.assessmentId,
    site: profile.name,
    country: profile.location.countryName,
    values: {
      record: permit.title,
      category: permit.category,
      holder: permit.holder,
      status: permit.status,
      owner: permit.ownerRole,
      review: formatDate(permit.reviewDate),
      due: formatDate(permit.dueDate),
    },
  })));
}

function buildEnvironmentRows(profiles: SiteEemsProfile[]): RegisterRow[] {
  return profiles.flatMap((profile) => profile.aspects.map((aspect) => ({
    id: `${profile.assessmentId}-${aspect.id}`,
    assessmentId: profile.assessmentId,
    site: profile.name,
    country: profile.location.countryName,
    values: {
      activity: aspect.activity,
      aspect: aspect.aspect,
      impact: aspect.impact,
      condition: aspect.condition,
      significance: aspect.significance,
      control: aspect.control,
      residual: aspect.residualRisk,
    },
  })));
}

function buildEnergyRows(profiles: SiteEemsProfile[]): RegisterRow[] {
  return profiles.map((profile) => ({
    id: `${profile.assessmentId}-energy`,
    assessmentId: profile.assessmentId,
    site: profile.name,
    country: profile.location.countryName,
    values: {
      period: profile.metrics.period,
      facility: metric(profile.metrics.facilityEnergyMWh.value, 0, profile.metrics.facilityEnergyMWh.unit),
      it: metric(profile.metrics.itEnergyMWh.value, 0, profile.metrics.itEnergyMWh.unit),
      pue: metric(profile.metrics.pue.value, 2, ""),
      water: metric(profile.metrics.waterConsumptionM3.value, 0, profile.metrics.waterConsumptionM3.unit),
      wue: metric(profile.metrics.wueLPerKwh.value, 2, profile.metrics.wueLPerKwh.unit),
      cue: metric(profile.metrics.cueKgCo2ePerKwh.value, 3, profile.metrics.cueKgCo2ePerKwh.unit),
    },
  }));
}

function buildActionRows(profiles: SiteEemsProfile[]): RegisterRow[] {
  return profiles.flatMap((profile) => [
    ...profile.actions.map((action) => ({
      id: `${profile.assessmentId}-action-${action.id}`,
      assessmentId: profile.assessmentId,
      site: profile.name,
      country: profile.location.countryName,
      values: {
        type: "Action",
        record: action.title,
        category: action.category,
        priority: action.severity,
        status: action.status,
        owner: action.ownerRole,
        due: formatDate(action.dueDate),
        followup: action.nextStep,
      },
    })),
    ...profile.checklists.map((checklist) => ({
      id: `${profile.assessmentId}-checklist-${checklist.id}`,
      assessmentId: profile.assessmentId,
      site: profile.name,
      country: profile.location.countryName,
      values: {
        type: "Checklist",
        record: checklist.title,
        category: "operational_control",
        priority: null,
        status: checklist.status,
        owner: checklist.ownerRole,
        due: formatDate(checklist.dueDate),
        followup: `${checklist.completedItems}/${checklist.totalItems} items complete`,
      },
    })),
    ...profile.audits.map((audit) => ({
      id: `${profile.assessmentId}-audit-${audit.id}`,
      assessmentId: profile.assessmentId,
      site: profile.name,
      country: profile.location.countryName,
      values: {
        type: "Audit",
        record: audit.title,
        category: audit.type,
        priority: audit.openFindings > 0 ? "high" : "low",
        status: audit.status,
        owner: "Assurance lead",
        due: formatDate(audit.scheduledDate),
        followup: audit.summary,
      },
    })),
  ]);
}

const columns: Record<EemsRegisterKind, Column[]> = {
  compliance: [
    { key: "record", label: "Permit / obligation" }, { key: "category", label: "Category", status: true },
    { key: "holder", label: "Holder", status: true }, { key: "status", label: "Status", status: true },
    { key: "owner", label: "Owner" }, { key: "review", label: "Review" }, { key: "due", label: "Due" },
  ],
  environment: [
    { key: "activity", label: "Activity" }, { key: "aspect", label: "Aspect" }, { key: "impact", label: "Impact" },
    { key: "condition", label: "Condition", status: true }, { key: "significance", label: "Significance", status: true },
    { key: "control", label: "Control" }, { key: "residual", label: "Residual risk", status: true },
  ],
  energy: [
    { key: "period", label: "Period" }, { key: "facility", label: "Facility energy", align: "right" },
    { key: "it", label: "IT energy", align: "right" }, { key: "pue", label: "PUE", align: "right" },
    { key: "water", label: "Water", align: "right" }, { key: "wue", label: "WUE", align: "right" },
    { key: "cue", label: "CUE", align: "right" },
  ],
  actions: [
    { key: "type", label: "Record type" }, { key: "record", label: "Action / control" },
    { key: "category", label: "Category", status: true }, { key: "priority", label: "Priority", status: true },
    { key: "status", label: "Status", status: true }, { key: "owner", label: "Owner" },
    { key: "due", label: "Due" }, { key: "followup", label: "Follow-up" },
  ],
};

export function EemsRegisterView({ profiles, initialRegister = "compliance", showRegisterNav = true, onSelect, onOpenSite }: EemsRegisterViewProps) {
  const [register, setRegister] = useState<EemsRegisterKind>(initialRegister);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "site", direction: "asc" });

  const allRows = useMemo(() => {
    if (register === "compliance") return buildComplianceRows(profiles);
    if (register === "environment") return buildEnvironmentRows(profiles);
    if (register === "energy") return buildEnergyRows(profiles);
    return buildActionRows(profiles);
  }, [profiles, register]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allRows
      .filter((row) => !normalizedQuery || [row.site, row.country, ...Object.values(row.values)]
        .some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)))
      .sort((first, second) => {
        const firstValue = sort.key === "site" ? first.site : first.values[sort.key];
        const secondValue = sort.key === "site" ? second.site : second.values[sort.key];
        const comparison = String(firstValue ?? "").localeCompare(String(secondValue ?? ""), undefined, { numeric: true, sensitivity: "base" });
        return sort.direction === "asc" ? comparison : -comparison;
      });
  }, [allRows, query, sort]);

  const changeRegister = (next: EemsRegisterKind) => {
    setRegister(next);
    setQuery("");
    setSort({ key: "site", direction: "asc" });
  };

  const changeSort = (key: string) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  };

  return (
    <section className="atlas-panel" aria-labelledby="eems-register-heading">
      <div className="flex flex-col gap-4 border-b atlas-rule px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="atlas-kicker text-tide">Portfolio registers</p>
          <h2 id="eems-register-heading" className="mt-2 font-display text-3xl leading-none text-ink">{registerLabels[register].title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{registerLabels[register].description}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
            Working scenario records · confirmation pending
          </p>
        </div>
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search current register</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search site, status or record" className="w-full border border-ink/25 bg-paper py-2.5 pl-9 pr-3 text-xs text-ink placeholder:text-slate-400" />
        </label>
      </div>

      {showRegisterNav ? (
        <nav className="overflow-x-auto border-b atlas-rule px-5 sm:px-6" aria-label="EEMS portfolio registers">
          <div className="flex min-w-max gap-6">
            {(Object.keys(registerLabels) as EemsRegisterKind[]).map((kind) => (
              <button key={kind} type="button" onClick={() => changeRegister(kind)} className="atlas-tab text-xs font-semibold" data-active={register === kind} aria-pressed={register === kind}>
                {registerLabels[kind].title}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
        <span>{visibleRows.length} records</span>
        {query ? <span>Filtered from {allRows.length}</span> : <span>{profiles.length} sites in scope</span>}
      </div>

      {visibleRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/10 bg-[#f1efe7] text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {[{ key: "site", label: "Site" } as Column, ...columns[register]].map((column) => {
                  const active = sort.key === column.key;
                  const Icon = active ? sort.direction === "asc" ? ArrowUp : ArrowDown : ChevronsUpDown;
                  return (
                    <th key={column.key} scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3 first:pl-6 ${column.align === "right" ? "text-right" : ""}`}>
                      <button type="button" onClick={() => changeSort(column.key)} className={`inline-flex items-center gap-1.5 ${column.align === "right" ? "ml-auto" : ""}`}>
                        {column.label}<Icon size={12} className={active ? "text-ink" : "text-slate-400"} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
                {onOpenSite ? <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Open workspace</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} onClick={() => onSelect?.(row.assessmentId)} className={`border-b border-ink/10 last:border-b-0 ${onSelect ? "cursor-pointer hover:bg-[#f1efe7]" : ""}`}>
                  <td className="px-6 py-4"><p className="text-xs font-semibold text-ink">{row.site}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.country}</p></td>
                  {columns[register].map((column) => {
                    const value = row.values[column.key];
                    return (
                      <td key={column.key} className={`max-w-[320px] px-4 py-4 text-xs leading-5 text-slate-700 ${column.align === "right" ? "atlas-marker-index whitespace-nowrap text-right" : ""}`}>
                        {column.status && typeof value === "string" ? statusCell(value) : value ?? "—"}
                      </td>
                    );
                  })}
                  {onOpenSite ? (
                    <td className="px-4 py-4 text-right">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onOpenSite(row.assessmentId); }} className="inline-flex items-center gap-1 text-xs font-semibold text-tide hover:text-ink">
                        Open <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink">No matching records</p>
          <p className="mt-1 text-xs text-slate-500">Clear the search or complete the relevant site assessment to populate this register.</p>
        </div>
      )}
    </section>
  );
}

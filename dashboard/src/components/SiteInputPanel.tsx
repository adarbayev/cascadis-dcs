import { FileSpreadsheet, LoaderCircle, MapPin, Plus, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import type { DraftForm, LocationInput } from "../types";
import { humanize } from "../lib/assessment";

interface SiteInputPanelProps {
  form: DraftForm;
  setForm: (form: DraftForm) => void;
  queued: LocationInput[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAssess: () => void;
  onCsv: (file: File) => Promise<void>;
  onDownloadTemplate: () => void;
  busy: boolean;
  error: string | null;
}

const inputClass =
  "mt-1.5 w-full border border-ink/20 bg-transparent px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-tide";
const labelClass = "atlas-kicker text-slate-500";

export function SiteInputPanel({
  form,
  setForm,
  queued,
  onAdd,
  onRemove,
  onAssess,
  onCsv,
  onDownloadTemplate,
  busy,
  error,
}: SiteInputPanelProps) {
  const update = (key: keyof DraftForm, value: string) => setForm({ ...form, [key]: value });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onAdd();
  };

  const handleCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await onCsv(file);
    event.target.value = "";
  };

  return (
    <aside className="bg-paper p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="atlas-kicker text-tide">Location intake / evidence request</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink">Build the assessment set</h2>
        </div>
        <span className="atlas-marker-index border border-ink/25 px-2 py-1 text-xs text-slate-600">{queued.length}/100</span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className={labelClass}>Site name</span>
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Phoenix candidate"
              required
            />
          </label>
          <label>
            <span className={labelClass}>Site ID</span>
            <input
              className={inputClass}
              value={form.id}
              onChange={(event) => update("id", event.target.value)}
              placeholder="phoenix-1"
              required
            />
          </label>
          <label>
            <span className={labelClass}>Project</span>
            <select className={inputClass} value={form.project_type} onChange={(event) => update("project_type", event.target.value)}>
              <option value="retrofit">Retrofit</option>
              <option value="expansion">Expansion</option>
              <option value="greenfield">Greenfield</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Latitude</span>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min="-90"
              max="90"
              step="any"
              value={form.latitude}
              onChange={(event) => update("latitude", event.target.value)}
              placeholder="33.4484"
              required
            />
          </label>
          <label>
            <span className={labelClass}>Longitude</span>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min="-180"
              max="180"
              step="any"
              value={form.longitude}
              onChange={(event) => update("longitude", event.target.value)}
              placeholder="-112.0740"
              required
            />
          </label>
        </div>

        <p className="flex items-center gap-2 border border-tide/20 bg-[#e7efeb] px-3 py-2 text-xs leading-5 text-slate-600">
          <MapPin size={14} className="shrink-0 text-tide" />
          Click the map to populate coordinates, then confirm the site details.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <label>
            <span className={labelClass}>Cost</span>
            <select className={inputClass} value={form.cost_priority} onChange={(event) => update("cost_priority", event.target.value)}>
              <option value="constrained">Constrained</option>
              <option value="balanced">Balanced</option>
              <option value="investment_ready">Investment ready</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Uptime</span>
            <select
              className={inputClass}
              value={form.uptime_constraint}
              onChange={(event) => update("uptime_constraint", event.target.value)}
            >
              <option value="no_outage">No outage</option>
              <option value="maintenance_window">Maintenance window</option>
              <option value="major_works_allowed">Major works allowed</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>3-year growth</span>
            <select className={inputClass} value={form.growth_3y} onChange={(event) => update("growth_3y", event.target.value)}>
              <option value="stable">Stable</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <details className="group border-y border-ink/20 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink marker:text-tide">Optional operating metrics</summary>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["pue", "PUE", "1.50"],
              ["wue_l_per_kwh", "WUE (L/kWh)", "0.80"],
              ["it_load_utilization_pct", "IT load (%)", "65"],
              ["annual_it_energy_mwh", "IT energy (MWh/y)", "120000"],
            ].map(([key, label, placeholder]) => (
              <label key={key}>
                <span className={labelClass}>{label}</span>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="any"
                  value={form[key as keyof DraftForm]}
                  onChange={(event) => update(key as keyof DraftForm, event.target.value)}
                  placeholder={placeholder}
                />
              </label>
            ))}
          </div>
        </details>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 border border-ink px-4 py-3 text-sm font-semibold text-ink transition hover:bg-signal"
        >
          <Plus size={17} /> Add site to assessment
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 atlas-kicker text-slate-400">
        <span className="h-px flex-1 bg-ink/20" /> or import portfolio <span className="h-px flex-1 bg-ink/20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-ink/30 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-tide hover:text-tide">
          <Upload size={15} /> Import CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsv} />
        </label>
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="flex items-center justify-center gap-2 border border-ink/20 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-tide hover:text-tide"
        >
          <FileSpreadsheet size={15} /> CSV template
        </button>
      </div>

      {queued.length ? (
        <div className="mt-5 space-y-2">
          <p className={labelClass}>Queued sites</p>
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {queued.map((site) => (
              <div key={site.id} className="flex items-center justify-between gap-3 border-b border-ink/15 px-1 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {site.latitude.toFixed(3)}, {site.longitude.toFixed(3)} · {humanize(site.project_type)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(site.id)}
                  className="p-2 text-slate-400 transition hover:text-red-700"
                  aria-label={`Remove ${site.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 border border-red-300 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!queued.length || busy}
        onClick={onAssess}
        className="mt-5 flex w-full items-center justify-center gap-2 border border-ink bg-ink px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-tide disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : null}
        {busy ? "Assessing source data…" : `Assess ${queued.length || "queued"} site${queued.length === 1 ? "" : "s"}`}
      </button>
    </aside>
  );
}

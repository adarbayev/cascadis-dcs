import type { LocationInput } from "../types";

const HEADER_ALIASES: Record<string, keyof LocationInput> = {
  id: "id",
  site_id: "id",
  name: "name",
  site_name: "name",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lon: "longitude",
  lng: "longitude",
  project_type: "project_type",
  cost_priority: "cost_priority",
  uptime_constraint: "uptime_constraint",
  growth_3y: "growth_3y",
  pue: "pue",
  wue_l_per_kwh: "wue_l_per_kwh",
  wue: "wue_l_per_kwh",
  it_load_utilization_pct: "it_load_utilization_pct",
  annual_it_energy_mwh: "annual_it_energy_mwh",
};

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

const optionalNumber = (value: string | undefined, row: number, label: string): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Row ${row}: ${label} must be numeric.`);
  return parsed;
};

function parseProjectType(value: string, row: number): LocationInput["project_type"] {
  if (value === "retrofit" || value === "expansion" || value === "greenfield") return value;
  throw new Error(`Row ${row}: project_type must be retrofit, expansion or greenfield.`);
}

function parseCostPriority(value: string, row: number): LocationInput["cost_priority"] {
  if (value === "constrained" || value === "balanced" || value === "investment_ready") return value;
  throw new Error(`Row ${row}: cost_priority is invalid.`);
}

function uptimeConstraint(value: string, row: number): LocationInput["uptime_constraint"] {
  if (value === "no_outage" || value === "maintenance_window" || value === "major_works_allowed") return value;
  throw new Error(`Row ${row}: uptime_constraint is invalid.`);
}

function growthLevel(value: string, row: number): LocationInput["growth_3y"] {
  if (value === "stable" || value === "moderate" || value === "high") return value;
  throw new Error(`Row ${row}: growth_3y is invalid.`);
}

export function parseLocationCsv(text: string): LocationInput[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one site.");
  if (rows.length - 1 > 100) throw new Error("The CSV contains more than the 100-site limit.");

  const headers = rows[0].map((header) => header.toLowerCase().trim().replaceAll(" ", "_"));
  const mapped = headers.map((header) => HEADER_ALIASES[header]);
  for (const required of ["id", "name", "latitude", "longitude"] as const) {
    if (!mapped.includes(required)) throw new Error(`Missing required column: ${required}.`);
  }

  const valueAt = (row: string[], key: keyof LocationInput) => {
    const index = mapped.indexOf(key);
    return index >= 0 ? row[index] : undefined;
  };

  const sites = rows.slice(1).map((row, index): LocationInput => {
    const rowNumber = index + 2;
    const latitude = optionalNumber(valueAt(row, "latitude"), rowNumber, "latitude");
    const longitude = optionalNumber(valueAt(row, "longitude"), rowNumber, "longitude");
    if (latitude === null || latitude < -90 || latitude > 90) {
      throw new Error(`Row ${rowNumber}: latitude must be between -90 and 90.`);
    }
    if (longitude === null || longitude < -180 || longitude > 180) {
      throw new Error(`Row ${rowNumber}: longitude must be between -180 and 180.`);
    }
    const id = valueAt(row, "id")?.trim();
    const name = valueAt(row, "name")?.trim();
    if (!id || !name) throw new Error(`Row ${rowNumber}: id and name are required.`);

    const projectType = valueAt(row, "project_type")?.trim() || "retrofit";
    const costPriority = valueAt(row, "cost_priority")?.trim() || "balanced";
    const uptime = valueAt(row, "uptime_constraint")?.trim() || "maintenance_window";
    const growth = valueAt(row, "growth_3y")?.trim() || "moderate";
    const parsedPue = optionalNumber(valueAt(row, "pue"), rowNumber, "pue");
    const parsedWue = optionalNumber(valueAt(row, "wue_l_per_kwh"), rowNumber, "wue_l_per_kwh");
    const parsedUtilisation = optionalNumber(valueAt(row, "it_load_utilization_pct"), rowNumber, "it_load_utilization_pct");
    const parsedEnergy = optionalNumber(valueAt(row, "annual_it_energy_mwh"), rowNumber, "annual_it_energy_mwh");
    if (parsedPue !== null && (parsedPue < 1 || parsedPue > 5)) throw new Error(`Row ${rowNumber}: pue must be between 1 and 5.`);
    if (parsedWue !== null && (parsedWue < 0 || parsedWue > 100)) throw new Error(`Row ${rowNumber}: wue_l_per_kwh must be between 0 and 100.`);
    if (parsedUtilisation !== null && (parsedUtilisation < 0 || parsedUtilisation > 100)) throw new Error(`Row ${rowNumber}: it_load_utilization_pct must be between 0 and 100.`);
    if (parsedEnergy !== null && parsedEnergy <= 0) throw new Error(`Row ${rowNumber}: annual_it_energy_mwh must be greater than zero.`);

    return {
      id,
      name,
      latitude,
      longitude,
      project_type: parseProjectType(projectType, rowNumber),
      cost_priority: parseCostPriority(costPriority, rowNumber),
      uptime_constraint: uptimeConstraint(uptime, rowNumber),
      growth_3y: growthLevel(growth, rowNumber),
      pue: parsedPue,
      wue_l_per_kwh: parsedWue,
      it_load_utilization_pct: parsedUtilisation,
      annual_it_energy_mwh: parsedEnergy,
    };
  });

  const ids = new Set<string>();
  for (const site of sites) {
    if (ids.has(site.id)) throw new Error(`Duplicate site id: ${site.id}.`);
    ids.add(site.id);
  }
  return sites;
}

const escape = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const text = typeof value === "string" && /^[\t ]*[=+\-@]/.test(value) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

import { describe, expect, it } from "vitest";
import { parseLocationCsv, rowsToCsv } from "./csv";

describe("CSV portfolio input", () => {
  it("parses canonical fields and defaults", () => {
    const data = parseLocationCsv("id,name,latitude,longitude\na,Alpha,51.5,-0.1");
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "a", project_type: "retrofit", cost_priority: "balanced", uptime_constraint: "maintenance_window", growth_3y: "moderate" });
  });

  it("handles quoted commas and validates operating metrics", () => {
    const data = parseLocationCsv('id,name,latitude,longitude,pue,wue,it_load_utilization_pct,annual_it_energy_mwh\na,"London, West",51.5,-0.1,1.4,0.5,72,100000');
    expect(data[0].name).toBe("London, West");
    expect(() => parseLocationCsv("id,name,latitude,longitude,pue\na,Alpha,51.5,-0.1,0.9")).toThrow(/pue must be between 1 and 5/i);
    expect(() => parseLocationCsv("id,name,latitude,longitude,it_load_utilization_pct\na,Alpha,51.5,-0.1,101")).toThrow(/between 0 and 100/i);
  });

  it("enforces the 100-site ceiling and escapes exports", () => {
    const rows = Array.from({ length: 101 }, (_, index) => `${index},Site ${index},0,0`).join("\n");
    expect(() => parseLocationCsv(`id,name,latitude,longitude\n${rows}`)).toThrow(/100-site limit/i);
    expect(rowsToCsv(["name"], [["London, West"]])).toBe('name\n"London, West"');
  });

  it("neutralises spreadsheet formulas in text while preserving numeric negatives", () => {
    const csv = rowsToCsv(
      ["name", "longitude", "note"],
      [["=WEBSERVICE(\"https://example.test\")", -0.1278, "  @command"]],
    );
    expect(csv).toBe('name,longitude,note\n"\'=WEBSERVICE(""https://example.test"")",-0.1278,\'  @command');
  });
});

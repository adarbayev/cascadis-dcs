import { afterEach, describe, expect, it, vi } from "vitest";

describe("published snapshot mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads portfolio data without calling the local API", async () => {
    vi.stubEnv("VITE_APP_MODE", "static");
    const fetchMock = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify({
      schema_version: "1.0.0",
      snapshot_at: "2026-08-10T00:00:00Z",
      snapshot_scope: "test",
      manifest_version: "test",
      policy: { version: "1" },
      source_status: [],
      assessments: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("./api");
    expect(api.isStaticMode).toBe(true);
    expect(await api.getPortfolio()).toEqual([]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("data/google-portfolio.2026-08-10.json");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("/api/v1");
    await expect(api.createAssessment({ locations: [], weights: { water: 0.5, carbon: 0.5 } })).rejects.toThrow(/local Cascadis API/i);
  });
});

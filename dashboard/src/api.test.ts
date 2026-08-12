import { afterEach, describe, expect, it, vi } from "vitest";
import { getSourceStatus } from "./api";

describe("source readiness normalisation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not treat configuration as a live availability check", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      checked_at: "2026-08-09T12:00:00Z",
      sources: [{
        provider: "aqueduct_esri",
        enabled: true,
        configured: true,
        mode: "live_api_with_sqlite_cache",
        note: "Configured provider; no live ping was performed.",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))));

    const [source] = await getSourceStatus();
    expect(source.status).toBe("configured");
    expect(source.status).not.toBe("available");
  });
});

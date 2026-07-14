// Phase 3, Sprint 41 — live route integration test for the Multi-Timeframe
// surface, the second bounded slice of the Route+UI backlog reduction.
// Uses the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to Sprint 34's
// already-unit-tested buildMultiTimeframeAnalysis() — these tests prove the
// HTTP wiring, not the confluence math itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface MultiTimeframeResponse {
  symbol: string;
  dataSource: string;
  timeframes: { interval: string; structure: { trend: string } }[];
  trendAgreement: string;
  dominantTrend: string | null;
  confluenceScore: number | null;
  confidenceLevel: string;
  summary: string;
}

describe("Multi-Timeframe routes (live, real Postgres, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("resolves a well-shaped multi-timeframe analysis for a known symbol using the default timeframe set", async () => {
    const res = await fetch(`${baseUrl}/api/trading/multi-timeframe/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MultiTimeframeResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.timeframes.map((t) => t.interval)).toEqual(["15m", "1h", "1D"]);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(body.trendAgreement);
    expect(["High", "Moderate", "Low"]).toContain(body.confidenceLevel);
  });

  it("honestly reports a null dominantTrend/confluenceScore when the timeframes don't agree, never fabricating a winner", async () => {
    const res = await fetch(`${baseUrl}/api/trading/multi-timeframe/AAPL`);
    const body = (await res.json()) as MultiTimeframeResponse;
    if (body.trendAgreement === "split" || body.trendAgreement === "insufficient-data") {
      expect(body.dominantTrend).toBeNull();
      expect(body.confluenceScore).toBeNull();
    } else {
      expect(body.dominantTrend).not.toBeNull();
    }
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/trading/multi-timeframe/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await (await fetch(`${baseUrl}/api/trading/multi-timeframe/NVDA`)).json();
    const b = await (await fetch(`${baseUrl}/api/trading/multi-timeframe/NVDA`)).json();
    expect(a).toEqual(b);
  });
});

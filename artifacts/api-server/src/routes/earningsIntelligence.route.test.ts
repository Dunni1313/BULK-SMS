// Phase 2, Sprint 25 — live route integration test for
// GET /stock-analyst/earnings/:symbol. Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve to
// the legacy-owner stand-in per tenantScope.ts, and REQUIRE_AUTH is off by
// default), exercising the SIMULATED path end-to-end over real HTTP. Live
// FMP/Alpha Vantage verification is explicitly DEFERRED — this test never
// configures a live provider key.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

describe("GET /stock-analyst/earnings/:symbol (live, SIMULATED path)", () => {
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

  it("returns 8 quarters of SIMULATED earnings intelligence for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/earnings/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      symbol: string;
      dataSource: string;
      quarters: unknown[];
      confidenceLevel: string;
      epsBeatRate: number | null;
    };
    expect(body.symbol).toBe("AAPL");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.quarters).toHaveLength(8);
    expect(body.confidenceLevel).toBe("High");
    expect(body.epsBeatRate).not.toBeNull();
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/earnings/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unknown symbol/i);
  });

  it("never triggers an earnings-intelligence fetch from the main value-research report", async () => {
    // Sanity check on the scope-discipline decision: the main report endpoint
    // still responds normally and carries no earnings-shaped field —
    // buildValueResearchReport() was never touched this sprint.
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("earningsIntelligence");
    expect(body).not.toHaveProperty("quarters");
    expect(body).not.toHaveProperty("epsBeatRate");
  });
});

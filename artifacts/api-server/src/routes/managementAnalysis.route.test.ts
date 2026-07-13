// Phase 2, Sprint 23 — live route integration test for
// GET /stock-analyst/management-quality/:symbol. Uses the real app + a real
// Postgres connection (unauthenticated requests resolve to the legacy-owner
// stand-in per tenantScope.ts). The document fetch goes through the real
// EdgarDocumentProvider, which will fail against the real SEC API in this
// session (data.sec.gov is unreachable via this environment's proxy) — this
// test asserts the route's honest degradation path, not a successful live
// EDGAR fetch. Live EDGAR verification is explicitly DEFERRED (same as
// Sprint 22's own route test).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { db, investingFilingAnalysisTable } from "@workspace/db";
import { eq } from "drizzle-orm";

describe("GET /stock-analyst/management-quality/:symbol (live route, EDGAR unreachable in this session)", () => {
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

  it("returns 200 with 9 dimensions and reused financial dimensions populated for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      symbol: string;
      dimensions: { dimension: string; score: number | null }[];
      confidenceLevel: string;
    };
    expect(body.symbol).toBe("AAPL");
    expect(body.dimensions.length).toBe(9);
    const capitalAllocation = body.dimensions.find((d) => d.dimension === "Capital Allocation Discipline")!;
    expect(capitalAllocation.score).not.toBeNull();
    expect(body.confidenceLevel).toBe("Low");
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unknown symbol/i);
  });

  it("does not write any investing_filing_analysis row — persist:false is honored", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/NVDA`);
    expect(res.status).toBe(200);
    const rows = await db.select().from(investingFilingAnalysisTable).where(eq(investingFilingAnalysisTable.symbol, "NVDA"));
    // Unlike /filings/:symbol (Sprint 22), which does persist, this route
    // always calls buildFilingAnalysis() with persist:false and must never
    // add a row for a symbol only ever queried through this endpoint.
    expect(rows.length).toBe(0);
  });

  it("never triggers a management-quality computation from the main value-research report", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("dimensions");
    expect(body).not.toHaveProperty("confidenceExplanation");
  });
});

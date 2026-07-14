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

  // Phase 4, Sprint 60 — the new ?documentType= query override, plumbed
  // through to buildFilingAnalysis() exactly like /filings/:symbol's own.
  it("honors ?documentType=10-Q — the Risk Acknowledgement dimension still reuses the same 'riskFactors' section key", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/AMD?documentType=10-Q`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dimensions: { dimension: string }[] };
    expect(body.dimensions.length).toBe(9);
    expect(body.dimensions.some((d) => d.dimension === "Risk Acknowledgement")).toBe(true);
  });

  it("returns 400 for an invalid ?documentType= value, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/AAPL?documentType=not-a-real-type`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid documenttype/i);
  });

  // Phase 4, Sprint 63 — Shareholder Alignment is now filled deterministically
  // (Sprint 24's insiderOwnershipPct/sharesOutstandingChange5y data), live,
  // over real HTTP, for the SIMULATED path — no EDGAR dependency at all.
  it("Shareholder Alignment is now scored (Sprint 63), reusing Investment Quality's own Insider Ownership/Share Dilution metrics", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/ORCL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dimensions: { dimension: string; score: number | null; detail: string }[] };
    const dim = body.dimensions.find((d) => d.dimension === "Shareholder Alignment")!;
    expect(dim.score).not.toBeNull();
    expect(dim.detail).toContain("Insider Ownership");
  });

  // Communication Quality/Long-Term Focus are honestly unavailable, live,
  // over real HTTP, in this session — no LLM key AND EDGAR unreachable
  // (either alone would already cause this), never a fabricated score.
  it("Communication Quality and Long-Term Focus are honestly unavailable — never a fabricated score — in this live, key-less session", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/CRM`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dimensions: { dimension: string; score: number | null; reason?: string }[] };
    for (const name of ["Communication Quality", "Long-Term Focus"]) {
      const dim = body.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toBeTruthy();
    }
  });

  it("never triggers a management-quality computation from the main value-research report", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("dimensions");
    expect(body).not.toHaveProperty("confidenceExplanation");
  });
});

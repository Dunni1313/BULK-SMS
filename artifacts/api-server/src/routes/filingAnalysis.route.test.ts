// Phase 2, Sprint 22 — live route integration test for
// GET /stock-analyst/filings/:symbol. Uses the real app + a real Postgres
// connection (persistence is exercised here since the route always resolves a
// real userId via getScopedUserId — unauthenticated requests resolve to the
// legacy-owner stand-in, and REQUIRE_AUTH is off by default). The document
// fetch itself goes through the real EdgarDocumentProvider, which will fail
// against the real SEC API in this session (data.sec.gov is unreachable via
// this environment's proxy) — this test asserts the route's honest
// degradation path (200 with documentAvailable:false), not a successful live
// EDGAR fetch. Live EDGAR verification is explicitly DEFERRED.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { db, investingFilingAnalysisTable } from "@workspace/db";
import { eq } from "drizzle-orm";

describe("GET /stock-analyst/filings/:symbol (live route, EDGAR unreachable in this session)", () => {
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

  it("returns 200 with an honest documentAvailable:false and populated financial highlights for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/MSFT`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      symbol: string;
      documentAvailable: boolean;
      sections: { found: boolean }[];
      keyFinancialHighlights: unknown[];
      confidenceLevel: string;
    };
    expect(body.symbol).toBe("MSFT");
    expect(body.documentAvailable).toBe(false);
    expect(body.sections.every((s) => !s.found)).toBe(true);
    expect(body.keyFinancialHighlights.length).toBeGreaterThan(0);
    expect(body.confidenceLevel).toBe("Low");
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unknown symbol/i);
  });

  it("persists a row to investing_filing_analysis, best-effort, without breaking the response", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/GOOGL`);
    expect(res.status).toBe(200);
    const rows = await db.select().from(investingFilingAnalysisTable).where(eq(investingFilingAnalysisTable.symbol, "GOOGL"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].filingType).toBe("10-K");
  });

  it("never triggers a filing fetch from the main value-research report", async () => {
    // Sanity check on the scope-discipline decision: the main report endpoint
    // still responds normally and carries no filing-shaped field —
    // buildValueResearchReport() was never touched this sprint.
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // body.sections is the report's own pre-existing list of report sections
    // (since Sprint 12) — unrelated to Document Intelligence's document
    // sections, so it's deliberately NOT asserted absent here.
    expect(body).not.toHaveProperty("executiveSummary");
    expect(body).not.toHaveProperty("documentAvailable");
  });
});

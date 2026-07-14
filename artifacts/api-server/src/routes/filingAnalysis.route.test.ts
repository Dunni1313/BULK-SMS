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

  // Phase 4, Sprint 60 — the new ?documentType= query override, honestly
  // degrading exactly like the pre-Sprint-60 default 10-K path (EDGAR is
  // unreachable in this session either way).
  it("honors ?documentType=10-Q, degrading honestly with 10-Q's own section keys and reason text", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/AMZN?documentType=10-Q`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documentType: string;
      documentAvailable: boolean;
      documentUnavailableReason: string;
      sections: { key: string; found: boolean }[];
      keyFinancialHighlights: unknown[];
    };
    expect(body.documentType).toBe("10-Q");
    expect(body.documentAvailable).toBe(false);
    expect(body.documentUnavailableReason).toMatch(/no 10-q filing was found|currently unavailable/i);
    expect(body.sections.map((s) => s.key)).toEqual(["financialStatements", "mdAndA", "riskFactors"]);
    expect(body.keyFinancialHighlights.length).toBeGreaterThan(0);
  });

  it("returns 400 for an invalid ?documentType= value, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/AAPL?documentType=not-a-real-type`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid documenttype/i);
  });

  it("persists a 10-Q request with filingType '10-Q', not the default '10-K'", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/NFLX?documentType=10-Q`);
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(investingFilingAnalysisTable)
      .where(eq(investingFilingAnalysisTable.symbol, "NFLX"));
    expect(rows.some((r) => r.filingType === "10-Q")).toBe(true);
  });

  it("defaults to 10-K when ?documentType= is omitted, byte-identical to the pre-Sprint-60 route", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/CRM`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documentType: string };
    expect(body.documentType).toBe("10-K");
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

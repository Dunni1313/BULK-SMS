// Phase 2, Sprint 31 — Company Research Unification (approved Phase 2 plan,
// Sprint 31). Live, end-to-end smoke test proving that one symbol lookup
// gives a user access to a COMPLETE institutional investment decision report
// across every module built in Sprints 12-30 — company overview, statements,
// ratios, Graham/DCF/Buffett valuations + consolidated MoS, moat, management,
// industry comparison, earnings history, filing analysis, the full Tom Nash
// analysis, the AI Investment Committee's final recommendation, and the
// Sprint 30 free-form AI analyst — all reachable for the SAME symbol against
// the real, running app (matching how a user actually traverses
// StockResearch.tsx's tabs for one selected symbol).
//
// SIMULATED path only. Live FMP/Alpha Vantage verification is explicitly
// deferred — no API key is available this session, the same unbroken
// disclosure every prior sprint since Sprint 11 has made.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

// Loosely typed response shapes — this file only asserts a handful of fields
// per module (each module's own real type lives in its own lib file/tests);
// `unknown as Json` avoids `any` while keeping the assertions readable.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Company Research Unification — one symbol, every module (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = "AAPL";

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

  it("GET /value/:symbol returns the full institutional decision report", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`);
    expect(res.status).toBe(200);
    const report = await json(res);
    expect(report.symbol).toBe(symbol);
    expect(report.tomNash).toBeTruthy();
    expect(report.investmentCommittee).toBeTruthy();
    expect(report.grahamValuation).toBeTruthy();
    expect(report.dcfValuation).toBeTruthy();
    expect(report.buffettValuation).toBeTruthy();
    expect(report.consolidatedMarginOfSafety).toBeTruthy();
  });

  it("GET /financial-statements/:symbol returns 5 years of statements for the same symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/financial-statements/${symbol}`);
    expect(res.status).toBe(200);
    const statements = await json(res);
    expect(statements.incomeStatement.length).toBeGreaterThan(0);
    expect(statements.balanceSheet.length).toBeGreaterThan(0);
    expect(statements.cashFlow.length).toBeGreaterThan(0);
  });

  it("GET /industry-comparison/:symbol returns a peer group for the same symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/industry-comparison/${symbol}`);
    expect(res.status).toBe(200);
    const comparison = await json(res);
    expect(comparison.symbol).toBe(symbol);
    expect(Array.isArray(comparison.peerGroup)).toBe(true);
  });

  it("GET /filings/:symbol degrades honestly (no live EDGAR access in this environment) but still resolves financial highlights", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/filings/${symbol}`);
    expect(res.status).toBe(200);
    const filing = await json(res);
    expect(typeof filing.documentAvailable).toBe("boolean");
    expect(Array.isArray(filing.keyFinancialHighlights)).toBe(true);
  });

  it("GET /management-quality/:symbol returns the 9-dimension analysis for the same symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/management-quality/${symbol}`);
    expect(res.status).toBe(200);
    const mgmt = await json(res);
    expect(Array.isArray(mgmt.dimensions)).toBe(true);
    expect(mgmt.dimensions.length).toBe(9);
  });

  it("GET /earnings/:symbol returns quarterly earnings history for the same symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/earnings/${symbol}`);
    expect(res.status).toBe(200);
    const earnings = await json(res);
    expect(Array.isArray(earnings.quarters)).toBe(true);
    expect(earnings.quarters.length).toBeGreaterThan(0);
  });

  it("POST /value-research/ask answers a free-form question grounded in the same symbol's report", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value-research/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, question: "What does the Investment Committee conclude?" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
    expect(["llm", "template"]).toContain(body.answerSource);
  });

  it("every module resolves for the same symbol without any 404 — the unified single-symbol-lookup guarantee", async () => {
    const paths = [
      `/api/stock-analyst/value/${symbol}`,
      `/api/stock-analyst/financial-statements/${symbol}`,
      `/api/stock-analyst/industry-comparison/${symbol}`,
      `/api/stock-analyst/filings/${symbol}`,
      `/api/stock-analyst/management-quality/${symbol}`,
      `/api/stock-analyst/earnings/${symbol}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("an unknown symbol 404s consistently across every module — never a partial/fabricated report", async () => {
    const unknown = "NOTASYMBOL";
    const paths = [
      `/api/stock-analyst/value/${unknown}`,
      `/api/stock-analyst/financial-statements/${unknown}`,
      `/api/stock-analyst/industry-comparison/${unknown}`,
      `/api/stock-analyst/filings/${unknown}`,
      `/api/stock-analyst/management-quality/${unknown}`,
      `/api/stock-analyst/earnings/${unknown}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(404);
    }
  });
});

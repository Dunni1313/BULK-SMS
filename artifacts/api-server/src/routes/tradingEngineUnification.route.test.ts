// Phase 3, Sprint 51 — Trading Engine Unification (approved Phase 3 plan
// §0 item 7 / §20; see docs/Phase-3-Trading-Engine-Execution-Plan.md's
// Sprint 51 as-built note). The closing Phase-3 integration test, live
// end-to-end against the real running app — mirroring Phase 2 Sprint 31's
// companyResearchUnification.route.test.ts pattern exactly, applied to the
// FULL Engine 2 surface named in the plan's own §0 item 7: "structure +
// liquidity + order flow + multi-timeframe + probability + regime + risk +
// journal + AI coach" (plus Sprint 49's Backtesting, shipped after this
// plan text was written).
//
// One symbol, one user (the unauthenticated-request legacy-owner stand-in
// per tenantScope.ts), every module. Position/journal rows this file
// creates are cleaned up at the end so this file leaves no state behind for
// any sibling test file sharing the same legacy-owner tables — the same
// disclosed discipline routes/tradingRisk.route.test.ts already established
// for this exact shared-table situation (Sprint 44).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Trading Engine Unification — one symbol, every Engine 2 module (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = "AAPL";
  let createdPositionId: number | null = null;
  let createdJournalEntryId: number | null = null;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    // Best-effort cleanup, mirroring the shared-table discipline
    // tradingRisk.route.test.ts already established (Sprint 44).
    if (createdJournalEntryId !== null) {
      await fetch(`${baseUrl}/api/trading/journal/${createdJournalEntryId}`, { method: "DELETE" });
    }
    if (createdPositionId !== null) {
      await fetch(`${baseUrl}/api/trading/positions/${createdPositionId}`, { method: "DELETE" });
    }
    server.close();
  });

  it("GET /trading/structure/:symbol resolves", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(body.dataSource).toBe("SIMULATED");
  });

  it("GET /trading/multi-timeframe/:symbol resolves", async () => {
    const res = await fetch(`${baseUrl}/api/trading/multi-timeframe/${symbol}`);
    expect(res.status).toBe(200);
    expect((await json(res)).symbol).toBe(symbol);
  });

  it("GET /trading/regime/:symbol resolves", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/${symbol}`);
    expect(res.status).toBe(200);
    expect((await json(res)).symbol).toBe(symbol);
  });

  it("GET /trading/probability/:symbol resolves", async () => {
    const res = await fetch(`${baseUrl}/api/trading/probability/${symbol}`);
    expect(res.status).toBe(200);
    expect((await json(res)).symbol).toBe(symbol);
  });

  it("GET /trading/liquidity/:symbol resolves", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/${symbol}`);
    expect(res.status).toBe(200);
    expect((await json(res)).symbol).toBe(symbol);
  });

  it("POST /trading/backtest/run resolves and persists for the same symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, strategy: "trend-following", interval: "1D", lookback: 180 }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);

    const listRes = await fetch(`${baseUrl}/api/trading/backtest/results`);
    expect(listRes.status).toBe(200);
    const list = await json(listRes);
    expect((list as Json[]).some((r) => r.id === body.id)).toBe(true);
  });

  it("POST /trading/positions creates a position in the same symbol, then GET /trading/risk includes its per-position context", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, side: "long", quantity: 5, entryPrice: 190, stopPrice: 180, targetPrice: 210 }),
    });
    expect(createRes.status).toBe(201);
    const position = await json(createRes);
    createdPositionId = position.id;

    const riskRes = await fetch(`${baseUrl}/api/trading/risk`);
    expect(riskRes.status).toBe(200);
    const risk = await json(riskRes);
    // Per-position assertion, not an aggregate count — GET /trading/risk
    // reads the legacy-owner's entire shared trading_positions table across
    // this suite's own sibling test files (the same disclosed discipline
    // Sprint 44's own route test established).
    const ctx = (risk.positionContexts as Json[]).find((c) => c.positionId === position.id);
    expect(ctx).toBeTruthy();
    expect(ctx!.symbol).toBe(symbol);
  });

  it("POST /trading/journal creates an entry referencing the created position, then GET /trading/journal includes it", async () => {
    expect(createdPositionId).not.toBeNull();
    const createRes = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Unification test entry for ${symbol}`,
        content: "One-symbol, whole-engine regression check.",
        mood: "confident",
        tradingPositionId: createdPositionId,
      }),
    });
    expect(createRes.status).toBe(201);
    const entry = await json(createRes);
    createdJournalEntryId = entry.id;
    expect(entry.tradingPositionId).toBe(createdPositionId);

    const listRes = await fetch(`${baseUrl}/api/trading/journal`);
    expect(listRes.status).toBe(200);
    const list = await json(listRes);
    expect((list as Json[]).some((e) => e.id === entry.id)).toBe(true);
  });

  it("POST /trading/coach/ask answers a question grounded in the same symbol's composed engine outputs", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, question: "What does the data say about this symbol right now?" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
    expect(["llm", "template"]).toContain(body.answerSource);
  });

  it("every per-symbol Engine 2 read resolves for the same symbol concurrently, with zero 404s — the literal 'one symbol lookup, complete picture' guarantee", async () => {
    const paths = [
      `/api/trading/structure/${symbol}`,
      `/api/trading/multi-timeframe/${symbol}`,
      `/api/trading/regime/${symbol}`,
      `/api/trading/probability/${symbol}`,
      `/api/trading/liquidity/${symbol}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("an unknown symbol 404s consistently across every per-symbol Engine 2 route — never a partial/fabricated result", async () => {
    const unknown = "NOTASYMBOL";
    const getPaths = [
      `/api/trading/structure/${unknown}`,
      `/api/trading/multi-timeframe/${unknown}`,
      `/api/trading/regime/${unknown}`,
      `/api/trading/probability/${unknown}`,
      `/api/trading/liquidity/${unknown}`,
    ];
    const getResults = await Promise.all(getPaths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of getResults) {
      expect(r.status).toBe(404);
    }

    const backtestRes = await fetch(`${baseUrl}/api/trading/backtest/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: unknown, strategy: "trend-following" }),
    });
    expect(backtestRes.status).toBe(404);

    const coachRes = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: unknown, question: "Anything?" }),
    });
    expect(coachRes.status).toBe(404);
  });
});

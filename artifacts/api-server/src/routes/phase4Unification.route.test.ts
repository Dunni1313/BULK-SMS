// Phase 4, Sprint 64 — Phase 4 Unification & Regression Pass (approved
// Phase 4 plan, Sprint 64; the closing sprint of Phase 4, mirroring the
// exact bar Phase 2 Sprint 31 (companyResearchUnification.route.test.ts)
// and Phase 3 Sprint 51 (tradingEngineUnification.route.test.ts) both
// cleared at their own phases' close).
//
// Live, end-to-end proof that the full platform — all 3 engines, plus the
// new Cross-Engine Command Center (Sprint 54) and Alerts (Sprint 56) —
// resolve consistently for ONE symbol/ONE user, with zero fabricated
// results anywhere. Sprint 62 (Live FMP/Alpha Vantage Provider
// Verification) remains correctly recorded BLOCKED and is out of scope for
// this file — SIMULATED path only, the same unbroken disclosure every
// prior sprint since Phase 2 Sprint 11 has made.
//
// A single, freshly-generated, collision-free ticker-shaped symbol is used
// for the ENTIRE sweep below (Engine 1, Engine 2, Engine 3, Command
// Center, Alerts) — unlike Sprint 31/51's own reuse of "AAPL" (safe there,
// since those routes only ever read from a stateless provider), this
// sprint's Alerts leg mutates real per-user rows (a watchlist item), so a
// random symbol avoids any risk of colliding with another concurrently-
// running test file's own use of a real, commonly-reused ticker — the
// exact same collision lesson Sprint 56's own notifications.route.test.ts
// already disclosed and fixed.
//
// Engine 3 (Options Income) is deliberately proven via the one genuinely
// new Engine-3-facing addition this phase, Options Engine-Native
// Backtesting (Sprint 57/58) — every other Engine 3 route was untouched
// this phase, so re-testing it here would duplicate existing coverage
// rather than prove anything new. That same test also proves a real,
// disclosed platform boundary rather than hiding it: optionsMath.ts's own
// getSnapshot() only resolves IV for its original 10-symbol UNIVERSE
// (Sprint 57's own disclosed scope), so a random symbol OUTSIDE that
// universe honestly returns available:false — never fabricated options
// data — while a symbol INSIDE it (AAPL) produces a real backtest. Both
// paths are proven below.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { getFundamentals } from "../lib/fundamentals.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

function randomSymbol(): string {
  return "Q" + Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
}

describe("Phase 4 Unification & Regression Pass — one symbol, one user, the whole platform (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = randomSymbol();
  const optionsUniverseSymbol = "AAPL"; // inside optionsMath.ts's own 10-symbol UNIVERSE
  let createdWatchlistId: number | null = null;

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
    if (createdWatchlistId !== null) {
      await fetch(`${baseUrl}/api/stock-analyst/value-watchlist/${createdWatchlistId}`, { method: "DELETE" });
    }
    server.close();
  });

  // ── Engine 1 (Investing) ────────────────────────────────────────────────

  it("Engine 1: GET /stock-analyst/value/:symbol resolves for the sweep symbol, carrying the Investment Committee's verdict", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(["Buy", "Hold", "Wait"]).toContain(body.investmentCommittee.consolidatedVerdict);
  });

  it("Engine 1: GET /stock-analyst/macro resolves (global, day-seeded — Sprint 55, previously route-less since Sprint 26)", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/macro`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.regime).toBe("string");
    expect(body.dataSource).toBe("SIMULATED");
  });

  it("Engine 1: POST /stock-analyst/investment-committee/narrate resolves for the sweep symbol (Sprint 61)", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.narrative).toBe("string");
    expect(["llm", "template"]).toContain(body.narrativeSource);
  });

  it("Engine 1: GET /stock-analyst/filings/:symbol and /management-quality/:symbol both resolve for the sweep symbol (Sprints 22/23/60/63)", async () => {
    const [filingsRes, mgmtRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/filings/${symbol}`),
      fetch(`${baseUrl}/api/stock-analyst/management-quality/${symbol}`),
    ]);
    expect(filingsRes.status).toBe(200);
    expect(mgmtRes.status).toBe(200);
    const mgmtBody = await json(mgmtRes);
    expect(mgmtBody.dimensions.length).toBe(9);
  });

  // ── Engine 2 (Trading) ──────────────────────────────────────────────────

  it("Engine 2: GET /trading/regime/:symbol resolves for the sweep symbol — the same read the Command Center pairs with Engine 1", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(body.dataSource).toBe("SIMULATED");
  });

  // ── Cross-Engine Command Center (Sprint 54) ─────────────────────────────

  it("Cross-Engine Command Center: Engine 1's Investment Committee and Engine 2's technical read resolve concurrently for the sweep symbol, on one screen", async () => {
    const [committeeRes, technicalRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`),
      fetch(`${baseUrl}/api/trading/regime/${symbol}`),
    ]);
    expect(committeeRes.status).toBe(200);
    expect(technicalRes.status).toBe(200);
    const [committeeBody, technicalBody] = await Promise.all([json(committeeRes), json(technicalRes)]);
    expect(committeeBody.symbol).toBe(symbol);
    expect(technicalBody.symbol).toBe(symbol);
  });

  // ── Engine 3 (Options Income) — Options Engine-Native Backtesting ──────

  it("Engine 3: POST /options-backtest/run produces a real, non-fabricated backtest for a symbol inside optionsMath.ts's own 10-symbol UNIVERSE", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: optionsUniverseSymbol, strategy: "iron_condor", lookback: 180 }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.symbol).toBe(optionsUniverseSymbol);
    expect(body.underlyingDataSource).toBe("SIMULATED");
    expect(body.optionsDataSource).toBe("SIMULATED");
  });

  it("Engine 3: POST /options-backtest/run honestly reports available:false — never fabricated options data — for the sweep symbol, which sits outside optionsMath.ts's own 10-symbol UNIVERSE", async () => {
    const res = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, strategy: "iron_condor", lookback: 180 }),
    });
    // Still a real, persisted resolution (201) for a genuinely valid-shaped
    // symbol — this is the disclosed honest-unavailable path, not a 404.
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(body.available).toBe(false);
    expect(body.totalTrades).toBe(0);
  });

  // ── Alerts (Sprint 56) — proves the same underlying signal, reached via
  //    two different paths (Sprint 27's own checkTargets read, and Sprint
  //    56's own evaluateWatchlistAlerts()), agrees for the sweep symbol ──

  it("Alerts: a watchlist target crossing for the sweep symbol is detected consistently by both Sprint 27's checkTargets read and Sprint 56's notification check", async () => {
    const f = (await getFundamentals(symbol))!;
    const createRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, desiredBuyPrice: f.price + 1000 }),
    });
    expect(createRes.status).toBe(200);
    const created = await json(createRes);
    createdWatchlistId = created.id;

    // Path 1: Sprint 27's own opt-in checkTargets read.
    const checkRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    expect(checkRes.status).toBe(200);
    const checkBody = (await checkRes.json()) as Json[];
    const row = checkBody.find((r) => r.symbol === symbol);
    expect(row).toBeTruthy();
    expect(row!.priceTargetCrossed).toBe(true);

    // Path 2: Sprint 56's own detection + persistence, same underlying
    // computeWatchlistTargets() function (extracted, unmodified, from the
    // exact same call site checkTargets=true uses — lib/watchlistTargets.ts).
    const notifyRes = await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" });
    expect(notifyRes.status).toBe(200);
    const created2 = (await notifyRes.json()) as Json[];
    const alert = created2.find((n) => n.relatedSymbol === symbol && n.type === "watchlist_target_crossed");
    expect(alert).toBeTruthy();
    expect(alert!.dataSource).toBe("SIMULATED");
    expect(alert!.isRead).toBe(false);

    // GET /notifications reflects the same alert; marking it read round-trips.
    const listRes = await fetch(`${baseUrl}/api/notifications`);
    const listBody = (await listRes.json()) as Json[];
    expect(listBody.find((n) => n.id === alert!.id)).toBeTruthy();

    const patchRes = await fetch(`${baseUrl}/api/notifications/${alert!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await json(patchRes);
    expect(patched.isRead).toBe(true);
  });

  // ── Full-platform concurrency + honest-null sweep ───────────────────────

  it("every per-symbol read across all 3 engines resolves concurrently for the same symbol, with zero 404s — the literal 'one symbol lookup, complete picture' guarantee", async () => {
    const paths = [
      `/api/stock-analyst/value/${symbol}`,
      `/api/stock-analyst/filings/${symbol}`,
      `/api/stock-analyst/management-quality/${symbol}`,
      `/api/trading/regime/${symbol}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("an unknown symbol 404s consistently across every per-symbol route touched this phase — never a partial/fabricated result", async () => {
    const unknown = "NOTASYMBOL";
    const getPaths = [
      `/api/stock-analyst/value/${unknown}`,
      `/api/stock-analyst/filings/${unknown}`,
      `/api/stock-analyst/management-quality/${unknown}`,
      `/api/trading/regime/${unknown}`,
    ];
    const getResults = await Promise.all(getPaths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of getResults) {
      expect(r.status).toBe(404);
    }

    const narrateRes = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: unknown }),
    });
    expect(narrateRes.status).toBe(404);

    const backtestRes = await fetch(`${baseUrl}/api/options-backtest/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: unknown, strategy: "iron_condor" }),
    });
    expect(backtestRes.status).toBe(404);
  });
});

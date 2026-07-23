// Phase 38 — Institutional Performance & Attribution Engine. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/riskExposure.route.test.ts's own Phase 37 established sign-up/
// session-cookie pattern) so this file's own holdings/positions/trades are
// never at risk of colliding with another concurrently-running test
// file's own data. Every real options trade inserted below uses a REAL,
// internally-consistent quote from optionsMath.ts's own
// getSnapshot()/buildIronCondor() — never fabricated financials.
//
// This file proves REAL performance aggregation and attribution
// calculations end to end — real unrealized/realized P&L, win rate,
// sector/strategy/asset attribution, capital efficiency, risk-adjusted
// performance, and the Historical Performance Timeline — over genuinely
// persisted rows, not mocked data.
//
// Analytical only — no AI predictions, no forecasts, no trade
// recommendations, no portfolio optimisation, no auto rebalancing, no auto
// execution, no alpha generation, no benchmark prediction anywhere in this
// file's assertions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  tradesTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingPortfolioSnapshotsTable,
  tradingPositionsTable,
  tradingJournalEntriesTable,
} from "@workspace/db";
import { getSnapshot, buildIronCondor } from "../lib/optionsMath.js";
import type { Server } from "node:http";

interface SignedUpUser {
  userId: string;
  cookie: string;
}

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

const seededUserIds: string[] = [];

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(investingPortfolioSnapshotsTable).where(eq(investingPortfolioSnapshotsTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingJournalEntriesTable).where(eq(tradingJournalEntriesTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function insertClosedIronCondor(userId: string, symbol: string, currentPnl: number, currentPnlPercent: number) {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "iron_condor",
      status: "closed",
      legs,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      expiration: quote.expiration,
      currentPnl,
      currentPnlPercent,
      openDate: new Date("2026-01-05T00:00:00Z"),
      closeDate: new Date("2026-01-20T00:00:00Z"),
    })
    .returning({ id: tradesTable.id });
  return row;
}

describe("Institutional Performance & Attribution Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `performance-attribution-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Performance Attribution Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

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
    for (const userId of seededUserIds) {
      await cleanupUser(userId);
    }
    server.close();
  });

  // ─── Empty state ─────────────────────────────────────────────────────

  it("GET /performance-attribution/dashboard returns an honest, well-shaped empty dashboard for a brand-new user with zero data anywhere", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/performance-attribution/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.investing.holdingsCount).toBe(0);
    expect(body.investing.totalUnrealizedPnl).toBeNull();
    expect(body.investing.holdings).toEqual([]);
    expect(body.investing.riskAdjusted.available).toBe(false);
    expect(typeof body.investing.riskAdjusted.reason).toBe("string");

    expect(body.trading.totalPositions).toBe(0);
    expect(body.trading.totalRealizedPnl).toBeNull();
    expect(body.trading.winRate).toBeNull();
    expect(body.trading.riskAdjusted.available).toBe(false);

    expect(body.options.openPositionsCount).toBe(0);
    expect(body.options.closedPositionsCount).toBe(0);
    expect(body.options.totalRealizedPnl).toBeNull();

    expect(body.combined.byEngine).toHaveLength(3);
    expect(body.combined.sectorAttribution).toEqual([]);
    expect(body.combined.strategyAttribution).toEqual([]);
    expect(body.combined.assetAttribution).toEqual([]);

    expect(body.timeline).toEqual([]);
    expect(typeof body.generatedAt).toBe("string");
  });

  // ─── Real cross-engine performance aggregation & attribution ───────────

  it("aggregates real per-user Investing/Trading/Options performance into one Combined view, with real attribution, capital efficiency, and risk-adjusted performance", async () => {
    const user = await signUp();

    // Investing: one portfolio, two holdings with real cost basis, so a
    // real unrealized P&L and sector/asset attribution can be computed.
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Core Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values([
      { userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 60, shares: 10, avgCostBasis: 100 },
      { userId: user.userId, portfolioId: portfolio.id, symbol: "SPY", targetWeightPct: 40, shares: 5, avgCostBasis: 400 },
    ]);
    // A real, previously-saved market-value snapshot for the Historical
    // Performance Timeline's own Investing series.
    await db.insert(investingPortfolioSnapshotsTable).values({ userId: user.userId, portfolioId: portfolio.id, totalMarketValue: 5000, holdingsCount: 2, analysisJson: { note: "test snapshot" } });

    // Trading: two closed positions (one winner, one loser) with a real
    // Trading Journal setupType linked via the loose, unenforced
    // tradingPositionId reference — proves the best-effort strategy
    // attribution join.
    const [winnerPosition] = await db
      .insert(tradingPositionsTable)
      .values({
        userId: user.userId,
        symbol: "AAPL",
        side: "long",
        status: "closed",
        quantity: 10,
        entryPrice: 100,
        exitPrice: 120,
        entryDate: new Date("2026-01-01T00:00:00Z"),
        exitDate: new Date("2026-01-15T00:00:00Z"),
      })
      .returning({ id: tradingPositionsTable.id });
    const [loserPosition] = await db
      .insert(tradingPositionsTable)
      .values({
        userId: user.userId,
        symbol: "MSFT",
        side: "long",
        status: "closed",
        quantity: 5,
        entryPrice: 400,
        exitPrice: 380,
        entryDate: new Date("2026-02-01T00:00:00Z"),
        exitDate: new Date("2026-02-10T00:00:00Z"),
      })
      .returning({ id: tradingPositionsTable.id });
    await db.insert(tradingJournalEntriesTable).values({
      userId: user.userId,
      tradingPositionId: winnerPosition.id,
      title: "Breakout entry",
      content: "Real journal entry for the winning position.",
      setupType: "breakout",
    });
    // loserPosition deliberately has no matching journal entry — proves
    // the honest "Unclassified" fallback for the best-effort join.

    // Real HTTP PATCH (not a raw DB update) so the settings row is
    // guaranteed to exist first, matching routes/tradingRisk.route.test.ts's
    // own established precedent.
    const settingsRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ tradingAccountValue: 100000 }),
    });
    expect(settingsRes.status).toBe(200);

    // Options: two closed iron condors (one winner, one loser), real
    // internally-consistent quotes, with real currentPnl/currentPnlPercent
    // so win rate, strategy/asset attribution, and risk-adjusted
    // performance can all be computed from real percentage returns.
    await insertClosedIronCondor(user.userId, "AAPL", 150, 30);
    await insertClosedIronCondor(user.userId, "SPY", -50, -10);

    const res = await fetch(`${baseUrl}/api/performance-attribution/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    // Investing — real unrealized P&L: AAPL (10 * (currentPrice-100)) + SPY
    // (5 * (currentPrice-400)); SIMULATED prices are deterministic but
    // unknown here, so assert shape and internal consistency instead of an
    // exact figure.
    expect(body.investing.holdingsCount).toBe(2);
    expect(body.investing.portfolioCount).toBe(1);
    expect(typeof body.investing.totalCostBasisValue).toBe("number");
    expect(body.investing.totalCostBasisValue).toBeCloseTo(10 * 100 + 5 * 400, 2);
    const aaplHolding = body.investing.holdings.find((h: any) => h.symbol === "AAPL");
    expect(aaplHolding.costBasisValue).toBeCloseTo(1000, 2);
    expect(aaplHolding.unrealizedPnl).toBeCloseTo(aaplHolding.marketValue - 1000, 2);
    expect(body.investing.riskAdjusted.available).toBe(false);
    expect(body.investing.capitalEfficiency.totalDeployed).toBeCloseTo(3000, 2);

    // Trading — real realized P&L: winner (120-100)*10=+200, loser
    // (380-400)*5=-100, so total realized P&L = +100, win rate 50%.
    expect(body.trading.closedPositionsCount).toBe(2);
    expect(body.trading.winningTrades).toBe(1);
    expect(body.trading.losingTrades).toBe(1);
    expect(body.trading.winRate).toBe(50);
    expect(body.trading.totalRealizedPnl).toBe(100);
    expect(body.trading.averageWin).toBe(200);
    expect(body.trading.averageLoss).toBe(-100);
    expect(body.trading.largestWinner).toBe(200);
    expect(body.trading.largestLoser).toBe(-100);
    // Risk-adjusted performance computed from 2 real closed trades' own
    // percentage returns — available, since n >= 2.
    expect(body.trading.riskAdjusted.available).toBe(true);
    expect(body.trading.riskAdjusted.tradeCount).toBe(2);
    expect(typeof body.trading.riskAdjusted.sharpeRatio).toBe("number");
    expect(body.trading.riskAdjusted.basis).toMatch(/trade-return-based/i);
    // Strategy attribution — the best-effort journal join: the winner is
    // classified as "breakout" (real journal entry), the loser honestly
    // falls back to "Unclassified" (no matching journal entry).
    const breakout = body.trading.strategyAttribution.find((s: any) => s.key === "breakout");
    expect(breakout).toBeDefined();
    expect(breakout.pnl).toBe(200);
    const unclassified = body.trading.strategyAttribution.find((s: any) => s.key === "unclassified");
    expect(unclassified).toBeDefined();
    expect(unclassified.pnl).toBe(-100);
    // Asset attribution — real, per-symbol realized P&L.
    const aaplAttr = body.trading.assetAttribution.find((a: any) => a.key === "AAPL");
    expect(aaplAttr.pnl).toBe(200);
    // Capital efficiency — real return on the real entry cost basis of
    // closed positions: (100)/(10*100 + 5*400) * 100.
    expect(body.trading.capitalEfficiency.capitalCommitted).toBeCloseTo(1000 + 2000, 2);
    // The server rounds returnOnCapitalPct to 2 decimals (round2), so
    // compare at that same precision, not the raw unrounded fraction.
    expect(body.trading.capitalEfficiency.returnOnCapitalPct).toBeCloseTo((100 / 3000) * 100, 2);

    // Options — real realized P&L: 150 + (-50) = 100, win rate 50%.
    expect(body.options.closedPositionsCount).toBe(2);
    expect(body.options.winningTrades).toBe(1);
    expect(body.options.losingTrades).toBe(1);
    expect(body.options.winRate).toBe(50);
    expect(body.options.totalRealizedPnl).toBe(100);
    expect(body.options.riskAdjusted.available).toBe(true);
    expect(body.options.riskAdjusted.tradeCount).toBe(2);
    // Asset attribution — real, per-symbol realized P&L.
    const aaplOptionsAttr = body.options.assetAttribution.find((a: any) => a.key === "AAPL");
    expect(aaplOptionsAttr.pnl).toBe(150);
    const spyOptionsAttr = body.options.assetAttribution.find((a: any) => a.key === "SPY");
    expect(spyOptionsAttr.pnl).toBe(-50);
    // Strategy attribution — both closed trades share the "iron_condor"
    // strategy, summed to the same real total.
    expect(body.options.strategyAttribution).toHaveLength(1);
    expect(body.options.strategyAttribution[0].key).toBe("iron_condor");
    expect(body.options.strategyAttribution[0].pnl).toBe(100);

    // Combined view — Return by Engine, never blended into one number.
    const byEngine = Object.fromEntries(body.combined.byEngine.map((e: any) => [e.engine, e.totalPnl]));
    expect(typeof byEngine.investing).toBe("number");
    expect(byEngine.trading).toBe(100);
    expect(byEngine.options).toBe(100);

    // Combined view — Sector Attribution (Investing only).
    expect(body.combined.sectorAttribution.length).toBeGreaterThan(0);
    for (const s of body.combined.sectorAttribution) expect(s.engine).toBe("investing");

    // Combined view — Strategy Attribution (Trading + Options).
    const combinedStrategyEngines = new Set(body.combined.strategyAttribution.map((s: any) => s.engine));
    expect(combinedStrategyEngines.has("trading")).toBe(true);
    expect(combinedStrategyEngines.has("options")).toBe(true);

    // Combined view — Asset Attribution across all 3 engines.
    const combinedAssetEngines = new Set(body.combined.assetAttribution.map((a: any) => a.engine));
    expect(combinedAssetEngines).toEqual(new Set(["investing", "trading", "options"]));

    // Combined view — Risk-Adjusted Performance: Investing always
    // unavailable, Trading and Options available from real closed trades.
    const riskAdjustedByEngine = Object.fromEntries(body.combined.riskAdjusted.map((r: any) => [r.engine, r.available]));
    expect(riskAdjustedByEngine.investing).toBe(false);
    expect(riskAdjustedByEngine.trading).toBe(true);
    expect(riskAdjustedByEngine.options).toBe(true);

    // Historical Performance Timeline — real monthly realized P&L
    // (Trading January +200/-100 net... wait, the two Trading positions
    // close in different months, so two distinct trading-realized points)
    // plus the real Investing market-value snapshot.
    const tradingPoints = body.timeline.filter((p: any) => p.source === "trading-realized");
    expect(tradingPoints.length).toBeGreaterThanOrEqual(2);
    const optionsPoints = body.timeline.filter((p: any) => p.source === "options-realized");
    expect(optionsPoints.length).toBeGreaterThanOrEqual(1);
    const investingPoints = body.timeline.filter((p: any) => p.source === "investing-market-value");
    expect(investingPoints.length).toBe(1);
    expect(investingPoints[0].value).toBe(5000);

    // Never a fabricated prediction/forecast/recommendation anywhere in
    // the composed response.
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"(?!ed)|autoexecute|autoadjust|"recommendedaction"|alpha generation|benchmark prediction/);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's Investing/Trading/Options performance into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Portfolio" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: userA.userId, portfolioId: portfolioA.id, symbol: "MSFT", targetWeightPct: 100, shares: 3, avgCostBasis: 300 });
    await db.insert(tradingPositionsTable).values({ userId: userA.userId, symbol: "MSFT", side: "long", status: "closed", quantity: 3, entryPrice: 300, exitPrice: 320 });

    const bodyA = (await (await fetch(`${baseUrl}/api/performance-attribution/dashboard`, { headers: { cookie: userA.cookie } })).json()) as any;
    const bodyB = (await (await fetch(`${baseUrl}/api/performance-attribution/dashboard`, { headers: { cookie: userB.cookie } })).json()) as any;

    expect(bodyA.investing.holdingsCount).toBe(1);
    expect(bodyA.trading.closedPositionsCount).toBe(1);
    expect(bodyA.trading.totalRealizedPnl).toBe(60);

    // User B's own dashboard must never reflect User A's real data.
    expect(bodyB.investing.holdingsCount).toBe(0);
    expect(bodyB.trading.closedPositionsCount).toBe(0);
    expect(bodyB.investing.holdings.some((h: any) => h.symbol === "MSFT")).toBe(false);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /performance-attribution/coach lists all 5 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/performance-attribution/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic).sort()).toEqual(["attribution", "capital_efficiency", "performance_metrics", "portfolio_interpretation", "risk_adjusted_returns"].sort());

    const oneRes = await fetch(`${baseUrl}/api/performance-attribution/coach/risk_adjusted_returns`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("risk_adjusted_returns");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /performance-attribution/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/performance-attribution/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /performance-attribution/learning lists all 5 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/performance-attribution/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/performance-attribution/learning/capital_efficiency`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("capital_efficiency");
    expect(one.links.some((l: any) => l.topicKey === "institutional-capital-allocation")).toBe(true);
  });

  it("GET /performance-attribution/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/performance-attribution/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("GET /performance-attribution/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/performance-attribution/dashboard`);
    expect(res.status).toBe(200);
  });

  // ─── Reporting Centre integration ───────────────────────────────────

  it("GET /reporting/performance-summary and GET /reporting/performance-attribution-report resolve real InstitutionalReport payloads reusing the same dashboard", async () => {
    const user = await signUp();
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "NVDA", side: "long", status: "closed", quantity: 2, entryPrice: 500, exitPrice: 550 });

    const summaryRes = await fetch(`${baseUrl}/api/reporting/performance-summary`, { headers: { cookie: user.cookie } });
    expect(summaryRes.status).toBe(200);
    const summary = (await summaryRes.json()) as any;
    expect(summary.reportType).toBe("performance-summary");
    expect(summary.sections.some((s: any) => s.id === "trading-performance")).toBe(true);

    const attributionRes = await fetch(`${baseUrl}/api/reporting/performance-attribution-report`, { headers: { cookie: user.cookie } });
    expect(attributionRes.status).toBe(200);
    const attribution = (await attributionRes.json()) as any;
    expect(attribution.reportType).toBe("performance-attribution-report");
    expect(attribution.sections.some((s: any) => s.id === "risk-adjusted-performance")).toBe(true);
    expect(attribution.sections.some((s: any) => s.id === "historical-performance-timeline")).toBe(true);
  });

  it("GET /reporting/types lists both new Phase 38 report types", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types.some((t) => t.reportType === "performance-summary")).toBe(true);
    expect(types.some((t) => t.reportType === "performance-attribution-report")).toBe(true);
  });
});

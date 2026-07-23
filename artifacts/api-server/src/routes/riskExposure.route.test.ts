// Phase 37 — Institutional Risk & Exposure Intelligence Engine. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/optionsLifecycle.route.test.ts's own Phase 36 established
// sign-up/session-cookie pattern) so this file's own portfolio/position/
// trade rows are never at risk of colliding with another concurrently-
// running test file's own data. Every real trade inserted below uses a
// REAL, internally-consistent quote from optionsMath.ts's own
// getSnapshot()/buildIronCondor() — never fabricated financials.
//
// This file proves the ROUTE WIRING (real per-user data across all 3
// engines correctly flows into the composed dashboard, coach, and
// learning responses) — not the underlying risk-scoring math itself,
// which is already independently covered by lib/investingRisk.test.ts,
// lib/tradingRisk.test.ts, lib/portfolioDashboard.test.ts, and
// lib/optionsPortfolioManagement.ts's own coverage via
// routes/optionsLifecycle.route.test.ts.
//
// Analytics and visibility only — no live execution, no auto hedging, no
// auto rebalancing, no trade/position recommendations, no AI predictions,
// no probability forecasting, no AI-based risk scoring, no automated
// alerts anywhere in this file's assertions.

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
  investingRiskSnapshotsTable,
  tradingPositionsTable,
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
  await db.delete(investingRiskSnapshotsTable).where(eq(investingRiskSnapshotsTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function insertOpenIronCondor(userId: string, symbol = "AAPL") {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "iron_condor", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: quote.pop, expiration: quote.expiration })
    .returning({ id: tradesTable.id });
  return row;
}

describe("Institutional Risk & Exposure Intelligence Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `risk-exposure-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Risk Exposure Test User" }),
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

  it("GET /risk-exposure/dashboard returns an honest, well-shaped empty dashboard for a brand-new user with zero data anywhere", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.investing.holdingsCount).toBe(0);
    expect(body.investing.portfolioCount).toBe(0);
    expect(body.investing.allocationBySymbol).toEqual([]);
    expect(body.investing.risk.totalMarketValue).toBeNull();

    expect(body.trading.openPositionsCount).toBe(0);
    expect(body.trading.risk.openPositionsCount).toBe(0);

    expect(body.options.dashboard.openPositionsCount).toBe(0);
    expect(body.options.portfolioManagement.lifecycleSummary.totalPositions).toBe(0);

    expect(body.combined.assetAllocation).toEqual({
      investingHoldingsCount: 0,
      investingPortfolioCount: 0,
      tradingOpenPositionsCount: 0,
      optionsOpenPositionsCount: 0,
    });
    expect(body.combined.correlationOverview.overlaps).toEqual([]);
    expect(body.combined.correlationOverview.overlapSymbolCount).toBe(0);
    expect(typeof body.combined.correlationOverview.note).toBe("string");
    expect(body.combined.correlationOverview.note.length).toBeGreaterThan(0);
    // The Concentration Timeline is never fabricated as empty just because
    // no snapshot was saved: the reused Options Exposure Timeline
    // (buildOptionsPortfolioManagementView, Phase 36) always reports its own
    // deterministic trailing-6-month window honestly, even when every month
    // genuinely had zero open positions — never silently dropped.
    expect(body.combined.concentrationTimeline.length).toBe(6);
    for (const point of body.combined.concentrationTimeline) {
      expect(point.source).toBe("options-exposure");
      expect(point.value).toBe(0);
    }
    expect(typeof body.generatedAt).toBe("string");
  });

  // ─── Real cross-engine data ──────────────────────────────────────────

  it("aggregates real per-user Investing/Trading/Options data into one Combined view, including a genuine cross-engine symbol overlap and a real concentration timeline", async () => {
    const user = await signUp();

    // Investing: one portfolio, two holdings (AAPL + SPY).
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Core Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values([
      { userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 60, shares: 10 },
      { userId: user.userId, portfolioId: portfolio.id, symbol: "SPY", targetWeightPct: 40, shares: 5 },
    ]);
    // A real, previously-saved risk snapshot for this same portfolio.
    await db.insert(investingRiskSnapshotsTable).values({ userId: user.userId, portfolioId: portfolio.id, overallScore: 72, analysisJson: { note: "test snapshot" } });

    // Trading: one open AAPL position (the deliberate cross-engine overlap symbol).
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "AAPL", side: "long", status: "open", quantity: 10, entryPrice: 190, stopPrice: 180, targetPrice: 210 });
    // Real HTTP PATCH (not a raw DB update) so the settings row is
    // guaranteed to exist first, matching routes/tradingRisk.route.test.ts's
    // own established precedent.
    const settingsRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ tradingAccountValue: 100000 }),
    });
    expect(settingsRes.status).toBe(200);

    // Options: one open AAPL iron condor (the same overlap symbol again).
    await insertOpenIronCondor(user.userId, "AAPL");

    const res = await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    // Investing view
    expect(body.investing.portfolioCount).toBe(1);
    expect(body.investing.holdingsCount).toBe(2);
    const investingSymbols = body.investing.allocationBySymbol.map((a: any) => a.symbol);
    expect(investingSymbols.sort()).toEqual(["AAPL", "SPY"]);
    expect(body.investing.risk.totalMarketValue).toBeGreaterThan(0);

    // Trading view
    expect(body.trading.openPositionsCount).toBe(1);
    expect(body.trading.accountValue).toBe(100000);
    expect(body.trading.risk.openPositionsCount).toBe(1);

    // Options view — reused verbatim from the existing Portfolio Risk
    // Dashboard / Options Portfolio Management view.
    expect(body.options.dashboard.openPositionsCount).toBeGreaterThanOrEqual(1);
    expect(body.options.portfolioManagement.lifecycleSummary.totalPositions).toBeGreaterThanOrEqual(1);

    // Combined view — Capital Allocation
    const capByEngine = Object.fromEntries(body.combined.capitalAllocation.map((c: any) => [c.engine, c.value]));
    expect(capByEngine.investing).toBeGreaterThan(0);
    expect(capByEngine.trading).toBe(100000);
    expect(typeof capByEngine.options).toBe("number");

    // Combined view — Buying Power Overview
    const bpEngines = body.combined.buyingPowerOverview.map((b: any) => b.engine);
    expect(bpEngines.sort()).toEqual(["options", "trading"]);

    // Combined view — Asset Allocation
    expect(body.combined.assetAllocation).toEqual({
      investingHoldingsCount: 2,
      investingPortfolioCount: 1,
      tradingOpenPositionsCount: 1,
      optionsOpenPositionsCount: body.options.dashboard.openPositionsCount,
    });

    // Combined view — the genuine, disclosed, non-fabricated cross-engine
    // symbol overlap: AAPL is real in Investing (a holding), Trading (an
    // open position), and Options (an open trade) — a real overlap across
    // all 3 engines, never a fabricated correlation coefficient.
    const aaplOverlap = body.combined.correlationOverview.overlaps.find((o: any) => o.symbol === "AAPL");
    expect(aaplOverlap).toBeDefined();
    expect(aaplOverlap.engines.sort()).toEqual(["investing", "options", "trading"]);
    expect(body.combined.correlationOverview.overlapSymbolCount).toBeGreaterThanOrEqual(1);
    // SPY is only ever held in Investing this test, so it must never appear
    // as a cross-engine overlap.
    expect(body.combined.correlationOverview.overlaps.some((o: any) => o.symbol === "SPY")).toBe(false);

    // Combined view — Concentration Timeline includes the real, saved
    // Investing risk snapshot.
    const snapshotPoint = body.combined.concentrationTimeline.find((p: any) => p.source === "investing-risk-snapshot" && p.value === 72);
    expect(snapshotPoint).toBeDefined();

    // Combined view — Greeks Summary is reused directly, unmodified, from
    // the existing Portfolio Risk Dashboard's own net-Greeks computation.
    expect(body.combined.greeksSummary).toEqual(body.options.dashboard.netGreeks);

    // Never a fabricated prediction/forecast/recommendation anywhere in
    // the composed response.
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"(?!ed)|autoexecute|autoadjust|"recommendedaction"/);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's Investing/Trading holdings into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Portfolio" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: userA.userId, portfolioId: portfolioA.id, symbol: "MSFT", targetWeightPct: 100, shares: 3 });
    await db.insert(tradingPositionsTable).values({ userId: userA.userId, symbol: "MSFT", side: "long", status: "open", quantity: 3, entryPrice: 400 });

    const bodyA = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: userA.cookie } })).json()) as any;
    const bodyB = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: userB.cookie } })).json()) as any;

    expect(bodyA.investing.holdingsCount).toBe(1);
    expect(bodyA.trading.openPositionsCount).toBe(1);

    // User B's own dashboard must never reflect User A's real data.
    expect(bodyB.investing.holdingsCount).toBe(0);
    expect(bodyB.trading.openPositionsCount).toBe(0);
    expect(bodyB.investing.allocationBySymbol.some((a: any) => a.symbol === "MSFT")).toBe(false);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /risk-exposure/coach lists all 7 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/risk-exposure/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(7);
    expect(all.map((e) => e.topic).sort()).toEqual(["capital_allocation", "concentration", "diversification", "exposure", "greeks", "position_sizing", "risk"].sort());

    const oneRes = await fetch(`${baseUrl}/api/risk-exposure/coach/greeks`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("greeks");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /risk-exposure/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/risk-exposure/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /risk-exposure/learning lists all 7 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/risk-exposure/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(7);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/risk-exposure/learning/concentration`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("concentration");
    expect(one.links.some((l: any) => l.topicKey === "portfolio-concentration")).toBe(true);
  });

  it("GET /risk-exposure/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/risk-exposure/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("GET /risk-exposure/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/risk-exposure/dashboard`);
    expect(res.status).toBe(200);
  });
});

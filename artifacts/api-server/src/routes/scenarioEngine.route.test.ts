// Phase 39 — Institutional Scenario & Stress Testing Engine. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/performanceAttribution.route.test.ts's own Phase 38 established
// sign-up/session-cookie pattern) so this file's own holdings/positions/
// trades are never at risk of colliding with another concurrently-running
// test file's own data.
//
// This file proves REAL deterministic scenario repricing end to end — real
// linear repricing for Investing/Trading, real Black-Scholes repricing
// (reused verbatim from lib/portfolioStressTest.ts) for Options, and the
// Combined cross-engine view — over genuinely persisted rows, not mocked
// data.
//
// Analytical only — no AI predictions, no market forecasting, no price
// targets, no trade recommendations, no portfolio optimisation, no auto
// hedging, no auto execution, no Monte Carlo simulation, no random scenario
// generation anywhere in this file's assertions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, sessionsTable, accountsTable, investingPortfoliosTable, investingHoldingsTable, tradingPositionsTable } from "@workspace/db";
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
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("Institutional Scenario & Stress Testing Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `scenario-engine-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Scenario Engine Test User" }),
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

  it("POST /scenario-engine/dashboard returns an honest, well-shaped empty-portfolio dashboard for a brand-new user with zero data anywhere", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: user.cookie }, body: JSON.stringify({}) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.scenarios).toHaveLength(8);
    expect(body.scenarios.map((s: any) => s.key)).toEqual(["market_up_5", "market_down_5", "market_up_10", "market_down_10", "volatility_up", "volatility_down", "rate_up", "rate_down"]);

    expect(body.investing.holdingsCount).toBe(0);
    expect(body.investing.results).toHaveLength(8);
    for (const r of body.investing.results) {
      if (r.scenario.category === "price") expect(r.available).toBe(true);
      else expect(r.available).toBe(false);
    }

    expect(body.trading.openPositionsCount).toBe(0);
    expect(body.trading.results).toHaveLength(8);

    // lib/portfolioStressTest.ts's own buildPortfolioStressTest() is reused
    // verbatim, unmodified — its own `available` field is unconditionally
    // true (it always produces a well-shaped, honestly-empty comparison
    // over zero positions, never a hard "unavailable" for an empty
    // portfolio); the 6 price/volatility scenarios still evaluate, just
    // with zero real impact since there are no open Options positions.
    expect(body.options.stressTest.available).toBe(true);
    expect(body.options.stressTest.scenarios).toHaveLength(6);
    for (const s of body.options.stressTest.scenarios) {
      expect(s.unrealizedPnlImpact).toBe(0);
    }
    // Interest-rate scenarios are this module's own, and honestly report
    // unavailable when there are no open Options trades to reprice.
    expect(body.options.rateScenarios).toHaveLength(2);
    for (const r of body.options.rateScenarios) {
      expect(r.available).toBe(false);
    }

    expect(body.combined.byEngine.length).toBeGreaterThan(0);
    expect(body.combined.sectorImpact).toEqual([]);
    expect(body.combined.assetImpact.length).toBeGreaterThanOrEqual(0);
    expect(typeof body.generatedAt).toBe("string");
  });

  // ─── Real cross-engine scenario repricing ───────────────────────────

  it("reprices real per-user Investing holdings and Trading positions linearly under the Market +5% scenario, internally consistent with the response's own resolved prices", async () => {
    const user = await signUp();

    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Scenario Test Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 100, shares: 10, avgCostBasis: 100 });
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "AAPL", side: "long", status: "open", quantity: 4, entryPrice: 100 });

    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: user.cookie }, body: JSON.stringify({}) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    // Investing — Market +5% is a pure linear reprice: impact = marketValue * 5%.
    const investingUp5 = body.investing.results.find((r: any) => r.scenario.key === "market_up_5");
    expect(investingUp5.available).toBe(true);
    const aaplHolding = investingUp5.holdings.find((h: any) => h.symbol === "AAPL");
    expect(aaplHolding.currentPrice).toBeGreaterThan(0);
    expect(aaplHolding.shockedPrice).toBeCloseTo(aaplHolding.currentPrice * 1.05, 2);
    expect(aaplHolding.impactDollars).toBeCloseTo(aaplHolding.marketValue * 0.05, 1);
    expect(investingUp5.totalImpactDollars).toBeCloseTo(aaplHolding.impactDollars, 1);

    // Investing — Volatility/Interest Rate scenarios are honestly
    // unavailable for a raw equity holding, never approximated.
    const investingVolUp = body.investing.results.find((r: any) => r.scenario.key === "volatility_up");
    expect(investingVolUp.available).toBe(false);
    expect(typeof investingVolUp.reason).toBe("string");
    expect(investingVolUp.reason.toLowerCase()).toMatch(/implied volatility|iv\/greeks/);

    // Trading — same linear reprice, direction-aware (long here).
    const tradingUp5 = body.trading.results.find((r: any) => r.scenario.key === "market_up_5");
    expect(tradingUp5.available).toBe(true);
    const aaplPosition = tradingUp5.positions.find((p: any) => p.symbol === "AAPL");
    expect(aaplPosition.currentPrice).toBeGreaterThan(0);
    expect(aaplPosition.shockedPrice).toBeCloseTo(aaplPosition.currentPrice * 1.05, 2);
    expect(aaplPosition.impactDollars).toBeCloseTo((aaplPosition.shockedPrice - aaplPosition.currentPrice) * 4, 1);

    // Combined view never blends Investing and Trading's own repriced
    // impacts into one number — each engine's own reading stays distinct.
    const combinedUp5 = body.combined.byEngine.filter((e: any) => e.scenarioKey === "market_up_5");
    const investingEntry = combinedUp5.find((e: any) => e.engine === "investing");
    const tradingEntry = combinedUp5.find((e: any) => e.engine === "trading");
    expect(investingEntry.impactDollars).toBeCloseTo(investingUp5.totalImpactDollars, 1);
    expect(tradingEntry.impactDollars).toBeCloseTo(tradingUp5.totalImpactDollars, 1);
  });

  it("honestly reports Market -10% as a real, larger-magnitude opposite-direction impact than Market +5%, proving genuine per-scenario repricing, not a fixed placeholder", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Down Scenario Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "MSFT", targetWeightPct: 100, shares: 6, avgCostBasis: 200 });

    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: user.cookie }, body: JSON.stringify({}) });
    const body = (await res.json()) as any;

    const up5 = body.investing.results.find((r: any) => r.scenario.key === "market_up_5").totalImpactDollars;
    const down10 = body.investing.results.find((r: any) => r.scenario.key === "market_down_10").totalImpactDollars;
    expect(up5).toBeGreaterThan(0);
    expect(down10).toBeLessThan(0);
    expect(Math.abs(down10)).toBeGreaterThan(Math.abs(up5));
  });

  // ─── Market Move Simulator — caller-supplied custom scenario ────────

  it("evaluates a caller-supplied custom percentage-move scenario alongside the 8 default scenarios, never replacing them", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Custom Scenario Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 100, shares: 2, avgCostBasis: 150 });

    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ customScenarios: [{ label: "Flash Crash", priceShockPct: -30 }] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.scenarios).toHaveLength(9);
    const custom = body.scenarios.find((s: any) => s.key === "custom_0");
    expect(custom.label).toBe("Flash Crash");
    expect(custom.priceShockPct).toBe(-30);

    const investingCustom = body.investing.results.find((r: any) => r.scenario.key === "custom_0");
    expect(investingCustom.available).toBe(true);
    expect(investingCustom.totalImpactDollars).toBeLessThan(0);

    // The 8 defaults are still present and unaffected by the custom addition.
    expect(body.investing.results.some((r: any) => r.scenario.key === "market_up_5")).toBe(true);
  });

  it("gives a custom scenario with no explicit label a deterministic default label", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ customScenarios: [{ priceShockPct: 12 }] }),
    });
    const body = (await res.json()) as any;
    const custom = body.scenarios.find((s: any) => s.key === "custom_0");
    expect(custom.label).toBe("Custom (+12%)");
  });

  // ─── Options — reused verbatim from the existing What-If Stress Test ──

  it("reuses the existing What-If Stress Test engine for real Options price/volatility scenarios, and supplies a genuinely new shocked risk-free rate for the interest-rate scenarios", async () => {
    const user = await signUp();
    const { getSnapshot, buildIronCondor } = await import("../lib/optionsMath.js");
    const snap = getSnapshot("AAPL")!;
    const quote = buildIronCondor(snap, { dte: 45 });
    const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
    await db.insert(tradesTable).values({
      userId: user.userId,
      symbol: "AAPL",
      strategy: "iron_condor",
      status: "open",
      legs,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      expiration: quote.expiration,
      openDate: new Date(),
    });

    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: user.cookie }, body: JSON.stringify({}) });
    const body = (await res.json()) as any;

    expect(body.options.stressTest.available).toBe(true);
    // 6 price/volatility scenarios (4 market + 2 volatility) reused
    // directly from the existing engine — the 2 rate scenarios are
    // evaluated separately.
    expect(body.options.stressTest.scenarios).toHaveLength(6);
    for (const s of body.options.stressTest.scenarios) {
      expect(typeof s.portfolioValueImpact).toBe("number");
      expect(s.after.greeks).toBeDefined();
      expect(typeof s.after.totalRiskDollars).toBe("number");
    }

    expect(body.options.rateScenarios).toHaveLength(2);
    for (const r of body.options.rateScenarios) {
      expect(r.available).toBe(true);
      // Stored as a percentage (e.g. 4.5 for 4.5%), matching
      // investingRiskFreeRate's own Sprint-11 default of 0.045.
      expect(r.baseRiskFreeRate).toBeCloseTo(4.5, 1);
      expect(typeof r.totalImpactDollars).toBe("number");
    }
    const rateUp = body.options.rateScenarios.find((r: any) => r.scenario.key === "rate_up");
    expect(rateUp.shockedRiskFreeRate).toBeGreaterThan(rateUp.baseRiskFreeRate);
    const rateDown = body.options.rateScenarios.find((r: any) => r.scenario.key === "rate_down");
    expect(rateDown.shockedRiskFreeRate).toBeLessThan(rateDown.baseRiskFreeRate);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's Investing/Trading scenario impact into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Scenario Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: userA.userId, portfolioId: portfolioA.id, symbol: "SPY", targetWeightPct: 100, shares: 3, avgCostBasis: 400 });

    const bodyA = (await (await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: userA.cookie }, body: JSON.stringify({}) })).json()) as any;
    const bodyB = (await (await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: userB.cookie }, body: JSON.stringify({}) })).json()) as any;

    expect(bodyA.investing.holdingsCount).toBe(1);
    expect(bodyB.investing.holdingsCount).toBe(0);
    expect(bodyB.investing.results.every((r: any) => r.holdings.length === 0)).toBe(true);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /scenario-engine/coach lists all 5 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/scenario-engine/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic).sort()).toEqual(["capital_impact", "greeks_impact", "portfolio_resilience", "scenario_analysis", "stress_testing"].sort());

    const oneRes = await fetch(`${baseUrl}/api/scenario-engine/coach/stress_testing`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("stress_testing");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /scenario-engine/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/scenario-engine/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /scenario-engine/learning lists all 5 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/scenario-engine/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/scenario-engine/learning/greeks_impact`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("greeks_impact");
    expect(one.links.some((l: any) => l.topicKey === "greeks-portfolio-greeks")).toBe(true);
  });

  it("GET /scenario-engine/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/scenario-engine/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("POST /scenario-engine/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    expect(res.status).toBe(200);
  });

  it("POST /scenario-engine/dashboard 400s for a malformed request body, never silently ignoring it", async () => {
    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customScenarios: "not-an-array" }) });
    expect(res.status).toBe(400);
  });

  // ─── Reporting Centre integration ───────────────────────────────────

  it("GET /reporting/scenario-analysis-report and GET /reporting/stress-test-report resolve real InstitutionalReport payloads reusing the same dashboard", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Reporting Scenario Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "NVDA", targetWeightPct: 100, shares: 1, avgCostBasis: 500 });

    const sarRes = await fetch(`${baseUrl}/api/reporting/scenario-analysis-report`, { headers: { cookie: user.cookie } });
    expect(sarRes.status).toBe(200);
    const sar = (await sarRes.json()) as any;
    expect(sar.reportType).toBe("scenario-analysis-report");
    expect(sar.sections.some((s: any) => s.id === "scenario-comparison")).toBe(true);
    expect(sar.sections.some((s: any) => s.id === "asset-impact")).toBe(true);

    const strRes = await fetch(`${baseUrl}/api/reporting/stress-test-report`, { headers: { cookie: user.cookie } });
    expect(strRes.status).toBe(200);
    const str = (await strRes.json()) as any;
    expect(str.reportType).toBe("stress-test-report");
    expect(str.sections.some((s: any) => s.id === "greeks-impact")).toBe(true);
    expect(str.sections.some((s: any) => s.id === "capital-impact")).toBe(true);
  });

  it("GET /reporting/types lists both new Phase 39 report types", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types.some((t) => t.reportType === "scenario-analysis-report")).toBe(true);
    expect(types.some((t) => t.reportType === "stress-test-report")).toBe(true);
  });

  // ─── Never a fabricated prediction/forecast/recommendation ──────────

  it("never emits a probability estimate, forecast, or trade/hedge recommendation anywhere in the composed response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "TSLA", targetWeightPct: 100, shares: 1, avgCostBasis: 250 });
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "TSLA", side: "long", status: "open", quantity: 1, entryPrice: 250 });

    const res = await fetch(`${baseUrl}/api/scenario-engine/dashboard`, { method: "POST", headers: { "Content-Type": "application/json", cookie: user.cookie }, body: JSON.stringify({}) });
    const body = (await res.json()) as any;
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"(?!ed)|montecarlo|monte carlo|autoexecute|autoadjust|"recommendedaction"|we recommend/);
  });
});

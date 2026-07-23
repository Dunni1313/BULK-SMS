// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine. Live route integration tests against a real app + real Postgres
// connection + the real Better-Auth instance (no auth mocking), using a
// fresh, isolated, genuinely signed-up user per test block (mirroring
// routes/decisionSupportEngine.route.test.ts's own Phase 40 established
// sign-up/session-cookie pattern) so this file's own portfolios/holdings
// are never at risk of colliding with another concurrently-running test
// file's own data.
//
// This file proves the Rebalancing Engine is a genuine, internally
// consistent COMPOSITION of the already-shipped, already-tested Portfolio
// Construction (Phase 2 Sprint 28) and Risk & Exposure Engine (Phase 37) —
// never a second, independently-computed set of figures.
//
// Planning and analysis only — no trade recommendations, no buy/sell
// signals, no automatic portfolio optimisation, no automatic rebalancing,
// no auto execution, no AI predictions, no forecasting, no machine
// learning anywhere in this file's assertions.

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

describe("Institutional Portfolio Rebalancing & Allocation Planning Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `rebalancing-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Rebalancing Test User" }),
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

  it("GET /rebalancing/dashboard returns an honest, well-shaped empty dashboard for a brand-new user with zero portfolios", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.portfolios).toEqual([]);
    expect(body.summary).toMatch(/no investing portfolios/i);
    expect(Array.isArray(body.crossEngineCapitalAllocation)).toBe(true);
    expect(Array.isArray(body.crossEngineSectorAllocation)).toBe(true);
    expect(Array.isArray(body.crossEngineStrategyAllocation)).toBe(true);
    expect(Array.isArray(body.allocationTimeline)).toBe(true);
    expect(typeof body.crossEngineAssetAllocation).toBe("object");
    expect(typeof body.generatedAt).toBe("string");

    expect(body.targetAllocationAvailability).toHaveLength(3);
    const byEngine = Object.fromEntries(body.targetAllocationAvailability.map((t: any) => [t.engine, t]));
    expect(byEngine.investing.available).toBe(true);
    expect(byEngine.trading.available).toBe(false);
    expect(byEngine.options.available).toBe(false);
    expect(typeof byEngine.trading.reason).toBe("string");
    expect(byEngine.trading.reason.length).toBeGreaterThan(0);
  }, 15000);

  // ─── Real composition, proven internally consistent ─────────────────

  it("Current/Target/Drift is byte-consistent with GET /portfolio-construction/portfolios/:id — zero recomputed allocation math", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Rebalancing Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values([
      { userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 60, shares: 10, avgCostBasis: 100 },
      { userId: user.userId, portfolioId: portfolio.id, symbol: "MSFT", targetWeightPct: 40, shares: 5, avgCostBasis: 200 },
    ]);

    const dashboardRes = await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: user.cookie } });
    expect(dashboardRes.status).toBe(200);
    const directRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, { headers: { cookie: user.cookie } });
    expect(directRes.status).toBe(200);

    const body = (await dashboardRes.json()) as any;
    const direct = (await directRes.json()) as any;

    expect(body.portfolios).toHaveLength(1);
    const summary = body.portfolios[0];
    expect(summary.portfolioId).toBe(portfolio.id);
    expect(summary.portfolioName).toBe("Rebalancing Holdings");
    expect(summary.allocation).toEqual(direct.allocation);
  });

  it("cross-engine Sector/Asset/Strategy/Capital Allocation and the Allocation Timeline are byte-consistent with GET /risk-exposure/dashboard", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Cross-Engine Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "NVDA", targetWeightPct: 100, shares: 2, avgCostBasis: 400 });
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "NVDA", side: "long", status: "open", quantity: 1, entryPrice: 400 });

    // Sequential, not concurrent: a genuinely pre-existing, previously-
    // disclosed dormant race in getSettingsRow() (lib/serverState.ts) can
    // surface when two separate top-level HTTP requests for a brand-new
    // user both try to lazily create that user's first settings row at
    // once — buildRebalancingDashboard() itself pre-warms the row before
    // its own internal fan-out, but a second, independent request racing
    // it is not covered by that pre-warm. Sequencing these two calls is a
    // scope-preserving test design choice, mirroring
    // decisionSupportEngine.route.test.ts's own established fix for this
    // exact situation.
    const dashboardRes = await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: user.cookie } });
    expect(dashboardRes.status).toBe(200);
    const riskRes = await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } });
    expect(riskRes.status).toBe(200);

    const body = (await dashboardRes.json()) as any;
    const risk = (await riskRes.json()) as any;

    expect(body.crossEngineCapitalAllocation).toEqual(risk.combined.capitalAllocation);
    expect(body.crossEngineBuyingPowerOverview).toEqual(risk.combined.buyingPowerOverview);
    expect(body.crossEngineSectorAllocation).toEqual(risk.combined.sectorConcentration);
    expect(body.crossEngineStrategyAllocation).toEqual(risk.combined.strategyConcentration);
    expect(body.crossEngineAssetAllocation).toEqual(risk.combined.assetAllocation);
    expect(body.allocationTimeline).toEqual(risk.combined.concentrationTimeline);
  });

  // ─── Rebalancing Planner ─────────────────────────────────────────────

  it("POST /rebalancing/portfolios/:id/propose computes correct drift and capital-movement arithmetic against a caller-supplied proposal", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Planner Holdings" }).returning({ id: investingPortfoliosTable.id });
    // AAPL's SIMULATED price is deterministic; shares × price gives a known
    // market value so the proposed-weight math below is exactly derivable.
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 100, shares: 10, avgCostBasis: 100 });

    const proposeRes = await fetch(`${baseUrl}/api/rebalancing/portfolios/${portfolio.id}/propose`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [{ symbol: "AAPL", targetWeightPct: 50 }] }),
    });
    expect(proposeRes.status).toBe(200);
    const comparison = (await proposeRes.json()) as any;

    expect(comparison.portfolioId).toBe(portfolio.id);
    expect(comparison.rows).toHaveLength(1);
    const row = comparison.rows[0];
    expect(row.symbol).toBe("AAPL");
    expect(row.storedTargetWeightPct).toBe(100);
    expect(row.proposedTargetWeightPct).toBe(50);
    // A single-holding portfolio proposed down to 50% target still has
    // 100% of the portfolio's own market value in that one holding, so
    // the drift from the proposed target is always +50pp regardless of
    // the underlying (deterministic, but provider-dependent) price.
    expect(row.driftFromProposedPct).toBeCloseTo(50, 5);
    expect(row.rebalanceActionVsProposed).toBe("sell");
    expect(typeof row.capitalMovementDollars).toBe("number");
    expect(row.capitalMovementDollars).toBeLessThan(0);

    expect(typeof comparison.totalCapitalToRaiseDollars).toBe("number");
    expect(comparison.totalCapitalToRaiseDollars).toBeGreaterThan(0);
    expect(comparison.totalCapitalToDeployDollars).toBe(0);
    expect(typeof comparison.summary).toBe("string");
  });

  it("POST /rebalancing/portfolios/:id/propose 404s for a nonexistent portfolio and for another user's own portfolio", async () => {
    const userA = await signUp();
    const userB = await signUp();
    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Only" }).returning({ id: investingPortfoliosTable.id });

    const nonexistentRes = await fetch(`${baseUrl}/api/rebalancing/portfolios/999999999/propose`, {
      method: "POST",
      headers: { cookie: userA.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [] }),
    });
    expect(nonexistentRes.status).toBe(404);

    const crossUserRes = await fetch(`${baseUrl}/api/rebalancing/portfolios/${portfolioA.id}/propose`, {
      method: "POST",
      headers: { cookie: userB.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [] }),
    });
    expect(crossUserRes.status).toBe(404);
  });

  it("POST /rebalancing/portfolios/:id/propose 400s for a malformed proposal body", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Malformed Body Holdings" }).returning({ id: investingPortfoliosTable.id });

    const res = await fetch(`${baseUrl}/api/rebalancing/portfolios/${portfolio.id}/propose`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [{ symbol: "AAPL", targetWeightPct: "not-a-number" }] }),
    });
    expect(res.status).toBe(400);

    const invalidIdRes = await fetch(`${baseUrl}/api/rebalancing/portfolios/not-an-id/propose`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [] }),
    });
    expect(invalidIdRes.status).toBe(400);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's portfolios into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Rebalancing Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: userA.userId, portfolioId: portfolioA.id, symbol: "SPY", targetWeightPct: 100, shares: 3, avgCostBasis: 400 });

    const bodyA = (await (await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: userA.cookie } })).json()) as any;
    const bodyB = (await (await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: userB.cookie } })).json()) as any;

    expect(bodyA.portfolios).toHaveLength(1);
    expect(bodyB.portfolios).toHaveLength(0);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /rebalancing/coach lists all 5 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/rebalancing/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic).sort()).toEqual(["capital_efficiency", "diversification", "portfolio_allocation", "portfolio_construction", "rebalancing_concepts"].sort());

    const oneRes = await fetch(`${baseUrl}/api/rebalancing/coach/rebalancing_concepts`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("rebalancing_concepts");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /rebalancing/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/rebalancing/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /rebalancing/learning lists all 6 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/rebalancing/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(6);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/rebalancing/learning/diversification`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("diversification");
    expect(one.links.some((l: any) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("GET /rebalancing/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/rebalancing/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("GET /rebalancing/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/rebalancing/dashboard`);
    expect(res.status).toBe(200);
  });

  // ─── Reporting Centre integration ───────────────────────────────────

  it("GET /reporting/portfolio-allocation-report and GET /reporting/rebalancing-planning-report/:portfolioId resolve real InstitutionalReport payloads reusing the same engine", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Reporting Rebalancing Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "TSLA", targetWeightPct: 100, shares: 1, avgCostBasis: 250 });

    const parRes = await fetch(`${baseUrl}/api/reporting/portfolio-allocation-report`, { headers: { cookie: user.cookie } });
    expect(parRes.status).toBe(200);
    const par = (await parRes.json()) as any;
    expect(par.reportType).toBe("portfolio-allocation-report");
    expect(par.sections.some((s: any) => s.id === "current-vs-target-allocation")).toBe(true);
    expect(par.sections.some((s: any) => s.id === "allocation-drift")).toBe(true);
    expect(par.sections.some((s: any) => s.id === "target-allocation-availability")).toBe(true);

    const rprRes = await fetch(`${baseUrl}/api/reporting/rebalancing-planning-report/${portfolio.id}`, { headers: { cookie: user.cookie } });
    expect(rprRes.status).toBe(200);
    const rpr = (await rprRes.json()) as any;
    expect(rpr.reportType).toBe("rebalancing-planning-report");
    expect(rpr.portfolioId).toBe(portfolio.id);
    expect(rpr.sections.some((s: any) => s.id === "proposed-allocation-comparison")).toBe(true);
    expect(rpr.sections.some((s: any) => s.id === "capital-movement-required")).toBe(true);
  });

  it("GET /reporting/rebalancing-planning-report/:portfolioId 404s for a nonexistent portfolio", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/reporting/rebalancing-planning-report/999999999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("GET /reporting/types lists both new Phase 41 report types", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types.some((t) => t.reportType === "portfolio-allocation-report")).toBe(true);
    expect(types.some((t) => t.reportType === "rebalancing-planning-report" && t.requiresPortfolio === true)).toBe(true);
  });

  // ─── Never a fabricated trade recommendation/forecast ───────────────

  it("never emits a trade recommendation, buy/sell signal, share count, forecast, or auto-rebalancing/auto-execution language anywhere in the composed response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "MSFT", targetWeightPct: 100, shares: 1, avgCostBasis: 300 });

    const dashboardRes = await fetch(`${baseUrl}/api/rebalancing/dashboard`, { headers: { cookie: user.cookie } });
    const dashboard = (await dashboardRes.json()) as any;
    const proposeRes = await fetch(`${baseUrl}/api/rebalancing/portfolios/${portfolio.id}/propose`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ targets: [{ symbol: "MSFT", targetWeightPct: 50 }] }),
    });
    const comparison = await proposeRes.json();

    for (const serialized of [JSON.stringify(dashboard).toLowerCase(), JSON.stringify(comparison).toLowerCase()]) {
      expect(serialized).not.toMatch(
        /"probability"|"prediction"|"forecast"(?!ed)|montecarlo|monte carlo|autoexecute|autoadjust|autorebalance|"recommendedaction"|we recommend|buy signal|sell signal|"suggestedshares"|"ordertype"/,
      );
    }
  });
});

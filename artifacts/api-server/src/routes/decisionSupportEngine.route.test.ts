// Phase 40 — Institutional Decision Support & Executive Insights Engine. Live
// route integration tests against a real app + real Postgres connection +
// the real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/scenarioEngine.route.test.ts's own Phase 39 established
// sign-up/session-cookie pattern) so this file's own holdings/positions/
// trades are never at risk of colliding with another concurrently-running
// test file's own data.
//
// This file proves the Decision Support dashboard is a genuine, internally
// consistent COMPOSITION of the already-shipped, already-tested Risk &
// Exposure (Phase 37), Performance & Attribution (Phase 38), Scenario &
// Stress Testing (Phase 39), and Portfolio Concentration engines — never a
// second, independently-computed set of figures.
//
// Interpretation only — no AI predictions, no trade recommendations, no
// buy/sell signals, no portfolio optimisation, no auto execution, no auto
// hedging, no auto rebalancing, no market forecasting, no machine learning,
// no generative investment advice anywhere in this file's assertions.

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

describe("Institutional Decision Support & Executive Insights Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `decision-support-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Decision Support Test User" }),
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

  it("GET /decision-support/dashboard returns an honest, well-shaped empty-portfolio dashboard for a brand-new user with zero data anywhere", async () => {
    // This is the file's own first real dashboard composition — 4 concurrent
    // engine calls (Risk & Exposure, Performance & Attribution, Scenario &
    // Stress Testing, Portfolio Concentration) plus the Executive Health
    // scorecard — and can incur real cold-start import/connection overhead
    // beyond Vitest's 5000ms default on a first invocation; a generous
    // explicit timeout avoids a flake here without masking a real
    // regression (every other call in this file, and this one under
    // repeated runs, resolves in well under 2s).
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.executiveSummary.investingHoldingsCount).toBe(0);
    expect(body.executiveSummary.tradingOpenPositionsCount).toBe(0);
    expect(body.executiveSummary.optionsOpenPositionsCount).toBe(0);
    expect(body.executiveSummary.alertCount).toBe(body.executiveAlerts.length);
    expect(body.executiveSummary.outstandingIssueCount).toBe(body.outstandingIssues.length);
    expect(typeof body.executiveSummary.summary).toBe("string");
    expect(body.executiveSummary.summary.length).toBeGreaterThan(0);

    expect(body.portfolioHealthOverview.investing.available).toBe(false);
    expect(body.portfolioHealthOverview.trading.available).toBe(false);
    expect(body.portfolioHealthOverview.options.available).toBe(true);

    expect(body.keyMetrics.length).toBe(12);
    expect(body.executiveHealth.dimensions.length).toBe(11);
    for (const d of body.executiveHealth.dimensions) {
      expect(typeof d.code).toBe("string");
      expect(typeof d.includedInComposite).toBe("boolean");
    }

    expect(typeof body.generatedAt).toBe("string");
  }, 15000);

  // ─── Real cross-engine composition, proven internally consistent ────

  it("composes real per-user Investing/Trading/Options figures, each byte-consistent with the underlying engines it reuses", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Decision Support Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 100, shares: 5, avgCostBasis: 100 });
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "AAPL", side: "long", status: "open", quantity: 2, entryPrice: 100 });

    // Sequential, not concurrent: a genuinely pre-existing, previously-
    // disclosed dormant race in getSettingsRow() (lib/serverState.ts, a
    // plain check-then-insert with no upsert safety, first documented
    // Phase 37 and repeated Phase 39) can surface when two separate
    // top-level HTTP requests for a brand-new user both try to lazily
    // create that user's first settings row at once — buildDecisionSupportDashboard()
    // itself pre-warms the row before its own internal fan-out, but a
    // second, independent request racing it is not covered by that
    // pre-warm. Sequencing these two calls is a scope-preserving test
    // design choice (not a production code change) mirroring the same
    // fix already applied for this exact situation in
    // e2e/specs/cross-engine-command-center.spec.ts.
    const dashboardRes = await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: user.cookie } });
    expect(dashboardRes.status).toBe(200);
    const riskRes = await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } });
    expect(riskRes.status).toBe(200);
    const body = (await dashboardRes.json()) as any;
    const risk = (await riskRes.json()) as any;

    // Executive Summary reuses the Risk & Exposure Engine's own
    // already-computed counts/values directly — never recomputed.
    expect(body.executiveSummary.investingHoldingsCount).toBe(risk.investing.holdingsCount);
    expect(body.executiveSummary.investingMarketValue).toBeCloseTo(risk.investing.risk.totalMarketValue, 2);
    expect(body.executiveSummary.tradingOpenPositionsCount).toBe(risk.trading.openPositionsCount);
    expect(body.executiveSummary.optionsOpenPositionsCount).toBe(risk.options.dashboard.openPositionsCount);

    // Risk Summary is a thin re-export of the exact same Combined view.
    expect(body.riskSummary.investingRiskScore).toBe(risk.investing.risk.overall.score);
    expect(body.riskSummary.tradingRiskScore).toBe(risk.trading.risk.overall.score);
    expect(body.riskSummary.combined.correlationOverview.overlapSymbolCount).toBe(risk.combined.correlationOverview.overlapSymbolCount);

    // Portfolio Health Overview reuses each engine's own already-computed
    // overall risk/health score.
    expect(body.portfolioHealthOverview.investing.score).toBe(risk.investing.risk.overall.score);
    expect(body.portfolioHealthOverview.trading.score).toBe(risk.trading.risk.overall.score);
    expect(body.portfolioHealthOverview.options.score).toBe(risk.options.dashboard.healthScore);

    // Capital Allocation / Exposure Summary are direct re-exports of the
    // Combined view's own already-computed arrays — never blended into one
    // cross-engine figure.
    expect(body.capitalAllocationSummary.capitalAllocation).toEqual(risk.combined.capitalAllocation);
    expect(body.exposureSummary.sectorConcentration).toEqual(risk.combined.sectorConcentration);
    expect(body.exposureSummary.greeksSummary).toEqual(risk.combined.greeksSummary);

    // Diversification Summary: Trading is always honestly unavailable
    // (no concentration-scoring formula exists for it in this codebase).
    expect(body.diversificationSummary.trading.available).toBe(false);
    expect(body.diversificationSummary.trading.score).toBeNull();
    expect(body.diversificationSummary.investing.score).toBe(risk.investing.risk.concentration.score);
  });

  // ─── Executive Health scorecard honesty ─────────────────────────────

  it("Executive Health scorecard never fabricates a score for a dimension with no genuine 0-100 formula, and honestly excludes it from the composite", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;

    const capitalUtil = body.executiveHealth.dimensions.find((d: any) => d.code === "capital_utilisation");
    expect(capitalUtil.score).toBeNull();
    expect(capitalUtil.includedInComposite).toBe(false);

    const performance = body.executiveHealth.dimensions.find((d: any) => d.code === "performance");
    expect(performance.score).toBeNull();
    expect(performance.includedInComposite).toBe(false);

    const portfolioHealth = body.executiveHealth.dimensions.find((d: any) => d.code === "portfolio_health");
    expect(portfolioHealth.includedInComposite).toBe(true);

    const includedScores = body.executiveHealth.dimensions.filter((d: any) => d.includedInComposite).map((d: any) => d.score);
    const present = includedScores.filter((s: number | null) => s != null);
    if (present.length > 0) {
      const expectedAvg = Math.round((present.reduce((a: number, b: number) => a + b, 0) / present.length) * 100) / 100;
      expect(body.executiveHealth.compositeScore).toBeCloseTo(expectedAvg, 1);
    }
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's Executive Summary/Risk/Health figures into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: userA.userId, name: "User A Decision Support Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: userA.userId, portfolioId: portfolioA.id, symbol: "SPY", targetWeightPct: 100, shares: 3, avgCostBasis: 400 });

    const bodyA = (await (await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: userA.cookie } })).json()) as any;
    const bodyB = (await (await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: userB.cookie } })).json()) as any;

    expect(bodyA.executiveSummary.investingHoldingsCount).toBe(1);
    expect(bodyB.executiveSummary.investingHoldingsCount).toBe(0);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /decision-support/coach lists all 8 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/decision-support/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(8);
    expect(all.map((e) => e.topic).sort()).toEqual(
      ["capital_allocation", "diversification", "executive_dashboards", "institutional_decision_support", "performance", "portfolio_interpretation", "risk", "scenario_analysis"].sort(),
    );

    const oneRes = await fetch(`${baseUrl}/api/decision-support/coach/risk`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("risk");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /decision-support/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/decision-support/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /decision-support/learning lists all 7 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/decision-support/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(7);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/decision-support/learning/diversification`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("diversification");
    expect(one.links.some((l: any) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("GET /decision-support/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/decision-support/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("GET /decision-support/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/decision-support/dashboard`);
    expect(res.status).toBe(200);
  });

  // ─── Reporting Centre integration ───────────────────────────────────

  it("GET /reporting/executive-decision-summary and GET /reporting/institutional-health-report resolve real InstitutionalReport payloads reusing the same dashboard", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Reporting Decision Support Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "NVDA", targetWeightPct: 100, shares: 1, avgCostBasis: 500 });

    const edsRes = await fetch(`${baseUrl}/api/reporting/executive-decision-summary`, { headers: { cookie: user.cookie } });
    expect(edsRes.status).toBe(200);
    const eds = (await edsRes.json()) as any;
    expect(eds.reportType).toBe("executive-decision-summary");
    expect(eds.sections.some((s: any) => s.id === "executive-summary")).toBe(true);
    expect(eds.sections.some((s: any) => s.id === "key-metrics-dashboard")).toBe(true);

    const ihrRes = await fetch(`${baseUrl}/api/reporting/institutional-health-report`, { headers: { cookie: user.cookie } });
    expect(ihrRes.status).toBe(200);
    const ihr = (await ihrRes.json()) as any;
    expect(ihr.reportType).toBe("institutional-health-report");
    expect(ihr.sections.some((s: any) => s.id === "executive-health-scorecard")).toBe(true);
    expect(ihr.sections.some((s: any) => s.id === "diversification-summary")).toBe(true);
  });

  it("GET /reporting/types lists both new Phase 40 report types", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types.some((t) => t.reportType === "executive-decision-summary")).toBe(true);
    expect(types.some((t) => t.reportType === "institutional-health-report")).toBe(true);
  });

  // ─── Never a fabricated prediction/forecast/recommendation ──────────

  it("never emits a probability estimate, forecast, buy/sell signal, or portfolio-optimisation/auto-execution recommendation anywhere in the composed response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "TSLA", targetWeightPct: 100, shares: 1, avgCostBasis: 250 });
    await db.insert(tradingPositionsTable).values({ userId: user.userId, symbol: "TSLA", side: "long", status: "open", quantity: 1, entryPrice: 250 });

    const res = await fetch(`${baseUrl}/api/decision-support/dashboard`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(
      /"probability"|"prediction"|"forecast"(?!ed)|montecarlo|monte carlo|autoexecute|autoadjust|autorebalance|"recommendedaction"|we recommend|buy signal|sell signal/,
    );
  });
});

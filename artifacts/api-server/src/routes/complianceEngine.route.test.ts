// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine. Live
// route integration tests against a real app + real Postgres connection +
// the real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/rebalancingEngine.route.test.ts's own Phase 41 established
// sign-up/session-cookie pattern) so this file's own policies/holdings are
// never at risk of colliding with another concurrently-running test file's
// own data.
//
// This file proves the Monitoring & Compliance Engine is a genuine,
// internally consistent COMPOSITION of the already-shipped, already-tested
// Risk & Exposure Engine (Phase 37), Diversification Summary
// (decisionSupportEngine.ts, Phase 40), Portfolio Concentration
// (portfolioConcentration.ts), and Options Income Engine (Phase 35) — never
// a second, independently-computed set of figures. Monitoring only — no
// trade recommendations, no buy/sell signals, no portfolio optimisation,
// no auto rebalancing, no auto execution, no AI predictions, no
// forecasting, no machine learning anywhere in this file's assertions.

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
  tradingPositionsTable,
  compliancePoliciesTable,
} from "@workspace/db";
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
  await db.delete(compliancePoliciesTable).where(eq(compliancePoliciesTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("Institutional Portfolio Monitoring & Compliance Engine routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `compliance-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Compliance Test User" }),
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

  it("GET /compliance/dashboard returns an honest, well-shaped empty dashboard for a brand-new user with zero policies", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.complianceSummary.totalPolicies).toBe(0);
    expect(body.complianceSummary.enabledPolicies).toBe(0);
    expect(body.complianceSummary.overallStatus).toBe("no_policies");
    expect(body.complianceSummary.summary).toMatch(/no compliance policies configured/i);
    expect(body.evaluations).toEqual([]);
    for (const section of [
      "allocationLimits",
      "sectorLimits",
      "assetLimits",
      "positionLimits",
      "strategyLimits",
      "greeksLimits",
      "buyingPowerLimits",
      "incomeStabilityLimits",
      "diversificationLimits",
      "policyViolations",
    ]) {
      expect(body[section]).toEqual([]);
    }
    expect(Array.isArray(body.complianceTimeline)).toBe(true);
    expect(typeof body.complianceTimelineNote).toBe("string");
    expect(body.complianceTimelineNote.length).toBeGreaterThan(0);
    expect(typeof body.generatedAt).toBe("string");
  }, 15000);

  // ─── Policy Types ────────────────────────────────────────────────────

  it("GET /compliance/policy-types lists all 15 policy types across 8 categories", async () => {
    const res = await fetch(`${baseUrl}/api/compliance/policy-types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types).toHaveLength(15);
    const categories = new Set(types.map((t) => t.category));
    // "allocation" is not its own category — it's a dashboard-level grouping
    // (lib/complianceEngine.ts's own ALLOCATION_CATEGORIES) spanning the
    // sector/position/strategy categories, never a policy's own category.
    expect([...categories].sort()).toEqual(["asset", "buying_power", "diversification", "greeks", "income_stability", "position", "sector", "strategy"].sort());
    for (const t of types) {
      expect(typeof t.label).toBe("string");
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.defaultLimitValue).toBe("number");
      expect(["max", "min"]).toContain(t.direction);
    }
  });

  // ─── Policy CRUD lifecycle ───────────────────────────────────────────

  it("full create/list/get/update/delete policy lifecycle", async () => {
    const user = await signUp();

    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_delta_max", label: "Max Portfolio Delta", direction: "max", limitValue: 500, enabled: true }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.policyType).toBe("portfolio_delta_max");
    expect(created.label).toBe("Max Portfolio Delta");
    expect(created.limitValue).toBe(500);
    expect(created.enabled).toBe(true);

    const listRes = await fetch(`${baseUrl}/api/compliance/policies`, { headers: { cookie: user.cookie } });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as any[];
    expect(list.some((p) => p.id === created.id)).toBe(true);

    const getRes = await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, { headers: { cookie: user.cookie } });
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as any;
    expect(got.id).toBe(created.id);

    const patchRes = await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, {
      method: "PATCH",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ limitValue: 750, enabled: false }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.limitValue).toBe(750);
    expect(patched.enabled).toBe(false);

    const deleteRes = await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(deleteRes.status).toBe(200);

    const afterDeleteRes = await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, { headers: { cookie: user.cookie } });
    expect(afterDeleteRes.status).toBe(404);
  });

  it("POST /compliance/policies 400s for an unknown policy type or a missing required field", async () => {
    const user = await signUp();

    const unknownTypeRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "not_a_real_policy_type", label: "Bad", limitValue: 10 }),
    });
    expect(unknownTypeRes.status).toBe(400);

    const missingFieldRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_delta_max" }),
    });
    expect(missingFieldRes.status).toBe(400);
  });

  it("GET/PATCH/DELETE /compliance/policies/:id 404 for a nonexistent policy and for another user's own policy; 400 for a non-numeric id", async () => {
    const userA = await signUp();
    const userB = await signUp();

    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: userA.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_gamma_max", label: "User A Only", direction: "max", limitValue: 50 }),
    });
    const created = (await createRes.json()) as any;

    expect((await fetch(`${baseUrl}/api/compliance/policies/999999999`, { headers: { cookie: userA.cookie } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, { headers: { cookie: userB.cookie } })).status).toBe(404);
    expect(
      (
        await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, {
          method: "PATCH",
          headers: { cookie: userB.cookie, "content-type": "application/json" },
          body: JSON.stringify({ limitValue: 1 }),
        })
      ).status,
    ).toBe(404);
    expect((await fetch(`${baseUrl}/api/compliance/policies/${created.id}`, { method: "DELETE", headers: { cookie: userB.cookie } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/compliance/policies/not-an-id`, { headers: { cookie: userA.cookie } })).status).toBe(400);
  });

  // ─── Policy evaluation math ──────────────────────────────────────────

  it("evaluates a breached position_allocation_max policy correctly against a real, concentrated single-holding portfolio", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Concentrated Holdings" }).returning({ id: investingPortfoliosTable.id });
    // A single holding is, by construction, 100% of the Investing book's
    // own allocation-by-symbol weight — a deterministic, always-true fact
    // regardless of the underlying (SIMULATED but deterministic) price.
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "AAPL", targetWeightPct: 100, shares: 10, avgCostBasis: 100 });

    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "position_allocation_max", label: "AAPL Position Cap", targetKey: "AAPL", direction: "max", limitValue: 25 }),
    });
    const policy = (await createRes.json()) as any;

    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    expect(dashboardRes.status).toBe(200);
    const dashboard = (await dashboardRes.json()) as any;

    const evaluation = dashboard.evaluations.find((e: any) => e.policyId === policy.id);
    expect(evaluation).toBeDefined();
    expect(evaluation.currentValue).toBe(100);
    expect(evaluation.status).toBe("breach");
    expect(evaluation.differenceValue).toBe(75);
    expect(evaluation.detail).toMatch(/exceeds/i);
    expect(dashboard.positionLimits.some((e: any) => e.policyId === policy.id)).toBe(true);
    expect(dashboard.policyViolations.some((e: any) => e.policyId === policy.id)).toBe(true);
    expect(dashboard.complianceSummary.breachCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.complianceSummary.overallStatus).toBe("breach");
  });

  it("evaluates a compliant position_allocation_max policy correctly when the limit is generous", async () => {
    const user = await signUp();
    const [portfolioA] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Generous Cap Holdings A" }).returning({ id: investingPortfoliosTable.id });
    const [portfolioB] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Generous Cap Holdings B" }).returning({ id: investingPortfoliosTable.id });
    // Two portfolios, each holding a different symbol at 100% of its own
    // portfolio, means each symbol is only 50% of the user's OVERALL
    // Investing allocation-by-symbol weight (the figure position_allocation_max
    // is actually evaluated against) — a real, well-below-90%, genuinely
    // compliant concentration, not a boundary case.
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolioA.id, symbol: "MSFT", targetWeightPct: 100, shares: 5, avgCostBasis: 200 });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolioB.id, symbol: "GOOGL", targetWeightPct: 100, shares: 5, avgCostBasis: 200 });

    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "position_allocation_max", label: "MSFT Position Cap", targetKey: "MSFT", direction: "max", limitValue: 90 }),
    });
    const policy = (await createRes.json()) as any;

    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    const dashboard = (await dashboardRes.json()) as any;
    const evaluation = dashboard.evaluations.find((e: any) => e.policyId === policy.id);
    expect(evaluation.status).toBe("compliant");
    expect(evaluation.detail).toMatch(/within/i);
    expect(dashboard.policyViolations.some((e: any) => e.policyId === policy.id)).toBe(false);
  });

  it("honestly reports 'unavailable' — never a fabricated compliant/breach status — when a policy's own targetKey resolves to nothing", async () => {
    const user = await signUp();
    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "sector_allocation_max", label: "Nonexistent Sector Cap", targetKey: "Not A Real Sector", direction: "max", limitValue: 40 }),
    });
    const policy = (await createRes.json()) as any;

    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    const dashboard = (await dashboardRes.json()) as any;
    const evaluation = dashboard.evaluations.find((e: any) => e.policyId === policy.id);
    expect(evaluation.status).toBe("unavailable");
    expect(evaluation.currentValue).toBeNull();
    expect(evaluation.differenceValue).toBeNull();
    expect(evaluation.detail).toMatch(/could not be resolved/i);
    expect(dashboard.complianceSummary.unavailableCount).toBeGreaterThanOrEqual(1);
    // Unavailable is never treated as a breach.
    expect(dashboard.policyViolations.some((e: any) => e.policyId === policy.id)).toBe(false);
  });

  it("a disabled policy still appears in its own category list but is excluded from the Compliance Summary's counts and Policy Violations, even when breached", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Disabled Policy Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "TSLA", targetWeightPct: 100, shares: 2, avgCostBasis: 250 });

    const createRes = await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "position_allocation_max", label: "Disabled TSLA Cap", targetKey: "TSLA", direction: "max", limitValue: 1, enabled: false }),
    });
    const policy = (await createRes.json()) as any;
    expect(policy.enabled).toBe(false);

    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    const dashboard = (await dashboardRes.json()) as any;

    expect(dashboard.positionLimits.some((e: any) => e.policyId === policy.id)).toBe(true);
    expect(dashboard.complianceSummary.enabledPolicies).toBe(0);
    expect(dashboard.complianceSummary.totalPolicies).toBe(1);
    expect(dashboard.policyViolations.some((e: any) => e.policyId === policy.id)).toBe(false);
  });

  // ─── Byte-consistency with the underlying, already-tested engines ────

  it("Greeks/Capital limits' current values are byte-consistent with GET /risk-exposure/dashboard — zero recomputed risk math", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Cross-Engine Compliance Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "NVDA", targetWeightPct: 100, shares: 2, avgCostBasis: 400 });

    await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "investing_capital_allocation_max", label: "Investing Capital Cap", direction: "max", limitValue: 1000000 }),
    });
    await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_delta_max", label: "Delta Cap", direction: "max", limitValue: 100000 }),
    });

    // Sequential, not concurrent — mirrors rebalancingEngine.route.test.ts's
    // own established fix for getSettingsRow()'s pre-existing, disclosed
    // check-then-insert race on a brand-new user's first settings row.
    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    expect(dashboardRes.status).toBe(200);
    const riskRes = await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } });
    expect(riskRes.status).toBe(200);

    const dashboard = (await dashboardRes.json()) as any;
    const risk = (await riskRes.json()) as any;

    const capitalEval = dashboard.evaluations.find((e: any) => e.policyType === "investing_capital_allocation_max");
    expect(capitalEval.currentValue).toBe(risk.investing.risk.totalMarketValue);

    const deltaEval = dashboard.evaluations.find((e: any) => e.policyType === "portfolio_delta_max");
    expect(deltaEval.currentValue).toBe(Math.round(Math.abs(risk.combined.greeksSummary.delta) * 100) / 100);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────

  it("never leaks one user's policies into another user's own dashboard", async () => {
    const userA = await signUp();
    const userB = await signUp();

    await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: userA.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_theta_exposure_max", label: "User A Only Theta Cap", direction: "max", limitValue: 5000 }),
    });

    const dashboardA = (await (await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: userA.cookie } })).json()) as any;
    const dashboardB = (await (await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: userB.cookie } })).json()) as any;

    expect(dashboardA.complianceSummary.totalPolicies).toBe(1);
    expect(dashboardB.complianceSummary.totalPolicies).toBe(0);
  });

  // ─── AI Coach ────────────────────────────────────────────────────────

  it("GET /compliance/coach lists all 5 deterministic explanations, and /coach/:topic resolves each with the shared COACH_DISCLAIMER", async () => {
    const listRes = await fetch(`${baseUrl}/api/compliance/coach`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(5);
    expect(all.map((e) => e.topic).sort()).toEqual(["capital_limits", "compliance_concepts", "governance", "portfolio_monitoring", "risk_limits"].sort());

    const oneRes = await fetch(`${baseUrl}/api/compliance/coach/governance`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("governance");
    expect(one.disclaimer.length).toBeGreaterThan(0);
  });

  it("GET /compliance/coach/:topic 404s for an unknown topic, never a fabricated explanation", async () => {
    const res = await fetch(`${baseUrl}/api/compliance/coach/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────

  it("GET /compliance/learning lists all 6 topics' own real, resolved Learning Centre links, and /learning/:topic resolves one", async () => {
    const listRes = await fetch(`${baseUrl}/api/compliance/learning`);
    expect(listRes.status).toBe(200);
    const all = (await listRes.json()) as any[];
    expect(all).toHaveLength(6);
    for (const entry of all) {
      expect(entry.links.length).toBeGreaterThan(0);
    }

    const oneRes = await fetch(`${baseUrl}/api/compliance/learning/diversification`);
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("diversification");
    expect(one.links.some((l: any) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("GET /compliance/learning/:topic 404s for an unknown topic, never a fabricated learning bundle", async () => {
    const res = await fetch(`${baseUrl}/api/compliance/learning/not-a-real-topic`);
    expect(res.status).toBe(404);
  });

  // ─── No special auth requirement ────────────────────────────────────

  it("GET /compliance/dashboard requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/compliance/dashboard`);
    expect(res.status).toBe(200);
  });

  // ─── Reporting Centre integration ───────────────────────────────────

  it("GET /reporting/compliance-report and GET /reporting/policy-monitoring-report resolve real InstitutionalReport payloads reusing the same engine", async () => {
    const user = await signUp();
    await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "portfolio_gamma_max", label: "Reporting Gamma Cap", direction: "max", limitValue: 25 }),
    });

    const complianceRes = await fetch(`${baseUrl}/api/reporting/compliance-report`, { headers: { cookie: user.cookie } });
    expect(complianceRes.status).toBe(200);
    const complianceReport = (await complianceRes.json()) as any;
    expect(complianceReport.reportType).toBe("compliance-report");
    expect(complianceReport.sections.some((s: any) => s.id === "compliance-summary")).toBe(true);
    expect(complianceReport.sections.some((s: any) => s.id === "policy-violations")).toBe(true);

    const policyRes = await fetch(`${baseUrl}/api/reporting/policy-monitoring-report`, { headers: { cookie: user.cookie } });
    expect(policyRes.status).toBe(200);
    const policyReport = (await policyRes.json()) as any;
    expect(policyReport.reportType).toBe("policy-monitoring-report");
    expect(policyReport.sections.some((s: any) => s.id === "greeks-limits")).toBe(true);
    expect(policyReport.sections.some((s: any) => s.id === "compliance-timeline")).toBe(true);
  });

  it("GET /reporting/types lists both new Phase 42 report types", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const types = (await res.json()) as any[];
    expect(types.some((t) => t.reportType === "compliance-report")).toBe(true);
    expect(types.some((t) => t.reportType === "policy-monitoring-report")).toBe(true);
  });

  // ─── Never a fabricated trade recommendation/forecast ───────────────

  it("never emits a trade recommendation, buy/sell signal, share count, forecast, or auto-rebalancing/auto-execution language anywhere in the composed response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Compliance Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "SPY", targetWeightPct: 100, shares: 1, avgCostBasis: 450 });
    await fetch(`${baseUrl}/api/compliance/policies`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ policyType: "position_allocation_max", label: "No Fabrication Cap", targetKey: "SPY", direction: "max", limitValue: 10 }),
    });

    const dashboardRes = await fetch(`${baseUrl}/api/compliance/dashboard`, { headers: { cookie: user.cookie } });
    const dashboard = await dashboardRes.json();

    const serialized = JSON.stringify(dashboard).toLowerCase();
    expect(serialized).not.toMatch(
      /"probability"|"prediction"|"forecast"(?!ed)|montecarlo|monte carlo|autoexecute|autoadjust|autorebalance|"recommendedaction"|we recommend|buy signal|sell signal|"suggestedshares"|"ordertype"|you should (buy|sell)/,
    );
  });
});

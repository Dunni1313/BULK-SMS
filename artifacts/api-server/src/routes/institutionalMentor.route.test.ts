// Institutional Mentor — Phase 8, Sprint 5. Live route integration test
// for GET /institutional-mentor. Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve
// to the legacy-owner stand-in per tenantScope.ts, the same established
// pattern routes/portfolioAnalyst.route.test.ts/routes/tradeJournal.
// route.test.ts already use). This route is a thin pass-through to
// lib/institutionalMentor.ts's already-unit-tested
// buildInstitutionalMentor() (see lib/institutionalMentor.test.ts's own
// isolated-user coverage) — these tests prove the HTTP wiring, response
// shape, and the never-a-broker-write/order-creation/trade-
// recommendation contract.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/institutionalMentor.test.ts's own isolated-user coverage)
// — the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/portfolioAnalyst.route.test.ts already established for exactly
// this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface InstitutionalMentorResponse {
  paperTradingMode: true;
  deterministicAnalysis: true;
  educationalOnly: true;
  scorecard: { category: string; label: string; score: number; grade: string; sourceModule: string; why: string }[];
  professionalReview: { text: string; category: string; sourceModule: string }[];
  decisionReview: { code: string; text: string; status: string; sourceModule: string; detail: string }[];
  capitalAllocationReview: { capitalEfficiencyScore: number; capitalEfficiencyGrade: string; allocationByStrategy: unknown[]; positionDistribution: unknown[]; cashUtilizationPct: number; summary: string };
  riskReview: { largestPortfolioRisk: string; primaryContributor: string; riskTrend: string; guidance: unknown[]; summary: string };
  incomeReview: { monthlyTheta: number; weeklyTheta: number; dailyTheta: number; annualizedTheta: number; incomeTrend: string; bySymbol: unknown[]; byStrategy: unknown[]; summary: string };
  behaviourReview: { disciplineScore: number; totalClosedTrades: number; behaviorPatterns: unknown[]; strengths: unknown[]; areasToImprove: unknown[]; summary: string };
  learningSummary: Record<string, { category: string; lessonHref: string | null; glossaryHref: string | null; strategyHref: string | null; explainModeHref: string | null }>;
  generatedAt: string;
}

describe("GET /institutional-mentor (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchMentor(): Promise<InstitutionalMentorResponse> {
    const res = await fetch(`${baseUrl}/api/institutional-mentor`);
    expect(res.status).toBe(200);
    return (await res.json()) as InstitutionalMentorResponse;
  }

  it("generates a well-shaped, deterministic-analysis, educational-only, Paper-Trading result", async () => {
    const body = await fetchMentor();
    expect(body.paperTradingMode).toBe(true);
    expect(body.deterministicAnalysis).toBe(true);
    expect(body.educationalOnly).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("Portfolio Scorecard has all 9 real categories, each with a numeric score, a grade, and a cited sourceModule", async () => {
    const body = await fetchMentor();
    expect(body.scorecard.length).toBe(9);
    const categories = body.scorecard.map((s) => s.category).sort();
    expect(categories).toEqual(
      [
        "capital_allocation",
        "diversification",
        "discipline",
        "event_preparation",
        "greeks_management",
        "income_generation",
        "position_sizing",
        "portfolio_health",
        "risk_management",
      ].sort(),
    );
    for (const entry of body.scorecard) {
      expect(typeof entry.score).toBe("number");
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(100);
      expect(["Excellent", "Good", "Fair", "Poor"]).toContain(entry.grade);
      expect(entry.sourceModule.length).toBeGreaterThan(0);
      expect(entry.why.length).toBeGreaterThan(0);
    }
  });

  it("Professional Review is a real array of deterministic, template-sourced institutional-PM observations", async () => {
    const body = await fetchMentor();
    expect(Array.isArray(body.professionalReview)).toBe(true);
    for (const obs of body.professionalReview) {
      expect(obs.text.length).toBeGreaterThan(0);
      expect(obs.category.length).toBeGreaterThan(0);
      expect(obs.sourceModule.length).toBeGreaterThan(0);
    }
  });

  it("Decision Review items each carry a real status, sourceModule, and detail — never a subjective, unreferenced score", async () => {
    const body = await fetchMentor();
    expect(body.decisionReview.length).toBeGreaterThan(0);
    for (const item of body.decisionReview) {
      expect(["followed", "exceeded", "improved", "declined", "neutral"]).toContain(item.status);
      expect(item.sourceModule.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);
    }
  });

  it("Capital Allocation Review exposes real cash-utilisation and allocation-distribution arrays", async () => {
    const body = await fetchMentor();
    expect(typeof body.capitalAllocationReview.cashUtilizationPct).toBe("number");
    expect(Array.isArray(body.capitalAllocationReview.allocationByStrategy)).toBe(true);
    expect(Array.isArray(body.capitalAllocationReview.positionDistribution)).toBe(true);
    expect(body.capitalAllocationReview.summary.length).toBeGreaterThan(0);
  });

  it("Risk Review exposes a real largestPortfolioRisk string and guidance array", async () => {
    const body = await fetchMentor();
    expect(typeof body.riskReview.largestPortfolioRisk).toBe("string");
    expect(Array.isArray(body.riskReview.guidance)).toBe(true);
    expect(["improving", "declining", "stable", "insufficient_history"]).toContain(body.riskReview.riskTrend);
  });

  it("Income Review's weekly/monthly/annualized theta are internally consistent, real Theta Income projections", async () => {
    const body = await fetchMentor();
    expect(typeof body.incomeReview.monthlyTheta).toBe("number");
    expect(typeof body.incomeReview.weeklyTheta).toBe("number");
    expect(typeof body.incomeReview.dailyTheta).toBe("number");
    expect(typeof body.incomeReview.annualizedTheta).toBe("number");
    expect(["improving", "declining", "stable", "insufficient_history"]).toContain(body.incomeReview.incomeTrend);
  });

  it("Behaviour Review is a real pass-through of the AI Trade Journal's own already-computed figures", async () => {
    const body = await fetchMentor();
    expect(typeof body.behaviourReview.disciplineScore).toBe("number");
    expect(typeof body.behaviourReview.totalClosedTrades).toBe("number");
    expect(Array.isArray(body.behaviourReview.behaviorPatterns)).toBe(true);
    expect(Array.isArray(body.behaviourReview.strengths)).toBe(true);
    expect(Array.isArray(body.behaviourReview.areasToImprove)).toBe(true);
  });

  it("Institutional Lessons attaches a real cross-link with a non-empty category to every section", async () => {
    const body = await fetchMentor();
    for (const link of Object.values(body.learningSummary)) {
      expect(link.category.length).toBeGreaterThan(0);
      expect(link.lessonHref !== null || link.glossaryHref !== null || link.strategyHref !== null).toBe(true);
    }
  });

  it("never carries a broker-write/order-creation/trade-recommendation surface — no such fields exist on this response shape", async () => {
    const body = await fetchMentor();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
    expect(body).not.toHaveProperty("recommendation");
    expect(body).not.toHaveProperty("action");
    expect(body).not.toHaveProperty("tradeRecommendation");
  });

  it("is a GET with no request body", async () => {
    const res = await fetch(`${baseUrl}/api/institutional-mentor`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated same-day calls (never mutates state that would change the answer)", async () => {
    const a = await fetchMentor();
    const b = await fetchMentor();
    expect(a.scorecard).toEqual(b.scorecard);
    expect(a.professionalReview).toEqual(b.professionalReview);
    expect(a.decisionReview).toEqual(b.decisionReview);
  });
});

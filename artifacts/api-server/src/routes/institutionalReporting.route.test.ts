// Phase 22 — Institutional Reporting & Client Presentation Engine. Live
// route integration tests. Uses the real app + a real Postgres connection
// (no auth session needed — unauthenticated requests resolve to the
// legacy-owner stand-in per tenantScope.ts). Per the established
// collision-avoidance precedent (notifications.route.test.ts,
// opportunityDiscovery.route.test.ts), this file uses a real, known
// SIMULATED-universe symbol (AAPL) for read-only generate checks (never
// mutates shared state) and a fresh, unique portfolio name for the
// portfolio-scoped checks (which do mutate the shared legacy-owner account).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ReportTypeMeta {
  reportType: string;
  label: string;
  description: string;
  requiresSymbol: boolean;
  requiresPortfolio: boolean;
}

interface InstitutionalReport {
  reportType: string;
  title: string;
  subtitle: string;
  symbol: string | null;
  portfolioId: number | null;
  dataSource: string;
  sections: { id: string; title: string; body: string; bullets?: string[] }[];
  disclaimer: string;
}

describe("Institutional Reporting & Client Presentation Engine routes (live, SIMULATED path)", () => {
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

  it("GET /reporting/types returns all 30 report types (Phase 37 adds risk-exposure-summary and portfolio-concentration-report; Phase 38 adds performance-summary and performance-attribution-report; Phase 39 adds scenario-analysis-report and stress-test-report; Phase 40 adds executive-decision-summary and institutional-health-report; Phase 41 adds portfolio-allocation-report and rebalancing-planning-report; Phase 42 adds compliance-report and policy-monitoring-report; Phase 43 adds watchlist-summary-report and opportunity-dashboard-report)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/types`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportTypeMeta[];
    expect(body).toHaveLength(30);
    expect(body.map((m) => m.reportType).sort()).toEqual(
      [
        "ai-coach-summary",
        "company-research",
        "compliance-report",
        "executive-intelligence-summary",
        "executive-summary",
        "investment-committee",
        "monitoring-summary",
        "opportunity-discovery",
        "opportunity-dashboard-report",
        "options-income-summary",
        "options-portfolio-review",
        "policy-monitoring-report",
        "position-lifecycle-summary",
        "risk-exposure-summary",
        "portfolio-concentration-report",
        "performance-summary",
        "performance-attribution-report",
        "scenario-analysis-report",
        "stress-test-report",
        "executive-decision-summary",
        "institutional-health-report",
        "portfolio-allocation-report",
        "rebalancing-planning-report",
        "portfolio-health",
        "portfolio-review",
        "strategy-framework-summary",
        "trade-planning-summary",
        "trading-analytics-summary",
        "watchlist",
        "watchlist-summary-report",
      ].sort(),
    );
  });

  it("GET /reporting/scenario-analysis-report resolves the full cross-engine Scenario Analysis Report", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/scenario-analysis-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("scenario-analysis-report");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual(["executive-summary", "portfolio-impact-summary", "asset-impact", "sector-impact", "strategy-impact", "scenario-comparison"]);
  });

  it("GET /reporting/stress-test-report resolves the Options-focused Stress Test Report", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/stress-test-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("stress-test-report");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual(["executive-summary", "portfolio-impact-summary", "greeks-impact", "buying-power-impact", "capital-impact"]);
  });

  it("GET /reporting/investment-committee/:symbol resolves a real report for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/investment-committee/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("investment-committee");
    expect(body.symbol).toBe("AAPL");
    expect(body.sections.map((s) => s.id)).toContain("investment-committee");
  });

  it("GET /reporting/investment-committee/:symbol 404s for an unresolvable symbol", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/investment-committee/NOTATICKER!!`);
    expect(res.status).toBe(404);
  });

  it("GET /reporting/company-research/:symbol resolves the full 13-section report", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/company-research/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("company-research");
    expect(body.sections.length).toBeGreaterThanOrEqual(13);
    expect(body.sections.map((s) => s.id)).toContain("investment-memo");
  });

  it("GET /reporting/company-research/:symbol?includeCoach=true includes real AI Coach explanations", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/company-research/AAPL?includeCoach=true`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    const coach = body.sections.find((s) => s.id === "ai-coach")!;
    expect(coach.bullets && coach.bullets.length).toBeGreaterThan(0);
  });

  it("GET /reporting/watchlist resolves (honest empty or real items)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/watchlist`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("watchlist");
  });

  it("GET /reporting/opportunity-discovery resolves with a section per bucket", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/opportunity-discovery`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("opportunity-discovery");
    expect(body.sections.length).toBeGreaterThan(1);
  });

  it("GET /reporting/monitoring-summary resolves", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/monitoring-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("monitoring-summary");
  });

  it("GET /reporting/ai-coach-summary resolves real learning progress", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/ai-coach-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("ai-coach-summary");
  });

  it("GET /reporting/executive-summary reuses the Cross-Engine Daily Report", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/executive-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("executive-summary");
    expect(body.sections.map((s) => s.id)).toEqual(["executive-summary", "investment-committee", "portfolio-risk", "portfolio-health"]);
  });

  it("GET /reporting/trade-planning-summary (Phase 28) reuses the calling user's own Trade Plans and Trading Risk analysis", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/trade-planning-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("trade-planning-summary");
    expect(body.sections.map((s) => s.id)).toEqual(["executive-summary", "trade-plans", "portfolio-risk"]);
  });

  it("full trade-planning-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "trade-planning-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("trade-planning-summary");
    expect(saved.report.reportType).toBe("trade-planning-summary");
  });

  it("GET /reporting/trading-analytics-summary (Phase 32) reuses the Trading Analytics Engine's own dashboard, reformatted into report sections", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/trading-analytics-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("trading-analytics-summary");
    expect(body.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "strategy-usage",
      "journal-analytics",
      "risk-analytics",
      "learning-analytics",
      "coach-analytics",
      "session-analytics",
    ]);
    expect(body.disclaimer).toContain("no new investment recommendation");
  });

  it("full trading-analytics-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "trading-analytics-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("trading-analytics-summary");
    expect(saved.report.reportType).toBe("trading-analytics-summary");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    const list = (await listRes.json()) as { id: number; reportType: string }[];
    expect(list.some((r) => r.id === saved.id && r.reportType === "trading-analytics-summary")).toBe(true);

    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/options-income-summary (Phase 35) reuses the Options Income Engine's own dashboard, reformatted into report sections, never a P/L forecast", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/options-income-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("options-income-summary");
    expect(body.sections.map((s) => s.id)).toEqual(["executive-summary", "theta-income", "strategy-mix", "upcoming-expirations"]);
    expect(body.disclaimer).toContain("no new investment recommendation");
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"/);
  });

  it("full options-income-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "options-income-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("options-income-summary");
    expect(saved.report.reportType).toBe("options-income-summary");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    const list = (await listRes.json()) as { id: number; reportType: string }[];
    expect(list.some((r) => r.id === saved.id && r.reportType === "options-income-summary")).toBe(true);

    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/options-portfolio-review (Phase 36) reuses the Options Portfolio Management view, reformatted into report sections, never a rebalancing recommendation", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/options-portfolio-review`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("options-portfolio-review");
    expect(body.sections.map((s) => s.id)).toEqual([
      "capital-utilisation",
      "position-concentration",
      "strategy-allocation",
      "sector-allocation",
      "expiration-ladder",
      "income-allocation",
      "expiration-tracker",
    ]);
    expect(body.disclaimer).toContain("no new investment recommendation");
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"|"rebalanc/);
  });

  it("full options-portfolio-review save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "options-portfolio-review" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("options-portfolio-review");
    expect(saved.report.reportType).toBe("options-portfolio-review");
    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/position-lifecycle-summary (Phase 36) reuses buildLifecycleSummary()'s own real tally, reformatted into report sections, never an automated stage assessment", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/position-lifecycle-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("position-lifecycle-summary");
    expect(body.sections.map((s) => s.id)).toEqual(["lifecycle-overview", "positions-by-stage"]);
    expect(body.disclaimer).toContain("no new investment recommendation");
  });

  it("full position-lifecycle-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "position-lifecycle-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("position-lifecycle-summary");
    expect(saved.report.reportType).toBe("position-lifecycle-summary");
    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/risk-exposure-summary (Phase 37) reuses the Risk & Exposure Intelligence Engine's own dashboard, reformatted into report sections, never a hedging or rebalancing recommendation", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/risk-exposure-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("risk-exposure-summary");
    expect(body.sections.map((s) => s.id)).toEqual(["risk-overview", "capital-allocation", "buying-power-overview", "greeks-summary", "cross-engine-exposure"]);
    expect(body.disclaimer).toContain("no new investment recommendation");
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"|"rebalanc|"hedg/);
  });

  it("full risk-exposure-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "risk-exposure-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("risk-exposure-summary");
    expect(saved.report.reportType).toBe("risk-exposure-summary");
    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/portfolio-concentration-report (Phase 37) reuses the same Risk & Exposure dashboard's own combined concentration figures, reformatted into report sections, never a diversification recommendation", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/portfolio-concentration-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("portfolio-concentration-report");
    expect(body.sections.map((s) => s.id)).toEqual(["sector-concentration", "strategy-concentration", "asset-allocation", "concentration-timeline"]);
    expect(body.disclaimer).toContain("no new investment recommendation");
  });

  it("full portfolio-concentration-report save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "portfolio-concentration-report" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("portfolio-concentration-report");
    expect(saved.report.reportType).toBe("portfolio-concentration-report");
    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/executive-intelligence-summary (Phase 33) reuses the Executive Intelligence Hub's own composition, reformatted into report sections", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/executive-intelligence-summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("executive-intelligence-summary");
    expect(body.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "investment-committee",
      "portfolio-risk",
      "strategy-usage",
      "portfolio-health",
      "risk-analytics",
      "learning-analytics",
      "coach-analytics",
      "monitoring",
      "checklist",
    ]);
    expect(body.disclaimer).toContain("no new investment recommendation");
  });

  it("full executive-intelligence-summary save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "executive-intelligence-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("executive-intelligence-summary");
    expect(saved.report.reportType).toBe("executive-intelligence-summary");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    const list = (await listRes.json()) as { id: number; reportType: string }[];
    expect(list.some((r) => r.id === saved.id && r.reportType === "executive-intelligence-summary")).toBe(true);

    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("full portfolio-review/portfolio-health flow via a fresh portfolio", async () => {
    const portfolioName = `Reporting Test Portfolio ${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: portfolioName, description: "" }),
    });
    expect(createRes.status).toBe(200);
    const portfolio = (await createRes.json()) as { id: number };

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", targetWeightPct: 100, shares: 10 }),
    });

    const reviewRes = await fetch(`${baseUrl}/api/reporting/portfolio-review/${portfolio.id}`);
    expect(reviewRes.status).toBe(200);
    const review = (await reviewRes.json()) as InstitutionalReport;
    expect(review.reportType).toBe("portfolio-review");
    expect(review.portfolioId).toBe(portfolio.id);
    expect(review.title).toContain(portfolioName);

    const healthRes = await fetch(`${baseUrl}/api/reporting/portfolio-health/${portfolio.id}`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as InstitutionalReport;
    expect(health.reportType).toBe("portfolio-health");
    expect(health.portfolioId).toBe(portfolio.id);

    const notFoundRes = await fetch(`${baseUrl}/api/reporting/portfolio-review/999999999`);
    expect(notFoundRes.status).toBe(404);
  });

  it("full save/list/get/delete persistence flow", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportType: "executive-summary" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("executive-summary");
    expect(saved.report.reportType).toBe("executive-summary");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.some((r) => r.id === saved.id)).toBe(true);

    const getRes = await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`);
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as { id: number };
    expect(got.id).toBe(saved.id);

    const deleteRes = await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);

    const getAfterDeleteRes = await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`);
    expect(getAfterDeleteRes.status).toBe(404);
  });

  it("POST /reporting/reports 404s when the report cannot be generated (unknown symbol)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportType: "company-research", symbol: "NOTATICKER!!" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /reporting/reports 400s for a missing reportType", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /reporting/compliance-report resolves the Compliance Report (Phase 42)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/compliance-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("compliance-report");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual(["compliance-summary", "policy-violations"]);
  });

  it("GET /reporting/policy-monitoring-report resolves the full Policy Monitoring Report (Phase 42)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/policy-monitoring-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("policy-monitoring-report");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual([
      "compliance-summary",
      "allocation-limits",
      "sector-limits",
      "asset-limits",
      "position-limits",
      "strategy-limits",
      "greeks-limits",
      "buying-power-limits",
      "income-stability-limits",
      "diversification-limits",
      "compliance-timeline",
    ]);
  });

  it("full compliance-report save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportType: "compliance-report" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("compliance-report");
    expect(saved.report.reportType).toBe("compliance-report");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    const list = (await listRes.json()) as { id: number; reportType: string }[];
    expect(list.some((r) => r.id === saved.id && r.reportType === "compliance-report")).toBe(true);

    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });

  it("GET /reporting/watchlist-summary-report resolves the Watchlist Summary Report (Phase 43)", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/watchlist-summary-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("watchlist-summary-report");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual(["watchlist-overview", "watchlist-health", "cross-engine-summary", "watchlist-dashboard-summary"]);
  });

  it("GET /reporting/opportunity-dashboard-report resolves the Opportunity Dashboard Report (Phase 43), distinct from the existing Opportunity Discovery Report", async () => {
    const res = await fetch(`${baseUrl}/api/reporting/opportunity-dashboard-report`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionalReport;
    expect(body.reportType).toBe("opportunity-dashboard-report");
    expect(body.reportType).not.toBe("opportunity-discovery");
    expect(body.symbol).toBeNull();
    expect(body.portfolioId).toBeNull();
    expect(body.sections.map((s) => s.id)).toEqual(["opportunity-overview"]);
  });

  it("full watchlist-summary-report save/persist flow via POST /reporting/reports", async () => {
    const saveRes = await fetch(`${baseUrl}/api/reporting/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportType: "watchlist-summary-report" }),
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number; reportType: string; report: InstitutionalReport };
    expect(saved.reportType).toBe("watchlist-summary-report");
    expect(saved.report.reportType).toBe("watchlist-summary-report");

    const listRes = await fetch(`${baseUrl}/api/reporting/reports`);
    const list = (await listRes.json()) as { id: number; reportType: string }[];
    expect(list.some((r) => r.id === saved.id && r.reportType === "watchlist-summary-report")).toBe(true);

    await fetch(`${baseUrl}/api/reporting/reports/${saved.id}`, { method: "DELETE" });
  });
});

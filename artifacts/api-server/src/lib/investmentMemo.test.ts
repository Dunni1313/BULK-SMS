// Phase 19 — Institutional Investment Committee Workbench unit tests.
//
// Deliberately runs the REAL buildValueResearchReport()/buildInstitutionalDecision()
// (via the same fundamentalsOverride test seam decisionEngine.test.ts already
// uses) rather than hand-constructing report/decision fixtures, so these
// tests prove genuine integration with every reused engine, not just
// investmentMemo.ts in isolation.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import { buildInstitutionalDecision, type ManagementQualityResult, type DecisionPortfolioContext } from "./decisionEngine.js";
import { buildInvestmentMemo, type InvestmentMemoResearchNote, type InvestmentMemoMonitoringAlert } from "./investmentMemo.js";
import type { Fundamentals } from "./fundamentals.js";

const NO_MANAGEMENT: ManagementQualityResult = { available: false, score: null, reason: "Document Intelligence could not resolve a filing in this environment." };

function fixture(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: "TEST",
    name: "Test Co",
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 100,
    sector: "Technology",
    industry: "Software",
    beta: 1.1,
    marketCap: 50e9,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 5,
    epsFwd: 5.5,
    fcfPerShare: 4.5,
    salesPerShare: 30,
    bookPerShare: 20,
    dividendPerShare: 0,
    pe: 20,
    forwardPe: 18,
    peg: 1.2,
    ps: 3.3,
    pb: 5,
    fcfYield: 0.045,
    earningsYield: 0.05,
    dividendYield: 0,
    revenueGrowth5y: 0.1,
    epsGrowth5y: 0.12,
    revenueGrowthFwd: 0.09,
    grossMargin: 0.55,
    operatingMargin: 0.25,
    netMargin: 0.18,
    roe: 0.22,
    roic: 0.18,
    debtToEquity: 0.4,
    interestCoverage: 12,
    currentRatio: 1.6,
    netCashPerShare: 3,
    fcfPositiveYears: 9,
    fcfMargin: 0.15,
    qualitative: {
      pricingPower: 60, brand: 60, customerLoyalty: 55, recurringRevenue: 55, scale: 55,
      switchingCost: 55, networkEffect: 50, ipStrength: 55, distribution: 55, regulatoryAdvantage: 50,
    },
    revenueHistory: [20, 22, 24, 26, 28, 30],
    epsHistory: [3, 3.5, 4, 4.3, 4.7, 5],
    fcfHistory: [2.7, 3, 3.4, 3.8, 4.1, 4.5],
    ...overrides,
  };
}

async function reportFor(f: Fundamentals): Promise<ValueResearchReport> {
  const report = await buildValueResearchReport(f.symbol, f.asOf, undefined, f);
  if (!report) throw new Error("expected a report");
  return report;
}

const HEADINGS = [
  "Business Summary",
  "Business Quality",
  "Competitive Advantage",
  "Financial Strength",
  "Valuation Summary",
  "Margin of Safety",
  "Decision Engine",
  "Investment Committee Verdict",
  "Portfolio Impact",
  "Risk Summary",
  "Catalysts",
  "Research Notes",
  "Monitoring Summary",
  "Conclusion",
];

describe("buildInvestmentMemo", () => {
  it("produces exactly the 14 required sections, in order, each with at least one paragraph", async () => {
    const report = await reportFor(fixture({ symbol: "MEMOCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    expect(memo.sections.map((s) => s.heading)).toEqual(HEADINGS);
    for (const section of memo.sections) {
      expect(section.paragraphs.length).toBeGreaterThan(0);
      for (const p of section.paragraphs) expect(p.length).toBeGreaterThan(0);
    }
  });

  it("never invents a recommendation — restates the Decision Engine's own recommendation/confidence verbatim", async () => {
    const report = await reportFor(fixture({ symbol: "RESTATE" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    expect(memo.recommendation).toBe(decision.recommendation);
    expect(memo.confidence).toBe(decision.confidence);
    const conclusion = memo.sections.find((s) => s.heading === "Conclusion")!;
    expect(conclusion.paragraphs[0]).toContain(decision.recommendation);
    const decisionSection = memo.sections.find((s) => s.heading === "Decision Engine")!;
    expect(decisionSection.paragraphs[0]).toContain(decision.recommendation);
  });

  it("Business Quality section quotes report.businessQuality's own score and rating, never a recomputed value", async () => {
    const report = await reportFor(fixture({ symbol: "BQCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    const section = memo.sections.find((s) => s.heading === "Business Quality")!;
    expect(section.paragraphs[0]).toContain(report.businessQuality.score.toFixed(0));
    expect(section.paragraphs[0]).toContain(report.businessQuality.rating);
  });

  it("Investment Committee Verdict section quotes report.investmentCommittee's own consolidated verdict and agreement", async () => {
    const report = await reportFor(fixture({ symbol: "ICVOTE" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    const section = memo.sections.find((s) => s.heading === "Investment Committee Verdict")!;
    expect(section.paragraphs[0]).toContain(report.investmentCommittee.consolidatedVerdict);
    expect(section.paragraphs[0]).toContain(report.investmentCommittee.agreement);
  });

  it("Risk Summary and Catalysts sections quote decision.risks/thingsToMonitor/catalysts directly, never a new risk", async () => {
    const report = await reportFor(fixture({ symbol: "RISKCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    const riskSection = memo.sections.find((s) => s.heading === "Risk Summary")!;
    if (decision.risks.length > 0) {
      for (const r of decision.risks) expect(riskSection.paragraphs.join(" ")).toContain(r);
    } else {
      expect(riskSection.paragraphs[0]).toBe("No risks identified.");
    }

    const catalystsSection = memo.sections.find((s) => s.heading === "Catalysts")!;
    if (decision.catalysts.length > 0) {
      for (const c of decision.catalysts) expect(catalystsSection.paragraphs.join(" ")).toContain(c);
    } else {
      expect(catalystsSection.paragraphs[0]).toBe("No catalysts identified.");
    }
  });

  it("Portfolio Impact honestly reports 'no portfolio context' when none supplied, never fabricates a weight", async () => {
    const report = await reportFor(fixture({ symbol: "NOPORT" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    const section = memo.sections.find((s) => s.heading === "Portfolio Impact")!;
    expect(section.paragraphs[0]).toBe(decision.portfolioFit.reason);
    expect(decision.portfolioFit.available).toBe(false);
  });

  it("Portfolio Impact reflects a real supplied portfolio context's currentWeightPct verbatim", async () => {
    const report = await reportFor(fixture({ symbol: "HELDCO" }));
    const portfolioContext: DecisionPortfolioContext = {
      portfolioId: 7,
      alreadyHeld: true,
      currentWeightPct: 12.5,
      sectorExposurePct: 30,
      diversificationScore: 60,
      portfolioRiskScore: 55,
    };
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, portfolioContext);
    const memo = buildInvestmentMemo(report, decision);

    const section = memo.sections.find((s) => s.heading === "Portfolio Impact")!;
    expect(section.paragraphs[0]).toContain("12.5%");
    expect(section.paragraphs[1]).toContain("30.0%");
  });

  it("Research Notes section quotes the exact already-fetched notes handed in, honestly empty when none supplied", async () => {
    const report = await reportFor(fixture({ symbol: "NOTESCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    const empty = buildInvestmentMemo(report, decision);
    expect(empty.sections.find((s) => s.heading === "Research Notes")!.paragraphs[0]).toBe("No research notes recorded for this symbol yet.");

    const notes: InvestmentMemoResearchNote[] = [{ note: "Watching Q3 margins closely.", createdAt: "2026-01-10T00:00:00.000Z" }];
    const withNotes = buildInvestmentMemo(report, decision, notes);
    const section = withNotes.sections.find((s) => s.heading === "Research Notes")!;
    expect(section.paragraphs.join(" ")).toContain("Watching Q3 margins closely.");
  });

  it("Monitoring Summary section quotes the exact already-fetched alerts handed in, honestly empty when none supplied", async () => {
    const report = await reportFor(fixture({ symbol: "ALERTCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    const empty = buildInvestmentMemo(report, decision);
    expect(empty.sections.find((s) => s.heading === "Monitoring Summary")!.paragraphs[0]).toBe("No monitoring alerts recorded for this symbol.");

    const alerts: InvestmentMemoMonitoringAlert[] = [
      { title: "Price target crossed", message: "Below desired buy price.", severity: "info", isRead: false, createdAt: "2026-01-12T00:00:00.000Z" },
    ];
    const withAlerts = buildInvestmentMemo(report, decision, [], alerts);
    const section = withAlerts.sections.find((s) => s.heading === "Monitoring Summary")!;
    expect(section.paragraphs.join(" ")).toContain("Price target crossed");
    expect(section.paragraphs[0]).toContain("1 unread");
  });

  it("never predicts a price or forecasts a return anywhere in the memo (excluding the disclaimer, which discloses the invariant)", async () => {
    const report = await reportFor(fixture({ symbol: "HONESTCO" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision, [{ note: "x", createdAt: "2026-01-01T00:00:00.000Z" }], [
      { title: "y", message: "z", severity: null, isRead: true, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const bodyText = memo.sections.flatMap((s) => s.paragraphs).join(" ").toLowerCase();
    expect(bodyText).not.toMatch(/price target/);
    expect(bodyText).not.toMatch(/expected return/);
    expect(bodyText).not.toMatch(/we (predict|forecast)/);
  });

  it("handles an ETF symbol with the established diversified-fund caveat, and a deeply unprofitable company honestly", async () => {
    const etfReport = await reportFor(fixture({ symbol: "ETFCO", kind: "etf" }));
    const etfDecision = buildInstitutionalDecision(etfReport, NO_MANAGEMENT, null);
    const etfMemo = buildInvestmentMemo(etfReport, etfDecision);
    expect(etfMemo.sections[0].paragraphs[0]).toContain("diversified fund");

    const poorReport = await reportFor(
      fixture({
        symbol: "UNPROFIT",
        epsTtm: -2,
        epsFwd: -1.5,
        fcfPerShare: -1,
        roic: -0.05,
        roe: -0.1,
      }),
    );
    const poorDecision = buildInstitutionalDecision(poorReport, NO_MANAGEMENT, null);
    const poorMemo = buildInvestmentMemo(poorReport, poorDecision);
    expect(["Reduce", "Sell", "Avoid", "Hold"]).toContain(poorMemo.recommendation);
    expect(poorMemo.sections.map((s) => s.heading)).toEqual(HEADINGS);
  });

  it("carries both required disclaimers' invariant language (educational, never a recommendation beyond restating existing engines)", async () => {
    const report = await reportFor(fixture({ symbol: "DISCLAIM" }));
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    const memo = buildInvestmentMemo(report, decision);

    expect(memo.disclaimer).toContain("Educational value-investing research only");
    expect(memo.disclaimer).toContain("not investment advice");
    expect(memo.overview).toContain("No LLM narration, no new scoring, no price prediction.");
  });
});

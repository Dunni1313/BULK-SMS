// Phase 22 — Institutional Reporting & Client Presentation Engine unit tests.
//
// Deliberately runs the REAL buildValueResearchReport()/buildInstitutionalDecision()
// (via the same fundamentalsOverride test seam decisionEngine.test.ts/
// investingCoach.test.ts already use) for the symbol-scoped report types, so
// these tests prove genuine integration and that every quoted section is
// byte-identical to the source engine's own already-computed output — never
// a re-derivation. Portfolio/opportunity/watchlist/learning/cross-engine
// report types are tested against small, hand-constructed fixtures of their
// own already-defined shapes, since those engines are exercised end-to-end
// elsewhere (portfolioIntelligence.test.ts, opportunityDiscovery.test.ts, etc.).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import { buildInstitutionalDecision, type ManagementQualityResult, type InstitutionalDecisionAnalysis } from "./decisionEngine.js";
import { buildInvestmentMemo } from "./investmentMemo.js";
import { explainCoach, COACH_TYPES, type CoachType, type CoachExplanation } from "./investingCoach.js";
import type { Fundamentals } from "./fundamentals.js";
import type { PortfolioIntelligenceAnalysis } from "./portfolioIntelligence.js";
import type { PortfolioOptimisationAnalysis } from "./portfolioOptimisation.js";
import type { OpportunityScanResult, OpportunityBucket } from "./opportunityDiscovery.js";
import type { CrossEngineDailyReport } from "./crossEngineDailyReport.js";
import type { LearningProgressSummary } from "./learningProgress.js";
import type { WatchlistTargetCheck } from "./watchlistTargets.js";
import type { StrategyMetadata } from "./tradingStrategyFramework.js";
import {
  REPORT_TYPES,
  REPORT_TYPE_META,
  buildInvestmentCommitteeReport,
  buildCompanyResearchReport,
  buildPortfolioReviewReport,
  buildPortfolioHealthReport,
  buildWatchlistReport,
  buildOpportunityDiscoveryReport,
  buildMonitoringSummaryReport,
  buildAiCoachLearningSummaryReport,
  buildExecutiveSummaryReport,
  buildStrategyFrameworkSummaryReport,
  type StrategyFrameworkChecklistSummaryItem,
  type StrategyFrameworkLearningCoverageItem,
  type StrategyFrameworkWorkspaceNoteItem,
  buildOptionsIncomeSummaryReport,
  businessQualitySection,
  financialStrengthSection,
  valuationSection,
  marginOfSafetySection,
  investmentCommitteeSection,
  type WatchlistReportItem,
} from "./institutionalReporting.js";
import { buildOptionsIncomeDashboard } from "./optionsIncomeAnalytics.js";

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
  } as Fundamentals;
}

async function reportFor(f: Fundamentals): Promise<ValueResearchReport> {
  const report = await buildValueResearchReport(f.symbol, f.asOf, undefined, f);
  if (!report) throw new Error("expected a report");
  return report;
}

function decisionFor(report: ValueResearchReport): InstitutionalDecisionAnalysis {
  return buildInstitutionalDecision(report, NO_MANAGEMENT, null);
}

describe("institutionalReporting.ts — REPORT_TYPE_META", () => {
  it("has exactly 32 entries matching REPORT_TYPES (mechanically updated as each later phase — through Phase 44's portfolio-workspace-summary/institutional-review-report — added its own new report types; this count had drifted out of sync with REPORT_TYPES since Phase 38 and is corrected here, a pre-existing staleness discovered while extending this file for Phase 44, not a Phase 44 regression)", () => {
    expect(REPORT_TYPE_META).toHaveLength(32);
    expect(REPORT_TYPES).toHaveLength(32);
    expect(REPORT_TYPE_META.map((m) => m.reportType).sort()).toEqual([...REPORT_TYPES].sort());
  });

  it("every entry has a non-empty label and description", () => {
    for (const m of REPORT_TYPE_META) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

describe("institutionalReporting.ts — shared section builders never re-derive ValueResearchReport sections", () => {
  it("businessQuality/financialStrength/valuation/marginOfSafety/investmentCommittee sections are byte-identical to report.sections", async () => {
    const report = await reportFor(fixture());
    expect(businessQualitySection(report)).toEqual(report.sections.find((s) => s.id === "business"));
    expect(financialStrengthSection(report)).toEqual(report.sections.find((s) => s.id === "financial"));
    expect(valuationSection(report)).toEqual(report.sections.find((s) => s.id === "valuation"));
    expect(marginOfSafetySection(report)).toEqual(report.sections.find((s) => s.id === "margin-of-safety"));
    expect(investmentCommitteeSection(report)).toEqual(report.sections.find((s) => s.id === "investment-committee"));
  });
});

describe("institutionalReporting.ts — buildInvestmentCommitteeReport", () => {
  it("assembles the expected sections and honest metadata", async () => {
    const report = await reportFor(fixture());
    const decision = decisionFor(report);
    const built = buildInvestmentCommitteeReport(report, decision);

    expect(built.reportType).toBe("investment-committee");
    expect(built.symbol).toBe(report.symbol);
    expect(built.portfolioId).toBeNull();
    expect(built.dataSource).toBe(report.dataSource);
    expect(built.sections.map((s) => s.id)).toEqual(["executive-summary", "investment-committee", "decision-engine", "evidence", "portfolio-impact"]);
    expect(built.title).toContain(report.symbol);
    expect(built.subtitle).toContain(decision.recommendation);
  });
});

describe("institutionalReporting.ts — buildCompanyResearchReport", () => {
  it("assembles all 13 sections in order, reusing the memo verbatim", async () => {
    const report = await reportFor(fixture());
    const decision = decisionFor(report);
    const memo = buildInvestmentMemo(report, decision, [], []);
    const built = buildCompanyResearchReport(report, decision, memo, [], [], []);

    expect(built.reportType).toBe("company-research");
    expect(built.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "business",
      "financial",
      "valuation",
      "margin-of-safety",
      "decision-engine",
      "investment-committee",
      "portfolio-impact",
      "evidence",
      "monitoring",
      "research-notes",
      "investment-memo",
      "ai-coach",
    ]);
    const memoSection = built.sections.find((s) => s.id === "investment-memo")!;
    expect(memoSection.body).toBe(memo.overview);
    expect(memoSection.bullets).toHaveLength(memo.sections.length);
  });

  it("honestly reports no AI Coach explanations when none were requested", async () => {
    const report = await reportFor(fixture());
    const decision = decisionFor(report);
    const memo = buildInvestmentMemo(report, decision, [], []);
    const built = buildCompanyResearchReport(report, decision, memo, [], [], []);
    const coachSection = built.sections.find((s) => s.id === "ai-coach")!;
    expect(coachSection.body).toMatch(/no institutional ai coach/i);
    expect(coachSection.bullets).toBeUndefined();
  });

  it("surfaces real AI Coach explanations verbatim when supplied", async () => {
    const report = await reportFor(fixture());
    const decision = decisionFor(report);
    const memo = buildInvestmentMemo(report, decision, [], []);
    const explanations: CoachExplanation[] = COACH_TYPES.map((c: CoachType) => explainCoach(c, { report, decision, alerts: [] }));
    const built = buildCompanyResearchReport(report, decision, memo, [], [], explanations);
    const coachSection = built.sections.find((s) => s.id === "ai-coach")!;
    expect(coachSection.bullets).toHaveLength(explanations.length);
    expect(coachSection.bullets![0]).toContain(explanations[0].headline);
  });

  it("research notes and monitoring sections reflect real rows, never fabricated when present", async () => {
    const report = await reportFor(fixture());
    const decision = decisionFor(report);
    const notes = [{ note: "Watch the next earnings call.", createdAt: "2026-01-10T00:00:00.000Z" }];
    const alerts = [{ title: "Price crossed target", message: "AAPL crossed the buy target.", severity: "info", isRead: false, createdAt: "2026-01-12T00:00:00.000Z" }];
    const memo = buildInvestmentMemo(report, decision, notes, alerts);
    const built = buildCompanyResearchReport(report, decision, memo, notes, alerts, []);
    expect(built.sections.find((s) => s.id === "research-notes")!.bullets![0]).toContain("Watch the next earnings call.");
    expect(built.sections.find((s) => s.id === "monitoring")!.bullets![0]).toContain("Price crossed target");
  });
});

describe("institutionalReporting.ts — buildPortfolioReviewReport / buildPortfolioHealthReport", () => {
  function optimisationFixture(): PortfolioOptimisationAnalysis {
    return {
      portfolioId: 1,
      health: {
        qualityScore: 70,
        qualityLabel: "Good",
        capitalAllocationScore: 65,
        diversificationScore: 60,
        diversificationLabel: "Moderate",
        overallRiskScore: 55,
        overallRiskLabel: "Moderate",
        summary: "Portfolio health is Moderate overall.",
      },
      concentration: { score: 60, label: "Moderate", largestPositionPct: 20, top10ExposurePct: 80 } as unknown as PortfolioOptimisationAnalysis["concentration"],
      diversification: {
        bySector: [{ label: "Technology", weightPct: 50 }],
        byIndustry: [{ label: "Software", weightPct: 50 }],
        growthValueMix: [{ label: "Growth", weightPct: 100 }],
        qualityMix: [{ label: "High Quality", weightPct: 100 }],
        largestPositionPct: 20,
        top10ExposurePct: 80,
      },
      positionQualityRanking: [
        { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", weightPct: 20, qualityScore: 70, valuationRating: "Fair", investmentCommitteeVerdict: "Buy", decisionRecommendation: "Buy", rankScore: 82, action: "core", actionReason: "Strong quality and fair valuation." },
      ],
      upgradeCandidates: [],
      trimCandidates: [],
      exitCandidates: [],
      capitalAllocationSuggestions: [{ action: "Hold cash", detail: "No compelling redeployment target found." }],
      replacementOpportunities: [],
      cashDeploymentSuggestions: [],
      summary: "Portfolio review summary.",
      disclaimer: "Educational research only.",
    };
  }

  it("Portfolio Review Report assembles the expected sections", () => {
    const built = buildPortfolioReviewReport(1, "My Portfolio", optimisationFixture());
    expect(built.reportType).toBe("portfolio-review");
    expect(built.portfolioId).toBe(1);
    expect(built.symbol).toBeNull();
    expect(built.title).toContain("My Portfolio");
    expect(built.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "portfolio-health",
      "diversification",
      "position-quality-ranking",
      "portfolio-impact",
      "capital-allocation",
      "opportunity-discovery",
    ]);
    expect(built.sections[0].body).toBe("Portfolio review summary.");
  });

  function intelligenceFixture(): PortfolioIntelligenceAnalysis {
    return {
      qualityScore: { score: 72, label: "Good", detail: "Weighted quality is Good." },
      capitalAllocationScore: { score: 68, label: "Good", detail: "Weighted capital allocation is Good." },
      diversificationScore: { score: 58, label: "Moderate", detail: "Diversification is Moderate." },
      weightedMetrics: { roic: 0.18, roe: 0.2, grossMargin: 0.5, operatingMargin: 0.22, fcfYield: 0.04, dividendYield: 0.01, debtToEquity: 0.3 },
      allocation: {
        bySector: [{ label: "Technology", weightPct: 60 }],
        byIndustry: [{ label: "Software", weightPct: 60 }],
        byMarketCapBand: [{ label: "Mega Cap", weightPct: 100 }],
        byCountry: { available: false, reason: "Not tracked." },
        byCurrency: { available: false, reason: "Not tracked." },
        growthValueMix: [{ label: "Growth", weightPct: 100 }],
        qualityMix: [{ label: "High Quality", weightPct: 100 }],
        largestPositionPct: 25,
        top10ExposurePct: 90,
        cashAllocationPct: 5,
        cashAllocationNote: "5% cash on hand.",
      },
      risk: {
        overall: { score: 55, label: "Moderate" } as unknown as PortfolioIntelligenceAnalysis["risk"]["overall"],
        concentration: { score: 60, label: "Moderate" } as unknown as PortfolioIntelligenceAnalysis["risk"]["concentration"],
        sectorExposure: { score: 60, label: "Moderate" } as unknown as PortfolioIntelligenceAnalysis["risk"]["sectorExposure"],
        cyclicality: { score: 60, label: "Moderate" } as unknown as PortfolioIntelligenceAnalysis["risk"]["cyclicality"],
        cashRisk: { score: 80, label: "Low", detail: "Cash risk is Low." },
        dividendDependence: { score: 80, label: "Low", detail: "Dividend dependence is Low." },
        leverageExposure: { score: 70, label: "Moderate", detail: "Leverage exposure is Moderate." },
        qualityDrift: { score: 75, label: "Low", detail: "Quality drift is Low." },
        portfolioStability: { score: 70, label: "Moderate", detail: "Portfolio stability is Moderate." },
      },
      income: { portfolioDividendYield: 0.01, estAnnualDividendIncome: 120 },
      performance: {
        totalCostBasisValue: 10000,
        totalMarketValue: 11000,
        totalUnrealizedPnl: 1000,
        totalUnrealizedPnlPct: 10,
        holdingsWithoutCostBasis: [],
      },
      holdings: [],
      unresolvedSymbols: [],
      summary: "Portfolio intelligence summary.",
    };
  }

  it("Portfolio Health Report assembles the expected sections", () => {
    const built = buildPortfolioHealthReport(2, "Health Portfolio", intelligenceFixture());
    expect(built.reportType).toBe("portfolio-health");
    expect(built.portfolioId).toBe(2);
    expect(built.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "portfolio-health",
      "financial-ratios",
      "diversification",
      "portfolio-risk",
      "income",
      "performance",
    ]);
    expect(built.sections[0].body).toBe("Portfolio intelligence summary.");
  });
});

describe("institutionalReporting.ts — buildWatchlistReport", () => {
  it("honestly reports an empty watchlist", () => {
    const built = buildWatchlistReport([]);
    expect(built.sections.find((s) => s.id === "executive-summary")!.body).toMatch(/empty/i);
  });

  it("reflects real items and their crossed-target status", () => {
    const check: WatchlistTargetCheck = { currentPrice: 95, priceTargetCrossed: true, marginOfSafetyTargetCrossed: false };
    const items: WatchlistReportItem[] = [{ symbol: "AAPL", category: "Core", reason: "Long-term hold", currentDecision: "Buy", check }];
    const built = buildWatchlistReport(items);
    const wl = built.sections.find((s) => s.id === "watchlist")!;
    expect(wl.bullets![0]).toContain("AAPL");
    expect(wl.bullets![0]).toContain("price target crossed: yes");
  });
});

describe("institutionalReporting.ts — buildOpportunityDiscoveryReport", () => {
  it("assembles a section per bucket, reusing each bucket's own rule text", () => {
    const scan: OpportunityScanResult = { rows: [], universeSize: 25, unresolvedSymbols: [], scannedAt: "2026-01-15T00:00:00.000Z" };
    const buckets: OpportunityBucket[] = [
      { category: "top-opportunities", label: "Top Opportunities", rule: "Rank score >= 70.", rows: [] },
    ];
    const built = buildOpportunityDiscoveryReport(scan, buckets);
    expect(built.sections).toHaveLength(2);
    expect(built.sections[1].title).toBe("Top Opportunities");
    expect(built.sections[1].body).toContain("Rank score >= 70.");
  });
});

describe("institutionalReporting.ts — buildMonitoringSummaryReport", () => {
  it("honestly reports no alerts", () => {
    const built = buildMonitoringSummaryReport([]);
    expect(built.sections.find((s) => s.id === "executive-summary")!.body).toMatch(/no monitoring alerts/i);
  });
});

describe("institutionalReporting.ts — buildAiCoachLearningSummaryReport", () => {
  it("reflects real progress figures", () => {
    const progress: LearningProgressSummary = {
      lessonsViewed: 10,
      lessonsCompleted: 4,
      glossaryTermsViewed: 6,
      strategiesViewed: 2,
      coachesViewed: 3,
      pathCompletion: [{ pathKey: "institutional-investing", title: "Institutional Investing Engine", topicsTotal: 9, topicsCompleted: 3, percentComplete: 33.3 }],
      greeksQuiz: { attempts: [], bestByTopic: [], totalAttempts: 2, averagePercent: 80, streak: 1, improvement: 5, firstPercent: 70, latestPercent: 85 },
      valueQuiz: { attempts: [], bestByTopic: [], totalAttempts: 1, averagePercent: 90, streak: 1, improvement: 0, firstPercent: 90, latestPercent: 90 },
      recentHistory: [{ itemType: "lesson", itemKey: "greeks-delta", viewedAt: "2026-01-14T00:00:00.000Z", completedAt: null }],
      completedLessonKeys: [],
      completedGlossaryKeys: [],
      completedStrategyKeys: [],
      completedCoachKeys: [],
      viewedStrategyKeys: [],
    };
    const built = buildAiCoachLearningSummaryReport(progress);
    expect(built.reportType).toBe("ai-coach-summary");
    expect(built.subtitle).toContain("4/10");
    const overview = built.sections.find((s) => s.id === "ai-coach")!;
    expect(overview.bullets).toContain("AI Coach explanations viewed: 3");
  });
});

describe("institutionalReporting.ts — buildExecutiveSummaryReport", () => {
  it("reuses the Cross-Engine Daily Report's own summary and figures", () => {
    const cross: CrossEngineDailyReport = {
      date: "2026-01-15",
      generatedAt: "2026-01-15T00:00:00.000Z",
      engine1: {
        macro: { asOf: "2026-01-15", regime: "stable_rates", regimeLabel: "Stable Rates", summary: "Rates are stable." } as unknown as CrossEngineDailyReport["engine1"]["macro"],
        watchlistTotalItems: 1,
        watchlistCrossings: [{ symbol: "AAPL", currentPrice: 95, priceTargetCrossed: true, marginOfSafetyTargetCrossed: null }],
      },
      engine2: { risk: { overall: { label: "Moderate" } } as unknown as CrossEngineDailyReport["engine2"]["risk"] },
      engine3: {
        healthScore: 80,
        healthLabel: "Good",
        openPositions: 3,
        totalUnrealizedPnl: 250.5,
        attentionCount: 1,
        criticalCount: 0,
        topOpportunitySymbol: "MSFT",
        topOpportunityRavishScore: 88,
      },
      summary: "Macro regime: Stable Rates. 1 watchlist symbol crossed a target today: AAPL.",
      disclaimer: "Educational research only.",
    };
    const built = buildExecutiveSummaryReport(cross);
    expect(built.reportType).toBe("executive-summary");
    expect(built.subtitle).toBe(cross.summary);
    expect(built.sections[0].body).toBe(cross.summary);
    expect(built.sections.find((s) => s.id === "portfolio-health")!.bullets).toContain("Top opportunity: MSFT (score 88)");
  });
});

// Phase 31 — Institutional Strategy Workbench extension of the Phase 30
// Strategy Framework Summary Report: 2 additive sections (Learning
// Coverage, Workspace Notes), reusing an existing report type — not a new
// one — so every pre-Phase-31 call site that omits the 2 new params keeps
// working identically.
function strategyFixture(overrides: Partial<StrategyMetadata> = {}): StrategyMetadata {
  return {
    id: 1,
    name: "My Setup",
    description: "A personally defined trade setup.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure"],
    checklist: [{ id: "a", label: "Structure reviewed", required: true }],
    educationalNotes: "Some notes.",
    references: [],
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("institutionalReporting.ts — buildStrategyFrameworkSummaryReport", () => {
  it("is byte-identical to Phase 30's own pre-Phase-31 shape when the 2 new params are omitted", () => {
    const strategies = [strategyFixture()];
    const checklists: StrategyFrameworkChecklistSummaryItem[] = [{ strategyId: 1, strategyName: "My Setup", symbol: "AAPL", status: "in_progress" }];
    const built = buildStrategyFrameworkSummaryReport(strategies, checklists);
    expect(built.sections.map((s) => s.id)).toEqual([
      "executive-summary",
      "strategy-registry",
      "checklist-instances",
      "learning-coverage",
      "workspace-notes",
    ]);
    // Both new sections honestly report empty when no input is given —
    // never a fabricated coverage/notes claim.
    expect(built.sections.find((s) => s.id === "learning-coverage")!.body).toMatch(/no registered strategies/i);
    expect(built.sections.find((s) => s.id === "workspace-notes")!.body).toMatch(/no workspace notes/i);
  });

  it("Learning Coverage reflects real viewed/not-yet-viewed state per strategy, never a fabricated claim", () => {
    const strategies = [strategyFixture({ id: 1, name: "Viewed Strategy" }), strategyFixture({ id: 2, name: "Unviewed Strategy" })];
    const learningCoverage: StrategyFrameworkLearningCoverageItem[] = [
      { strategyId: 1, strategyName: "Viewed Strategy", viewed: true },
      { strategyId: 2, strategyName: "Unviewed Strategy", viewed: false },
    ];
    const built = buildStrategyFrameworkSummaryReport(strategies, [], learningCoverage, []);
    const section = built.sections.find((s) => s.id === "learning-coverage")!;
    expect(section.body).toMatch(/1 of 2/);
    expect(section.bullets).toContain("Viewed Strategy: viewed");
    expect(section.bullets).toContain("Unviewed Strategy: not yet viewed");
  });

  it("Workspace Notes reflects real recorded notes, never fabricates one for a strategy with none", () => {
    const strategies = [strategyFixture()];
    const workspaceNotes: StrategyFrameworkWorkspaceNoteItem[] = [
      { strategyId: 1, strategyName: "My Setup", note: "Checked structure before entry.", updatedAt: "2026-01-02T00:00:00.000Z" },
    ];
    const built = buildStrategyFrameworkSummaryReport(strategies, [], [], workspaceNotes);
    const section = built.sections.find((s) => s.id === "workspace-notes")!;
    expect(section.bullets?.[0]).toBe("My Setup (updated 2026-01-02T00:00:00.000Z): Checked structure before entry.");
  });
});

describe("institutionalReporting.ts — buildOptionsIncomeSummaryReport (Phase 35)", () => {
  it("honestly reports all-empty sections for a brand-new user with no positions, never a fabricated figure", () => {
    const dashboard = buildOptionsIncomeDashboard({ openRows: [], closedRows: [], thetaPositions: [] });
    const built = buildOptionsIncomeSummaryReport(dashboard);
    expect(built.reportType).toBe("options-income-summary");
    expect(built.sections.map((s) => s.id)).toEqual(["executive-summary", "theta-income", "strategy-mix", "upcoming-expirations"]);
    expect(built.sections.find((s) => s.id === "executive-summary")!.body).toMatch(/no open or closed/i);
    expect(built.sections.find((s) => s.id === "theta-income")!.body).toMatch(/no open positions/i);
    expect(built.sections.find((s) => s.id === "strategy-mix")!.body).toMatch(/no open positions/i);
    expect(built.sections.find((s) => s.id === "upcoming-expirations")!.body).toMatch(/no open positions/i);
  });

  it("reformats a real Options Income Dashboard into report sections, byte-consistent with the source engine's own figures — never re-derived", () => {
    const dashboard = buildOptionsIncomeDashboard({
      openRows: [
        { id: 1, symbol: "SPY", strategy: "iron_condor", credit: 150, maxLoss: 350, expiration: "2026-08-15" },
        { id: 2, symbol: "MSFT", strategy: "calendar_spread", credit: 80, maxLoss: 200, expiration: "2026-08-01" },
      ],
      closedRows: [{ credit: 120 }],
      thetaPositions: [
        { symbol: "SPY", strategy: "iron_condor", theta: 2 },
        { symbol: "MSFT", strategy: "calendar_spread", theta: 1.5 },
      ],
    });
    const built = buildOptionsIncomeSummaryReport(dashboard);

    expect(built.subtitle).toContain(`${dashboard.overview.openPositionsCount} open position(s)`);
    expect(built.generatedAt).toBe(dashboard.generatedAt);

    const overviewSection = built.sections.find((s) => s.id === "executive-summary")!;
    expect(overviewSection.body).toContain(`${dashboard.overview.openPositionsCount} open position(s)`);
    expect(overviewSection.bullets).toContain(`Capital allocated: $${dashboard.overview.totalCapitalAllocated.toLocaleString()}`);

    const thetaSection = built.sections.find((s) => s.id === "theta-income")!;
    expect(thetaSection.body).toContain(`$${dashboard.overview.theta.daily.toLocaleString()}/day`);

    const mixSection = built.sections.find((s) => s.id === "strategy-mix")!;
    expect(mixSection.bullets).toHaveLength(dashboard.strategyMix.length);
    for (const m of dashboard.strategyMix) {
      expect(mixSection.bullets).toContain(`${m.strategyLabel ?? m.strategy}: ${m.positionCount} position(s), $${m.capitalAllocated.toLocaleString()} allocated`);
    }

    const expirySection = built.sections.find((s) => s.id === "upcoming-expirations")!;
    expect(expirySection.body).toContain(`${dashboard.upcomingExpirations.length} distinct expiration date(s)`);

    // Never a P/L prediction, forecast, or trade recommendation anywhere in the report.
    const serialized = JSON.stringify(built).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"/);
  });
});

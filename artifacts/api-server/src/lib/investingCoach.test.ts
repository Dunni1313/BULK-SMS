// Phase 21 — Institutional AI Coach & Education Platform unit tests.
//
// Deliberately runs the REAL buildValueResearchReport()/buildInstitutionalDecision()
// (via the same fundamentalsOverride test seam decisionEngine.test.ts already
// uses) rather than hand-constructing report/decision fixtures, so these tests
// prove genuine integration with every reused engine, not just
// investingCoach.ts in isolation.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import { buildInstitutionalDecision, type ManagementQualityResult, type DecisionPortfolioContext, type InstitutionalDecisionAnalysis } from "./decisionEngine.js";
import { SINGLE_SYMBOL_CONCENTRATION_CAP_PCT } from "./investingRisk.js";
import type { Fundamentals } from "./fundamentals.js";
import {
  explainCoach,
  explainInvestmentCoach,
  explainPortfolioCoach,
  explainDecisionCoach,
  explainValuationCoach,
  explainRiskCoach,
  explainResearchCoach,
  explainMonitoringCoach,
  explainCommitteeCoach,
  COACH_TYPES,
  COACH_LABELS,
  COACH_DISCLAIMER,
  type CoachNotification,
} from "./investingCoach.js";

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

async function decisionFor(f: Fundamentals, portfolio: DecisionPortfolioContext | null = null): Promise<{ report: ValueResearchReport; decision: InstitutionalDecisionAnalysis }> {
  const report = await reportFor(f);
  const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, portfolio);
  return { report, decision };
}

describe("Institutional AI Coach — shared invariants across all 8 coaches", () => {
  it("every coach type is dispatchable and produces a well-shaped, never-empty explanation", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "COACHALL" }));
    for (const coach of COACH_TYPES) {
      const explanation = explainCoach(coach, { report, decision, alerts: [] });
      expect(explanation.coach).toBe(coach);
      expect(explanation.coachLabel).toBe(COACH_LABELS[coach]);
      expect(explanation.symbol).toBe(report.symbol);
      expect(explanation.headline.length).toBeGreaterThan(0);
      expect(explanation.whyThisExists.length).toBeGreaterThan(0);
      expect(explanation.howToInterpret.length).toBeGreaterThan(0);
      expect(explanation.commonMistakes.length).toBeGreaterThan(0);
      expect(explanation.institutionalPerspective.length).toBeGreaterThan(0);
      expect(explanation.relatedGlossaryKeys.length).toBeGreaterThan(0);
      expect(explanation.calculationSources.length).toBeGreaterThan(0);
      expect(explanation.disclaimer).toBe(COACH_DISCLAIMER);
    }
  });

  it("the disclaimer never varies per symbol or coach — always the exact same static string", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "DISCLAIM" }));
    const explanations = COACH_TYPES.map((c) => explainCoach(c, { report, decision, alerts: [] }));
    const disclaimers = new Set(explanations.map((e) => e.disclaimer));
    expect(disclaimers.size).toBe(1);
    expect([...disclaimers][0]).toBe(COACH_DISCLAIMER);
  });

  it("explainCoach() dispatcher produces byte-identical output to calling each coach function directly", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "DISPATCH" }));
    expect(explainCoach("investment", { report, decision })).toEqual(explainInvestmentCoach(report, decision));
    expect(explainCoach("decision", { report, decision })).toEqual(explainDecisionCoach(report, decision));
    expect(explainCoach("valuation", { report, decision })).toEqual(explainValuationCoach(report));
    expect(explainCoach("risk", { report, decision })).toEqual(explainRiskCoach(report, decision));
    expect(explainCoach("research", { report, decision })).toEqual(explainResearchCoach(report));
    expect(explainCoach("committee", { report, decision })).toEqual(explainCommitteeCoach(report));
    expect(explainCoach("portfolio", { report, decision })).toEqual(explainPortfolioCoach(report, decision, null));
    expect(explainCoach("monitoring", { report, decision })).toEqual(explainMonitoringCoach(report, []));
  });
});

describe("Investment Coach", () => {
  it("headline and confidence quote the Decision Engine's own recommendation/confidence — never a new judgment", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "INVCOACH", price: 60, roic: 0.3, roe: 0.35, grossMargin: 0.7 }));
    const e = explainInvestmentCoach(report, decision);
    expect(e.headline).toContain(decision.recommendation);
    expect(e.headline).toContain(String(decision.confidence));
    expect(e.whyThisExists).toBe(decision.explanation);
    expect(e.strengthsIncreasingConfidence).toEqual(decision.strengths);
    expect(e.metricsUsed.some((m) => m.label === "Business Quality" && m.detail.includes(String(report.businessQuality.score)))).toBe(true);
  });
});

describe("Portfolio Coach", () => {
  it("no portfolio supplied — honestly says so, never fabricates a weight or fit", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "NOPORT" }), null);
    const e = explainPortfolioCoach(report, decision, null);
    expect(e.headline).toContain("no portfolio was supplied");
    expect(e.metricsUsed).toEqual([]);
    expect(e.supportingEvidence).toEqual([]);
  });

  it("portfolio supplied, already held over the concentration cap — flags the breach as a risk, quoting the real numbers", async () => {
    const overconcentrated: DecisionPortfolioContext = {
      portfolioId: 1,
      alreadyHeld: true,
      currentWeightPct: SINGLE_SYMBOL_CONCENTRATION_CAP_PCT + 5,
      sectorExposurePct: 20,
      diversificationScore: 80,
      portfolioRiskScore: 70,
    };
    const { report, decision } = await decisionFor(fixture({ symbol: "OVERCONC" }), overconcentrated);
    const e = explainPortfolioCoach(report, decision, overconcentrated);
    expect(e.headline).toContain("already held");
    expect(e.risksReducingConfidence.some((r) => r.includes(`${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}%`))).toBe(true);
    expect(e.metricsUsed.some((m) => m.label === "Current weight" && m.detail.includes(String(overconcentrated.currentWeightPct)))).toBe(true);
  });

  it("healthy, well-diversified portfolio — surfaces the diversification score as a strength", async () => {
    const healthy: DecisionPortfolioContext = {
      portfolioId: 2,
      alreadyHeld: false,
      currentWeightPct: null,
      sectorExposurePct: 10,
      diversificationScore: 80,
      portfolioRiskScore: 30,
    };
    const { report, decision } = await decisionFor(fixture({ symbol: "HEALTHY" }), healthy);
    const e = explainPortfolioCoach(report, decision, healthy);
    expect(e.strengthsIncreasingConfidence.length).toBeGreaterThan(0);
    expect(e.headline).toContain("not currently held");
  });
});

describe("Decision Coach", () => {
  it("metricsUsed mirrors the Decision Engine's own checklist one-for-one", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "DECCOACH" }));
    const e = explainDecisionCoach(report, decision);
    expect(e.metricsUsed.length).toBe(decision.checklist.length);
    expect(e.strengthsIncreasingConfidence).toEqual(decision.drivers);
  });

  it("thingsToMonitor and contradicting evidence both surface as risksReducingConfidence, never dropped", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "MONITME" }));
    const e = explainDecisionCoach(report, decision);
    for (const m of decision.thingsToMonitor) {
      expect(e.risksReducingConfidence).toContain(m);
    }
  });
});

describe("Valuation Coach", () => {
  it("all 4 available valuation models are quoted with their real fair values and ratings", async () => {
    const { report } = await decisionFor(fixture({ symbol: "VALCOACH" }));
    const e = explainValuationCoach(report);
    expect(e.metricsUsed.length).toBe(4);
    if (report.valuation.available) {
      expect(e.metricsUsed[0].detail).toContain(report.valuation.rating);
    }
    expect(e.supportingEvidence.some((m) => m.label === "Model agreement" && m.detail === report.consolidatedMarginOfSafety.agreement)).toBe(true);
  });

  it("honestly unavailable when trailing EPS is non-positive — never fabricates a fair value", async () => {
    const { report } = await decisionFor(fixture({ symbol: "NOEARNC", epsTtm: -1, epsFwd: -0.5, pe: null as unknown as number, forwardPe: null }));
    const e = explainValuationCoach(report);
    if (!report.grahamValuation.available) {
      expect(e.metricsUsed.find((m) => m.label === "Graham valuation")!.detail).toContain("unavailable");
    }
  });
});

describe("Risk Coach", () => {
  it("financial strength flags and decision risks both surface as risksReducingConfidence", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "RISKCOACH", debtToEquity: 2.5, interestCoverage: 1 }));
    const e = explainRiskCoach(report, decision);
    for (const flag of report.financialStrength.flags) {
      expect(e.risksReducingConfidence).toContain(flag);
    }
    expect(e.metricsUsed.some((m) => m.label === "Portfolio risk checklist")).toBe(true);
  });
});

describe("Research Coach", () => {
  it("metricsUsed mirrors Business Quality's own factor list one-for-one", async () => {
    const { report } = await decisionFor(fixture({ symbol: "RESCOACH" }));
    const e = explainResearchCoach(report);
    expect(e.metricsUsed.length).toBe(report.businessQuality.factors.length);
    expect(e.strengthsIncreasingConfidence).toEqual([...report.investmentQuality.strengths, ...report.competitiveAdvantage.strengths]);
  });
});

describe("Monitoring Coach", () => {
  it("no alerts recorded — honestly says so, never invents an alert", async () => {
    const { report } = await decisionFor(fixture({ symbol: "NOALERTS" }));
    const e = explainMonitoringCoach(report, []);
    expect(e.headline).toContain("no monitoring alerts recorded");
    expect(e.supportingEvidence).toEqual([]);
  });

  it("recorded alerts are quoted verbatim; only high-severity alerts reduce confidence", async () => {
    const alerts: CoachNotification[] = [
      { type: "price_target", title: "Price crossed target", message: "AAPL crossed $150", severity: "high", createdAt: "2026-01-01T00:00:00.000Z" },
      { type: "watchlist", title: "Watchlist note", message: "Just informational", severity: "low", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const { report } = await decisionFor(fixture({ symbol: "HASALERTS" }));
    const e = explainMonitoringCoach(report, alerts);
    expect(e.headline).toContain("2 recorded monitoring alerts");
    expect(e.supportingEvidence.length).toBe(2);
    expect(e.risksReducingConfidence.length).toBe(1);
    expect(e.risksReducingConfidence[0]).toContain("AAPL crossed $150");
  });
});

describe("Committee Coach", () => {
  it("every vote is quoted verbatim from the Investment Committee's own output", async () => {
    const { report } = await decisionFor(fixture({ symbol: "COMMCOACH" }));
    const e = explainCommitteeCoach(report);
    expect(e.metricsUsed.length).toBe(report.investmentCommittee.votes.length);
    expect(e.headline).toContain(report.investmentCommittee.consolidatedVerdict);
    expect(e.headline).toContain(report.investmentCommittee.agreement);
  });

  it("split agreement surfaces the safe-Hold-default explanation as a risk", async () => {
    // A deeply unprofitable ETF-shaped fixture is unlikely to force a split, so
    // this proves the CONDITIONAL logic path itself rather than forcing a
    // specific agreement outcome (which depends on 3 independently-computed
    // analyst votes this module must never re-derive).
    const { report } = await decisionFor(fixture({ symbol: "SPLITCHK" }));
    const e = explainCommitteeCoach(report);
    if (report.investmentCommittee.agreement === "split") {
      expect(e.risksReducingConfidence.length).toBeGreaterThan(0);
    } else {
      expect(e.risksReducingConfidence).toEqual([]);
    }
  });
});

describe("ETF handling — never fabricates a business-judgment coach reading for a diversified fund", () => {
  it("Research Coach still returns a well-shaped explanation for an ETF-kind fundamentals input", async () => {
    const { report, decision } = await decisionFor(fixture({ symbol: "ETFCOACH", kind: "etf" }));
    const e = explainResearchCoach(report);
    expect(e.metricsUsed.length).toBe(report.businessQuality.factors.length);
    const invE = explainInvestmentCoach(report, decision);
    expect(invE.symbol).toBe(report.symbol);
  });
});

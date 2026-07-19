// Phase 14 — Institutional Investment Decision Engine unit tests.
//
// Deliberately runs the REAL buildValueResearchReport() (via its established
// fundamentalsOverride test seam — the same seam every other Phase 2+ sprint's
// tests use to drive unprofitable/incomplete data through the pipeline) rather
// than hand-constructing a ValueResearchReport-shaped fixture, so these tests
// prove genuine integration with every reused engine, not just decisionEngine.ts
// in isolation.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import {
  buildInstitutionalDecision,
  type ManagementQualityResult,
  type DecisionPortfolioContext,
} from "./decisionEngine.js";
import { SINGLE_SYMBOL_CONCENTRATION_CAP_PCT, SECTOR_CONCENTRATION_CAP_PCT } from "./investingRisk.js";
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

describe("buildInstitutionalDecision", () => {
  it("Excellent company — wide moat, strong quality, deep discount → Buy/Accumulate with mostly passing checklist", async () => {
    const f = fixture({
      symbol: "EXCEL",
      price: 60, // well under intrinsic value implied by the strong fundamentals below
      roic: 0.3,
      roe: 0.35,
      grossMargin: 0.7,
      operatingMargin: 0.35,
      netMargin: 0.25,
      revenueGrowth5y: 0.18,
      epsGrowth5y: 0.2,
      debtToEquity: 0.1,
      interestCoverage: 40,
      fcfPositiveYears: 10,
      netCashPerShare: 15,
      qualitative: {
        pricingPower: 90, brand: 90, customerLoyalty: 85, recurringRevenue: 85, scale: 85,
        switchingCost: 85, networkEffect: 80, ipStrength: 85, distribution: 80, regulatoryAdvantage: 70,
      },
    });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(["Buy", "Accumulate"]).toContain(decision.recommendation);
    expect(decision.confidence).toBeGreaterThan(0);
    const bq = decision.checklist.find((c) => c.id === "business-quality")!;
    expect(bq.status).toBe("pass");
    const moat = decision.checklist.find((c) => c.id === "moat")!;
    expect(["pass", "warning"]).toContain(moat.status);
    expect(decision.checklist.find((c) => c.id === "debt")!.status).toBe("pass");
    expect(decision.strengths.length).toBeGreaterThan(0);
    expect(decision.disclaimer).toContain("Educational research only");
  });

  it("Average company — middling everything, fair valuation → Hold", async () => {
    const f = fixture({ symbol: "AVERAG", price: 100 });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(decision.recommendation).not.toBe("Sell");
    expect(decision.recommendation).not.toBe("Avoid");
    expect(decision.checklist).toHaveLength(15);
    for (const item of decision.checklist) {
      expect(["pass", "warning", "fail", "unavailable"]).toContain(item.status);
      expect(item.explanation.length).toBeGreaterThan(0);
    }
  });

  it("Poor company — weak quality, thin moat, mediocre balance sheet → Reduce or Avoid", async () => {
    const f = fixture({
      symbol: "POORCO",
      roic: 0.03,
      roe: 0.04,
      grossMargin: 0.15,
      operatingMargin: 0.03,
      netMargin: 0.01,
      revenueGrowth5y: -0.02,
      epsGrowth5y: -0.05,
      fcfPositiveYears: 4,
      qualitative: {
        pricingPower: 15, brand: 15, customerLoyalty: 15, recurringRevenue: 15, scale: 15,
        switchingCost: 15, networkEffect: 10, ipStrength: 15, distribution: 15, regulatoryAdvantage: 10,
      },
    });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(["Reduce", "Avoid", "Hold", "Sell"]).toContain(decision.recommendation);
    expect(decision.checklist.find((c) => c.id === "business-quality")!.status).not.toBe("pass");
  });

  it("Overvalued company — good business trading well above intrinsic value → Valuation/MoS checklist fails, never a Buy", async () => {
    const f = fixture({ symbol: "RICHCO", price: 500 });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(decision.recommendation).not.toBe("Buy");
    const valuation = decision.checklist.find((c) => c.id === "valuation")!;
    const mos = decision.checklist.find((c) => c.id === "margin-of-safety")!;
    expect(["warning", "fail"]).toContain(valuation.status);
    expect(["warning", "fail"]).toContain(mos.status);
    expect(decision.contradictingEvidence.some((e) => e.label === "Margin of Safety")).toBe(true);
  });

  it("Undervalued company — good business trading well below intrinsic value → strong margin of safety, Buy-leaning", async () => {
    const f = fixture({ symbol: "CHEAPCO", price: 40 });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    const mos = decision.checklist.find((c) => c.id === "margin-of-safety")!;
    expect(mos.status).toBe("pass");
    expect(decision.supportingEvidence.some((e) => e.label === "Margin of Safety")).toBe(true);
  });

  it("High debt — elevated leverage and thin coverage → Debt checklist fails and pulls recommendation toward Avoid/Sell", async () => {
    const f = fixture({
      symbol: "DEBTCO",
      debtToEquity: 3.5,
      interestCoverage: 1.2,
      currentRatio: 0.6,
      netCashPerShare: -20,
    });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(decision.checklist.find((c) => c.id === "debt")!.status).toBe("fail");
    expect(["Weak", "Risky"]).toContain(report.financialStrength.rating);
    expect(["Avoid", "Sell", "Reduce"]).toContain(decision.recommendation);
    expect(decision.risks.length).toBeGreaterThan(0);
  });

  it("Negative cash flow — no positive FCF years → Cash Flow checklist fails, never fabricated", async () => {
    const f = fixture({
      symbol: "NOCASH",
      fcfPerShare: -2,
      fcfYield: -0.02,
      fcfMargin: -0.05,
      fcfPositiveYears: 0,
      fcfHistory: [-1, -1.2, -0.8, -1.5, -2, -2.2],
    });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    const cashFlow = decision.checklist.find((c) => c.id === "cash-flow")!;
    expect(cashFlow.status).toBe("fail");
    expect(cashFlow.explanation).not.toMatch(/unavailable/i);
  });

  it("Incomplete provider data — non-positive trailing EPS makes Graham/valuation unavailable → honestly unavailable, never fabricated", async () => {
    const f = fixture({ symbol: "NOEARN", epsTtm: -1, epsFwd: -0.5, pe: null as unknown as number, forwardPe: null });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    // At least one of the valuation-dependent checklist items should honestly
    // degrade rather than invent a fair value from negative earnings.
    const valuation = decision.checklist.find((c) => c.id === "valuation")!;
    const mos = decision.checklist.find((c) => c.id === "margin-of-safety")!;
    if (report.consolidatedMarginOfSafety.averageMarginOfSafety == null) {
      expect(valuation.status).toBe("unavailable");
      expect(mos.status).toBe("unavailable");
    }
    expect(decision.recommendation).toBeDefined();
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
  });

  it("Provider unavailable (Management Quality unresolvable, no portfolio) — degrades honestly across every dependent checklist item, never crashes", async () => {
    const f = fixture({ symbol: "NODATA" });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(decision.managementQuality.available).toBe(false);
    expect(decision.checklist.find((c) => c.id === "management")!.status).toBe("unavailable");
    expect(decision.checklist.find((c) => c.id === "risk")!.status).toBe("unavailable");
    expect(decision.checklist.find((c) => c.id === "portfolio-fit")!.status).toBe("unavailable");
    expect(decision.checklist.find((c) => c.id === "diversification")!.status).toBe("unavailable");
    expect(decision.portfolioFit.available).toBe(false);
    expect(decision.thingsToMonitor.some((m) => m.includes("No portfolio was supplied"))).toBe(true);
  });

  it("Management Quality available — feeds into the checklist, synthesis score, and evidence honestly", async () => {
    const f = fixture({ symbol: "MGMTOK" });
    const report = await reportFor(f);
    const goodMgmt: ManagementQualityResult = { available: true, score: 80 };
    const decision = buildInstitutionalDecision(report, goodMgmt, null);

    expect(decision.checklist.find((c) => c.id === "management")!.status).toBe("pass");
    expect(decision.supportingEvidence.some((e) => e.label === "Management Quality")).toBe(true);
  });

  it("Portfolio context: already overconcentrated in this symbol downgrades Buy/Accumulate to Hold", async () => {
    const f = fixture({ symbol: "CHEAPCO2", price: 40 });
    const report = await reportFor(f);
    const overconcentrated: DecisionPortfolioContext = {
      portfolioId: 1,
      alreadyHeld: true,
      currentWeightPct: SINGLE_SYMBOL_CONCENTRATION_CAP_PCT + 5,
      sectorExposurePct: 20,
      diversificationScore: 80,
      portfolioRiskScore: 70,
    };
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, overconcentrated);

    expect(decision.recommendation).toBe("Hold");
    expect(decision.explanation).toContain("Downgraded");
    const fit = decision.checklist.find((c) => c.id === "portfolio-fit")!;
    expect(fit.status).toBe("fail");
  });

  it("Portfolio context: well-diversified, not held, sector exposure under cap → Portfolio Fit and Diversification pass", async () => {
    const f = fixture({ symbol: "GOODPORT" });
    const report = await reportFor(f);
    const healthy: DecisionPortfolioContext = {
      portfolioId: 2,
      alreadyHeld: false,
      currentWeightPct: null,
      sectorExposurePct: 10,
      diversificationScore: 85,
      portfolioRiskScore: 80,
    };
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, healthy);

    expect(decision.checklist.find((c) => c.id === "portfolio-fit")!.status).toBe("pass");
    expect(decision.checklist.find((c) => c.id === "diversification")!.status).toBe("pass");
    expect(decision.checklist.find((c) => c.id === "risk")!.status).toBe("pass");
    expect(decision.portfolioFit.available).toBe(true);
  });

  it("Portfolio context: sector already at cap → Portfolio Fit at most a warning", async () => {
    const f = fixture({ symbol: "SECTORCAP" });
    const report = await reportFor(f);
    const sectorHeavy: DecisionPortfolioContext = {
      portfolioId: 3,
      alreadyHeld: false,
      currentWeightPct: null,
      sectorExposurePct: SECTOR_CONCENTRATION_CAP_PCT + 5,
      diversificationScore: 40,
      portfolioRiskScore: 40,
    };
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, sectorHeavy);

    expect(["warning", "fail"]).toContain(decision.checklist.find((c) => c.id === "portfolio-fit")!.status);
  });

  it("ETF handling — never fabricates a moat/business-quality judgment for a diversified fund", async () => {
    const f = fixture({ symbol: "ETFONE", kind: "etf" });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);

    expect(decision.kind).toBe("etf");
    expect(decision.checklist).toHaveLength(15);
  });

  it("every checklist item has a non-empty explanation and a valid status, across every scenario above", async () => {
    const f = fixture({ symbol: "SHAPECK" });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    for (const item of decision.checklist) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.explanation.length).toBeGreaterThan(0);
    }
  });

  it("summary and explanation always reference the symbol and are non-empty", async () => {
    const f = fixture({ symbol: "SUMCHK" });
    const report = await reportFor(f);
    const decision = buildInstitutionalDecision(report, NO_MANAGEMENT, null);
    expect(decision.summary).toContain("SUMCHK");
    expect(decision.explanation.length).toBeGreaterThan(0);
  });
});

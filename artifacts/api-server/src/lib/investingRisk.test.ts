// Phase 2, Sprint 29 — Portfolio Risk Analysis unit tests (approved Phase 2
// plan, Sprint 29). computePortfolioRisk() is pure and I/O-free — these
// tests construct fixtures directly, matching portfolioHealth.test.ts's own
// testability discipline.

import { describe, it, expect } from "vitest";
import {
  computePortfolioRisk,
  computePortfolioRiskFromAllocation,
  SINGLE_SYMBOL_CONCENTRATION_CAP_PCT,
  SECTOR_CONCENTRATION_CAP_PCT,
  type RiskInputHolding,
} from "./investingRisk.js";

function holding(over: Partial<RiskInputHolding> = {}): RiskInputHolding {
  return { symbol: "AAA", marketValue: 1000, sector: "Technology", beta: 1.0, ...over };
}

describe("computePortfolioRisk — concentration", () => {
  it("scores concentration well when no holding dominates", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 3000 }),
      holding({ symbol: "BBB", marketValue: 3000 }),
      holding({ symbol: "CCC", marketValue: 4000 }),
    ]);
    expect(result.concentration.largestSymbol).toBe("CCC");
    expect(result.concentration.largestSymbolWeightPct).toBe(40);
    expect(result.concentration.capBreached).toBe(true); // 40% > 25% cap
  });

  it("trips the hard concentration cap when a single holding exceeds the threshold", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 8000 }),
      holding({ symbol: "BBB", marketValue: 2000 }),
    ]);
    expect(result.concentration.largestSymbolWeightPct).toBe(80);
    expect(result.concentration.capBreached).toBe(true);
    expect(result.concentration.detail).toMatch(new RegExp(`${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}%`));
  });

  it("does not breach the cap when the largest holding is under the threshold", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 2000 }),
      holding({ symbol: "BBB", marketValue: 2000 }),
      holding({ symbol: "CCC", marketValue: 2000 }),
      holding({ symbol: "DDD", marketValue: 2000 }),
      holding({ symbol: "EEE", marketValue: 2000 }),
    ]);
    expect(result.concentration.largestSymbolWeightPct).toBe(20);
    expect(result.concentration.capBreached).toBe(false);
  });

  it("honestly reports insufficient data when nothing can be priced", () => {
    const result = computePortfolioRisk([holding({ marketValue: null })]);
    expect(result.concentration.score).toBeNull();
    expect(result.concentration.label).toBe("Insufficient data");
    expect(result.concentration.capBreached).toBe(false);
  });
});

describe("computePortfolioRisk — sector exposure", () => {
  it("aggregates market value by sector and flags the largest", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 5000, sector: "Technology" }),
      holding({ symbol: "BBB", marketValue: 3000, sector: "Technology" }),
      holding({ symbol: "CCC", marketValue: 2000, sector: "Healthcare" }),
    ]);
    expect(result.sectorExposure.largestSector).toBe("Technology");
    expect(result.sectorExposure.largestSectorWeightPct).toBe(80);
    expect(result.sectorExposure.capBreached).toBe(true); // 80% > 40% cap
    const techRow = result.sectorExposure.breakdown.find((r) => r.sector === "Technology")!;
    expect(techRow.marketValue).toBe(8000);
  });

  it("excludes unclassified holdings from the sector breakdown, reporting them honestly instead", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 5000, sector: "Technology" }),
      holding({ symbol: "BBB", marketValue: 5000, sector: null }),
    ]);
    expect(result.sectorExposure.breakdown).toHaveLength(1);
    expect(result.sectorExposure.unclassifiedWeightPct).toBe(50);
  });

  it("honestly reports insufficient data when no holding has a known sector", () => {
    const result = computePortfolioRisk([holding({ sector: null })]);
    expect(result.sectorExposure.score).toBeNull();
    expect(result.sectorExposure.label).toBe("Insufficient data");
    expect(result.sectorExposure.breakdown).toEqual([]);
  });

  it("does not breach the sector cap when exposure is well diversified", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 2500, sector: "Technology" }),
      holding({ symbol: "BBB", marketValue: 2500, sector: "Healthcare" }),
      holding({ symbol: "CCC", marketValue: 2500, sector: "Financials" }),
      holding({ symbol: "DDD", marketValue: 2500, sector: "Energy" }),
    ]);
    expect(result.sectorExposure.largestSectorWeightPct).toBe(25);
    expect(result.sectorExposure.capBreached).toBe(false);
  });
});

describe("computePortfolioRisk — beta estimate", () => {
  it("computes a market-value-weighted average beta", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 5000, beta: 2.0 }),
      holding({ symbol: "BBB", marketValue: 5000, beta: 1.0 }),
    ]);
    expect(result.betaEstimate.portfolioBeta).toBe(1.5);
    expect(result.betaEstimate.coveragePct).toBe(100);
  });

  it("renormalizes over only the holdings with a known beta — never averaging in an unknown beta as 0", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 5000, beta: 2.0 }),
      holding({ symbol: "BBB", marketValue: 5000, beta: null }),
    ]);
    // Only AAA's beta (2.0) is known; renormalized over its own value alone.
    expect(result.betaEstimate.portfolioBeta).toBe(2.0);
    expect(result.betaEstimate.coveragePct).toBe(50);
  });

  it("honestly reports insufficient data when no holding has a known beta", () => {
    const result = computePortfolioRisk([holding({ beta: null })]);
    expect(result.betaEstimate.score).toBeNull();
    expect(result.betaEstimate.portfolioBeta).toBeNull();
    expect(result.betaEstimate.coveragePct).toBe(0);
  });

  it("labels sensitivity correctly across bands", () => {
    expect(computePortfolioRisk([holding({ beta: 0.5 })]).betaEstimate.label).toBe("Low");
    expect(computePortfolioRisk([holding({ beta: 1.0 })]).betaEstimate.label).toBe("Moderate");
    expect(computePortfolioRisk([holding({ beta: 1.3 })]).betaEstimate.label).toBe("Elevated");
    expect(computePortfolioRisk([holding({ beta: 1.8 })]).betaEstimate.label).toBe("High");
  });
});

describe("computePortfolioRisk — overall score and hard-cap override", () => {
  it("blends the three component scores into an overall score", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 2500, sector: "Technology", beta: 1.0 }),
      holding({ symbol: "BBB", marketValue: 2500, sector: "Healthcare", beta: 1.0 }),
      holding({ symbol: "CCC", marketValue: 2500, sector: "Financials", beta: 1.0 }),
      holding({ symbol: "DDD", marketValue: 2500, sector: "Energy", beta: 1.0 }),
    ]);
    expect(result.overall.score).not.toBeNull();
    expect(result.overall.score).toBeGreaterThan(0);
  });

  it("caps the overall score when the concentration hard cap is breached, regardless of the blend", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 9000, sector: "Technology", beta: 1.0 }),
      holding({ symbol: "BBB", marketValue: 1000, sector: "Healthcare", beta: 1.0 }),
    ]);
    expect(result.concentration.capBreached).toBe(true);
    expect(result.overall.score).not.toBeNull();
    expect(result.overall.score as number).toBeLessThanOrEqual(60);
    expect(result.overall.detail).toMatch(/cap breached/i);
  });

  it("caps the overall score when the sector cap is breached", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 5000, sector: "Technology", beta: 1.0 }),
      holding({ symbol: "BBB", marketValue: 4000, sector: "Technology", beta: 1.0 }),
      holding({ symbol: "CCC", marketValue: 1000, sector: "Healthcare", beta: 1.0 }),
    ]);
    expect(result.sectorExposure.capBreached).toBe(true);
    expect(result.overall.score as number).toBeLessThanOrEqual(60);
  });

  it("honestly reports insufficient data overall when nothing could be priced", () => {
    const result = computePortfolioRisk([holding({ marketValue: null, sector: null, beta: null })]);
    expect(result.overall.score).toBeNull();
    expect(result.overall.label).toBe("Insufficient data");
    expect(result.totalMarketValue).toBeNull();
  });

  it("reports unresolved symbols honestly rather than silently dropping them", () => {
    const result = computePortfolioRisk([
      holding({ symbol: "AAA", marketValue: 1000 }),
      holding({ symbol: "ZZZ", marketValue: null }),
    ]);
    expect(result.unresolvedSymbols).toEqual(["ZZZ"]);
  });

  it("handles zero holdings honestly", () => {
    const result = computePortfolioRisk([]);
    expect(result.overall.score).toBeNull();
    expect(result.totalMarketValue).toBeNull();
    expect(result.unresolvedSymbols).toEqual([]);
  });
});

describe("computePortfolioRiskFromAllocation — adapter", () => {
  it("computes the same result as calling computePortfolioRisk directly with the same fields", () => {
    const allocationHoldings = [
      { symbol: "AAA", marketValue: 5000, sector: "Technology", beta: 1.2, id: 1, targetWeightPct: 50, shares: 10, notes: "", currentPrice: 500, actualWeightPct: 50, driftPct: 0, rebalanceAction: "hold" as const },
      { symbol: "BBB", marketValue: 5000, sector: "Healthcare", beta: 0.8, id: 2, targetWeightPct: 50, shares: 10, notes: "", currentPrice: 500, actualWeightPct: 50, driftPct: 0, rebalanceAction: "hold" as const },
    ];
    const viaAdapter = computePortfolioRiskFromAllocation(allocationHoldings);
    const viaDirect = computePortfolioRisk(
      allocationHoldings.map((h) => ({ symbol: h.symbol, marketValue: h.marketValue, sector: h.sector, beta: h.beta })),
    );
    expect(viaAdapter).toEqual(viaDirect);
  });
});

describe("SECTOR_CONCENTRATION_CAP_PCT sanity", () => {
  it("is a positive percentage below 100", () => {
    expect(SECTOR_CONCENTRATION_CAP_PCT).toBeGreaterThan(0);
    expect(SECTOR_CONCENTRATION_CAP_PCT).toBeLessThan(100);
  });
});

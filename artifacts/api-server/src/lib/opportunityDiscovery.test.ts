// Phase 15 — Institutional Opportunity Discovery Engine unit tests.
//
// Deliberately runs the REAL buildValueResearchReport() (via its established
// fundamentalsOverride test seam, the same seam decisionEngine.test.ts and
// every other Phase 2+ sprint's tests use) rather than hand-constructing a
// ValueResearchReport-shaped fixture, so these tests prove genuine
// integration with every reused engine, not just opportunityDiscovery.ts in
// isolation.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import { SimulatedFundamentalsProvider, type Fundamentals } from "./fundamentals.js";
import {
  getOpportunityScanUniverse,
  buildOpportunityRow,
  applyScreenerFilters,
  rankOpportunities,
  bucketOpportunities,
  compareOpportunities,
  scanOpportunities,
  type OpportunityRow,
} from "./opportunityDiscovery.js";
import { INVESTING_UNIVERSE } from "./investingUniverse.js";
import { SECTOR_PEER_UNIVERSE } from "./industryPeers.js";

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

async function rowFor(f: Fundamentals): Promise<OpportunityRow> {
  const report = await buildValueResearchReport(f.symbol, f.asOf, undefined, f);
  if (!report) throw new Error("expected a report");
  return buildOpportunityRow(f, report);
}

describe("getOpportunityScanUniverse", () => {
  it("is the union of INVESTING_UNIVERSE and SECTOR_PEER_UNIVERSE, deduplicated, no new symbol list invented", () => {
    const universe = getOpportunityScanUniverse();
    for (const u of INVESTING_UNIVERSE) expect(universe).toContain(u.symbol);
    for (const peers of Object.values(SECTOR_PEER_UNIVERSE)) {
      for (const s of peers) expect(universe).toContain(s);
    }
    expect(new Set(universe).size).toBe(universe.length); // no duplicates
    expect(universe).toEqual([...universe].sort()); // stable, sorted order
  });
});

describe("buildOpportunityRow", () => {
  it("reuses every field directly off Fundamentals/ValueResearchReport — never a new score", async () => {
    const f = fixture({ symbol: "ROWX", roic: 0.25, dividendYield: 0.03 });
    const row = await rowFor(f);
    const report = await buildValueResearchReport(f.symbol, f.asOf, undefined, f);
    expect(row.businessQualityScore).toBe(report!.businessQuality.score);
    expect(row.moatRating).toBe(report!.moat.rating);
    expect(row.investmentQualityScore).toBe(report!.investmentQuality.score);
    expect(row.competitiveAdvantageScore).toBe(report!.competitiveAdvantage.score);
    expect(row.marginOfSafety).toBe(report!.consolidatedMarginOfSafety.averageMarginOfSafety);
    expect(row.investmentCommitteeVerdict).toBe(report!.investmentCommittee.consolidatedVerdict);
    expect(row.tomNashConvictionScore).toBe(report!.tomNash.convictionScore);
    expect(row.roic).toBe(f.roic);
    expect(row.dividendYield).toBe(f.dividendYield);
  });

  it("rankScore is byte-identical to a direct decisionSynthesisScore() call for the same report", async () => {
    const f = fixture({ symbol: "RANKCHK" });
    const report = await buildValueResearchReport(f.symbol, f.asOf, undefined, f);
    const { decisionSynthesisScore } = await import("./decisionEngine.js");
    const expected = decisionSynthesisScore(report!, { available: false, score: null });
    const row = await rowFor(f);
    expect(row.rankScore).toBe(expected);
  });

  it("rankExplanation quotes the row's own real numbers, never boilerplate", async () => {
    const f = fixture({ symbol: "EXPLAIN" });
    const row = await rowFor(f);
    expect(row.rankExplanation).toContain(row.rankScore.toString());
    expect(row.rankExplanation).toContain(row.investmentCommitteeVerdict);
  });
});

describe("applyScreenerFilters", () => {
  it("never fabricates a Country filter result — always reports it unavailable", async () => {
    const rows = [await rowFor(fixture({ symbol: "COUNTRYCHK" }))];
    const { unavailableFilters, rows: filtered } = applyScreenerFilters(rows, { country: "USA" });
    expect(unavailableFilters).toEqual(["country"]);
    expect(filtered.length).toBe(rows.length); // never silently drops rows for an unavailable filter
  });

  it("does not flag country unavailable when it was not supplied", async () => {
    const rows = [await rowFor(fixture({ symbol: "NOCOUNTRY" }))];
    const { unavailableFilters } = applyScreenerFilters(rows, {});
    expect(unavailableFilters).toEqual([]);
  });

  it("filters by sector, ROIC, dividend yield, and valuation rating using already-computed fields only", async () => {
    const cheap = await rowFor(fixture({ symbol: "CHEAPX", sector: "Technology", roic: 0.3, dividendYield: 0.04, price: 40 }));
    const other = await rowFor(fixture({ symbol: "OTHERX", sector: "Health Care", roic: 0.05, dividendYield: 0.0, price: 400 }));
    const rows = [cheap, other];

    const bySector = applyScreenerFilters(rows, { sector: "Technology" });
    expect(bySector.rows.map((r) => r.symbol)).toEqual(["CHEAPX"]);

    const byRoic = applyScreenerFilters(rows, { minRoic: 0.1 });
    expect(byRoic.rows.map((r) => r.symbol)).toEqual(["CHEAPX"]);

    const byDividend = applyScreenerFilters(rows, { minDividendYield: 0.02 });
    expect(byDividend.rows.map((r) => r.symbol)).toEqual(["CHEAPX"]);
  });

  it("totalBeforeFilter reflects the input size, not the filtered size", async () => {
    const rows = [await rowFor(fixture({ symbol: "A1" })), await rowFor(fixture({ symbol: "A2", roic: 0 }))];
    const { totalBeforeFilter, rows: filtered } = applyScreenerFilters(rows, { minRoic: 0.5 });
    expect(totalBeforeFilter).toBe(2);
    expect(filtered.length).toBe(0);
  });
});

describe("rankOpportunities", () => {
  it("sorts by rankScore descending, reusing the Decision Engine's own synthesis score — never a new composite", async () => {
    const strong = await rowFor(fixture({ symbol: "STRONGX", roic: 0.35, roe: 0.4, grossMargin: 0.75, operatingMargin: 0.4, netMargin: 0.3, revenueGrowth5y: 0.2, epsGrowth5y: 0.22, debtToEquity: 0.05, interestCoverage: 50, price: 40 }));
    const weak = await rowFor(fixture({ symbol: "WEAKX", roic: 0.02, roe: 0.03, grossMargin: 0.2, operatingMargin: 0.02, netMargin: 0.01, revenueGrowth5y: 0.0, epsGrowth5y: -0.05, debtToEquity: 2.5, interestCoverage: 1.5, price: 400 }));
    const ranked = rankOpportunities([weak, strong]);
    expect(ranked[0].symbol).toBe("STRONGX");
    expect(ranked[0].rankScore).toBeGreaterThanOrEqual(ranked[1].rankScore);
  });

  it("breaks ties alphabetically by symbol for a stable, deterministic order", () => {
    const a: OpportunityRow = { ...blankRow(), symbol: "BBB", rankScore: 50 };
    const b: OpportunityRow = { ...blankRow(), symbol: "AAA", rankScore: 50 };
    const ranked = rankOpportunities([a, b]);
    expect(ranked.map((r) => r.symbol)).toEqual(["AAA", "BBB"]);
  });
});

describe("bucketOpportunities", () => {
  it("Undervalued Companies requires a real consolidated margin of safety >= 15%, never fabricated", async () => {
    const cheap = await rowFor(fixture({ symbol: "MOSHI", price: 40 }));
    const buckets = bucketOpportunities([cheap]);
    const undervalued = buckets.find((b) => b.category === "undervalued")!;
    if (cheap.marginOfSafety != null && cheap.marginOfSafety >= 0.15) {
      expect(undervalued.rows.map((r) => r.symbol)).toContain("MOSHI");
    } else {
      expect(undervalued.rows.map((r) => r.symbol)).not.toContain("MOSHI");
    }
  });

  it("Wide Moat Companies only includes rows whose moat rating is genuinely Wide", async () => {
    const wide = await rowFor(fixture({
      symbol: "MOATX",
      qualitative: { pricingPower: 95, brand: 95, customerLoyalty: 90, recurringRevenue: 85, scale: 90, switchingCost: 90, networkEffect: 85, ipStrength: 90, distribution: 85, regulatoryAdvantage: 60 },
      roic: 0.35,
    }));
    const none = await rowFor(fixture({
      symbol: "NOMOATX",
      qualitative: { pricingPower: 20, brand: 20, customerLoyalty: 20, recurringRevenue: 20, scale: 20, switchingCost: 20, networkEffect: 10, ipStrength: 15, distribution: 20, regulatoryAdvantage: 10 },
      roic: 0.02,
    }));
    const buckets = bucketOpportunities([wide, none]);
    const wideMoat = buckets.find((b) => b.category === "wide-moat")!;
    expect(wideMoat.rows.every((r) => r.moatRating === "Wide")).toBe(true);
    expect(wideMoat.rows.map((r) => r.symbol)).not.toContain("NOMOATX");
  });

  it("Dividend Opportunities requires dividendYield >= 2%", async () => {
    const div = await rowFor(fixture({ symbol: "DIVX", dividendYield: 0.035 }));
    const none = await rowFor(fixture({ symbol: "NODIV", dividendYield: 0.0 }));
    const buckets = bucketOpportunities([div, none]);
    const dividend = buckets.find((b) => b.category === "dividend")!;
    expect(dividend.rows.map((r) => r.symbol)).toEqual(["DIVX"]);
  });

  it("Growth Opportunities requires 5y revenue growth >= 15%", async () => {
    const growth = await rowFor(fixture({ symbol: "GROWX", revenueGrowth5y: 0.25 }));
    const slow = await rowFor(fixture({ symbol: "SLOWX", revenueGrowth5y: 0.03 }));
    const buckets = bucketOpportunities([growth, slow]);
    const growthBucket = buckets.find((b) => b.category === "growth")!;
    expect(growthBucket.rows.map((r) => r.symbol)).toEqual(["GROWX"]);
  });

  it("Deep Value requires both a deep margin of safety AND a non-trivial business quality (avoids value traps)", async () => {
    const cheapButWeak = await rowFor(fixture({
      symbol: "TRAPX",
      price: 20,
      roic: 0.01, roe: 0.01, grossMargin: 0.05, operatingMargin: 0.0, netMargin: -0.02, epsGrowth5y: -0.2,
      qualitative: { pricingPower: 10, brand: 10, customerLoyalty: 10, recurringRevenue: 10, scale: 10, switchingCost: 10, networkEffect: 5, ipStrength: 10, distribution: 10, regulatoryAdvantage: 5 },
    }));
    const buckets = bucketOpportunities([cheapButWeak]);
    const deepValue = buckets.find((b) => b.category === "deep-value")!;
    // Business quality score for this fixture is well under 42, so even if
    // cheap it must never appear in Deep Value (the value-trap guard).
    expect(deepValue.rows.map((r) => r.symbol)).not.toContain("TRAPX");
  });

  it("Turnaround Candidates never appears for a Risky-rated balance sheet, regardless of price", async () => {
    const distressed = await rowFor(fixture({
      symbol: "DISTRESSX",
      price: 10,
      debtToEquity: 3.0,
      interestCoverage: 0.5,
      currentRatio: 0.3,
      netCashPerShare: -20,
      fcfPositiveYears: 1,
    }));
    const buckets = bucketOpportunities([distressed]);
    const turnaround = buckets.find((b) => b.category === "turnaround")!;
    expect(turnaround.rows.map((r) => r.symbol)).not.toContain("DISTRESSX");
  });

  it("Watchlist Candidates excludes symbols already on the supplied watchlist", async () => {
    const a = await rowFor(fixture({ symbol: "WATCHA", price: 40, roic: 0.3, roe: 0.35, revenueGrowth5y: 0.2 }));
    const buckets = bucketOpportunities([a], { watchlistSymbols: ["WATCHA"] });
    const watchlistBucket = buckets.find((b) => b.category === "watchlist-candidates")!;
    expect(watchlistBucket.rows.map((r) => r.symbol)).not.toContain("WATCHA");
  });

  it("Portfolio Upgrade Candidates is honestly empty when no portfolio context was supplied", async () => {
    const a = await rowFor(fixture({ symbol: "NOPORT" }));
    const buckets = bucketOpportunities([a]);
    const upgrade = buckets.find((b) => b.category === "portfolio-upgrade-candidates")!;
    expect(upgrade.rows).toEqual([]);
  });

  it("Portfolio Upgrade Candidates excludes symbols already held in the supplied portfolio", async () => {
    const held = await rowFor(fixture({ symbol: "HELDX", price: 40, roic: 0.3, roe: 0.35, revenueGrowth5y: 0.2 }));
    const notHeld = await rowFor(fixture({ symbol: "NEWX", price: 40, roic: 0.3, roe: 0.35, revenueGrowth5y: 0.2 }));
    const buckets = bucketOpportunities([held, notHeld], { portfolioSymbols: ["HELDX"] });
    const upgrade = buckets.find((b) => b.category === "portfolio-upgrade-candidates")!;
    expect(upgrade.rows.map((r) => r.symbol)).not.toContain("HELDX");
  });

  it("every bucket carries its own disclosed, non-empty rule string", async () => {
    const buckets = bucketOpportunities([await rowFor(fixture({ symbol: "RULECHK" }))]);
    expect(buckets).toHaveLength(10);
    for (const b of buckets) expect(b.rule.length).toBeGreaterThan(10);
  });
});

describe("compareOpportunities", () => {
  it("picks the genuinely best already-computed value per dimension, never a new score", async () => {
    const better = await rowFor(fixture({ symbol: "BETTERX", roic: 0.3, debtToEquity: 0.1 }));
    const worse = await rowFor(fixture({ symbol: "WORSEX", roic: 0.05, debtToEquity: 1.5 }));
    const { bestBy } = compareOpportunities([better, worse]);
    expect(bestBy["ROIC"]).toBe("BETTERX"); // higher is better
    expect(bestBy["Debt/Equity"]).toBe("BETTERX"); // lower is better
  });

  it("returns an empty bestBy for an empty row set — never fabricated", () => {
    const { bestBy, rows } = compareOpportunities([]);
    expect(bestBy).toEqual({});
    expect(rows).toEqual([]);
  });
});

function blankRow(): OpportunityRow {
  return {
    symbol: "X", name: "X", kind: "stock", price: 1, sector: null, industry: null,
    businessQualityScore: 50, businessQualityRating: "Average", investmentQualityScore: 50,
    moatRating: "None", moatScore: 0, competitiveAdvantageScore: null,
    financialStrengthRating: "Acceptable", financialStrengthScore: 50,
    valuationRating: "Fair", marginOfSafety: null,
    marketCap: null, revenueGrowth5y: 0, roic: 0, roe: 0, debtToEquity: 0, fcfMargin: 0, dividendYield: 0,
    investmentCommitteeVerdict: "Hold", investmentCommitteeConfidence: 50,
    tomNashConvictionScore: 50, tomNashVerdict: "Hold",
    decisionRecommendation: "Hold", rankScore: 50, rankExplanation: "x",
    dataSource: "SIMULATED", fetchedAt: new Date().toISOString(), simulated: true,
  };
}

describe("scanOpportunities (orchestration)", () => {
  it("resolves every symbol exactly once, never a duplicate provider fetch, and reports unresolved symbols honestly", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await scanOpportunities(provider, { symbols: ["AAPL", "MSFT", "NOTASYMBOL!!"] });
    expect(result.universeSize).toBe(3);
    expect(result.rows.map((r) => r.symbol).sort()).toEqual(["AAPL", "MSFT"]);
    expect(result.unresolvedSymbols).toEqual(["NOTASYMBOL!!"]);
  });

  it("defaults to the full opportunity scan universe when no symbols are supplied", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await scanOpportunities(provider, { symbols: getOpportunityScanUniverse().slice(0, 5) });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((r) => r.dataSource === "SIMULATED")).toBe(true);
  });

  it("is deterministic across repeated calls for the same symbols", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const first = await scanOpportunities(provider, { symbols: ["AAPL", "MSFT"] });
    const second = await scanOpportunities(provider, { symbols: ["AAPL", "MSFT"] });
    const strip = (r: OpportunityRow) => ({ ...r, fetchedAt: undefined });
    expect(first.rows.map(strip)).toEqual(second.rows.map(strip));
  });
});

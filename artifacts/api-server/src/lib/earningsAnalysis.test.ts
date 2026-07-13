// Phase 2, Sprint 25 — Earnings Intelligence Engine unit tests (approved
// Phase 2 plan, Sprint 25). analyzeEarningsIntelligence() is pure and
// provider-agnostic, so most cases here construct an EarningsHistory fixture
// directly rather than going through a FundamentalsProvider.

import { describe, it, expect } from "vitest";
import { analyzeEarningsIntelligence, buildEarningsIntelligence } from "./earningsAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { EarningsHistory, QuarterlyEarningsRecord } from "./fundamentals.js";

function q(overrides: Partial<QuarterlyEarningsRecord> = {}): QuarterlyEarningsRecord {
  return {
    fiscalQuarter: "Q1 2024",
    reportDate: null,
    epsActual: null,
    epsEstimate: null,
    epsSurprisePct: null,
    revenueActual: null,
    revenueEstimate: null,
    revenueSurprisePct: null,
    ...overrides,
  };
}

function history(quarters: QuarterlyEarningsRecord[], overrides: Partial<EarningsHistory> = {}): EarningsHistory {
  return {
    symbol: "TEST",
    name: "Test Co",
    dataSource: "SIMULATED",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    quarters,
    ...overrides,
  };
}

describe("analyzeEarningsIntelligence", () => {
  it("computes EPS beat rate over quarters with both actual and estimate present", () => {
    const h = history([
      q({ epsActual: 1.1, epsEstimate: 1.0 }), // beat
      q({ epsActual: 0.9, epsEstimate: 1.0 }), // miss
      q({ epsActual: 1.0, epsEstimate: 1.0 }), // meet -> counted as beat (>=)
      q({ epsActual: null, epsEstimate: 1.0 }), // excluded, missing actual
    ]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.epsBeatRate).toBeCloseTo(2 / 3, 4);
  });

  it("reports revenueBeatRate honestly null when no quarter has both revenue fields (Alpha Vantage's permanent gap)", () => {
    const h = history([
      q({ epsActual: 1.1, epsEstimate: 1.0, revenueActual: null, revenueEstimate: null }),
      q({ epsActual: 1.2, epsEstimate: 1.1, revenueActual: null, revenueEstimate: null }),
    ]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.revenueBeatRate).toBeNull();
    expect(result.epsBeatRate).not.toBeNull();
  });

  it("computes revenueBeatRate normally when the provider supplies both revenue fields", () => {
    const h = history([
      q({ revenueActual: 110, revenueEstimate: 100 }),
      q({ revenueActual: 90, revenueEstimate: 100 }),
    ]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.revenueBeatRate).toBeCloseTo(0.5, 4);
  });

  it("never divides by a zero estimate — surprise% stays null, never Infinity/NaN", () => {
    const h = history([q({ epsActual: 1.0, epsEstimate: 0 })]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.quarters[0].epsSurprisePct).toBeNull();
  });

  it("derives a consecutive beat streak counting back from the most recent quarter", () => {
    const h = history([
      q({ epsActual: 0.9, epsEstimate: 1.0 }), // miss (oldest)
      q({ epsActual: 1.1, epsEstimate: 1.0 }), // beat
      q({ epsActual: 1.2, epsEstimate: 1.0 }), // beat
      q({ epsActual: 1.3, epsEstimate: 1.0 }), // beat (most recent)
    ]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.epsSurpriseStreak).toEqual({ direction: "beat", count: 3 });
  });

  it("breaks the streak on missing data rather than fabricating a continuation", () => {
    const h = history([
      q({ epsActual: 1.1, epsEstimate: 1.0 }),
      q({ epsActual: null, epsEstimate: 1.0 }), // missing actual
      q({ epsActual: 1.2, epsEstimate: 1.0 }),
    ]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.epsSurpriseStreak).toEqual({ direction: "beat", count: 1 });
  });

  it("returns a null streak when no quarter has both eps fields", () => {
    const h = history([q(), q()]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.epsSurpriseStreak).toBeNull();
  });

  it("honestly reports the earnings growth trend as insufficient-data with fewer than 6 usable quarters", () => {
    const h = history([q({ epsActual: 1.0 }), q({ epsActual: 1.1 }), q({ epsActual: 1.2 })]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.earningsGrowthTrend.direction).toBe("insufficient-data");
    expect(result.earningsGrowthTrend.epsYoyGrowthPct).toBeNull();
  });

  it("classifies an accelerating earnings growth trend", () => {
    const epsActuals = [1.0, 1.0, 1.0, 1.0, 1.2, 1.2, 1.2, 1.5];
    const h = history(epsActuals.map((v) => q({ epsActual: v })));
    const result = analyzeEarningsIntelligence(h);
    expect(result.earningsGrowthTrend.direction).toBe("accelerating");
    expect(result.earningsGrowthTrend.epsYoyGrowthPct).toBeCloseTo(50, 1);
  });

  it("classifies a decelerating earnings growth trend", () => {
    const epsActuals = [1.0, 1.0, 1.0, 1.0, 1.5, 1.5, 1.5, 1.2];
    const h = history(epsActuals.map((v) => q({ epsActual: v })));
    const result = analyzeEarningsIntelligence(h);
    expect(result.earningsGrowthTrend.direction).toBe("decelerating");
  });

  it("classifies a stable earnings growth trend when the YoY swing is within the stable band", () => {
    const epsActuals = [1.0, 1.0, 1.0, 1.0, 1.1, 1.1, 1.1, 1.12];
    const h = history(epsActuals.map((v) => q({ epsActual: v })));
    const result = analyzeEarningsIntelligence(h);
    expect(result.earningsGrowthTrend.direction).toBe("stable");
  });

  it("computes revenue YoY growth independently of the EPS-driven direction classification", () => {
    const h = history(
      [1, 1, 1, 1, 1, 1, 1, 1].map((_, i) => q({ epsActual: 1, revenueActual: 100 + i * 10 })),
    );
    const result = analyzeEarningsIntelligence(h);
    expect(result.earningsGrowthTrend.revenueYoyGrowthPct).not.toBeNull();
  });

  it("reuses competitiveAdvantage.ts's historyConsistencyScore for the EPS-history component of Earnings Consistency Score", () => {
    const monotonic = history(
      [1.0, 1.1, 1.2, 1.3, 1.4].map((v) => q({ epsActual: v, epsEstimate: v })),
    );
    const declining = history(
      [1.4, 1.3, 1.2, 1.1, 1.0].map((v) => q({ epsActual: v, epsEstimate: v * 1.5 })),
    );
    const monotonicResult = analyzeEarningsIntelligence(monotonic);
    const decliningResult = analyzeEarningsIntelligence(declining);
    expect(monotonicResult.consistencyScore).not.toBeNull();
    expect(monotonicResult.consistencyScore!).toBeGreaterThan(decliningResult.consistencyScore ?? 0);
  });

  it("consistency score is null only when there's no EPS history and no beat rate at all", () => {
    const h = history([q(), q()]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.consistencyScore).toBeNull();
  });

  it("confidence is High when both EPS and revenue actual-vs-estimate are fully present", () => {
    const h = history(
      Array.from({ length: 8 }, () => q({ epsActual: 1, epsEstimate: 1, revenueActual: 100, revenueEstimate: 100 })),
    );
    const result = analyzeEarningsIntelligence(h);
    expect(result.confidenceLevel).toBe("High");
  });

  it("confidence is Moderate when EPS is fully present but revenue is permanently unavailable (Alpha Vantage)", () => {
    const h = history(Array.from({ length: 8 }, () => q({ epsActual: 1, epsEstimate: 1 })));
    const result = analyzeEarningsIntelligence(h);
    expect(result.confidenceLevel).toBe("Moderate");
    expect(result.confidenceExplanation).toMatch(/does not publish revenue actual-vs-estimate data/);
  });

  it("confidence is Low when most quarters have no usable data", () => {
    const h = history([q({ epsActual: 1, epsEstimate: 1 }), q(), q(), q()]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.confidenceLevel).toBe("Low");
  });

  it("handles zero quarters honestly, never fabricating a summary", () => {
    const h = history([]);
    const result = analyzeEarningsIntelligence(h);
    expect(result.epsBeatRate).toBeNull();
    expect(result.consistencyScore).toBeNull();
    expect(result.confidenceLevel).toBe("Low");
    expect(result.summary).toMatch(/no quarterly earnings data is available/i);
  });

  it("adds an ETF caveat to the summary for ETF-kind companies, not for stocks", () => {
    const h = history(Array.from({ length: 4 }, () => q({ epsActual: 1, epsEstimate: 1 })));
    const stock = analyzeEarningsIntelligence(h, "stock");
    const etf = analyzeEarningsIntelligence(h, "etf");
    expect(stock.summary).not.toMatch(/diversified fund/i);
    expect(etf.summary).toMatch(/diversified fund/i);
  });

  it("passes through the quarters array unmodified as the historical earnings timeline", () => {
    const quarters = [q({ fiscalQuarter: "Q1 2024" }), q({ fiscalQuarter: "Q2 2024" })];
    const h = history(quarters);
    const result = analyzeEarningsIntelligence(h);
    expect(result.quarters).toEqual(quarters);
  });

  it("never claims to fabricate or execute anything, and involves no LLM narration", () => {
    const h = history(Array.from({ length: 8 }, () => q({ epsActual: 1, epsEstimate: 1 })));
    const result = analyzeEarningsIntelligence(h);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});

describe("buildEarningsIntelligence — SIMULATED provider orchestration", () => {
  it("returns a full analysis with 8 quarters for a known SIMULATED symbol", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildEarningsIntelligence("AAPL", provider);
    expect(result).not.toBeNull();
    expect(result!.quarters.length).toBe(8);
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
  });

  it("honestly returns null for an invalid ticker shape, never fabricating an analysis", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const result = await buildEarningsIntelligence("NOT A TICKER!!", provider);
    expect(result).toBeNull();
  });

  it("is deterministic — repeated calls for the same symbol produce byte-identical quarters", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await buildEarningsIntelligence("MSFT", provider);
    const b = await buildEarningsIntelligence("MSFT", provider);
    expect(a!.quarters).toEqual(b!.quarters);
  });
});

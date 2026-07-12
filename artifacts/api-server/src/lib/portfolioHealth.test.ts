import { describe, it, expect } from "vitest";
import {
  computePortfolioHealth,
  threatFromSeverity,
  type PortfolioHealthInput,
} from "./portfolioHealth.js";

const healthy: PortfolioHealthInput = {
  accountValue: 125000,
  openTrades: 4,
  netDelta: 0.2,
  netTheta: 85,
  netVega: -120,
  netGamma: 0.04,
  portfolioRiskUsedPct: 6,
  maxPortfolioRiskPct: 25,
  withinLimits: true,
  perTradeOverCap: 0,
  symbolRisk: [
    { symbol: "SPY", riskDollars: 1500 },
    { symbol: "QQQ", riskDollars: 1400 },
    { symbol: "IWM", riskDollars: 1300 },
    { symbol: "NVDA", riskDollars: 1200 },
  ],
  attentionCount: 0,
  criticalCount: 0,
};

describe("threatFromSeverity", () => {
  it("maps severities onto traffic-light levels", () => {
    expect(threatFromSeverity("none")).toBe("green");
    expect(threatFromSeverity("info")).toBe("green");
    expect(threatFromSeverity("warning")).toBe("yellow");
    expect(threatFromSeverity("critical")).toBe("red");
  });
});

describe("computePortfolioHealth", () => {
  it("is deterministic for identical input", () => {
    const a = computePortfolioHealth(healthy);
    const b = computePortfolioHealth(healthy);
    expect(a).toEqual(b);
  });

  it("scores a balanced, in-limit book as healthy", () => {
    const r = computePortfolioHealth(healthy);
    expect(r.health.score).toBeGreaterThanOrEqual(80);
    expect(r.health.label).toBe("Healthy");
    expect(r.exposure.score).toBeGreaterThanOrEqual(80);
    expect(r.riskConcentration.score).toBeGreaterThanOrEqual(80);
    expect(r.threatCounts).toEqual({ green: 4, yellow: 0, red: 0 });
  });

  it("returns perfect scores for an empty (all-cash) book", () => {
    const r = computePortfolioHealth({ ...healthy, openTrades: 0, symbolRisk: [], netTheta: 0, netDelta: 0 });
    expect(r.health.score).toBe(100);
    expect(r.exposure.label).toBe("Flat");
    expect(r.largestSymbol).toBeNull();
  });

  it("caps health when the risk limit is breached", () => {
    const r = computePortfolioHealth({ ...healthy, withinLimits: false, portfolioRiskUsedPct: 30 });
    expect(r.health.score).toBeLessThanOrEqual(55);
  });

  it("caps health below the Stable band when a position is critical", () => {
    const r = computePortfolioHealth({ ...healthy, attentionCount: 2, criticalCount: 1 });
    expect(r.health.score).toBeLessThanOrEqual(64);
    expect(r.threatCounts).toEqual({ green: 2, yellow: 1, red: 1 });
  });

  it("penalises directional skew in the exposure score", () => {
    const skewed = computePortfolioHealth({ ...healthy, netDelta: 5 });
    expect(skewed.exposure.score).toBeLessThan(computePortfolioHealth(healthy).exposure.score);
  });

  it("penalises single-name concentration", () => {
    const concentrated = computePortfolioHealth({
      ...healthy,
      symbolRisk: [
        { symbol: "TSLA", riskDollars: 9000 },
        { symbol: "SPY", riskDollars: 500 },
      ],
    });
    expect(concentrated.largestSymbol).toBe("TSLA");
    expect(concentrated.largestSymbolPct).toBeGreaterThan(0.9);
    expect(concentrated.riskConcentration.score).toBeLessThan(
      computePortfolioHealth(healthy).riskConcentration.score,
    );
  });

  it("flags a book that is not collecting theta", () => {
    const r = computePortfolioHealth({ ...healthy, netTheta: -20 });
    expect(r.exposure.score).toBeLessThan(computePortfolioHealth(healthy).exposure.score);
  });
});

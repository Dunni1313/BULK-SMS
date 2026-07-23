import { describe, it, expect } from "vitest";
import { computeScenarioComparison, type ScenarioInput } from "./tradingScenarioComparison.js";

function scenario(over: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    name: "Scenario A",
    direction: "long",
    accountRiskPct: 1,
    entryPrice: 100,
    stopPrice: 95,
    targetPrice: 115,
    ...over,
  };
}

describe("computeScenarioComparison", () => {
  it("returns an honest empty result for zero scenarios", () => {
    const result = computeScenarioComparison("AAPL", [], 10_000);
    expect(result.scenarios).toHaveLength(0);
    expect(result.bestRiskRewardName).toBeNull();
    expect(result.tightestRiskName).toBeNull();
    expect(result.summary).toBe("No scenarios were supplied to compare.");
  });

  it("computes each scenario's risk via the exact same computeRiskParameters() math a real trade plan uses", () => {
    const result = computeScenarioComparison(
      "AAPL",
      [scenario({ name: "Tight stop", entryPrice: 100, stopPrice: 98, targetPrice: 110 })],
      10_000,
    );
    // stopDistance=2, rewardDistance=10, R:R=5; riskDollars=100, positionSize=50
    expect(result.scenarios[0].risk.riskRewardRatio).toBe(5);
    expect(result.scenarios[0].risk.positionSize).toBe(50);
  });

  it("identifies the scenario with the highest risk/reward ratio, never fabricating a winner when none exists", () => {
    const result = computeScenarioComparison(
      "AAPL",
      [
        scenario({ name: "Wide target", entryPrice: 100, stopPrice: 95, targetPrice: 130 }), // R:R = 6
        scenario({ name: "Tight target", entryPrice: 100, stopPrice: 95, targetPrice: 105 }), // R:R = 1
      ],
      10_000,
    );
    expect(result.bestRiskRewardName).toBe("Wide target");
  });

  it("identifies the scenario with the smallest computed position size", () => {
    const result = computeScenarioComparison(
      "AAPL",
      [
        scenario({ name: "Wide stop", entryPrice: 100, stopPrice: 80, targetPrice: 130, accountRiskPct: 1 }),
        scenario({ name: "Narrow stop", entryPrice: 100, stopPrice: 98, targetPrice: 110, accountRiskPct: 1 }),
      ],
      10_000,
    );
    // Wide stop: riskDollars=100, stopDistance=20 -> positionSize=5
    // Narrow stop: riskDollars=100, stopDistance=2 -> positionSize=50
    expect(result.tightestRiskName).toBe("Wide stop");
  });

  it("honestly excludes riskRewardRatio comparisons when a scenario has a zero stop distance, never a fabricated ratio", () => {
    const result = computeScenarioComparison(
      "AAPL",
      [scenario({ name: "Zero stop distance", entryPrice: 100, stopPrice: 100, targetPrice: 110 })],
      10_000,
    );
    expect(result.scenarios[0].risk.riskRewardRatio).toBeNull();
    expect(result.bestRiskRewardName).toBeNull();
  });

  it("honestly reports null position sizes and a null tightestRiskName when no account value is supplied", () => {
    const result = computeScenarioComparison("AAPL", [scenario(), scenario({ name: "B" })], null);
    expect(result.scenarios.every((s) => s.risk.positionSize === null)).toBe(true);
    expect(result.tightestRiskName).toBeNull();
    expect(result.accountValue).toBeNull();
  });

  it("carries the symbol and account value through to the result, and the summary names both winners", () => {
    const result = computeScenarioComparison(
      "MSFT",
      [
        scenario({ name: "A", entryPrice: 100, stopPrice: 95, targetPrice: 130 }),
        scenario({ name: "B", entryPrice: 100, stopPrice: 90, targetPrice: 105 }),
      ],
      5_000,
    );
    expect(result.symbol).toBe("MSFT");
    expect(result.accountValue).toBe(5_000);
    expect(result.summary).toContain("MSFT");
    expect(result.summary).toContain("Highest risk/reward");
    expect(result.summary).toContain("Smallest position size");
  });

  it("works with no symbol supplied (comparison is symbol-agnostic pure arithmetic)", () => {
    const result = computeScenarioComparison(null, [scenario()], 10_000);
    expect(result.symbol).toBeNull();
    expect(result.summary).not.toContain("for null");
  });

  it("is deterministic for the same inputs", () => {
    const scenarios = [scenario({ name: "A" }), scenario({ name: "B", targetPrice: 120 })];
    const a = computeScenarioComparison("AAPL", scenarios, 10_000);
    const b = computeScenarioComparison("AAPL", scenarios, 10_000);
    expect(a).toEqual(b);
  });
});

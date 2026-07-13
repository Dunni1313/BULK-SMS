// Phase 2, Sprint 28 — Portfolio Construction Engine unit tests (approved
// Phase 2 plan, Sprint 28). computePortfolioAllocation() is pure and
// provider-agnostic — these tests construct fixtures directly rather than
// going through a FundamentalsProvider.

import { describe, it, expect } from "vitest";
import {
  computePortfolioAllocation,
  buildPortfolioAllocation,
  REBALANCE_DRIFT_THRESHOLD_PCT,
  type PortfolioHoldingInput,
} from "./portfolioConstruction.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";

function holding(overrides: Partial<PortfolioHoldingInput> = {}): PortfolioHoldingInput {
  return {
    id: 1,
    symbol: "AAA",
    targetWeightPct: 50,
    shares: null,
    notes: "",
    ...overrides,
  };
}

describe("computePortfolioAllocation", () => {
  it("computes market value and actual weight for holdings with shares and a resolved price", () => {
    const holdings = [
      holding({ id: 1, symbol: "AAA", shares: 10, targetWeightPct: 50 }),
      holding({ id: 2, symbol: "BBB", shares: 10, targetWeightPct: 50 }),
    ];
    const prices = new Map([
      ["AAA", 100],
      ["BBB", 100],
    ]);
    const result = computePortfolioAllocation(holdings, prices);
    expect(result.totalMarketValue).toBe(2000);
    expect(result.holdings[0].marketValue).toBe(1000);
    expect(result.holdings[0].actualWeightPct).toBe(50);
    expect(result.holdings[0].driftPct).toBe(0);
    expect(result.holdings[0].rebalanceAction).toBe("hold");
  });

  it("honestly reports null market value/actual weight/drift when shares is null — never fabricated", () => {
    const holdings = [holding({ shares: null })];
    const prices = new Map([["AAA", 100]]);
    const result = computePortfolioAllocation(holdings, prices);
    expect(result.holdings[0].marketValue).toBeNull();
    expect(result.holdings[0].actualWeightPct).toBeNull();
    expect(result.holdings[0].driftPct).toBeNull();
    expect(result.holdings[0].rebalanceAction).toBe("unknown");
    expect(result.totalMarketValue).toBeNull();
  });

  it("honestly reports null market value when the symbol's price could not be resolved", () => {
    const holdings = [holding({ shares: 10 })];
    const prices = new Map([["AAA", null]]);
    const result = computePortfolioAllocation(holdings, prices);
    expect(result.holdings[0].currentPrice).toBeNull();
    expect(result.holdings[0].marketValue).toBeNull();
    expect(result.unresolvedSymbols).toEqual(["AAA"]);
  });

  it("flags 'sell' when a holding is overweight beyond the drift threshold, and 'buy' when underweight", () => {
    const holdings = [
      holding({ id: 1, symbol: "OVER", shares: 90, targetWeightPct: 50 }),
      holding({ id: 2, symbol: "UNDER", shares: 10, targetWeightPct: 50 }),
    ];
    const prices = new Map([
      ["OVER", 1],
      ["UNDER", 1],
    ]);
    const result = computePortfolioAllocation(holdings, prices);
    // OVER: actual 90%, target 50% -> drift +40pp -> overweight -> sell
    const over = result.holdings.find((h) => h.symbol === "OVER")!;
    expect(over.actualWeightPct).toBe(90);
    expect(over.driftPct).toBe(40);
    expect(over.rebalanceAction).toBe("sell");
    // UNDER: actual 10%, target 50% -> drift -40pp -> underweight -> buy
    const under = result.holdings.find((h) => h.symbol === "UNDER")!;
    expect(under.driftPct).toBe(-40);
    expect(under.rebalanceAction).toBe("buy");
  });

  it("stays within the drift threshold band as 'hold', never flagging a trivial drift", () => {
    const holdings = [
      holding({ id: 1, symbol: "A", shares: 52, targetWeightPct: 50 }),
      holding({ id: 2, symbol: "B", shares: 48, targetWeightPct: 50 }),
    ];
    const prices = new Map([
      ["A", 1],
      ["B", 1],
    ]);
    const result = computePortfolioAllocation(holdings, prices);
    // A: actual 52%, target 50% -> drift +2pp, well under REBALANCE_DRIFT_THRESHOLD_PCT
    expect(Math.abs(result.holdings[0].driftPct!)).toBeLessThan(REBALANCE_DRIFT_THRESHOLD_PCT);
    expect(result.holdings[0].rebalanceAction).toBe("hold");
  });

  it("never silently normalizes target weights — reports the actual sum and an honest warning when it isn't ~100%", () => {
    const holdings = [holding({ targetWeightPct: 30 }), holding({ id: 2, symbol: "BBB", targetWeightPct: 30 })];
    const prices = new Map<string, number | null>();
    const result = computePortfolioAllocation(holdings, prices);
    expect(result.totalTargetWeightPct).toBe(60);
    expect(result.targetWeightSumWarning).toMatch(/60%/);
  });

  it("reports no warning when target weights sum to (approximately) 100%", () => {
    const holdings = [holding({ targetWeightPct: 60 }), holding({ id: 2, symbol: "BBB", targetWeightPct: 40 })];
    const result = computePortfolioAllocation(holdings, new Map());
    expect(result.targetWeightSumWarning).toBeNull();
  });

  it("handles zero holdings honestly", () => {
    const result = computePortfolioAllocation([], new Map());
    expect(result.holdings).toEqual([]);
    expect(result.totalMarketValue).toBeNull();
    expect(result.totalTargetWeightPct).toBe(0);
    expect(result.summary).toMatch(/no holdings yet/i);
  });

  it("never claims to fabricate or execute anything", () => {
    const holdings = [holding({ shares: 10 })];
    const result = computePortfolioAllocation(holdings, new Map([["AAA", 100]]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});

describe("buildPortfolioAllocation — SIMULATED provider orchestration", () => {
  it("resolves a real price per distinct symbol via the provider", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const holdings = [holding({ id: 1, symbol: "AAPL", shares: 5 }), holding({ id: 2, symbol: "MSFT", shares: 5 })];
    const result = await buildPortfolioAllocation(holdings, provider);
    expect(result.holdings[0].currentPrice).not.toBeNull();
    expect(result.holdings[1].currentPrice).not.toBeNull();
    expect(result.totalMarketValue).not.toBeNull();
  });

  it("dedupes repeated symbols to a single provider call's worth of price resolution", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const holdings = [
      holding({ id: 1, symbol: "AAPL", shares: 5 }),
      holding({ id: 2, symbol: "AAPL", shares: 3 }),
    ];
    const result = await buildPortfolioAllocation(holdings, provider);
    expect(result.holdings[0].currentPrice).toBe(result.holdings[1].currentPrice);
  });

  it("honestly returns a null price for an invalid ticker shape, never fabricating a value", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const holdings = [holding({ symbol: "NOT A TICKER!!", shares: 5 })];
    const result = await buildPortfolioAllocation(holdings, provider);
    expect(result.holdings[0].currentPrice).toBeNull();
    expect(result.unresolvedSymbols).toEqual(["NOT A TICKER!!"]);
  });
});

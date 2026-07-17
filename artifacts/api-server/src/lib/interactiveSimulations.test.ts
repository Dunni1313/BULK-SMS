// AI Teacher & Learning Centre sprint — Interactive Education
// simulations. Pure unit coverage — every simulation is a deterministic
// function of its inputs (reusing optionsMath.ts's real bs() for
// delta/theta, lib/earnings.ts's real computeExpectedMove() for expected
// move, and standard textbook formulas for payoff/concentration).

import { describe, it, expect } from "vitest";
import {
  simulateDelta,
  simulateTheta,
  simulateExpectedMove,
  simulatePayoff,
  simulateConcentration,
  SimulationError,
} from "./interactiveSimulations.js";

function assertLabeledEducational(result: { educationalSimulation: true; notMarketData: true; noTradeRecommendation: true }) {
  expect(result.educationalSimulation).toBe(true);
  expect(result.notMarketData).toBe(true);
  expect(result.noTradeRecommendation).toBe(true);
}

describe("simulateDelta", () => {
  it("produces a rising delta curve as price rises through the strike (a call's own real Black-Scholes behavior)", () => {
    const result = simulateDelta(100, 0.3, 30);
    assertLabeledEducational(result);
    expect(result.points.length).toBeGreaterThan(10);
    const first = result.points[0].y;
    const last = result.points[result.points.length - 1].y;
    expect(last).toBeGreaterThan(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(last).toBeLessThanOrEqual(1);
  });

  it("is deterministic — identical inputs produce identical output", () => {
    expect(simulateDelta(100, 0.3, 30)).toEqual(simulateDelta(100, 0.3, 30));
  });

  it("rejects a non-positive strike, a non-positive dte, and an out-of-range IV", () => {
    expect(() => simulateDelta(-1, 0.3, 30)).toThrow(SimulationError);
    expect(() => simulateDelta(100, 0.3, 0)).toThrow(SimulationError);
    expect(() => simulateDelta(100, -0.1, 30)).toThrow(SimulationError);
    expect(() => simulateDelta(100, 5, 30)).toThrow(SimulationError);
  });
});

describe("simulateTheta", () => {
  it("theta magnitude generally grows (more negative) as DTE shrinks toward expiration", () => {
    const result = simulateTheta(100, 0.3);
    assertLabeledEducational(result);
    const farOut = result.points[0]; // dte 60
    const nearExpiry = result.points[result.points.length - 1]; // dte ~1
    expect(Math.abs(nearExpiry.y)).toBeGreaterThan(Math.abs(farOut.y));
  });

  it("rejects a non-positive strike or an out-of-range IV", () => {
    expect(() => simulateTheta(0, 0.3)).toThrow(SimulationError);
    expect(() => simulateTheta(100, -1)).toThrow(SimulationError);
  });
});

describe("simulateExpectedMove", () => {
  it("expected move widens with the square root of time (a longer horizon has a wider range)", () => {
    const result = simulateExpectedMove(100, 0.3);
    assertLabeledEducational(result);
    const early = result.points[0].y;
    const late = result.points[result.points.length - 1].y;
    expect(late).toBeGreaterThan(early);
  });

  it("rejects a non-positive price or an out-of-range IV", () => {
    expect(() => simulateExpectedMove(0, 0.3)).toThrow(SimulationError);
    expect(() => simulateExpectedMove(100, 4)).toThrow(SimulationError);
  });
});

describe("simulatePayoff", () => {
  it("covered_call: profit is capped above the strike, and the payoff line is non-decreasing until it flattens", () => {
    const result = simulatePayoff("covered_call", { stockCostBasis: 100, callStrike: 105, callPremium: 2 });
    assertLabeledEducational(result);
    const atStrike = result.points.find((p) => p.x >= 105)!;
    const wellAbove = result.points[result.points.length - 1];
    // Once past the strike, further upside in the stock no longer adds to P&L (capped).
    expect(wellAbove.y).toBeCloseTo(atStrike.y, 0);
  });

  it("cash_secured_put: max profit is exactly the premium collected, above the strike", () => {
    const result = simulatePayoff("cash_secured_put", { putStrike: 100, putPremium: 3 });
    const aboveStrike = result.points.filter((p) => p.x >= 100);
    for (const p of aboveStrike) {
      expect(p.y).toBeCloseTo(300, 0); // premium * 100
    }
  });

  it("iron_condor: max profit equals the net credit inside the short strikes, and losses are capped by the wing width", () => {
    const result = simulatePayoff("iron_condor", { putStrike: 95, longPutStrike: 90, callStrike: 105, longCallStrike: 110, netCredit: 1.5 });
    const insideRange = result.points.filter((p) => p.x >= 95 && p.x <= 105);
    for (const p of insideRange) {
      expect(p.y).toBeCloseTo(150, 0); // credit * 100
    }
    const minY = Math.min(...result.points.map((p) => p.y));
    // Max loss is bounded by (wing width - credit) * 100 = (5 - 1.5) * 100 = 350
    expect(minY).toBeGreaterThanOrEqual(-360);
  });

  it("rejects an unknown strategy", () => {
    // @ts-expect-error deliberately invalid strategy to prove the runtime guard
    expect(() => simulatePayoff("not_a_real_strategy", {})).toThrow(SimulationError);
  });
});

describe("simulateConcentration", () => {
  it("a single 100%-weight position scores maximally concentrated (100 HHI)", () => {
    const result = simulateConcentration([100]);
    assertLabeledEducational(result);
    expect(result.summary).toContain("100");
  });

  it("many equal-weight positions score well-diversified (low HHI)", () => {
    const result = simulateConcentration(new Array(20).fill(5));
    expect(result.summary.toLowerCase()).toContain("well diversified");
  });

  it("normalizes weights that don't sum to 100 before scoring", () => {
    const a = simulateConcentration([40, 30, 20, 10]);
    const b = simulateConcentration([4, 3, 2, 1]);
    expect(a.points).toEqual(b.points);
  });

  it("rejects an empty weight list and a non-positive weight sum", () => {
    expect(() => simulateConcentration([])).toThrow(SimulationError);
    expect(() => simulateConcentration([0, 0])).toThrow(SimulationError);
  });
});

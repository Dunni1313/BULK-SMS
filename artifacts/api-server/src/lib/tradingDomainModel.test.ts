// Phase 24 — Institutional Trading Engine Foundation.
// Tests for the one real function in the shared domain model:
// computeRiskParameters(). Everything else in tradingDomainModel.ts is a
// type re-export or a type-only interface, needing no test of its own.
import { describe, it, expect } from "vitest";
import { computeRiskParameters, TRADING_SESSION_WINDOWS } from "./tradingDomainModel.js";

describe("computeRiskParameters", () => {
  it("computes position size and risk:reward from a long plan's entry/stop/target", () => {
    const result = computeRiskParameters(
      { accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115 },
      10000,
    );
    // risk $100 (1% of 10,000), stop distance $5 -> 20 units
    expect(result.positionSize).toBeCloseTo(20, 4);
    // reward distance $15 / stop distance $5 = 3
    expect(result.riskRewardRatio).toBe(3);
  });

  it("computes the same math for a short plan (stop above entry, target below)", () => {
    const result = computeRiskParameters(
      { accountRiskPct: 2, entryPrice: 100, stopPrice: 105, targetPrice: 85 },
      10000,
    );
    // risk $200 (2% of 10,000), stop distance $5 -> 40 units
    expect(result.positionSize).toBeCloseTo(40, 4);
    // reward distance $15 / stop distance $5 = 3
    expect(result.riskRewardRatio).toBe(3);
  });

  it("honestly reports null position size when account value is not positive, never a fabricated number", () => {
    const zero = computeRiskParameters({ accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115 }, 0);
    const negative = computeRiskParameters({ accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115 }, -500);
    const missing = computeRiskParameters({ accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115 }, null);
    expect(zero.positionSize).toBeNull();
    expect(negative.positionSize).toBeNull();
    expect(missing.positionSize).toBeNull();
    // riskRewardRatio is independent of account value and should still compute
    expect(zero.riskRewardRatio).toBe(3);
  });

  it("honestly reports null for both derived fields when entry equals stop (zero stop distance)", () => {
    const result = computeRiskParameters(
      { accountRiskPct: 1, entryPrice: 100, stopPrice: 100, targetPrice: 115 },
      10000,
    );
    expect(result.positionSize).toBeNull();
    expect(result.riskRewardRatio).toBeNull();
  });

  it("preserves the original entry/stop/target/accountRiskPct fields unchanged", () => {
    const result = computeRiskParameters(
      { accountRiskPct: 1.5, entryPrice: 50, stopPrice: 48, targetPrice: 56 },
      20000,
    );
    expect(result.accountRiskPct).toBe(1.5);
    expect(result.entryPrice).toBe(50);
    expect(result.stopPrice).toBe(48);
    expect(result.targetPrice).toBe(56);
  });
});

describe("TRADING_SESSION_WINDOWS", () => {
  it("defines exactly the 4 standard sessions, each with a valid UTC hour range", () => {
    expect(TRADING_SESSION_WINDOWS.map((w) => w.name).sort()).toEqual(
      ["london", "new_york", "sydney", "tokyo"].sort(),
    );
    for (const w of TRADING_SESSION_WINDOWS) {
      expect(w.startUtcHour).toBeGreaterThanOrEqual(0);
      expect(w.startUtcHour).toBeLessThanOrEqual(23);
      expect(w.endUtcHour).toBeGreaterThanOrEqual(0);
      expect(w.endUtcHour).toBeLessThanOrEqual(23);
    }
  });
});

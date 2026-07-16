import { describe, it, expect } from "vitest";
import type { Trade, OrderReconciliationEntry } from "@workspace/api-client-react";
import {
  tradeDirection,
  derivedExitPrice,
  holdingPeriodDays,
  isMockOrderId,
  tradeSpreadQuantity,
  computePerformanceAnalytics,
  computeReconciliationSuccess,
} from "./tradeAnalytics";

function tradeFixture(over: Partial<Trade> = {}): Trade {
  return {
    id: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    status: "open",
    legs: [],
    openDate: "2026-07-01T00:00:00.000Z",
    closeDate: null,
    expiration: null,
    credit: 100,
    maxProfit: 100,
    maxLoss: 400,
    currentPnl: null,
    currentPnlPercent: null,
    pop: 0.7,
    ev: 20,
    theta: 5,
    ravishScore: 70,
    exitReason: null,
    notes: null,
    ...over,
  } as Trade;
}

describe("tradeDirection", () => {
  it("classifies a net-credit trade as Short", () => {
    expect(tradeDirection(tradeFixture({ credit: 100 }))).toBe("Short");
  });
  it("classifies a net-debit trade as Long", () => {
    expect(tradeDirection(tradeFixture({ credit: -50 }))).toBe("Long");
  });
  it("classifies a zero-credit trade as Short (credit >= 0)", () => {
    expect(tradeDirection(tradeFixture({ credit: 0 }))).toBe("Short");
  });
});

describe("derivedExitPrice", () => {
  it("is null for a trade that is not closed", () => {
    expect(derivedExitPrice(tradeFixture({ status: "open", currentPnl: 50 }))).toBeNull();
  });

  it("is null for a closed trade with no known realized P&L", () => {
    expect(derivedExitPrice(tradeFixture({ status: "closed", currentPnl: null }))).toBeNull();
  });

  it("derives cost-to-close from credit minus realized P&L for a closed trade", () => {
    // credit 100, realized P&L +40 => cost to close 60.
    expect(derivedExitPrice(tradeFixture({ status: "closed", credit: 100, currentPnl: 40 }))).toBe(60);
  });

  it("derives a negative cost-to-close honestly when the loss exceeded the credit received", () => {
    expect(derivedExitPrice(tradeFixture({ status: "closed", credit: 100, currentPnl: -50 }))).toBe(150);
  });
});

describe("holdingPeriodDays", () => {
  it("computes days between open and close for a closed trade", () => {
    const t = tradeFixture({
      status: "closed",
      openDate: "2026-07-01T00:00:00.000Z",
      closeDate: "2026-07-05T00:00:00.000Z",
    });
    expect(holdingPeriodDays(t)).toBe(4);
  });

  it("computes days between open and 'now' for a still-open trade", () => {
    const t = tradeFixture({ status: "open", openDate: "2026-07-01T00:00:00.000Z", closeDate: null });
    const now = new Date("2026-07-04T00:00:00.000Z");
    expect(holdingPeriodDays(t, now)).toBe(3);
  });

  it("never returns a negative holding period", () => {
    const t = tradeFixture({ status: "open", openDate: "2026-07-10T00:00:00.000Z", closeDate: null });
    const now = new Date("2026-07-01T00:00:00.000Z");
    expect(holdingPeriodDays(t, now)).toBe(0);
  });
});

describe("isMockOrderId", () => {
  it("recognizes a mock-prefixed order id", () => {
    expect(isMockOrderId("mock-abc123")).toBe(true);
  });
  it("recognizes a real-looking order id as not mock", () => {
    expect(isMockOrderId("a1b2c3d4-real-alpaca-id")).toBe(false);
  });
  it("treats null/undefined as not mock", () => {
    expect(isMockOrderId(null)).toBe(false);
    expect(isMockOrderId(undefined)).toBe(false);
  });
});

describe("tradeSpreadQuantity", () => {
  it("is null for a trade with no legs", () => {
    expect(tradeSpreadQuantity(tradeFixture({ legs: [] }))).toBeNull();
  });

  it("takes the largest per-leg quantity as the spread count", () => {
    const t = tradeFixture({
      legs: [
        { side: "sell", quantity: 2, strike: 400, optionType: "put", expiration: "2026-12-18", openPrice: 2 },
        { side: "buy", quantity: 2, strike: 390, optionType: "put", expiration: "2026-12-18", openPrice: 1 },
      ] as Trade["legs"],
    });
    expect(tradeSpreadQuantity(t)).toBe(2);
  });
});

describe("computePerformanceAnalytics", () => {
  it("honestly reports all-null/zero figures for an empty trade list", () => {
    const a = computePerformanceAnalytics([]);
    expect(a.totalTrades).toBe(0);
    expect(a.winRate).toBeNull();
    expect(a.averageWin).toBeNull();
    expect(a.averageLoss).toBeNull();
    expect(a.averageHoldingDays).toBeNull();
    expect(a.largestWinner).toBeNull();
    expect(a.largestLoser).toBeNull();
    expect(a.openTrades).toBe(0);
    expect(a.closedTrades).toBe(0);
  });

  it("computes win rate, averages, and largest winner/loser over a real mix of closed trades", () => {
    const trades = [
      tradeFixture({ id: 1, status: "closed", currentPnl: 100, openDate: "2026-07-01T00:00:00.000Z", closeDate: "2026-07-03T00:00:00.000Z" }),
      tradeFixture({ id: 2, status: "closed", currentPnl: 200, openDate: "2026-07-01T00:00:00.000Z", closeDate: "2026-07-05T00:00:00.000Z" }),
      tradeFixture({ id: 3, status: "closed", currentPnl: -50, openDate: "2026-07-01T00:00:00.000Z", closeDate: "2026-07-02T00:00:00.000Z" }),
      tradeFixture({ id: 4, status: "open", currentPnl: null }),
    ];
    const a = computePerformanceAnalytics(trades);
    expect(a.totalTrades).toBe(4);
    expect(a.winningTrades).toBe(2);
    expect(a.losingTrades).toBe(1);
    expect(a.winRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(a.averageWin).toBe(150); // (100 + 200) / 2
    expect(a.averageLoss).toBe(-50);
    expect(a.largestWinner).toBe(200);
    expect(a.largestLoser).toBe(-50);
    expect(a.openTrades).toBe(1);
    expect(a.closedTrades).toBe(3);
    // Average holding days over the 3 closed trades: 2, 4, 1 => 7/3.
    expect(a.averageHoldingDays).toBeCloseTo(7 / 3, 5);
  });

  it("counts a breakeven trade separately, excluded from winRate's denominator", () => {
    const trades = [
      tradeFixture({ id: 1, status: "closed", currentPnl: 0 }),
      tradeFixture({ id: 2, status: "closed", currentPnl: 10 }),
    ];
    const a = computePerformanceAnalytics(trades);
    expect(a.breakevenTrades).toBe(1);
    expect(a.winRate).toBe(100); // 1 win / 1 decided (breakeven excluded)
  });

  it("counts pending trades toward openTrades", () => {
    const trades = [tradeFixture({ id: 1, status: "pending" })];
    const a = computePerformanceAnalytics(trades);
    expect(a.openTrades).toBe(1);
  });

  it("never fabricates a win/loss for a closed trade with an unknown P&L", () => {
    const trades = [tradeFixture({ id: 1, status: "closed", currentPnl: null })];
    const a = computePerformanceAnalytics(trades);
    expect(a.winningTrades).toBe(0);
    expect(a.losingTrades).toBe(0);
    expect(a.winRate).toBeNull();
    // Still counts as a closed trade for the closedTrades tally.
    expect(a.closedTrades).toBe(1);
  });
});

function orderEntryFixture(over: Partial<OrderReconciliationEntry> = {}): OrderReconciliationEntry {
  return {
    tradeId: 1,
    alpacaOrderId: "order-1",
    localSymbol: "AAPL",
    brokerSymbol: "AAPL",
    localStatus: "open",
    brokerStatus: "filled",
    brokerRawStatus: "filled",
    localQuantity: 1,
    brokerQuantity: 1,
    filledQuantity: 1,
    averageFillPrice: 2.5,
    issues: [],
    ...over,
  };
}

describe("computeReconciliationSuccess", () => {
  it("honestly reports null (not 0% or 100%) when reconciliation hasn't been checked", () => {
    const s = computeReconciliationSuccess(undefined);
    expect(s.successPercentage).toBeNull();
    expect(s.consideredCount).toBe(0);
  });

  it("honestly reports null when reconciliation ran but there was nothing to compare", () => {
    const s = computeReconciliationSuccess([]);
    expect(s.successPercentage).toBeNull();
  });

  it("computes 100% when every order entry is issue-free", () => {
    const s = computeReconciliationSuccess([orderEntryFixture(), orderEntryFixture({ tradeId: 2, alpacaOrderId: "order-2" })]);
    expect(s.successPercentage).toBe(100);
    expect(s.matchedCount).toBe(2);
    expect(s.consideredCount).toBe(2);
  });

  it("computes a real percentage when some entries have issues", () => {
    const s = computeReconciliationSuccess([
      orderEntryFixture(),
      orderEntryFixture({ tradeId: 2, alpacaOrderId: "order-2", issues: ["quantity_mismatch"] }),
      orderEntryFixture({ tradeId: 3, alpacaOrderId: "order-3", issues: ["missing_at_broker"] }),
    ]);
    expect(s.successPercentage).toBeCloseTo((1 / 3) * 100, 5);
  });
});

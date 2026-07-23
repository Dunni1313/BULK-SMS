// Phase 24 — Institutional Trading Engine Foundation.
import { describe, it, expect } from "vitest";
import { createTradePlan, transitionTradePlanStatus } from "./tradePlanService.js";

describe("createTradePlan", () => {
  it("builds a draft plan with derived risk parameters, symbol uppercased", () => {
    const plan = createTradePlan(
      { symbol: "aapl", direction: "long", thesis: "Bull flag on the daily.", accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115 },
      10000,
    );
    expect(plan.status).toBe("draft");
    expect(plan.symbol).toBe("AAPL");
    expect(plan.direction).toBe("long");
    expect(plan.thesis).toBe("Bull flag on the daily.");
    expect(plan.risk.positionSize).toBeCloseTo(20, 4);
    expect(plan.risk.riskRewardRatio).toBe(3);
    expect(typeof plan.id).toBe("string");
    expect(plan.id.length).toBeGreaterThan(0);
    expect(new Date(plan.createdAt).toISOString()).toBe(plan.createdAt);
  });

  it("never fabricates a position size when no account value is supplied", () => {
    const plan = createTradePlan(
      { symbol: "MSFT", direction: "short", thesis: "Rejection at resistance.", accountRiskPct: 1, entryPrice: 300, stopPrice: 310, targetPrice: 270 },
      null,
    );
    expect(plan.risk.positionSize).toBeNull();
    expect(plan.risk.riskRewardRatio).toBe(3);
  });

  it("gives two plans created from identical inputs distinct ids", () => {
    const input = { symbol: "TSLA", direction: "long" as const, thesis: "x", accountRiskPct: 1, entryPrice: 200, stopPrice: 190, targetPrice: 230 };
    const a = createTradePlan(input, 5000);
    const b = createTradePlan(input, 5000);
    expect(a.id).not.toBe(b.id);
  });
});

describe("transitionTradePlanStatus", () => {
  function draftPlan() {
    return createTradePlan(
      { symbol: "NVDA", direction: "long", thesis: "x", accountRiskPct: 1, entryPrice: 100, stopPrice: 90, targetPrice: 130 },
      10000,
    );
  }

  it("allows draft -> active", () => {
    const next = transitionTradePlanStatus(draftPlan(), "active");
    expect(next?.status).toBe("active");
  });

  it("allows draft -> cancelled", () => {
    const next = transitionTradePlanStatus(draftPlan(), "cancelled");
    expect(next?.status).toBe("cancelled");
  });

  it("allows active -> closed", () => {
    const active = transitionTradePlanStatus(draftPlan(), "active")!;
    const closed = transitionTradePlanStatus(active, "closed");
    expect(closed?.status).toBe("closed");
  });

  it("honestly refuses draft -> closed (must go through active first), returning null rather than mutating", () => {
    const plan = draftPlan();
    const result = transitionTradePlanStatus(plan, "closed");
    expect(result).toBeNull();
  });

  it("honestly refuses re-opening an already-closed plan", () => {
    const active = transitionTradePlanStatus(draftPlan(), "active")!;
    const closed = transitionTradePlanStatus(active, "closed")!;
    expect(transitionTradePlanStatus(closed, "active")).toBeNull();
    expect(transitionTradePlanStatus(closed, "draft")).toBeNull();
  });

  it("honestly refuses transitioning a cancelled plan anywhere", () => {
    const cancelled = transitionTradePlanStatus(draftPlan(), "cancelled")!;
    expect(transitionTradePlanStatus(cancelled, "active")).toBeNull();
    expect(transitionTradePlanStatus(cancelled, "closed")).toBeNull();
  });

  it("never mutates the input plan object", () => {
    const plan = draftPlan();
    const original = { ...plan };
    transitionTradePlanStatus(plan, "active");
    expect(plan).toEqual(original);
  });
});

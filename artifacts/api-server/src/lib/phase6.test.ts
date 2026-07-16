import { describe, it, expect } from "vitest";
import { evaluateAutoGuardrails, decideCandidate } from "./autoExecution.js";
import { MIN_RAVISH_SCORE } from "./execution.js";

const BASE = {
  mode: "full_auto",
  autoEnabled: true,
  tradesToday: 0,
  maxTradesPerDay: 5,
  concurrentPositions: 0,
  maxConcurrentPositions: 10,
  dailyRealizedPnl: 0,
  accountValue: 125_000,
  maxDailyLossPct: 5,
};

describe("evaluateAutoGuardrails", () => {
  it("allows trading when armed and within all limits", () => {
    const r = evaluateAutoGuardrails(BASE);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.remainingCapacity).toBe(5); // min(5 day, 10 concurrent)
  });

  it("blocks when mode is not full_auto", () => {
    const r = evaluateAutoGuardrails({ ...BASE, mode: "semi_auto" });
    expect(r.allowed).toBe(false);
    expect(r.remainingCapacity).toBe(0);
    expect(r.reason).toMatch(/not active/i);
  });

  it("blocks when the master switch (kill switch) is off", () => {
    const r = evaluateAutoGuardrails({ ...BASE, autoEnabled: false });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/kill switch/i);
  });

  it("blocks at the daily trade cap", () => {
    const r = evaluateAutoGuardrails({ ...BASE, tradesToday: 5, maxTradesPerDay: 5 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/daily trade cap/i);
  });

  it("blocks at the concurrent-position cap", () => {
    const r = evaluateAutoGuardrails({
      ...BASE,
      concurrentPositions: 10,
      maxConcurrentPositions: 10,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/concurrent/i);
  });

  it("trips the daily-loss circuit breaker at the limit", () => {
    // 5% of 125k = 6250 loss limit
    const r = evaluateAutoGuardrails({ ...BASE, dailyRealizedPnl: -6250 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/circuit breaker/i);
  });

  it("does not trip the breaker just below the limit", () => {
    const r = evaluateAutoGuardrails({ ...BASE, dailyRealizedPnl: -6249 });
    expect(r.allowed).toBe(true);
  });

  it("ignores positive realized P&L for the breaker", () => {
    const r = evaluateAutoGuardrails({ ...BASE, dailyRealizedPnl: 9999 });
    expect(r.allowed).toBe(true);
  });

  it("remaining capacity is the tighter of day vs concurrent caps", () => {
    const r = evaluateAutoGuardrails({
      ...BASE,
      tradesToday: 3,
      maxTradesPerDay: 5, // 2 left by day
      concurrentPositions: 9,
      maxConcurrentPositions: 10, // 1 left by concurrent
    });
    expect(r.allowed).toBe(true);
    expect(r.remainingCapacity).toBe(1);
  });
});

describe("decideCandidate", () => {
  const autoMinScore = 68;

  it("executes a valid candidate above the auto floor", () => {
    const d = decideCandidate({
      validationValid: true,
      ravishScore: 72,
      autoMinScore,
      violations: [],
    });
    expect(d.decision).toBe("execute");
  });

  it("skips a candidate below the auto floor even if valid", () => {
    const d = decideCandidate({
      validationValid: true,
      ravishScore: 65, // below 68 auto floor
      autoMinScore,
      violations: [],
    });
    expect(d.decision).toBe("skip");
    expect(d.reason).toMatch(/below the auto floor/i);
  });

  it("rejects a candidate that clears the score floor but fails risk validation", () => {
    const d = decideCandidate({
      validationValid: false,
      ravishScore: 75,
      autoMinScore,
      violations: ["Portfolio risk exceeds cap"],
    });
    expect(d.decision).toBe("reject");
    expect(d.reason).toMatch(/risk validation failed/i);
  });

  it("score floor is the stricter of auto-min and the hard execution floor", () => {
    // If someone sets autoMinScore below the hard floor, the hard floor wins.
    const d = decideCandidate({
      validationValid: true,
      ravishScore: MIN_RAVISH_SCORE - 1,
      autoMinScore: 0,
      violations: [],
    });
    expect(d.decision).toBe("skip");
  });

  it("score-floor skip takes priority over a risk failure", () => {
    const d = decideCandidate({
      validationValid: false,
      ravishScore: 50,
      autoMinScore,
      violations: ["bad"],
    });
    expect(d.decision).toBe("skip");
  });
});

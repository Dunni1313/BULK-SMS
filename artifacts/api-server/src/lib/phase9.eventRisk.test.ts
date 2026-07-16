import { describe, it, expect } from "vitest";
import { assessEventRisk, getUpcomingEvents } from "./eventRisk.js";

// Fixed clock: Monday, Jan 5 2026 (UTC) so the simulated calendar is deterministic.
const NOW = Date.UTC(2026, 0, 5);
const DAY_MS = 86_400_000;
function exp(daysFromNow: number): string {
  return new Date(NOW + daysFromNow * DAY_MS).toISOString().split("T")[0];
}

describe("event risk — earnings rule", () => {
  it("blocks short premium (iron condor) when earnings falls inside the trade window", () => {
    const a = assessEventRisk({
      symbol: "AAPL",
      strategy: "iron_condor",
      expiration: exp(45),
      now: NOW,
      earningsInDays: 10,
    });
    expect(a.blockShortPremium).toBe(true);
    expect(a.blockAuto).toBe(true);
    expect(a.level).toBe("high");
    expect(a.penalty).toBeGreaterThanOrEqual(12);
    expect(a.events.some((e) => e.type === "earnings")).toBe(true);
    expect(a.warnings.some((w) => /do not open short premium/i.test(w))).toBe(true);
  });

  it("blocks iron fly the same way", () => {
    const a = assessEventRisk({
      symbol: "NVDA",
      strategy: "iron_fly",
      expiration: exp(30),
      now: NOW,
      earningsInDays: 6,
    });
    expect(a.blockShortPremium).toBe(true);
  });

  it("does NOT block the dedicated earnings strategy (it trades the event)", () => {
    const a = assessEventRisk({
      symbol: "AAPL",
      strategy: "earnings",
      expiration: exp(20),
      now: NOW,
      earningsInDays: 5,
    });
    expect(a.blockShortPremium).toBe(false);
    // the event is still surfaced, but does not contribute the earnings penalty
    expect(a.events.some((e) => e.type === "earnings")).toBe(true);
  });

  it("warns (not blocks) a calendar spread whose expiration crosses earnings", () => {
    const a = assessEventRisk({
      symbol: "AAPL",
      strategy: "calendar_spread",
      expiration: exp(45),
      now: NOW,
      earningsInDays: 10,
    });
    expect(a.blockShortPremium).toBe(false);
    expect(a.events.some((e) => e.type === "earnings")).toBe(true);
    expect(a.warnings.some((w) => /earnings/i.test(w))).toBe(true);
  });

  it("ignores earnings that fall after expiration", () => {
    const a = assessEventRisk({
      symbol: "AAPL",
      strategy: "iron_condor",
      expiration: exp(7),
      now: NOW,
      earningsInDays: 30,
    });
    expect(a.events.some((e) => e.type === "earnings")).toBe(false);
    expect(a.blockShortPremium).toBe(false);
  });
});

describe("event risk — macro penalty + levels", () => {
  it("accumulates a penalty from in-window macro events (no earnings)", () => {
    const a = assessEventRisk({
      symbol: "SPY",
      strategy: "iron_condor",
      expiration: exp(60),
      now: NOW,
      earningsInDays: null,
    });
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.events.every((e) => e.type !== "earnings")).toBe(true);
    expect(a.penalty).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(a.level);
  });

  it("escalates to high + blockAuto when an FOMC decision is in the window (no earnings)", () => {
    // Jan 2026 is an FOMC month; the 3rd-Wednesday decision (~Jan 21) is inside a 45d window.
    const a = assessEventRisk({
      symbol: "SPY",
      strategy: "iron_condor",
      expiration: exp(45),
      now: NOW,
      earningsInDays: null,
    });
    expect(a.events.some((e) => e.type === "fomc")).toBe(true);
    expect(a.level).toBe("high");
    expect(a.blockAuto).toBe(true);
  });

  it("stays medium (no auto-block) for routine monthly macro with no FOMC/earnings", () => {
    // A Feb window contains jobs + CPI but NO FOMC (Feb is not an FOMC month) and no earnings.
    const feb = Date.UTC(2026, 1, 2);
    const febExp = new Date(feb + 20 * DAY_MS).toISOString().split("T")[0];
    const a = assessEventRisk({
      symbol: "TSLA", // no dividend, no earnings
      strategy: "iron_condor",
      expiration: febExp,
      now: feb,
      earningsInDays: null,
    });
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.events.some((e) => e.impact === "high")).toBe(false);
    expect(a.penalty).toBeGreaterThan(0);
    expect(a.level).toBe("medium");
    expect(a.blockAuto).toBe(false);
  });

  it("returns a clean assessment when nothing is in the window", () => {
    const a = assessEventRisk({
      symbol: "TSLA", // does not pay a dividend
      strategy: "iron_condor",
      expiration: exp(3),
      now: NOW,
      earningsInDays: null,
    });
    expect(a.level).toBe("none");
    expect(a.penalty).toBe(0);
    expect(a.events).toHaveLength(0);
    expect(a.blockShortPremium).toBe(false);
    expect(a.blockAuto).toBe(false);
  });

  it("is a full passthrough when disabled", () => {
    const a = assessEventRisk({
      symbol: "AAPL",
      strategy: "iron_condor",
      expiration: exp(45),
      now: NOW,
      earningsInDays: 5,
      enabled: false,
    });
    expect(a.level).toBe("none");
    expect(a.penalty).toBe(0);
    expect(a.events).toHaveLength(0);
    expect(a.blockShortPremium).toBe(false);
  });
});

describe("event risk — upcoming calendar", () => {
  it("returns a forward calendar including macro events, all in the future, sorted", () => {
    const evs = getUpcomingEvents(["SPY", "AAPL"], NOW, 60);
    expect(evs.length).toBeGreaterThan(0);
    expect(evs.some((e) => ["fomc", "cpi", "jobs"].includes(e.type))).toBe(true);
    expect(evs.every((e) => e.daysAway >= 0)).toBe(true);
    const dates = evs.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

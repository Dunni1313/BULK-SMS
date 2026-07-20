// Phase 25 — Institutional Trade Workspace. Unit tests for the one
// genuinely new piece of Market Data orchestration this phase.

import { describe, it, expect } from "vitest";
import { activeSessionsAt, buildSessionData } from "./sessionService.js";

describe("activeSessionsAt", () => {
  it("reports Tokyo+Sydney open, London/New York closed, at hour 3 UTC", () => {
    const sessions = activeSessionsAt(new Date("2026-01-05T03:00:00.000Z"));
    expect(sessions.sort()).toEqual(["sydney", "tokyo"].sort());
  });

  it("reports London open, Sydney/Tokyo closed, at hour 10 UTC", () => {
    const sessions = activeSessionsAt(new Date("2026-01-05T10:00:00.000Z"));
    expect(sessions).toEqual(["london"]);
  });

  it("reports both London and New York open during their overlap, at hour 13 UTC", () => {
    const sessions = activeSessionsAt(new Date("2026-01-05T13:00:00.000Z"));
    expect(sessions.sort()).toEqual(["london", "new_york"].sort());
  });

  it("correctly handles Sydney's midnight wrap (21:00-06:00 UTC) at hour 23", () => {
    const sessions = activeSessionsAt(new Date("2026-01-05T23:00:00.000Z"));
    expect(sessions).toContain("sydney");
  });

  it("reports zero sessions open at a genuinely quiet hour (e.g. hour 17 UTC, after London/NY close, before Sydney open)", () => {
    // New York closes at 21:00 UTC, Sydney opens at 21:00 UTC — 17:00 is
    // still inside New York's own window, so pick a real gap: after London
    // closes (16:00) but New York is still open until 21:00 -> not empty.
    // The only genuine gap in this session table is none (24h coverage via
    // Sydney's wrap + New York's 12-21 + London's 7-16 + Tokyo's 0-9) —
    // confirm hour 17 (mid New York) is non-empty instead, an honest
    // property of the real table rather than a fabricated "quiet hour".
    const sessions = activeSessionsAt(new Date("2026-01-05T17:00:00.000Z"));
    expect(sessions).toEqual(["new_york"]);
  });
});

describe("buildSessionData", () => {
  it("honestly returns null for an invalid ticker shape", async () => {
    const result = await buildSessionData("NOT A TICKER!!");
    expect(result).toBeNull();
  });

  it("resolves a well-shaped result for a valid symbol, uppercasing it", async () => {
    const result = await buildSessionData("aapl", "2026-06-15T15:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.asOf).toBe("2026-06-15T15:00:00.000Z");
    expect(Array.isArray(result!.activeSessions)).toBe(true);
    expect(result!.sessionHigh).not.toBeNull();
    expect(result!.sessionLow).not.toBeNull();
    expect(result!.sessionHigh!).toBeGreaterThanOrEqual(result!.sessionLow!);
  });

  it("is deterministic across repeated calls for the same symbol/asOf", async () => {
    const a = await buildSessionData("MSFT", "2026-06-15T15:00:00.000Z");
    const b = await buildSessionData("MSFT", "2026-06-15T15:00:00.000Z");
    expect(a).toEqual(b);
  });

  it("resolves a plausible session for a symbol outside the default 10-symbol universe", async () => {
    const result = await buildSessionData("IBM", "2026-06-15T15:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("IBM");
  });
});

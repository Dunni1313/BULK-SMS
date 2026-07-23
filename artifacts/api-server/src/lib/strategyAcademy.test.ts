// AI Teacher & Learning Centre sprint — Strategy Academy. The static
// content is a plain, deterministic TypeScript literal (no DB, no
// network); the paperExample field for iron_condor/iron_fly/
// calendar_spread calls the REAL execution.ts canonicalQuote()/coach.ts
// positionGreeks() — the exact same functions the real Trade Ticket
// uses — so this is a genuine, if lightweight, integration test.

import { describe, it, expect } from "vitest";
import {
  getStrategyAcademyEntry,
  allStrategyAcademyEntries,
  strategyAcademyKeys,
  type StrategyAcademyKey,
} from "./strategyAcademy.js";

const ALL_KEYS: StrategyAcademyKey[] = [
  "covered_call",
  "cash_secured_put",
  "wheel",
  "vertical_spread",
  "iron_condor",
  "iron_fly",
  "calendar_spread",
  "diagonal_spread",
];

const LIVE_KEYS: StrategyAcademyKey[] = ["iron_condor", "iron_fly", "calendar_spread"];
const UNAVAILABLE_KEYS: StrategyAcademyKey[] = ["covered_call", "cash_secured_put", "wheel", "vertical_spread", "diagonal_spread"];

describe("strategy academy content", () => {
  it("has exactly the 8 requested strategies", () => {
    expect(strategyAcademyKeys().sort()).toEqual([...ALL_KEYS].sort());
  });

  it("every entry has all 10 requested detail fields, non-empty", () => {
    for (const key of ALL_KEYS) {
      const entry = getStrategyAcademyEntry(key)!;
      expect(entry.construction.length).toBeGreaterThan(10);
      expect(entry.idealMarket.length).toBeGreaterThan(10);
      expect(entry.maxProfit.length).toBeGreaterThan(5);
      expect(entry.maxLoss.length).toBeGreaterThan(5);
      expect(entry.greeksProfile.length).toBeGreaterThan(10);
      expect(entry.timeDecay.length).toBeGreaterThan(10);
      expect(entry.volatilityBehavior.length).toBeGreaterThan(10);
      expect(entry.assignmentRisk.length).toBeGreaterThan(10);
      expect(entry.commonMistakes.length).toBeGreaterThan(0);
      expect(entry.institutionalPerspective.length).toBeGreaterThan(10);
    }
  });

  it("builtByThisEngine is true only for the 3 strategies execution.ts actually builds", () => {
    for (const key of LIVE_KEYS) {
      expect(getStrategyAcademyEntry(key)!.builtByThisEngine).toBe(true);
    }
    for (const key of UNAVAILABLE_KEYS) {
      expect(getStrategyAcademyEntry(key)!.builtByThisEngine).toBe(false);
    }
  });
});

describe("paper trading example — live worked examples", () => {
  it("iron_condor/iron_fly/calendar_spread produce a real, available example with real Greeks", () => {
    for (const key of LIVE_KEYS) {
      const entry = getStrategyAcademyEntry(key)!;
      expect(entry.paperExample.available).toBe(true);
      expect(entry.paperExample.unavailableReason).toBeNull();
      expect(entry.paperExample.symbol).toBe("SPY");
      expect(entry.paperExample.detail).not.toBeNull();
      expect(entry.paperExample.detail).toContain("SPY");
      expect(entry.paperExample.greeks).not.toBeNull();
      expect(typeof entry.paperExample.greeks!.delta).toBe("number");
    }
  });
});

describe("paper trading example — honest unavailability", () => {
  it("covered_call/cash_secured_put/wheel/vertical_spread/diagonal_spread are honestly disclosed as unavailable, never fabricated", () => {
    for (const key of UNAVAILABLE_KEYS) {
      const entry = getStrategyAcademyEntry(key)!;
      expect(entry.paperExample.available).toBe(false);
      expect(entry.paperExample.unavailableReason).not.toBeNull();
      expect(entry.paperExample.symbol).toBeNull();
      expect(entry.paperExample.detail).toBeNull();
      expect(entry.paperExample.greeks).toBeNull();
    }
  });
});

describe("getStrategyAcademyEntry / allStrategyAcademyEntries", () => {
  it("honestly returns null for an unknown strategy key", () => {
    expect(getStrategyAcademyEntry("not-a-real-strategy")).toBeNull();
  });

  it("allStrategyAcademyEntries returns all 8, each matching its own single-entry lookup", () => {
    const all = allStrategyAcademyEntries();
    expect(all).toHaveLength(8);
    for (const key of ALL_KEYS) {
      const single = getStrategyAcademyEntry(key);
      const fromAll = all.find((e) => e.key === key);
      expect(fromAll?.construction).toBe(single?.construction);
      expect(fromAll?.builtByThisEngine).toBe(single?.builtByThisEngine);
    }
  });
});

// v1.3.1 — AI Trading Coach, Frontend UI. Unit tests for the shared
// context adapters and the static suggested-prompts/suggested-actions rule
// tables.

import { describe, it, expect } from "vitest";
import {
  focusFromSymbol,
  focusFromScannerCandidate,
  focusFromTradingPosition,
  getSuggestedPrompts,
  getSuggestedActions,
} from "./trading-coach-context";

describe("trading-coach-context adapters", () => {
  it("focusFromSymbol uppercases the symbol", () => {
    expect(focusFromSymbol("aapl")).toEqual({ symbol: "AAPL" });
  });

  it("focusFromScannerCandidate builds a human-readable label from the strategy", () => {
    const focus = focusFromScannerCandidate({ id: 42, symbol: "AAPL", strategy: "iron_condor" });
    expect(focus).toEqual({
      symbol: "AAPL",
      scannerCandidateId: 42,
      scannerCandidateLabel: "AAPL iron condor",
    });
  });

  it("focusFromTradingPosition includes the side in its label when supplied", () => {
    expect(focusFromTradingPosition({ id: 7, symbol: "TSLA", side: "short" })).toEqual({
      symbol: "TSLA",
      tradingPositionId: 7,
      tradingPositionLabel: "TSLA short",
    });
  });

  it("focusFromTradingPosition falls back to the symbol alone when side is omitted", () => {
    expect(focusFromTradingPosition({ id: 7, symbol: "TSLA" })).toEqual({
      symbol: "TSLA",
      tradingPositionId: 7,
      tradingPositionLabel: "TSLA",
    });
  });
});

describe("getSuggestedPrompts", () => {
  it("includes opportunity-specific prompts when a scanner candidate is in focus", () => {
    const prompts = getSuggestedPrompts({ symbol: "AAPL", scannerCandidateId: 1 });
    expect(prompts).toContain("Explain this opportunity");
    expect(prompts).toContain("Teach me this strategy");
  });

  it("includes symbol-specific prompts when only a symbol is in focus", () => {
    const prompts = getSuggestedPrompts({ symbol: "AAPL" });
    expect(prompts).toContain("Explain AAPL's current market structure");
  });

  it("includes position-specific prompts when a trading position is in focus", () => {
    const prompts = getSuggestedPrompts({ tradingPositionId: 3 });
    expect(prompts).toContain("Review this trade setup");
    expect(prompts).toContain("Help me prepare a trade checklist");
  });

  it("always includes general prompts even with no focus at all", () => {
    const prompts = getSuggestedPrompts({});
    expect(prompts).toContain("Explain the Greeks");
    expect(prompts).toContain("Review my portfolio concentration");
  });

  it("never returns duplicate prompts and caps the list at 6", () => {
    const prompts = getSuggestedPrompts({ symbol: "AAPL", scannerCandidateId: 1, tradingPositionId: 3 });
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(prompts.length).toBeLessThanOrEqual(6);
  });
});

describe("getSuggestedActions", () => {
  it("always includes the Options Dashboard and Options Income Portfolio deep links", () => {
    const actions = getSuggestedActions({});
    expect(actions.some((a) => a.href === "/options-dashboard")).toBe(true);
    expect(actions.some((a) => a.href === "/portfolio-ai")).toBe(true);
  });

  it("adds a Trade Execution Center deep link only when a scanner candidate is in focus", () => {
    expect(getSuggestedActions({}).some((a) => a.href.startsWith("/ticket/"))).toBe(false);
    const actions = getSuggestedActions({ scannerCandidateId: 9 });
    expect(actions.some((a) => a.href === "/ticket/9")).toBe(true);
  });

  it("adds a Trading Research deep link only when a trading position is in focus", () => {
    expect(getSuggestedActions({}).some((a) => a.label.includes("Portfolio Risk"))).toBe(false);
    const actions = getSuggestedActions({ tradingPositionId: 4 });
    expect(actions.some((a) => a.href === "/trading-research")).toBe(true);
  });

  it("never fabricates an action for a focus field that isn't set", () => {
    // No scannerCandidateId, no tradingPositionId — only the two always-on
    // actions should be present, never a stale reference to id 0/undefined.
    const actions = getSuggestedActions({ symbol: "AAPL" });
    expect(actions).toHaveLength(2);
  });
});

// Phase 31 — Institutional Strategy Workbench. Pure unit tests over the
// deterministic strategy-metadata comparison utility — proves it never
// compares performance, never ranks, and never reorders its input.

import { describe, it, expect } from "vitest";
import { compareStrategies } from "./strategy-comparison";
import type { TradingStrategy } from "@workspace/api-client-react";

function fixture(overrides: Partial<TradingStrategy> = {}): TradingStrategy {
  return {
    id: 1,
    name: "Strategy A",
    description: "A description.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "a", label: "Reviewed structure", required: true },
      { id: "b", label: "Optional note", required: false },
    ],
    educationalNotes: "Some notes.",
    references: ["Book 1"],
    version: "1.0.0",
    validation: { valid: true, issues: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("compareStrategies", () => {
  it("compares metadata fields only, in the same order the strategies were given — never reordered", () => {
    const a = fixture({ id: 1, name: "Strategy A" });
    const b = fixture({ id: 2, name: "Strategy B", category: "breakout" });
    const rows = compareStrategies([a, b]);
    expect(rows.map((r) => r.strategyId)).toEqual([1, 2]);
    expect(rows[0].category).toBe("trend");
    expect(rows[1].category).toBe("breakout");
  });

  it("derives checklistSize and requiredChecklistItemCount directly from the strategy's own checklist array", () => {
    const [row] = compareStrategies([fixture()]);
    expect(row.checklistSize).toBe(2);
    expect(row.requiredChecklistItemCount).toBe(1);
  });

  it("derives requiredEvidenceCount and passes through the evidence list itself", () => {
    const [row] = compareStrategies([fixture()]);
    expect(row.requiredEvidenceCount).toBe(2);
    expect(row.requiredEvidence).toEqual(["structure", "liquidity"]);
  });

  it("passes through the strategy's own validation.valid, never re-deriving it", () => {
    const invalid = fixture({ id: 3, validation: { valid: false, issues: [{ field: "name", message: "Name is required." }] } });
    const [row] = compareStrategies([invalid]);
    expect(row.validationValid).toBe(false);
  });

  it("Learning Coverage: honestly false when the strategy's own key is absent from viewedStrategyKeys", () => {
    const [row] = compareStrategies([fixture({ id: 5 })], []);
    expect(row.learningCoverageViewed).toBe(false);
  });

  it("Learning Coverage: honestly true only when the exact strategy-framework:<id> key is present", () => {
    const rows = compareStrategies(
      [fixture({ id: 5 }), fixture({ id: 6 })],
      ["strategy-framework:5"],
    );
    expect(rows[0].learningCoverageViewed).toBe(true);
    expect(rows[1].learningCoverageViewed).toBe(false);
  });

  it("never computes or exposes a performance/ranking field — the row shape is metadata only", () => {
    const [row] = compareStrategies([fixture()]);
    const keys = Object.keys(row);
    for (const forbidden of ["winRate", "rank", "score", "performance", "pnl", "expectancy"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("returns an empty array for an empty strategy list, never fabricating a row", () => {
    expect(compareStrategies([])).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  deriveStructureDisplayState,
  deriveTrendAlignmentState,
  structureDisplayStateBadgeClass,
} from "./structure-display-state";

describe("deriveStructureDisplayState", () => {
  it("maps uptrend + non-Low confidence to Bullish", () => {
    expect(deriveStructureDisplayState("uptrend", "High")).toBe("Bullish");
    expect(deriveStructureDisplayState("uptrend", "Moderate")).toBe("Bullish");
  });

  it("maps downtrend + non-Low confidence to Bearish", () => {
    expect(deriveStructureDisplayState("downtrend", "High")).toBe("Bearish");
  });

  it("maps range + non-Low confidence to Range", () => {
    expect(deriveStructureDisplayState("range", "Moderate")).toBe("Range");
  });

  it("maps any trend at Low confidence to Unclear / Insufficient Data, never fabricating a directional read on a thin sample", () => {
    expect(deriveStructureDisplayState("uptrend", "Low")).toBe("Unclear / Insufficient Data");
    expect(deriveStructureDisplayState("downtrend", "Low")).toBe("Unclear / Insufficient Data");
    expect(deriveStructureDisplayState("range", "Low")).toBe("Unclear / Insufficient Data");
  });
});

describe("deriveTrendAlignmentState", () => {
  it("maps a split agreement to Transition, reusing the engine's own honest conflict signal", () => {
    expect(deriveTrendAlignmentState("split", null, "Low")).toBe("Transition");
  });

  it("maps insufficient-data agreement to Unclear / Insufficient Data, distinct from a genuine conflict", () => {
    expect(deriveTrendAlignmentState("insufficient-data", null, "Low")).toBe("Unclear / Insufficient Data");
  });

  it("maps unanimous/majority agreement with a real dominant trend through to the single-timeframe mapping", () => {
    expect(deriveTrendAlignmentState("unanimous", "uptrend", "High")).toBe("Bullish");
    expect(deriveTrendAlignmentState("majority", "downtrend", "Moderate")).toBe("Bearish");
    expect(deriveTrendAlignmentState("unanimous", "range", "High")).toBe("Range");
  });

  it("never fabricates a dominant trend when none exists, even for a non-split agreement", () => {
    expect(deriveTrendAlignmentState("majority", null, "Moderate")).toBe("Unclear / Insufficient Data");
  });
});

describe("structureDisplayStateBadgeClass", () => {
  it("returns a distinct class for each of the 5 states", () => {
    const states = ["Bullish", "Bearish", "Range", "Transition", "Unclear / Insufficient Data"] as const;
    const classes = states.map((s) => structureDisplayStateBadgeClass(s));
    expect(new Set(classes).size).toBe(5);
  });
});

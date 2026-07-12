// Phase 2, Sprint 14 — Consolidated Margin of Safety unit tests (approved
// Phase 2 plan, Sprint 14). Uses constructed fixtures (not live analyzer
// calls) to exercise the aggregation logic directly across unanimous /
// majority / split / insufficient-data scenarios.

import { describe, it, expect } from "vitest";
import { consolidateMarginOfSafety, type ModelEntry } from "./marginOfSafety.js";

function available(fairValue: number, marginOfSafety: number, rating: ModelEntry["result"]["rating"]): ModelEntry["result"] {
  return { available: true, fairValue, marginOfSafety, rating };
}
function unavailable(): ModelEntry["result"] {
  return { available: false };
}

describe("consolidateMarginOfSafety", () => {
  it("computes min/max/average fair value across available models only", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.1, "Fair") },
      { model: "Graham", result: available(120, 0.2, "Cheap") },
      { model: "DCF", result: available(80, -0.1, "Expensive") },
    ];
    const c = consolidateMarginOfSafety(90, entries);
    expect(c.modelsConsidered).toBe(3);
    expect(c.modelsAvailable).toBe(3);
    expect(c.minFairValue).toBe(80);
    expect(c.maxFairValue).toBe(120);
    expect(c.averageFairValue).toBe(100);
    expect(c.averageMarginOfSafety).toBeCloseTo((0.1 + 0.2 - 0.1) / 3, 4);
  });

  it("excludes unavailable models from the range/average without fabricating a value for them", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.1, "Fair") },
      { model: "Graham", result: unavailable() },
      { model: "DCF", result: available(110, 0.18, "Cheap") },
    ];
    const c = consolidateMarginOfSafety(90, entries);
    expect(c.modelsConsidered).toBe(3);
    expect(c.modelsAvailable).toBe(2);
    expect(c.fairValues.map((f) => f.model)).toEqual(["Blended", "DCF"]);
  });

  it("reports 'unanimous' agreement when every available model's rating buckets the same way", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.2, "Cheap") },
      { model: "Graham", result: available(110, 0.25, "Cheap") },
      { model: "DCF", result: available(105, 0.22, "Cheap") },
    ];
    const c = consolidateMarginOfSafety(80, entries);
    expect(c.agreement).toBe("unanimous");
  });

  it("reports 'majority' agreement when more than half agree but not all", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.2, "Cheap") },
      { model: "Graham", result: available(110, 0.25, "Cheap") },
      { model: "DCF", result: available(80, -0.1, "Expensive") },
    ];
    const c = consolidateMarginOfSafety(80, entries);
    expect(c.agreement).toBe("majority");
  });

  it("reports 'split' agreement when there is no clear majority", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.2, "Cheap") },
      { model: "Graham", result: available(80, -0.1, "Expensive") },
    ];
    const c = consolidateMarginOfSafety(90, entries);
    expect(c.agreement).toBe("split");
  });

  it("reports 'insufficient-data' when fewer than 2 models are available", () => {
    const oneModel: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.1, "Fair") },
      { model: "Graham", result: unavailable() },
    ];
    const c = consolidateMarginOfSafety(90, oneModel);
    expect(c.agreement).toBe("insufficient-data");

    const zeroModels: ModelEntry[] = [
      { model: "Blended", result: unavailable() },
      { model: "Graham", result: unavailable() },
    ];
    const c2 = consolidateMarginOfSafety(90, zeroModels);
    expect(c2.modelsAvailable).toBe(0);
    expect(c2.minFairValue).toBeNull();
    expect(c2.maxFairValue).toBeNull();
    expect(c2.averageFairValue).toBeNull();
    expect(c2.agreement).toBe("insufficient-data");
    expect(c2.summary).toMatch(/no valuation model/i);
  });

  it("never fabricates a fair value for an entry that lacks one", () => {
    const entries: ModelEntry[] = [
      { model: "Blended", result: available(100, 0.1, "Fair") },
      { model: "Graham", result: unavailable() },
    ];
    const c = consolidateMarginOfSafety(90, entries);
    expect(c.fairValues).toHaveLength(1);
    expect(c.fairValues[0].model).toBe("Blended");
  });
});

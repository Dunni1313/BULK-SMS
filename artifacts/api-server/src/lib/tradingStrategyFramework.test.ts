// Phase 30 — Institutional Strategy Framework. Pure unit tests over the
// framework's own structural logic — categories/evidence vocabulary,
// checklist instantiation/completion math, and metadata validation. No
// database, no HTTP — see routes/tradingStrategies.route.test.ts and
// routes/tradingStrategyChecklists.route.test.ts for the live persistence
// layer.

import { describe, it, expect } from "vitest";
import {
  STRATEGY_CATEGORIES,
  STRATEGY_CATEGORY_LABELS,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_LABELS,
  buildEvidenceLink,
  instantiateChecklistItems,
  computeChecklistCompletion,
  deriveChecklistStatus,
  validateStrategyMetadata,
  isStrategyMetadataValid,
  toStrategyLearningSummary,
  type StrategyMetadataInput,
  type StrategyMetadata,
  type StrategyChecklistItemState,
} from "./tradingStrategyFramework.js";

function validInput(overrides: Partial<StrategyMetadataInput> = {}): StrategyMetadataInput {
  return {
    name: "My Setup",
    description: "A personally defined trade setup.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "a", label: "Structure reviewed", required: true },
      { id: "b", label: "Optional note", required: false },
    ],
    educationalNotes: "Some notes.",
    references: ["A book"],
    version: "1.0.0",
    ...overrides,
  };
}

describe("Strategy Categories", () => {
  it("has 8 generic, non-methodology-named categories", () => {
    expect(STRATEGY_CATEGORIES).toHaveLength(8);
    for (const cat of STRATEGY_CATEGORIES) {
      expect(STRATEGY_CATEGORY_LABELS[cat]).toBeTruthy();
    }
    // Never a named methodology.
    const joined = STRATEGY_CATEGORIES.join(" ").toLowerCase();
    expect(joined).not.toContain("ict");
    expect(joined).not.toContain("smc");
  });
});

describe("Evidence Framework", () => {
  it("covers all 7 requested deterministic output sources", () => {
    expect(EVIDENCE_SOURCE_TYPES).toEqual(["structure", "liquidity", "session", "risk", "trade-plan", "journal", "coach"]);
    for (const t of EVIDENCE_SOURCE_TYPES) {
      expect(EVIDENCE_SOURCE_LABELS[t]).toBeTruthy();
    }
  });

  it("buildEvidenceLink packages a citation without calculating anything", () => {
    const link = buildEvidenceLink("structure", "Trend: uptrend", "AAPL");
    expect(link.sourceType).toBe("structure");
    expect(link.label).toBe("Market Structure Workbench");
    expect(link.detail).toBe("Trend: uptrend");
    expect(link.url).toBe("/market-structure-workbench?symbol=AAPL");
  });

  it("buildEvidenceLink omits the symbol query param when no symbol is given", () => {
    const link = buildEvidenceLink("journal", "3 entries reviewed");
    expect(link.url).toBe("/trading-journal");
  });
});

describe("Checklist Engine", () => {
  const template = [
    { id: "a", label: "Required item", required: true },
    { id: "b", label: "Another required item", required: true },
    { id: "c", label: "Optional item", required: false },
  ];

  it("instantiateChecklistItems starts every item incomplete with no notes/evidence", () => {
    const items = instantiateChecklistItems(template);
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.completed).toBe(false);
      expect(item.notes).toBe("");
      expect(item.evidenceLinks).toEqual([]);
    }
  });

  it("computeChecklistCompletion honestly reports 0% for a fresh checklist, never NaN", () => {
    const items = instantiateChecklistItems(template);
    const summary = computeChecklistCompletion(items);
    expect(summary.requiredTotal).toBe(2);
    expect(summary.requiredCompleted).toBe(0);
    expect(summary.optionalTotal).toBe(1);
    expect(summary.allRequiredComplete).toBe(false);
    expect(summary.percentComplete).toBe(0);
  });

  it("computeChecklistCompletion reflects partial completion", () => {
    const items = instantiateChecklistItems(template);
    items[0].completed = true;
    const summary = computeChecklistCompletion(items);
    expect(summary.requiredCompleted).toBe(1);
    expect(summary.allRequiredComplete).toBe(false);
    expect(summary.percentComplete).toBe(Math.round((1 / 3) * 100));
  });

  it("allRequiredComplete is true only once every required item is done, regardless of optional items", () => {
    const items = instantiateChecklistItems(template);
    items[0].completed = true;
    items[1].completed = true;
    // Optional item 'c' still incomplete.
    const summary = computeChecklistCompletion(items);
    expect(summary.allRequiredComplete).toBe(true);
    expect(summary.percentComplete).toBe(Math.round((2 / 3) * 100));
  });

  it("deriveChecklistStatus is 'complete' only when all required items are done", () => {
    const items = instantiateChecklistItems(template);
    expect(deriveChecklistStatus(items)).toBe("in_progress");
    items[0].completed = true;
    items[1].completed = true;
    expect(deriveChecklistStatus(items)).toBe("complete");
  });

  it("deriveChecklistStatus never fabricates 'complete' for an empty checklist", () => {
    expect(deriveChecklistStatus([])).toBe("in_progress");
  });

  it("a checklist with zero required items (all optional) is honestly always allRequiredComplete=true", () => {
    const optionalOnly: StrategyChecklistItemState[] = instantiateChecklistItems([
      { id: "x", label: "Optional only", required: false },
    ]);
    const summary = computeChecklistCompletion(optionalOnly);
    expect(summary.requiredTotal).toBe(0);
    expect(summary.allRequiredComplete).toBe(true);
    expect(deriveChecklistStatus(optionalOnly)).toBe("complete");
  });
});

describe("Strategy Validation Framework", () => {
  it("accepts a genuinely well-formed strategy", () => {
    const issues = validateStrategyMetadata(validInput());
    expect(issues).toEqual([]);
    expect(isStrategyMetadataValid(validInput())).toBe(true);
  });

  it("flags a missing name and description", () => {
    const issues = validateStrategyMetadata(validInput({ name: "", description: "  " }));
    expect(issues.some((i) => i.field === "name")).toBe(true);
    expect(issues.some((i) => i.field === "description")).toBe(true);
  });

  it("flags an invalid category", () => {
    const issues = validateStrategyMetadata(validInput({ category: "ict" as never }));
    expect(issues.some((i) => i.field === "category")).toBe(true);
  });

  it("flags empty timeframes and an invalid timeframe value", () => {
    expect(validateStrategyMetadata(validInput({ timeframes: [] })).some((i) => i.field === "timeframes")).toBe(true);
    expect(
      validateStrategyMetadata(validInput({ timeframes: ["3m" as never] })).some((i) => i.field === "timeframes"),
    ).toBe(true);
  });

  it("flags empty markets", () => {
    expect(validateStrategyMetadata(validInput({ markets: [] })).some((i) => i.field === "markets")).toBe(true);
  });

  it("flags empty or invalid required evidence", () => {
    expect(
      validateStrategyMetadata(validInput({ requiredEvidence: [] })).some((i) => i.field === "requiredEvidence"),
    ).toBe(true);
    expect(
      validateStrategyMetadata(validInput({ requiredEvidence: ["not-a-real-source" as never] })).some(
        (i) => i.field === "requiredEvidence",
      ),
    ).toBe(true);
  });

  it("flags an empty checklist, a blank label, and duplicate ids", () => {
    expect(validateStrategyMetadata(validInput({ checklist: [] })).some((i) => i.field === "checklist")).toBe(true);
    expect(
      validateStrategyMetadata(validInput({ checklist: [{ id: "a", label: "", required: true }] })).some(
        (i) => i.field === "checklist",
      ),
    ).toBe(true);
    expect(
      validateStrategyMetadata(
        validInput({
          checklist: [
            { id: "a", label: "One", required: true },
            { id: "a", label: "Two", required: false },
          ],
        }),
      ).some((i) => i.field === "checklist"),
    ).toBe(true);
  });

  it("flags a malformed version string", () => {
    expect(validateStrategyMetadata(validInput({ version: "v1" })).some((i) => i.field === "version")).toBe(true);
    expect(validateStrategyMetadata(validInput({ version: "" })).some((i) => i.field === "version")).toBe(true);
    expect(validateStrategyMetadata(validInput({ version: "2.1" })).some((i) => i.field === "version")).toBe(false);
  });

  it("never flags a real methodology name as invalid input on its own — validation is structural, not a judgment on content", () => {
    // Users may freely name their own strategy after a real methodology
    // they personally use; this framework never blocks or evaluates that
    // choice, only the metadata's own structural completeness.
    const issues = validateStrategyMetadata(validInput({ name: "My ICT-Inspired Setup" }));
    expect(issues).toEqual([]);
  });
});

describe("Strategy Learning Framework projection", () => {
  it("toStrategyLearningSummary is a thin, honest projection of a strategy's own educational fields", () => {
    const meta: StrategyMetadata = {
      ...validInput(),
      id: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const summary = toStrategyLearningSummary(meta);
    expect(summary).toEqual({
      id: 7,
      name: "My Setup",
      category: "trend",
      version: "1.0.0",
      educationalNotes: "Some notes.",
      references: ["A book"],
      requiredEvidence: ["structure", "liquidity"],
      checklistItemCount: 2,
    });
  });
});

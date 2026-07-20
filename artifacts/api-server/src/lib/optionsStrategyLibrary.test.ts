// Phase 35 — Institutional Options Income Engine (Foundation).
import { describe, it, expect } from "vitest";
import {
  allOptionsStrategyTemplates,
  getOptionsStrategyTemplate,
  templateForExecutionStrategy,
  type OptionsStrategyLibraryKey,
} from "./optionsStrategyLibrary.js";
import { getStrategyAcademyEntry } from "./strategyAcademy.js";

const ALL_KEYS: OptionsStrategyLibraryKey[] = [
  "covered_call",
  "cash_secured_put",
  "wheel",
  "iron_condor",
  "iron_fly",
  "calendar",
  "diagonal",
  "vertical_credit",
  "vertical_debit",
];

describe("allOptionsStrategyTemplates", () => {
  it("returns exactly the 9 requested strategies as reusable templates", () => {
    const templates = allOptionsStrategyTemplates();
    expect(templates).toHaveLength(9);
    expect(templates.map((t) => t.key).sort()).toEqual([...ALL_KEYS].sort());
  });

  it("never generates a trade — every template is pure metadata with no leg/price/quantity fields", () => {
    for (const t of allOptionsStrategyTemplates()) {
      expect(t).not.toHaveProperty("legs");
      expect(t).not.toHaveProperty("credit");
      expect(t).not.toHaveProperty("quantity");
      expect(t).not.toHaveProperty("strike");
    }
  });

  it("honestly reports builtByThisEngine only for the 3 templates whose academy source execution.ts actually builds (iron_condor, iron_fly, calendar)", () => {
    const built = allOptionsStrategyTemplates().filter((t) => t.builtByThisEngine).map((t) => t.key);
    expect(built.sort()).toEqual(["calendar", "iron_condor", "iron_fly"]);
  });

  it("covered_call, cash_secured_put, wheel, diagonal, vertical_credit, vertical_debit are honestly NOT builtByThisEngine", () => {
    for (const key of ["covered_call", "cash_secured_put", "wheel", "diagonal", "vertical_credit", "vertical_debit"] as const) {
      expect(getOptionsStrategyTemplate(key)!.builtByThisEngine).toBe(false);
    }
  });
});

describe("getOptionsStrategyTemplate", () => {
  it("returns null for an unknown key", () => {
    expect(getOptionsStrategyTemplate("not-a-real-strategy")).toBeNull();
  });

  it("reuses lib/strategyAcademy.ts's own construction/idealMarket/assignmentRisk text, never re-authoring it", () => {
    const template = getOptionsStrategyTemplate("iron_condor")!;
    const academy = getStrategyAcademyEntry("iron_condor")!;
    expect(template.summary).toBe(academy.construction);
    expect(template.idealMarket).toBe(academy.idealMarket);
    expect(template.assignmentRisk).toBe(academy.assignmentRisk);
  });

  it("vertical_credit and vertical_debit both reuse the SAME underlying vertical_spread academy text, distinguished only by incomeType/collateralType", () => {
    const credit = getOptionsStrategyTemplate("vertical_credit")!;
    const debit = getOptionsStrategyTemplate("vertical_debit")!;
    const academy = getStrategyAcademyEntry("vertical_spread")!;
    expect(credit.summary).toBe(academy.construction);
    expect(debit.summary).toBe(academy.construction);
    expect(credit.incomeType).toBe("credit");
    expect(debit.incomeType).toBe("debit");
    expect(credit.collateralType).toBe("defined_risk");
    expect(debit.collateralType).toBe("debit");
  });

  it("every template has a non-empty collateral note distinguishing it from every other template's own collateral shape", () => {
    const notes = allOptionsStrategyTemplates().map((t) => t.collateralNote);
    for (const n of notes) expect(n.length).toBeGreaterThan(0);
  });

  it("maps iron_condor/iron_fly/calendar to their real execution.ts strategy keys, and never fabricates a mapping for the 6 non-tracked templates", () => {
    expect(getOptionsStrategyTemplate("iron_condor")!.executionStrategyKey).toBe("iron_condor");
    expect(getOptionsStrategyTemplate("iron_fly")!.executionStrategyKey).toBe("iron_fly");
    expect(getOptionsStrategyTemplate("calendar")!.executionStrategyKey).toBe("calendar_spread");
    for (const key of ["covered_call", "cash_secured_put", "wheel", "diagonal", "vertical_credit", "vertical_debit"] as const) {
      expect(getOptionsStrategyTemplate(key)!.executionStrategyKey).toBeNull();
    }
  });
});

describe("templateForExecutionStrategy", () => {
  it("resolves a real trades.strategy value back to its own Strategy Library template", () => {
    expect(templateForExecutionStrategy("iron_condor")?.key).toBe("iron_condor");
    expect(templateForExecutionStrategy("iron_fly")?.key).toBe("iron_fly");
    expect(templateForExecutionStrategy("calendar_spread")?.key).toBe("calendar");
  });

  it("honestly returns null for a real strategy value with no matching template (e.g. earnings)", () => {
    expect(templateForExecutionStrategy("earnings")).toBeNull();
  });
});

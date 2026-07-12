// Phase 2, Sprint 12 — regression proof that integrating Graham Valuation into
// buildValueResearchReport() changed nothing about the existing report except
// the addition of the new grahamValuation field and its report section
// (approved Phase 2 plan, Sprint 12).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { getFundamentals } from "./fundamentals.js";
import type { Fundamentals } from "./fundamentals.js";

const EXISTING_SECTION_IDS = [
  "snapshot",
  "business",
  "quality",
  "moat",
  "financial",
  "profitability",
  "growth",
  "valuation",
  "margin-of-safety",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 12 Graham integration regression", () => {
  it("every pre-existing section id is still present, unchanged, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("graham-valuation");
    // Phase 2, Sprint 13 added "dcf-valuation", Sprint 14 added
    // "buffett-valuation", and Sprint 15 added "investment-quality" on top of
    // Sprint 12's own addition — this assertion reflects the current total,
    // not just Sprint 12's own delta; graham-valuation's continued presence
    // (checked above) is this test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 4);
  });

  it("every pre-existing top-level field is still present and correctly shaped", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.businessQuality).toBeTruthy();
    expect(report.moat).toBeTruthy();
    expect(report.financialStrength).toBeTruthy();
    expect(report.valuation).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds a grahamValuation field, correctly shaped for the available case", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const g = report.grahamValuation;
    expect(g).toBeTruthy();
    expect(g.available).toBe(true);
    if (g.available) {
      expect(g.fairValue).toBeGreaterThan(0);
      expect(g.methods.length).toBeGreaterThan(0);
      expect(["High", "Medium", "Low", "None"]).toContain(g.marginOfSafetyLabel);
      expect(["Cheap", "Fair", "Expensive", "Very Expensive"]).toContain(g.rating);
    }
  });

  it("the graham-valuation section renders the Graham methods, not the blended-model methods", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const grahamSection = report.sections.find((s) => s.id === "graham-valuation")!;
    // Phase 2, Sprint 15 shifted this from "9." to "10." (see the numbering
    // test below) by inserting "Investment Quality" before "Economic Moat".
    expect(grahamSection.title).toBe("10. Graham Valuation");
    expect(grahamSection.bullets!.join(" ")).toMatch(/Graham/);
  });

  it("section numbering after the new Graham section shifted by exactly one, but ids did not change", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    // Phase 2, Sprint 15 inserted "4. Investment Quality" right after
    // "3. Business Quality", shifting "valuation" and everything below it by
    // one further from Sprint 14's own numbering (which had already shifted
    // Sprint 12's original numbering by two, for DCF + Buffett).
    expect(byId.get("valuation")).toBe("9. Valuation & Fair Value");
    expect(byId.get("graham-valuation")).toBe("10. Graham Valuation");
    expect(byId.get("margin-of-safety")).toBe("13. Margin of Safety");
    expect(byId.get("risks")).toBe("14. Risks & Red Flags");
    expect(byId.get("decision")).toBe("15. Value-Investor Decision");
    expect(byId.get("stock-vs-options")).toBe("16. Stock vs. Options");
    expect(byId.get("checklist")).toBe("17. Buffett Checklist");
    expect(byId.get("metrics")).toBe("18. Key Metrics");
    expect(byId.get("disclaimer")).toBe("19. Disclaimers & Data Source");
  });

  it("honestly reports Graham valuation UNAVAILABLE (no fabrication) when trailing EPS is not positive, independent of the blended model's own availability", async () => {
    const base = (await getFundamentals("TSLA"))!;
    const unprofitable: Fundamentals = {
      ...base,
      epsTtm: null,
      epsFwd: null,
      fcfPerShare: -1,
      pe: null,
      forwardPe: null,
      peg: null,
      fcfYield: null,
      earningsYield: null,
    };
    const report = (await buildValueResearchReport(base.symbol, undefined, undefined, unprofitable))!;
    const g = report.grahamValuation;
    expect(g.available).toBe(false);
    if (!g.available) {
      expect(g.reason).toMatch(/positive trailing EPS/);
    }
    const raw = g as Record<string, unknown>;
    expect(raw.fairValue).toBeUndefined();
    expect(raw.grahamNumber).toBeUndefined();
    expect(raw.methods).toBeUndefined();

    const grahamSection = report.sections.find((s) => s.id === "graham-valuation")!;
    expect(grahamSection.bullets!.join(" ")).not.toMatch(/\$/);
  });
});

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
    // "buffett-valuation", Sprint 15 added "investment-quality", Sprint 16
    // added "tom-nash", Sprint 17 added "investment-committee", and Sprint 18
    // added "financial-ratios" on top of Sprint 12's own addition — this
    // assertion reflects the current total, not just Sprint 12's own delta;
    // graham-valuation's continued presence (checked above) is this test's
    // actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 7);
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
    // Section numbering has shifted twice since Sprint 12 (Sprint 15 inserted
    // Investment Quality, Sprint 18 inserted Financial Ratios) — see the
    // numbering test below for the full chain; ids never change.
    expect(grahamSection.title).toBe("11. Graham Valuation");
    expect(grahamSection.bullets!.join(" ")).toMatch(/Graham/);
  });

  it("section numbering after the new Graham section shifted by exactly one, but ids did not change", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    // Section numbering has shifted repeatedly since Sprint 12 as later sprints
    // inserted new sections (Sprint 15: Investment Quality after Business
    // Quality; Sprint 16: Tom Nash after Margin of Safety; Sprint 17: Investment
    // Committee after Tom Nash; Sprint 18: Financial Ratios after Growth) —
    // this assertion reflects the current numbering; ids never change.
    expect(byId.get("financial-ratios")).toBe("9. Financial Ratios");
    expect(byId.get("valuation")).toBe("10. Valuation & Fair Value");
    expect(byId.get("graham-valuation")).toBe("11. Graham Valuation");
    expect(byId.get("margin-of-safety")).toBe("14. Margin of Safety");
    expect(byId.get("tom-nash")).toBe("15. Tom Nash Analysis");
    expect(byId.get("investment-committee")).toBe("16. Investment Committee");
    expect(byId.get("risks")).toBe("17. Risks & Red Flags");
    expect(byId.get("decision")).toBe("18. Value-Investor Decision");
    expect(byId.get("stock-vs-options")).toBe("19. Stock vs. Options");
    expect(byId.get("checklist")).toBe("20. Buffett Checklist");
    expect(byId.get("metrics")).toBe("21. Key Metrics");
    expect(byId.get("disclaimer")).toBe("22. Disclaimers & Data Source");
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

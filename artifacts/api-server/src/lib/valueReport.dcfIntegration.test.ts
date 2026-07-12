// Phase 2, Sprint 13 — regression proof that integrating DCF Valuation into
// buildValueResearchReport() changed nothing about the existing report
// (including Sprint 12's Graham section and the blended model) except the
// addition of the new dcfValuation field and its report section (approved
// Phase 2 plan, Sprint 13).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeValuation } from "./valueInvesting.js";
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
  "graham-valuation",
  "margin-of-safety",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 13 DCF integration regression", () => {
  it("every pre-existing section id (including Sprint 12's graham-valuation) is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("dcf-valuation");
    // Phase 2, Sprint 14 added a further section ("buffett-valuation") on top
    // of Sprint 13's own addition — this assertion reflects the current
    // total; dcf-valuation's continued presence (checked above) is this
    // test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 2);
  });

  it("Graham's own output for a fixed symbol is unchanged by DCF's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const grahamStandalone = analyzeGrahamValuation(f);

    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.grahamValuation).toEqual(grahamStandalone);
  });

  it("the blended model's own output for a fixed symbol is unchanged by DCF's addition", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const blendedStandalone = analyzeValuation(f);

    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.valuation).toEqual(blendedStandalone);
  });

  it("every pre-existing top-level field is still present and correctly shaped", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.businessQuality).toBeTruthy();
    expect(report.moat).toBeTruthy();
    expect(report.financialStrength).toBeTruthy();
    expect(report.valuation).toBeTruthy();
    expect(report.grahamValuation).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds a dcfValuation field, correctly shaped for the available case", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const d = report.dcfValuation;
    expect(d).toBeTruthy();
    expect(d.available).toBe(true);
    if (d.available) {
      expect(d.fairValue).toBeGreaterThan(0);
      expect(d.discountRate).toBe(0.09);
      expect(d.terminalGrowthRate).toBe(0.025);
      expect(d.projectionYears).toBe(5);
      expect(d.projectedFreeCashFlows).toHaveLength(5);
      expect(d.methods.length).toBe(2);
      expect(["High", "Medium", "Low", "None"]).toContain(d.marginOfSafetyLabel);
      expect(["Cheap", "Fair", "Expensive", "Very Expensive"]).toContain(d.rating);
      expect(["High", "Moderate", "Low"]).toContain(d.confidenceLabel);
      expect(d.confidenceExplanation.length).toBeGreaterThan(0);
    }
  });

  it("the dcf-valuation section renders the DCF methods and confidence explanation", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const dcfSection = report.sections.find((s) => s.id === "dcf-valuation")!;
    expect(dcfSection.title).toBe("10. DCF Valuation");
    expect(dcfSection.bullets!.join(" ")).toMatch(/Projected Cash Flows|Terminal Value/);
  });

  it("section numbering after the new DCF section shifted by exactly one from Sprint 12's shape, ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("graham-valuation")).toBe("9. Graham Valuation");
    expect(byId.get("dcf-valuation")).toBe("10. DCF Valuation");
    // Phase 2, Sprint 14 inserted "11. Buffett Valuation" next, shifting
    // everything below by one more from Sprint 13's own numbering.
    expect(byId.get("margin-of-safety")).toBe("12. Margin of Safety");
    expect(byId.get("risks")).toBe("13. Risks & Red Flags");
    expect(byId.get("decision")).toBe("14. Value-Investor Decision");
    expect(byId.get("stock-vs-options")).toBe("15. Stock vs. Options");
    expect(byId.get("checklist")).toBe("16. Buffett Checklist");
    expect(byId.get("metrics")).toBe("17. Key Metrics");
    expect(byId.get("disclaimer")).toBe("18. Disclaimers & Data Source");
  });

  it("honestly reports DCF valuation UNAVAILABLE (no fabrication) when FCF is not positive, independent of Graham/the blended model's own availability", async () => {
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
    const d = report.dcfValuation;
    expect(d.available).toBe(false);
    if (!d.available) {
      expect(d.reason).toMatch(/positive free cash flow/i);
    }
    const raw = d as Record<string, unknown>;
    expect(raw.fairValue).toBeUndefined();
    expect(raw.projectedFreeCashFlows).toBeUndefined();
    expect(raw.methods).toBeUndefined();

    const dcfSection = report.sections.find((s) => s.id === "dcf-valuation")!;
    expect(dcfSection.bullets!.join(" ")).not.toMatch(/\$/);

    // Graham is ALSO unavailable for this same unprofitable fixture (trailing
    // EPS is null too) — but for its OWN independent reason, not because DCF
    // said so. Proves the two analysts don't share state.
    expect(report.grahamValuation.available).toBe(false);
  });
});

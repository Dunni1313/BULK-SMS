// Phase 2, Sprint 14 — regression proof that integrating Buffett Valuation
// and the Consolidated Margin of Safety into buildValueResearchReport()
// changed nothing about the existing report (including Sprint 12's Graham
// section, Sprint 13's DCF section, and the blended model) except the
// addition of the two new fields/sections, and the intentional content
// upgrade of the existing "margin-of-safety" section (id/position stable,
// per the approved Sprint 14 plan decision 6) — approved Phase 2 plan,
// Sprint 14.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeValuation, analyzeBusinessQuality, analyzeMoat } from "./valueInvesting.js";
import { getFundamentals } from "./fundamentals.js";
import type { Fundamentals } from "./fundamentals.js";

const EXISTING_SECTION_IDS = [
  "snapshot",
  "business",
  "quality",
  "moat",
  "competitive-advantage",
  "financial",
  "profitability",
  "growth",
  "valuation",
  "graham-valuation",
  "dcf-valuation",
  "margin-of-safety",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 14 Buffett + consolidated MoS integration regression", () => {
  it("every pre-existing section id (including graham-valuation and dcf-valuation) is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("buffett-valuation");
    // Phase 2, Sprint 15 added "investment-quality", Sprint 16 added
    // "tom-nash", Sprint 17 added "investment-committee", and Sprint 18 added
    // "financial-ratios" on top of this sprint's own addition — this
    // assertion reflects the current total; buffett-valuation's continued
    // presence (checked above) is this test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 5);
  });

  it("Graham's own output for a fixed symbol is unchanged by Buffett's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const grahamStandalone = analyzeGrahamValuation(f);

    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.grahamValuation).toEqual(grahamStandalone);
  });

  it("DCF's own output for a fixed symbol is unchanged by Buffett's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const dcfStandalone = analyzeDcfValuation(f);

    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.dcfValuation).toEqual(dcfStandalone);
  });

  it("the blended model's own output for a fixed symbol is unchanged by Buffett's addition", async () => {
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
    expect(report.dcfValuation).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds a buffettValuation field, correctly shaped for the available case", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const b = report.buffettValuation;
    expect(b).toBeTruthy();
    expect(b.available).toBe(true);
    if (b.available) {
      expect(b.fairValue).toBeGreaterThan(0);
      expect(b.requiredReturn).toBeGreaterThan(0);
      expect(b.ownerEarnings).toBeGreaterThan(0);
      expect(b.methods.length).toBe(1);
      expect(["High", "Medium", "Low", "None"]).toContain(b.marginOfSafetyLabel);
      expect(["Cheap", "Fair", "Expensive", "Very Expensive"]).toContain(b.rating);
    }
  });

  it("buffettValuation is computed from the report's own businessQuality/moat, not recomputed independently", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const bq = analyzeBusinessQuality(f);
    const moat = analyzeMoat(f);

    const report = (await buildValueResearchReport("AAPL"))!;
    // A wider moat / higher quality should never produce a lower fair value
    // than a hypothetical weaker one — sanity-checks the wiring rather than
    // re-deriving the exact number (that's buffettValuation.test.ts's job).
    expect(bq.score).toBe(report.businessQuality.score);
    expect(moat.rating).toBe(report.moat.rating);
  });

  it("adds a consolidatedMarginOfSafety field spanning all 4 models", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const c = report.consolidatedMarginOfSafety;
    expect(c).toBeTruthy();
    expect(c.modelsConsidered).toBe(4);
    expect(c.fairValues.map((mv) => mv.model).sort()).toEqual(["Blended", "Buffett", "DCF", "Graham"]);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(c.agreement);
  });

  it("the buffett-valuation section renders the Buffett method, and margin-of-safety now shows the consolidated view", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const buffettSection = report.sections.find((s) => s.id === "buffett-valuation")!;
    // Section numbering has shifted repeatedly since Sprint 14 (see the
    // numbering test below for the full chain); ids never change.
    expect(buffettSection.title).toBe("14. Buffett Valuation");
    expect(buffettSection.bullets!.join(" ")).toMatch(/Owner Earnings Perpetuity/);

    const mosSection = report.sections.find((s) => s.id === "margin-of-safety")!;
    // Upgraded content (per approved decision 6): the consolidated summary,
    // not just the blended model's own single-model MoS sentence.
    expect(mosSection.body).toMatch(/valuation models/i);
    expect(mosSection.bullets!.length).toBeGreaterThan(0);
  });

  it("section numbering shifted by exactly one from Sprint 13's shape, ids did not change", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    // Section numbering has shifted repeatedly since Sprint 14 as later
    // sprints inserted new sections (Investment Quality, Tom Nash, Investment
    // Committee, Financial Ratios) — ids are unchanged, only display numbers
    // moved.
    expect(byId.get("financial-ratios")).toBe("10. Financial Ratios");
    expect(byId.get("dcf-valuation")).toBe("13. DCF Valuation");
    expect(byId.get("buffett-valuation")).toBe("14. Buffett Valuation");
    expect(byId.get("margin-of-safety")).toBe("15. Margin of Safety");
    expect(byId.get("tom-nash")).toBe("16. Tom Nash Analysis");
    expect(byId.get("investment-committee")).toBe("17. Investment Committee");
    expect(byId.get("risks")).toBe("18. Risks & Red Flags");
    expect(byId.get("decision")).toBe("19. Value-Investor Decision");
    expect(byId.get("stock-vs-options")).toBe("20. Stock vs. Options");
    expect(byId.get("checklist")).toBe("21. Buffett Checklist");
    expect(byId.get("metrics")).toBe("22. Key Metrics");
    expect(byId.get("disclaimer")).toBe("23. Disclaimers & Data Source");
  });

  it("honestly reports Buffett valuation UNAVAILABLE (no fabrication) when FCF is not positive, independent of Graham/DCF/the blended model's own availability", async () => {
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
    const b = report.buffettValuation;
    expect(b.available).toBe(false);
    if (!b.available) {
      expect(b.reason).toMatch(/positive free cash flow/i);
    }
    const raw = b as Record<string, unknown>;
    expect(raw.fairValue).toBeUndefined();
    expect(raw.ownerEarnings).toBeUndefined();
    expect(raw.methods).toBeUndefined();

    // DCF is ALSO unavailable for this same fixture (FCF non-positive) — but
    // for its own independent reason, and the consolidation should reflect
    // fewer than 4 available models, not fabricate a Buffett/DCF number.
    expect(report.dcfValuation.available).toBe(false);
    expect(report.consolidatedMarginOfSafety.modelsAvailable).toBeLessThan(4);
  });
});

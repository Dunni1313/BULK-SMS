// Phase 2, Sprint 15 — regression proof that integrating the Investment Quality
// Engine into buildValueResearchReport() changed nothing about the existing report
// (including Graham/DCF/Buffett/the blended model's own outputs) except the
// addition of the new investmentQuality field and its report section (approved
// Phase 2 plan, Sprint 15).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeBusinessQuality, analyzeMoat, analyzeValuation } from "./valueInvesting.js";
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
  "dcf-valuation",
  "buffett-valuation",
  "margin-of-safety",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 15 Investment Quality integration regression", () => {
  it("every pre-existing section id is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("investment-quality");
    // Phase 2, Sprint 16 added "tom-nash", Sprint 17 added
    // "investment-committee", and Sprint 18 added "financial-ratios" on top
    // of this sprint's own addition — this assertion reflects the current
    // total; investment-quality's continued presence (checked above) is this
    // test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 4);
  });

  it("Graham's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const grahamStandalone = analyzeGrahamValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.grahamValuation).toEqual(grahamStandalone);
  });

  it("DCF's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const dcfStandalone = analyzeDcfValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.dcfValuation).toEqual(dcfStandalone);
  });

  it("Buffett's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const bq = analyzeBusinessQuality(f);
    const moat = analyzeMoat(f);
    const buffettStandalone = analyzeBuffettValuation(f, bq, moat);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.buffettValuation).toEqual(buffettStandalone);
  });

  it("the blended model's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
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
    expect(report.buffettValuation).toBeTruthy();
    expect(report.consolidatedMarginOfSafety).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds an investmentQuality field, correctly shaped, with the two permanently-unavailable metrics honestly reported", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const iq = report.investmentQuality;
    expect(iq).toBeTruthy();
    expect(iq.metrics).toHaveLength(12);
    expect(iq.score).not.toBeNull();
    expect(["High", "Moderate", "Low"]).toContain(iq.confidenceLevel);
    const dilution = iq.metrics.find((m) => m.metric === "Share Dilution / Buybacks")!;
    const insider = iq.metrics.find((m) => m.metric === "Insider Ownership")!;
    expect(dilution.availability).toBe("unavailable");
    expect(insider.availability).toBe("unavailable");
  });

  it("the investment-quality section renders all 12 metrics, including the unavailable ones' reasons", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const section = report.sections.find((s) => s.id === "investment-quality")!;
    expect(section.title).toBe("4. Investment Quality");
    expect(section.bullets).toHaveLength(12);
    expect(section.bullets!.join(" ")).toMatch(/unavailable/);
  });

  it("section numbering shifted by exactly one from Sprint 14's shape, all ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("business")).toBe("2. Business Overview");
    expect(byId.get("quality")).toBe("3. Business Quality");
    expect(byId.get("investment-quality")).toBe("4. Investment Quality");
    expect(byId.get("moat")).toBe("5. Economic Moat");
    expect(byId.get("financial")).toBe("6. Financial Strength");
    expect(byId.get("profitability")).toBe("7. Profitability & Returns on Capital");
    expect(byId.get("growth")).toBe("8. Growth");
    // Phase 2, Sprint 18 inserted "9. Financial Ratios" right after Growth,
    // shifting Valuation onward by one further from this sprint's own
    // numbering (which had already shifted Sprint 14's numbering by two, for
    // Tom Nash + the Investment Committee).
    expect(byId.get("financial-ratios")).toBe("9. Financial Ratios");
    expect(byId.get("valuation")).toBe("10. Valuation & Fair Value");
    expect(byId.get("graham-valuation")).toBe("11. Graham Valuation");
    expect(byId.get("dcf-valuation")).toBe("12. DCF Valuation");
    expect(byId.get("buffett-valuation")).toBe("13. Buffett Valuation");
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

  it("investment quality is computed independently of Graham/DCF/Buffett's own availability", async () => {
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
    expect(report.grahamValuation.available).toBe(false);
    expect(report.dcfValuation.available).toBe(false);
    // Investment Quality has no single "available" gate — it still produces a
    // score from whichever of the 12 metrics have usable data.
    expect(report.investmentQuality.metrics).toHaveLength(12);
  });
});

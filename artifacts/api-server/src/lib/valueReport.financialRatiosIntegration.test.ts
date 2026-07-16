// Phase 2, Sprint 18 — regression proof that integrating Financial Ratio Analysis
// into buildValueResearchReport() changed nothing about the existing report
// (including Graham/DCF/Buffett/the blended model/Investment Quality/Tom Nash/the
// Investment Committee's own outputs) except the addition of the new
// financialRatios field and its report section (approved Phase 2 plan, Sprint 18).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeInvestmentQuality } from "./investmentQuality.js";
import { analyzeTomNash } from "./tomNashEngine.js";
import { synthesizeInvestmentCommittee } from "./investmentCommittee.js";
import { analyzeFinancialRatios } from "./financialRatios.js";
import { analyzeBusinessQuality, analyzeFinancialStrength, analyzeMoat, analyzeValuation } from "./valueInvesting.js";
import { getFundamentals } from "./fundamentals.js";
import type { Fundamentals } from "./fundamentals.js";

const EXISTING_SECTION_IDS = [
  "snapshot",
  "business",
  "quality",
  "investment-quality",
  "moat",
  "competitive-advantage",
  "financial",
  "profitability",
  "growth",
  "valuation",
  "graham-valuation",
  "dcf-valuation",
  "buffett-valuation",
  "margin-of-safety",
  "tom-nash",
  "investment-committee",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 18 Financial Ratios integration regression", () => {
  it("every pre-existing section id is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("financial-ratios");
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 1);
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

  it("Investment Quality's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const iqStandalone = analyzeInvestmentQuality(f);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.investmentQuality).toEqual(iqStandalone);
  });

  it("Tom Nash's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const bq = analyzeBusinessQuality(f);
    const fin = analyzeFinancialStrength(f);
    const blended = analyzeValuation(f);
    const graham = analyzeGrahamValuation(f);
    const dcf = analyzeDcfValuation(f);
    const buffett = analyzeBuffettValuation(f, bq, analyzeMoat(f));
    const iq = analyzeInvestmentQuality(f);
    const tomNashStandalone = analyzeTomNash(f, iq, fin, blended, graham, dcf, buffett);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.tomNash).toEqual(tomNashStandalone);
  });

  it("the Investment Committee's own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const bq = analyzeBusinessQuality(f);
    const fin = analyzeFinancialStrength(f);
    const blended = analyzeValuation(f);
    const graham = analyzeGrahamValuation(f);
    const dcf = analyzeDcfValuation(f);
    const buffett = analyzeBuffettValuation(f, bq, analyzeMoat(f));
    const iq = analyzeInvestmentQuality(f);
    const tomNash = analyzeTomNash(f, iq, fin, blended, graham, dcf, buffett);
    const committeeStandalone = synthesizeInvestmentCommittee(graham, buffett, tomNash);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.investmentCommittee).toEqual(committeeStandalone);
  });

  it("every pre-existing top-level field is still present and correctly shaped", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.businessQuality).toBeTruthy();
    expect(report.investmentQuality).toBeTruthy();
    expect(report.moat).toBeTruthy();
    expect(report.financialStrength).toBeTruthy();
    expect(report.valuation).toBeTruthy();
    expect(report.grahamValuation).toBeTruthy();
    expect(report.dcfValuation).toBeTruthy();
    expect(report.buffettValuation).toBeTruthy();
    expect(report.consolidatedMarginOfSafety).toBeTruthy();
    expect(report.tomNash).toBeTruthy();
    expect(report.investmentCommittee).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds a financialRatios field, correctly shaped, with the 3 uncomputable ratios always unavailable", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const fr = report.financialRatios;
    expect(fr).toBeTruthy();
    const all = [...fr.valuation, ...fr.profitability, ...fr.liquidityAndLeverage];
    const quickRatio = all.find((m) => m.label === "Quick Ratio")!;
    const roa = all.find((m) => m.label === "Return on Assets")!;
    const assetTurnover = all.find((m) => m.label === "Asset Turnover")!;
    expect(quickRatio.available).toBe(false);
    expect(roa.available).toBe(false);
    expect(assetTurnover.available).toBe(false);
    const payoutRatio = all.find((m) => m.label === "Payout Ratio")!;
    expect(payoutRatio).toBeTruthy();
    expect(fr.trends.length).toBe(3);
  });

  it("financialRatios' own output for a fixed symbol is byte-identical to a standalone call", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const standalone = analyzeFinancialRatios(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.financialRatios).toEqual(standalone);
  });

  it("the financial-ratios section renders after growth and before valuation, and section numbering shifted by exactly one, ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("growth")).toBe("9. Growth");
    expect(byId.get("financial-ratios")).toBe("10. Financial Ratios");
    expect(byId.get("valuation")).toBe("11. Valuation & Fair Value");
    expect(byId.get("graham-valuation")).toBe("12. Graham Valuation");
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

  it("financial ratios are computed independently of Graham/DCF/Buffett's own availability", async () => {
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
    // Financial Ratios has no single "available" gate — it still produces a
    // per-ratio breakdown from whichever fields have usable data.
    const all = [...report.financialRatios.valuation, ...report.financialRatios.profitability, ...report.financialRatios.liquidityAndLeverage];
    expect(all.length).toBeGreaterThan(0);
  });
});

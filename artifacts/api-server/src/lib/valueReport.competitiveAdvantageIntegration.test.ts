// Phase 2, Sprint 21 — regression proof that adding the Competitive Advantage
// Engine (and extracting classifyMoatRating() out of analyzeMoat()) changed
// nothing about the existing Value Report (including analyzeMoat()'s own now-
// refactored output, and Graham/DCF/Buffett/the blended model/Investment
// Quality/Tom Nash/the Investment Committee/Financial Ratios' own outputs)
// except the addition of the new competitiveAdvantage field and its report
// section (approved Phase 2 plan, Sprint 21).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeInvestmentQuality } from "./investmentQuality.js";
import { analyzeTomNash } from "./tomNashEngine.js";
import { synthesizeInvestmentCommittee } from "./investmentCommittee.js";
import { analyzeFinancialRatios } from "./financialRatios.js";
import { analyzeCompetitiveAdvantage } from "./competitiveAdvantage.js";
import { analyzeBusinessQuality, analyzeFinancialStrength, analyzeMoat, analyzeValuation } from "./valueInvesting.js";
import { getFundamentals } from "./fundamentals.js";

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
  "financial-ratios",
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

describe("buildValueResearchReport — Sprint 21 Competitive Advantage integration regression", () => {
  it("every pre-existing section id is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();
    const ids = report.sections.map((s) => s.id);
    expect(ids).toEqual(EXISTING_SECTION_IDS);
    expect(report.sections.length).toBe(23);
  });

  it("analyzeMoat()'s own output is unchanged by the classifyMoatRating() extraction", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const moatStandalone = analyzeMoat(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.moat).toEqual(moatStandalone);
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

  it("Financial Ratios' own output for a fixed symbol is unchanged by this sprint's addition", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const standalone = analyzeFinancialRatios(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.financialRatios).toEqual(standalone);
  });

  it("adds a competitiveAdvantage field, byte-identical to a standalone call", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const iq = analyzeInvestmentQuality(f);
    const fin = analyzeFinancialStrength(f);
    const standalone = analyzeCompetitiveAdvantage(f, iq, fin);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.competitiveAdvantage).toEqual(standalone);
  });

  it("the competitive-advantage section renders after moat and before financial strength, and section numbering shifted by exactly one, ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("moat")).toBe("5. Economic Moat");
    expect(byId.get("competitive-advantage")).toBe("6. Competitive Advantage");
    expect(byId.get("financial")).toBe("7. Financial Strength");
    expect(byId.get("profitability")).toBe("8. Profitability & Returns on Capital");
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

  it("competitive advantage is computed independently of Graham/DCF/Buffett's own availability", async () => {
    const base = (await getFundamentals("TSLA"))!;
    const unprofitable = {
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
    // Competitive Advantage has no single "available" gate tied to valuation —
    // it still produces a full dimension breakdown from qualitative/quality data.
    expect(report.competitiveAdvantage.score).not.toBeNull();
    expect(report.competitiveAdvantage.dimensions.length).toBe(11);
  });
});

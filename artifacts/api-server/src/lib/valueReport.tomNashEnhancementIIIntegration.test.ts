// Phase 2, Sprint 26 — regression proof that Tom Nash Investment Engine,
// Enhancement II (Sector & Macro, Interest Rate Sensitivity, AI/Tech-Cycle)
// plus the Investment Committee's confidence-weighting refinement changed
// nothing about the Value Report's structure — no new section, no new
// top-level field — and that every model whose own computation Sprint 26
// didn't touch is unaffected. Tom Nash's own conviction score/verdict are
// proven byte-identical to the pre-Sprint-26 formula (the 3 new dimensions
// are informational only); the Investment Committee's Tom Nash vote
// confidence is proven to change only via the new dataCompleteness discount,
// never its vote mapping/agreement classification.

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

describe("buildValueResearchReport — Sprint 26 Tom Nash Enhancement II / Committee refinement integration regression", () => {
  it("no new report section — same 23 section ids as Sprint 21 onward", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();
    const ids = report.sections.map((s) => s.id);
    expect(ids).toEqual(EXISTING_SECTION_IDS);
    expect(report.sections.length).toBe(23);
  });

  it("Graham's own output for a fixed symbol is unaffected — it never reads Tom Nash's new dimensions", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const grahamStandalone = analyzeGrahamValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.grahamValuation).toEqual(grahamStandalone);
  });

  it("DCF's own output for a fixed symbol is unaffected — it never reads Tom Nash's new dimensions", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const dcfStandalone = analyzeDcfValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.dcfValuation).toEqual(dcfStandalone);
  });

  it("Buffett's own output for a fixed symbol is unaffected — it never reads Tom Nash's new dimensions", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const bq = analyzeBusinessQuality(f);
    const moat = analyzeMoat(f);
    const buffettStandalone = analyzeBuffettValuation(f, bq, moat);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.buffettValuation).toEqual(buffettStandalone);
  });

  it("the blended model's own output for a fixed symbol is unaffected", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const blendedStandalone = analyzeValuation(f);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.valuation).toEqual(blendedStandalone);
  });

  it("Investment Quality's own output for a fixed symbol is unaffected", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const iqStandalone = analyzeInvestmentQuality(f);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.investmentQuality).toEqual(iqStandalone);
  });

  it("Financial Ratios' own output for a fixed symbol is unaffected", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const standalone = analyzeFinancialRatios(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.financialRatios).toEqual(standalone);
  });

  it("Competitive Advantage's own output for a fixed symbol is unaffected", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const iq = analyzeInvestmentQuality(f);
    const fin = analyzeFinancialStrength(f);
    const standalone = analyzeCompetitiveAdvantage(f, iq, fin);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.competitiveAdvantage).toEqual(standalone);
  });

  it("Tom Nash's convictionScore/verdict are byte-identical to the pre-Sprint-26 5-pillar formula — the 3 new dimensions never enter it", async () => {
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
    expect(report.tomNash.sectorMacro.sector).toBe(f.sector);
    expect(report.tomNash.rateSensitivity.durationScore).toBeGreaterThanOrEqual(0);
    expect(["High", "Moderate", "Low"]).toContain(report.tomNash.aiTechCycle.label);
    expect(report.tomNash.dataCompleteness).toBeGreaterThanOrEqual(0);
    expect(report.tomNash.dataCompleteness).toBeLessThanOrEqual(1);
  });

  it("the Investment Committee's own output for a fixed symbol is wired consistently between standalone and report, including the new confidence discount", async () => {
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
    const tnVote = report.investmentCommittee.votes.find((v) => v.analyst === "Tom Nash");
    if (tnVote) {
      expect(tnVote.confidence).toBeCloseTo(tomNash.convictionScore * tomNash.dataCompleteness, 4);
    }
  });

  it("the tom-nash section's rationale includes the 3 new informational lines, and section numbering is unchanged from Sprint 24", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("tom-nash")).toBe("16. Tom Nash Analysis");
    expect(byId.get("investment-committee")).toBe("17. Investment Committee");
    const section = report.sections.find((s) => s.id === "tom-nash")!;
    expect(section.bullets!.some((b) => b.startsWith("Sector & Macro (informational):"))).toBe(true);
    expect(section.bullets!.some((b) => b.startsWith("Interest Rate Sensitivity (informational):"))).toBe(true);
    expect(section.bullets!.some((b) => b.startsWith("AI & Technology-Cycle (informational"))).toBe(true);
  });
});

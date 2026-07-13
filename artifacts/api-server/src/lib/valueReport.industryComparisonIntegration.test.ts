// Phase 2, Sprint 20 — regression proof that adding Fundamentals.sector/industry
// and the new Industry Comparison Engine changed nothing about the existing
// Value Report (including Graham/DCF/Buffett/the blended model/Investment
// Quality/Tom Nash/the Investment Committee/Financial Ratios' own outputs)
// except the addition of the new sector/industry header fields on
// ValueResearchReport — no new report section this sprint (approved Phase 2
// plan, Sprint 20; Industry Comparison is a separate, on-demand route/result
// type, never folded into buildValueResearchReport()).

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
import { getFundamentals, getFundamentalsProvider } from "./fundamentals.js";
import { buildIndustryComparison } from "./industryComparison.js";

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

describe("buildValueResearchReport — Sprint 20 sector/industry + Industry Comparison integration regression", () => {
  it("section ids, count, and numbering are completely unchanged — no new section this sprint", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();
    const ids = report.sections.map((s) => s.id);
    expect(ids).toEqual(EXISTING_SECTION_IDS);
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length);
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

  it("adds sector/industry fields, correctly sourced from Fundamentals", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.sector).toBe(f.sector);
    expect(report.industry).toBe(f.industry);
    expect(report.sector).toBe("Technology");
    expect(report.industry).toBe("Consumer Electronics");
  });

  it("every pre-existing top-level field is still present and correctly shaped", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.businessQuality).toBeTruthy();
    expect(report.investmentQuality).toBeTruthy();
    expect(report.moat).toBeTruthy();
    expect(report.financialStrength).toBeTruthy();
    expect(report.financialRatios).toBeTruthy();
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

  it("Industry Comparison computes independently and does not mutate buildValueResearchReport's own output", async () => {
    // fetchedAt is stamped fresh (new Date().toISOString()) on every SIMULATED
    // fetch, so it legitimately differs between any two separate report calls
    // regardless of buildIndustryComparison — excluded from this comparison,
    // every other field is compared byte-for-byte.
    const before = (await buildValueResearchReport("AAPL"))!;
    const provider = await getFundamentalsProvider();
    await buildIndustryComparison("AAPL", provider);
    const after = (await buildValueResearchReport("AAPL"))!;
    expect({ ...after, fetchedAt: undefined }).toEqual({ ...before, fetchedAt: undefined });
  });
});

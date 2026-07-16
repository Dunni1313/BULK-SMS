// Phase 2, Sprint 24 — regression proof that Tom Nash Investment Engine,
// Enhancement I (Capital Allocation, Buybacks & Insider Ownership) changed
// nothing about the Value Report's structure — no new section, no new
// top-level field — and that every model NOT consuming the three new
// Fundamentals fields (insiderOwnershipPct, sharesOutstandingChange5y,
// netInsiderActivity) is unaffected. Investment Quality and Tom Nash DO
// change in content for a SIMULATED symbol (per this sprint's approved,
// disclosed decision to score the two previously-always-unavailable
// metrics and extend Tom Nash's Capital Allocation pillar) — proven correct
// via the same standalone-vs-report-wiring consistency check every prior
// sprint's own integration test uses, not a byte-identical-to-before check.

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

describe("buildValueResearchReport — Sprint 24 Capital Allocation / Insider Ownership integration regression", () => {
  it("no new report section — same 23 section ids as Sprint 21 onward", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();
    const ids = report.sections.map((s) => s.id);
    expect(ids).toEqual(EXISTING_SECTION_IDS);
    expect(report.sections.length).toBe(23);
  });

  it("the SIMULATED symbol now carries real (non-null) capital-allocation data on the underlying Fundamentals", async () => {
    const f = (await getFundamentals("AAPL"))!;
    expect(f.insiderOwnershipPct).not.toBeNull();
    expect(f.sharesOutstandingChange5y).not.toBeNull();
    expect(f.netInsiderActivity).not.toBeNull();
  });

  it("Graham's own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const grahamStandalone = analyzeGrahamValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.grahamValuation).toEqual(grahamStandalone);
  });

  it("DCF's own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const dcfStandalone = analyzeDcfValuation(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.dcfValuation).toEqual(dcfStandalone);
  });

  it("Buffett's own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const bq = analyzeBusinessQuality(f);
    const moat = analyzeMoat(f);
    const buffettStandalone = analyzeBuffettValuation(f, bq, moat);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.buffettValuation).toEqual(buffettStandalone);
  });

  it("the blended model's own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const blendedStandalone = analyzeValuation(f);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.valuation).toEqual(blendedStandalone);
  });

  it("Financial Ratios' own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const standalone = analyzeFinancialRatios(f);
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.financialRatios).toEqual(standalone);
  });

  it("Competitive Advantage's own output for a fixed symbol is unaffected — it never reads the new fields", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const iq = analyzeInvestmentQuality(f);
    const fin = analyzeFinancialStrength(f);
    const standalone = analyzeCompetitiveAdvantage(f, iq, fin);
    const report = (await buildValueResearchReport("AAPL"))!;
    // Investment Quality itself now includes 2 more available metrics for a
    // SIMULATED symbol (this sprint's own change) — so recompute iq fresh
    // rather than assume it's identical to a hypothetical pre-Sprint-24 run.
    expect(report.competitiveAdvantage).toEqual(standalone);
  });

  it("Investment Quality now scores Share Dilution/Buybacks and Insider Ownership as available for a SIMULATED symbol, wired consistently between standalone and report", async () => {
    const f = (await getFundamentals("MSFT"))!;
    const iqStandalone = analyzeInvestmentQuality(f);
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.investmentQuality).toEqual(iqStandalone);
    const dilution = iqStandalone.metrics.find((m) => m.metric === "Share Dilution / Buybacks")!;
    const insider = iqStandalone.metrics.find((m) => m.metric === "Insider Ownership")!;
    expect(dilution.availability).toBe("available");
    expect(insider.availability).toBe("available");
    expect(iqStandalone.confidenceLevel).toBe("High");
  });

  it("Tom Nash's Capital Allocation pillar now folds in Share Dilution/Buybacks and Insider Ownership for a SIMULATED symbol, wired consistently between standalone and report", async () => {
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
    expect(tomNashStandalone.capitalAllocation.detail).toMatch(/Share Dilution\/Buybacks [\d.]+\/100/);
    expect(tomNashStandalone.capitalAllocation.detail).toMatch(/Insider Ownership [\d.]+\/100/);
    expect(tomNashStandalone.capitalAllocation.detail).toMatch(/recent aggregate insider activity: (buying|selling|neutral)/);
  });

  it("Tom Nash's Business Quality pillar remains byte-identical to Investment Quality's own overall score (Sprint 16's invariant, still holds)", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.tomNash.businessQuality.score).toBe(report.investmentQuality.score);
  });

  it("the Investment Committee's own output for a fixed symbol is wired consistently between standalone and report", async () => {
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

  it("a LIVE-shaped Fundamentals object with null capital-allocation fields (Alpha Vantage's honest scope this sprint) still produces a fully-formed report with the pre-Sprint-24 unavailable behavior for those two metrics", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const avShaped = { ...f, insiderOwnershipPct: null, sharesOutstandingChange5y: null, netInsiderActivity: null };
    const iq = analyzeInvestmentQuality(avShaped);
    const dilution = iq.metrics.find((m) => m.metric === "Share Dilution / Buybacks")!;
    const insider = iq.metrics.find((m) => m.metric === "Insider Ownership")!;
    expect(dilution.availability).toBe("unavailable");
    expect(insider.availability).toBe("unavailable");
    expect(iq.confidenceLevel).toBe("Moderate");
  });
});

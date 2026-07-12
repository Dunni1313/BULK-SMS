// Phase 2, Sprint 17 — regression proof that integrating the AI Investment
// Committee (Core) into buildValueResearchReport() changed nothing about the
// existing report (including Graham/DCF/Buffett/the blended model/Investment
// Quality/Tom Nash's own outputs) except the addition of the new
// investmentCommittee field and its report section (approved Phase 2 plan,
// Sprint 17).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeInvestmentQuality } from "./investmentQuality.js";
import { analyzeTomNash } from "./tomNashEngine.js";
import { analyzeBusinessQuality, analyzeFinancialStrength, analyzeMoat, analyzeValuation } from "./valueInvesting.js";
import { getFundamentals } from "./fundamentals.js";
import type { Fundamentals } from "./fundamentals.js";

const EXISTING_SECTION_IDS = [
  "snapshot",
  "business",
  "quality",
  "investment-quality",
  "moat",
  "financial",
  "profitability",
  "growth",
  "valuation",
  "graham-valuation",
  "dcf-valuation",
  "buffett-valuation",
  "margin-of-safety",
  "tom-nash",
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 17 Investment Committee integration regression", () => {
  it("every pre-existing section id is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("investment-committee");
    // Phase 2, Sprint 18 added a further section ("financial-ratios") on top
    // of this sprint's own addition — this assertion reflects the current
    // total; investment-committee's continued presence (checked above) is
    // this test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 2);
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
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds an investmentCommittee field, correctly shaped, with a vote per available analyst", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const c = report.investmentCommittee;
    expect(c).toBeTruthy();
    expect(c.votes.length).toBeGreaterThan(0);
    expect(c.votes.length).toBeLessThanOrEqual(3);
    expect(["Buy", "Hold", "Wait"]).toContain(c.consolidatedVerdict);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(c.agreement);
    expect(c.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(c.confidenceScore).toBeLessThanOrEqual(100);
  });

  it("Tom Nash always casts a vote in the Committee, using its own verdict/convictionScore unmodified", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const tnVote = report.investmentCommittee.votes.find((v) => v.analyst === "Tom Nash")!;
    expect(tnVote).toBeTruthy();
    expect(tnVote.verdict).toBe(report.tomNash.verdict);
    expect(tnVote.confidence).toBe(report.tomNash.convictionScore);
  });

  it("the investment-committee section renders after tom-nash, and section numbering shifted by exactly one, ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    expect(byId.get("tom-nash")).toBe("15. Tom Nash Analysis");
    expect(byId.get("investment-committee")).toBe("16. Investment Committee");
    expect(byId.get("risks")).toBe("17. Risks & Red Flags");
    expect(byId.get("decision")).toBe("18. Value-Investor Decision");
    expect(byId.get("stock-vs-options")).toBe("19. Stock vs. Options");
    expect(byId.get("checklist")).toBe("20. Buffett Checklist");
    expect(byId.get("metrics")).toBe("21. Key Metrics");
    expect(byId.get("disclaimer")).toBe("22. Disclaimers & Data Source");
  });

  it("excludes Graham/Buffett from the Committee's votes when their valuation is unavailable, never fabricating a vote, while Tom Nash still votes", async () => {
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
    expect(report.buffettValuation.available).toBe(false);
    const analysts = report.investmentCommittee.votes.map((v) => v.analyst);
    expect(analysts).not.toContain("Graham");
    expect(analysts).not.toContain("Buffett");
    expect(analysts).toContain("Tom Nash");
  });
});

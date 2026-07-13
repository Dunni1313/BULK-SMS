// Phase 2, Sprint 16 — regression proof that integrating the Tom Nash Investment
// Engine (Core) into buildValueResearchReport() changed nothing about the existing
// report (including Graham/DCF/Buffett/the blended model/Investment Quality's own
// outputs) except the addition of the new tomNash field and its report section
// (approved Phase 2 plan, Sprint 16).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeInvestmentQuality } from "./investmentQuality.js";
import { analyzeBusinessQuality, analyzeMoat, analyzeValuation } from "./valueInvesting.js";
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
  "risks",
  "decision",
  "stock-vs-options",
  "checklist",
  "metrics",
  "disclaimer",
];

describe("buildValueResearchReport — Sprint 16 Tom Nash integration regression", () => {
  it("every pre-existing section id is still present, plus exactly one new one", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();

    const ids = report.sections.map((s) => s.id);
    for (const id of EXISTING_SECTION_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("tom-nash");
    // Phase 2, Sprint 17 added "investment-committee" and Sprint 18 added
    // "financial-ratios" on top of this sprint's own addition — this
    // assertion reflects the current total; tom-nash's continued presence
    // (checked above) is this test's actual regression guarantee.
    expect(report.sections.length).toBe(EXISTING_SECTION_IDS.length + 3);
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
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
    expect(typeof report.disclaimer).toBe("string");
  });

  it("adds a tomNash field, correctly shaped, composed of the 5 required pillars", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const t = report.tomNash;
    expect(t).toBeTruthy();
    expect(t.businessQuality.score).toBe(report.investmentQuality.score);
    expect(typeof t.growth.score === "number" || t.growth.score === null).toBe(true);
    expect(typeof t.capitalAllocation.score === "number" || t.capitalAllocation.score === null).toBe(true);
    expect(t.financialStrength.score).toBe(report.financialStrength.score);
    expect(typeof t.valuation.score === "number" || t.valuation.score === null).toBe(true);
    expect(t.convictionScore).toBeGreaterThanOrEqual(0);
    expect(t.convictionScore).toBeLessThanOrEqual(100);
    expect(["Buy", "Hold", "Wait"]).toContain(t.verdict);
    expect(t.rationale.length).toBe(5);
  });

  it("Business Quality pillar is byte-identical to the report's own investmentQuality.score (whole-engine reuse, not recomputed)", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.tomNash.businessQuality.score).toBe(report.investmentQuality.score);
  });

  it("Financial Strength pillar is byte-identical to the report's own financialStrength.score (direct reuse, not recomputed)", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report.tomNash.financialStrength.score).toBe(report.financialStrength.score);
  });

  // Phase 2, Sprint 24 (Tom Nash Investment Engine — Enhancement I)
  // deliberately changed this: Insider Ownership is now surfaced in the
  // Capital Allocation pillar's detail (and averaged in when available) —
  // see tomNashEngine.test.ts and valueReport.capitalAllocationIntegration.test.ts
  // for the dedicated Sprint 24 coverage. It still only ever appears within
  // the Capital Allocation line, never elsewhere in the section.
  it("surfaces Insider Ownership only within the Capital Allocation line of the Tom Nash section (Sprint 24)", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const section = report.sections.find((s) => s.id === "tom-nash")!;
    const capitalAllocationLine = section.bullets!.find((b) => b.startsWith("Capital Allocation:"))!;
    expect(capitalAllocationLine).toMatch(/Insider Ownership/);
    for (const bullet of section.bullets!) {
      if (bullet === capitalAllocationLine) continue;
      expect(bullet).not.toMatch(/Insider Ownership/);
    }
  });

  it("the tom-nash section renders after margin-of-safety, and section numbering shifted by exactly one, ids unchanged", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    const byId = new Map(report.sections.map((s) => [s.id, s.title]));
    // Phase 2, Sprint 17 inserted "15. Investment Committee" right after Tom
    // Nash Analysis, shifting Risks onward by one further. Sprint 18's
    // "financial-ratios" insertion (before Valuation) doesn't affect anything
    // from margin-of-safety onward.
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

  it("Tom Nash's valuation pillar is honestly unavailable when Graham/DCF/Buffett are all unavailable, independent of Investment Quality's own availability", async () => {
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
    expect(report.buffettValuation.available).toBe(false);
    if (!report.valuation.available) {
      expect(report.tomNash.valuation.score).toBeNull();
    }
    // Investment Quality still produces a score independent of valuation availability.
    expect(report.investmentQuality.score).not.toBeNull();
    expect(report.tomNash.businessQuality.score).toBe(report.investmentQuality.score);
  });
});

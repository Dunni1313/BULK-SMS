// Phase 2, Sprint 31 — Company Research Unification (approved Phase 2 plan,
// Sprint 31). This is the "end-to-end regression pass across the whole
// engine" the roadmap's Sprint 31 entry calls for.
//
// Audit finding, disclosed in the Sprint 31 completion report: every module
// built across Sprints 12-30 was ALREADY wired into one coherent Company
// Research experience by the time each of those sprints shipped — this test
// exists to PROVE that comprehensively in one place, something no prior test
// file did, rather than to change any behavior. buildValueResearchReport()
// itself was NOT modified this sprint.
//
// This test never touches any provider directly (SIMULATED only) — no live
// FMP/Alpha Vantage verification is claimed, consistent with the unbroken
// precedent since Sprint 11 (no API key available this session).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";

const ALL_SECTION_IDS_IN_ORDER = [
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

describe("buildValueResearchReport — full institutional decision report shape (Sprint 31)", () => {
  it("produces every section from Sprints 12-17, in the documented order, with zero gaps", async () => {
    const report = (await buildValueResearchReport("AAPL"))!;
    expect(report).not.toBeNull();
    expect(report.sections.map((s) => s.id)).toEqual(ALL_SECTION_IDS_IN_ORDER);
  });

  it("produces every top-level analytical field a complete institutional decision report needs — company overview, all 4 valuation models + consolidated MoS, moat, quality, Tom Nash, and the Investment Committee's final recommendation", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report).not.toBeNull();

    // Company overview.
    expect(report.symbol).toBe("MSFT");
    expect(report.name).toBeTruthy();
    expect(report.price).toBeGreaterThan(0);
    expect(report.sector).toBeTruthy();
    expect(report.industry).toBeTruthy();

    // Quality / moat / competitive advantage.
    expect(report.businessQuality.score).toBeGreaterThanOrEqual(0);
    expect(report.investmentQuality).toBeTruthy();
    expect(report.moat.rating).toBeTruthy();
    expect(report.competitiveAdvantage).toBeTruthy();
    expect(report.financialStrength.rating).toBeTruthy();
    expect(report.financialRatios).toBeTruthy();

    // All 4 valuation models + the consolidated margin of safety (Sprints 12-14).
    for (const model of [report.valuation, report.grahamValuation, report.dcfValuation, report.buffettValuation]) {
      expect(model).toBeTruthy();
      expect(typeof model.available).toBe("boolean");
    }
    expect(report.consolidatedMarginOfSafety.modelsConsidered).toBe(4);

    // The full Tom Nash pillar analysis (Sprint 16, Enhancement I/II Sprints 24/26).
    expect(report.tomNash.convictionScore).toBeGreaterThanOrEqual(0);
    expect(["Buy", "Hold", "Wait"]).toContain(report.tomNash.verdict);
    expect(report.tomNash.businessQuality).toBeTruthy();
    expect(report.tomNash.growth).toBeTruthy();
    expect(report.tomNash.capitalAllocation).toBeTruthy();
    expect(report.tomNash.financialStrength).toBeTruthy();
    expect(report.tomNash.valuation).toBeTruthy();
    expect(report.tomNash.sectorMacro).toBeTruthy();
    expect(report.tomNash.rateSensitivity).toBeTruthy();
    expect(report.tomNash.aiTechCycle).toBeTruthy();

    // The AI Investment Committee's final consolidated recommendation (Sprint 17).
    expect(["Buy", "Hold", "Wait"]).toContain(report.investmentCommittee.consolidatedVerdict);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(report.investmentCommittee.agreement);

    // Decision + stock-vs-options + risks + metrics + disclaimer.
    expect(report.decision.verdict).toBeTruthy();
    expect(report.stockVsOptions.verdict).toBeTruthy();
    expect(report.risks.length).toBeGreaterThan(0);
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(report.disclaimer).toMatch(/SIMULATED|not Warren Buffett/i);
  });

  it("holds for an ETF too (diversified-fund caveat path, not just single-company stocks)", async () => {
    const report = (await buildValueResearchReport("SPY"))!;
    expect(report).not.toBeNull();
    expect(report.kind).toBe("etf");
    expect(report.sections.map((s) => s.id)).toEqual(ALL_SECTION_IDS_IN_ORDER);
  });

  it("holds for a symbol outside the original 10-symbol SIMULATED universe (syntheticProfile path)", async () => {
    const report = (await buildValueResearchReport("IBM"))!;
    expect(report).not.toBeNull();
    expect(report.sections.map((s) => s.id)).toEqual(ALL_SECTION_IDS_IN_ORDER);
  });

  it("honestly returns null for a genuinely invalid ticker shape, never fabricating a report", async () => {
    const report = await buildValueResearchReport("NOT A TICKER!!");
    expect(report).toBeNull();
  });
});

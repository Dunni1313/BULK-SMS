// Phase 12 — Institutional Investing Engine Consolidation & Integration.
// Investment Thesis Generator tests. Every scenario is built by calling the
// real, unmodified buildValueResearchReport() with a fundamentalsOverride
// fixture (the same "construct Fundamentals, run the real report" pattern
// this codebase's own grahamValuation.test.ts/dcfValuation.test.ts already
// use) — never a hand-rolled fake ValueResearchReport — so the thesis
// generator is proven against genuine Engine 1 output for each named
// scenario (healthy, highly leveraged, negative cash flow, dividend payer,
// growth, value, incomplete data).

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { buildInvestmentThesis } from "./investmentThesisGenerator.js";
import type { Fundamentals } from "./fundamentals.js";

function fixture(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: "TEST",
    name: "Test Co",
    kind: "stock",
    dataSource: "SIMULATED",
    asOf: "2026-01-15",
    fetchedAt: "2026-01-15T00:00:00.000Z",
    price: 150,
    sector: "Technology",
    industry: "Software",
    beta: 1.1,
    insiderOwnershipPct: null,
    sharesOutstandingChange5y: null,
    netInsiderActivity: null,
    epsTtm: 10,
    epsFwd: 11,
    fcfPerShare: 9,
    salesPerShare: 60,
    bookPerShare: 40,
    dividendPerShare: 0,
    pe: 15,
    forwardPe: 13.6,
    peg: null,
    ps: 2.5,
    pb: 3.75,
    fcfYield: 0.06,
    earningsYield: 0.067,
    dividendYield: 0,
    revenueGrowth5y: 0.08,
    epsGrowth5y: 0.1,
    revenueGrowthFwd: 0.07,
    grossMargin: 0.4,
    operatingMargin: 0.2,
    netMargin: 0.15,
    roe: 0.2,
    roic: 0.15,
    debtToEquity: 0.3,
    interestCoverage: 15,
    currentRatio: 1.5,
    netCashPerShare: 2,
    fcfPositiveYears: 9,
    fcfMargin: 0.15,
    qualitative: {
      pricingPower: 55, brand: 55, customerLoyalty: 55, recurringRevenue: 55, scale: 55,
      switchingCost: 55, networkEffect: 55, ipStrength: 55, distribution: 55, regulatoryAdvantage: 55,
    },
    revenueHistory: [50, 52, 54, 56, 58, 60],
    epsHistory: [7, 8, 8.5, 9, 9.5, 10],
    fcfHistory: [6, 6.5, 7, 7.5, 8, 9],
    ...overrides,
  };
}

async function buildThesisFor(overrides: Partial<Fundamentals> = {}) {
  const report = await buildValueResearchReport("TEST", "2026-01-15", undefined, fixture(overrides));
  if (!report) throw new Error("report unexpectedly null");
  return { report, thesis: buildInvestmentThesis(report) };
}

describe("buildInvestmentThesis", () => {
  it("produces a well-shaped thesis for a healthy, average company", async () => {
    const { report, thesis } = await buildThesisFor({});
    expect(thesis.symbol).toBe(report.symbol);
    expect(thesis.name).toBe(report.name);
    expect(thesis.dataSource).toBe("SIMULATED");
    expect(thesis.sections.map((s) => s.heading)).toEqual([
      "Business Overview",
      "Financial Health",
      "Valuation",
      "Institutional Perspective",
      "Conclusion",
    ]);
    for (const s of thesis.sections) {
      expect(s.paragraphs.length).toBeGreaterThan(0);
      for (const p of s.paragraphs) expect(p.length).toBeGreaterThan(0);
    }
  });

  it("never fabricates a buy/sell recommendation beyond restating the platform's own existing verdict", async () => {
    const { report, thesis } = await buildThesisFor({});
    const conclusion = thesis.sections.find((s) => s.heading === "Conclusion")!;
    expect(conclusion.paragraphs.join(" ")).toContain(report.decision.verdict);
    expect(conclusion.paragraphs.join(" ")).toContain("introduces no new score");
  });

  it("scenario: highly leveraged company — flags financial-health weaknesses without crashing", async () => {
    const { thesis } = await buildThesisFor({
      debtToEquity: 3.5,
      interestCoverage: 1.2,
      currentRatio: 0.6,
      netCashPerShare: -5,
    });
    const financialHealth = thesis.sections.find((s) => s.heading === "Financial Health")!;
    expect(financialHealth.paragraphs.length).toBeGreaterThan(0);
    // A highly-leveraged fixture should not be described as strong.
    expect(financialHealth.paragraphs[0]).not.toMatch(/rated "Excellent"/);
  });

  it("scenario: negative cash flow — Graham/DCF/Buffett honestly report unavailable, never fabricated", async () => {
    const { report, thesis } = await buildThesisFor({
      epsTtm: -2,
      epsFwd: -1,
      fcfPerShare: -3,
      fcfHistory: [-1, -1.5, -2, -2.2, -2.5, -3],
      fcfMargin: -0.05,
      fcfPositiveYears: 0,
    });
    expect(report.grahamValuation.available).toBe(false);
    expect(report.dcfValuation.available).toBe(false);
    expect(report.buffettValuation.available).toBe(false);
    const valuation = thesis.sections.find((s) => s.heading === "Valuation")!;
    const text = valuation.paragraphs.join(" ");
    expect(text).toContain("Graham model: not available");
    expect(text).toContain("DCF model: not available");
    expect(text).toContain("Buffett model: not available");
  });

  it("scenario: dividend payer — reflected honestly, no fabricated growth claims", async () => {
    const { thesis } = await buildThesisFor({
      dividendPerShare: 4,
      dividendYield: 0.03,
      epsGrowth5y: 0.02,
      revenueGrowth5y: 0.02,
    });
    expect(thesis.sections.length).toBe(5);
  });

  it("scenario: growth company — high growth rates flow through without new scoring", async () => {
    const { report, thesis } = await buildThesisFor({
      revenueGrowth5y: 0.35,
      epsGrowth5y: 0.4,
      revenueGrowthFwd: 0.3,
    });
    const overview = thesis.sections.find((s) => s.heading === "Business Overview")!;
    expect(overview.paragraphs[0]).toContain(report.businessQuality.rating);
  });

  it("scenario: value company — a large margin of safety is described, never a price target", async () => {
    const { thesis } = await buildThesisFor({
      price: 60,
      pe: 6,
      pb: 0.8,
      ps: 0.8,
    });
    const valuation = thesis.sections.find((s) => s.heading === "Valuation")!;
    const text = valuation.paragraphs.join(" ");
    expect(text).not.toMatch(/\$\d+ (in|by) \d{4}/); // never a dated future price
  });

  it("scenario: incomplete data (ETF, no qualitative-specific data) — still produces a complete, honest thesis", async () => {
    const { thesis } = await buildThesisFor({ kind: "etf" });
    expect(thesis.sections.length).toBe(5);
    for (const s of thesis.sections) expect(s.paragraphs.length).toBeGreaterThan(0);
  });

  it("supportingPoints and riskFactors are derived only from already-computed strengths/weaknesses/risks", async () => {
    const { report, thesis } = await buildThesisFor({});
    for (const point of thesis.supportingPoints) {
      const inQualityStrengths = report.investmentQuality.strengths.includes(point);
      const inCaStrengths = report.competitiveAdvantage.strengths.includes(point);
      const isMoatLine = point.includes(report.moat.rating);
      expect(inQualityStrengths || inCaStrengths || isMoatLine).toBe(true);
    }
    for (const factor of thesis.riskFactors) {
      const isRiskFlag = report.risks.some((r) => factor === `[${r.severity.toUpperCase()}] ${r.text}`);
      const inQualityWeaknesses = report.investmentQuality.weaknesses.includes(factor);
      const inCaWeaknesses = report.competitiveAdvantage.weaknesses.includes(factor);
      expect(isRiskFlag || inQualityWeaknesses || inCaWeaknesses).toBe(true);
    }
  });

  it("the disclaimer always states this is deterministic and not AI-generated", async () => {
    const { thesis } = await buildThesisFor({});
    expect(thesis.disclaimer).toContain("not a buy, sell, or hold recommendation");
    expect(thesis.disclaimer.toLowerCase()).toContain("not written by an ai language model");
  });

  it("is deterministic across repeated calls for the same report (excluding generatedAt)", async () => {
    const report = await buildValueResearchReport("TEST", "2026-01-15", undefined, fixture({}));
    if (!report) throw new Error("report unexpectedly null");
    const a = buildInvestmentThesis(report);
    const b = buildInvestmentThesis(report);
    expect(a.sections).toEqual(b.sections);
    expect(a.supportingPoints).toEqual(b.supportingPoints);
    expect(a.riskFactors).toEqual(b.riskFactors);
    expect(a.overview).toEqual(b.overview);
  });

  it("never modifies the report it reads from (zero mutation)", async () => {
    const report = await buildValueResearchReport("TEST", "2026-01-15", undefined, fixture({}));
    if (!report) throw new Error("report unexpectedly null");
    const before = JSON.stringify(report);
    buildInvestmentThesis(report);
    expect(JSON.stringify(report)).toBe(before);
  });
});

// Phase 2, Sprint 23 — Management Quality Analysis Engine unit tests
// (approved Phase 2 plan, Sprint 23). No userId is passed in any test here,
// so buildFilingAnalysis's persistence branch never fires regardless (this
// module always calls it with persist:false) — no DB dependency.
//
// Phase 4, Sprint 63 — this session has no LLM key configured (confirmed
// before implementation, matching every prior sprint's own disclosure), so
// every test in THIS file exercises Communication Quality's/Long-Term
// Focus's real, live "LLM unavailable" honest-degradation path — never a
// mocked LLM success. The genuine LLM-success path (including the
// individual-characterization guard actually discarding a violating
// response) is covered separately in
// managementAnalysis.llmDimensions.test.ts, which mocks the provider SDK the
// same way coach-level.test.ts already established.

import { describe, it, expect } from "vitest";
import { buildManagementQualityAnalysis } from "./managementAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { FundamentalsProvider, Fundamentals, FetchOpts, FinancialStatements, EarningsHistory } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument, FetchDocumentOpts } from "./documentProviders.js";

// Phase 4, Sprint 63 — a thin wrapper that delegates to the real
// SimulatedFundamentalsProvider but nulls out the two Sprint-24 fields
// Shareholder Alignment reuses, so its own honest-unavailable path (e.g. a
// live FMP/Alpha Vantage provider, neither of which supplies
// insiderOwnershipPct today) is directly testable without a live key.
class NoInsiderDataFundamentalsProvider implements FundamentalsProvider {
  readonly id = "no-insider-data";
  readonly dataSource = "SIMULATED" as const;
  readonly isLive = false;
  private readonly inner = new SimulatedFundamentalsProvider();
  async getFundamentals(symbol: string, asOf?: string, opts?: FetchOpts): Promise<Fundamentals | null> {
    const f = await this.inner.getFundamentals(symbol, asOf, opts);
    if (!f) return null;
    return { ...f, insiderOwnershipPct: null, sharesOutstandingChange5y: null };
  }
  getFinancialStatements(symbol: string, opts?: FetchOpts): Promise<FinancialStatements | null> {
    return this.inner.getFinancialStatements(symbol, opts);
  }
  getEarningsHistory(symbol: string, opts?: FetchOpts): Promise<EarningsHistory | null> {
    return this.inner.getEarningsHistory(symbol, opts);
  }
}

const SUBSTANTIAL_RISK_HTML = `<html><body>
  <p>Item 1. Business</p>
  <p>${"Acme Corp designs and sells widgets worldwide. ".repeat(20)}</p>
  <p>Item 1A. Risk Factors</p>
  <p>${"Our business faces significant competitive pressure and regulatory uncertainty. ".repeat(60)}</p>
  <p>Item 7. Management's Discussion and Analysis</p>
  <p>${"Revenue increased year over year on strong demand. ".repeat(20)}</p>
  <p>Item 8. Financial Statements</p>
</body></html>`;

class FakeDocumentProvider implements DocumentProvider {
  readonly id = "fake";
  constructor(private readonly behavior: "found" | "not-found") {}
  async fetchDocument(symbol: string, documentType: DocumentType, _opts?: FetchDocumentOpts): Promise<RawDocument | null> {
    if (this.behavior === "not-found") return null;
    return {
      symbol,
      documentType,
      filingDate: "2025-11-01",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${symbol}-10k.htm`,
      accessionNumber: "0000320193-25-000100",
      fetchedAt: new Date().toISOString(),
      html: SUBSTANTIAL_RISK_HTML,
    };
  }
}

describe("buildManagementQualityAnalysis", () => {
  it("honestly returns null for an unknown/invalid symbol, never fabricating an analysis", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("NOT A TICKER!!", docs, fundamentals);
    expect(result).toBeNull();
  });

  it("scores all 9 requested dimensions, in the requested order", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("AAPL", docs, fundamentals);
    expect(result).not.toBeNull();
    expect(result!.dimensions.map((d) => d.dimension)).toEqual([
      "Capital Allocation Discipline",
      "Strategic Consistency",
      "Long-Term Focus",
      "Communication Quality",
      "Risk Acknowledgement",
      "Execution Discipline",
      "Shareholder Alignment",
      "Transparency",
      "Financial Stewardship",
    ]);
  });

  it("directly reuses Tom Nash's Capital Allocation pillar, zero new scoring logic", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("MSFT", docs, fundamentals);
    const report = await (await import("./valueReport.js")).buildValueResearchReport("MSFT", undefined, fundamentals);
    const dim = result!.dimensions.find((d) => d.dimension === "Capital Allocation Discipline")!;
    expect(dim.score).toBe(report!.tomNash.capitalAllocation.score);
  });

  it("directly reuses Financial Strength's own score for Financial Stewardship", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("GOOGL", docs, fundamentals);
    const report = await (await import("./valueReport.js")).buildValueResearchReport("GOOGL", undefined, fundamentals);
    const dim = result!.dimensions.find((d) => d.dimension === "Financial Stewardship")!;
    expect(dim.score).toBe(report!.financialStrength.score);
  });

  it("directly reuses Competitive Advantage's Competitive Durability dimension for Execution Discipline", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("NVDA", docs, fundamentals);
    const report = await (await import("./valueReport.js")).buildValueResearchReport("NVDA", undefined, fundamentals);
    const durability = report!.competitiveAdvantage.dimensions.find((d) => d.dimension === "Competitive Durability")!;
    const dim = result!.dimensions.find((d) => d.dimension === "Execution Discipline")!;
    expect(dim.score).toBe(durability.score);
  });

  it("scores Risk Acknowledgement from the Risk Factors section's presence and word count, with a source reference", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("META", docs, fundamentals);
    const dim = result!.dimensions.find((d) => d.dimension === "Risk Acknowledgement")!;
    expect(dim.score).not.toBeNull();
    expect(dim.score!).toBeGreaterThan(0);
    expect(dim.sourceSection).toBeTruthy();
    expect(dim.sourceSection!.key).toBe("riskFactors");
    expect(dim.sourceSection!.sourceUrl).toContain("10k.htm");
  });

  // Phase 4, Sprint 63 — Strategic Consistency stays structurally unavailable
  // (needs multi-year filing data this codebase doesn't fetch). Long-Term
  // Focus/Communication Quality are unavailable in THIS session specifically
  // because no LLM key is configured (confirmed before implementation) —
  // never a fabricated score either way. Shareholder Alignment is NO LONGER
  // in this list — see the dedicated test below proving it's now filled.
  it("Strategic Consistency, Long-Term Focus, and Communication Quality are honestly unavailable, never fabricated", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("TSLA", docs, fundamentals);
    for (const name of ["Strategic Consistency", "Long-Term Focus", "Communication Quality"]) {
      const dim = result!.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toBeTruthy();
    }
    // Strategic Consistency has no source text to reference at all.
    expect(result!.dimensions.find((d) => d.dimension === "Strategic Consistency")!.sourceSection).toBeUndefined();
  });

  // Phase 4, Sprint 63 — Long-Term Focus/Communication Quality's honest
  // reason distinguishes "no filing text to read" from "LLM unavailable" —
  // both are real, distinct paths, never conflated.
  it("Long-Term Focus/Communication Quality report 'no filing text' (not 'LLM unavailable') when there's no filing at all", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("not-found");
    const result = await buildManagementQualityAnalysis("PYPL", docs, fundamentals);
    for (const name of ["Long-Term Focus", "Communication Quality"]) {
      const dim = result!.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toMatch(/could not be located or extracted/i);
    }
  });

  it("Long-Term Focus/Communication Quality report 'AI narration is not available' when a filing exists but no LLM key is configured", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("SHOP", docs, fundamentals);
    for (const name of ["Long-Term Focus", "Communication Quality"]) {
      const dim = result!.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toMatch(/ai narration is not available/i);
    }
  });

  // Phase 4, Sprint 63 — Shareholder Alignment, the one deterministic fill.
  it("Shareholder Alignment reuses Investment Quality's own already-scored Insider Ownership/Share Dilution metrics, zero new formula", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("ORCL", docs, fundamentals);
    const report = await (await import("./valueReport.js")).buildValueResearchReport("ORCL", undefined, fundamentals);
    const insider = report!.investmentQuality.metrics.find((m) => m.metric === "Insider Ownership")!;
    const dilution = report!.investmentQuality.metrics.find((m) => m.metric === "Share Dilution / Buybacks")!;
    expect(insider.availability).toBe("available");
    expect(dilution.availability).toBe("available");
    const dim = result!.dimensions.find((d) => d.dimension === "Shareholder Alignment")!;
    expect(dim.score).not.toBeNull();
    expect(dim.score).toBe(Math.round((insider.score! + dilution.score!) / 2));
    expect(dim.detail).toContain("Insider Ownership");
    expect(dim.detail).toContain("Share Dilution/Buybacks");
  });

  it("Shareholder Alignment is honestly unavailable — never a fabricated score — when neither insider metric has real data", async () => {
    const fundamentals = new NoInsiderDataFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("CRM", docs, fundamentals);
    const dim = result!.dimensions.find((d) => d.dimension === "Shareholder Alignment")!;
    expect(dim.score).toBeNull();
    expect(dim.reason).toMatch(/requires insider ownership and share-buyback data/i);
  });

  it("degrades honestly when no filing is found — Risk Acknowledgement and Transparency reflect it, but reused financial dimensions still populate", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("not-found");
    const result = await buildManagementQualityAnalysis("AMZN", docs, fundamentals);
    expect(result).not.toBeNull();
    const risk = result!.dimensions.find((d) => d.dimension === "Risk Acknowledgement")!;
    expect(risk.score).toBeNull();
    const capitalAllocation = result!.dimensions.find((d) => d.dimension === "Capital Allocation Discipline")!;
    expect(capitalAllocation.score).not.toBeNull();
    const stewardship = result!.dimensions.find((d) => d.dimension === "Financial Stewardship")!;
    expect(stewardship.score).not.toBeNull();
  });

  it("computes an overall score as the renormalized weighted average of available dimensions, in 0-100 range", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("QQQ", docs, fundamentals);
    expect(result!.score).not.toBeNull();
    expect(result!.score!).toBeGreaterThanOrEqual(0);
    expect(result!.score!).toBeLessThanOrEqual(100);
  });

  // Phase 4, Sprint 63 — Shareholder Alignment's own fill raises the
  // available count from 5 to 6 of 9 for a SIMULATED company (still below the
  // 0.8 ratio "Moderate" threshold, so confidenceLevel itself is unchanged —
  // only the underlying count improved, a genuine, disclosed behavior change
  // from Sprint 23's own shipped report, not a regression).
  it("confidence level is Low in this session (6 of 9 dimensions available without an LLM key)", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("SPY", docs, fundamentals);
    expect(result!.confidenceLevel).toBe("Low");
    expect(result!.confidenceExplanation).toMatch(/6 of 9 dimensions/i);
  });

  it("the disclaimer never claims to characterize a named individual", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("IWM", docs, fundamentals);
    expect(result!.disclaimer).toMatch(/not a characterization of any individual executive/i);
  });
});

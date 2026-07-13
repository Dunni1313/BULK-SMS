// Phase 2, Sprint 23 — Management Quality Analysis Engine unit tests
// (approved Phase 2 plan, Sprint 23). No userId is passed in any test here,
// so buildFilingAnalysis's persistence branch never fires regardless (this
// module always calls it with persist:false) — no DB dependency.

import { describe, it, expect } from "vitest";
import { buildManagementQualityAnalysis } from "./managementAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument, FetchDocumentOpts } from "./documentProviders.js";

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

  it("the 4 requested dimensions with no honest deterministic path are always unavailable, never fabricated", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("TSLA", docs, fundamentals);
    for (const name of ["Strategic Consistency", "Long-Term Focus", "Communication Quality", "Shareholder Alignment"]) {
      const dim = result!.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toBeTruthy();
      expect(dim.sourceSection).toBeUndefined();
    }
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

  it("confidence level is Low for virtually every company today (only 5 of 9 dimensions ever available)", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("SPY", docs, fundamentals);
    expect(result!.confidenceLevel).toBe("Low");
    expect(result!.confidenceExplanation).toMatch(/5 of 9 dimensions/i);
  });

  it("the disclaimer never claims to characterize a named individual", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildManagementQualityAnalysis("IWM", docs, fundamentals);
    expect(result!.disclaimer).toMatch(/not a characterization of any individual executive/i);
  });
});

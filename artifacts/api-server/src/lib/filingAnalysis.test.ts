// Phase 2, Sprint 22 — Document Intelligence Engine: buildFilingAnalysis
// composition tests (approved Phase 2 plan, Sprint 22). No userId is passed in
// any test here, so the persistence branch (a real db.insert) never fires —
// persistence is proven separately in the live route test, which already
// requires a Postgres connection per this codebase's established convention.

import { describe, it, expect } from "vitest";
import { buildFilingAnalysis } from "./filingAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument, FetchDocumentOpts } from "./documentProviders.js";

const SAMPLE_HTML = `<html><body>
  <p>Item 1. Business</p>
  <p>${"Acme Corp designs and sells widgets worldwide. ".repeat(20)}</p>
  <p>Item 1A. Risk Factors</p>
  <p>${"Our business faces significant competitive pressure. ".repeat(20)}</p>
  <p>Item 7. Management's Discussion and Analysis</p>
  <p>${"Revenue increased year over year on strong demand. ".repeat(20)}</p>
  <p>Item 8. Financial Statements</p>
</body></html>`;

class FakeDocumentProvider implements DocumentProvider {
  readonly id = "fake";
  public callCount = 0;
  constructor(private readonly behavior: "found" | "not-found" | "throw") {}
  async fetchDocument(symbol: string, documentType: DocumentType, _opts?: FetchDocumentOpts): Promise<RawDocument | null> {
    this.callCount++;
    if (this.behavior === "throw") throw new Error("EDGAR is down");
    if (this.behavior === "not-found") return null;
    return {
      symbol,
      documentType,
      filingDate: "2025-11-01",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${symbol}-10k.htm`,
      accessionNumber: "0000320193-25-000100",
      fetchedAt: new Date().toISOString(),
      html: SAMPLE_HTML,
    };
  }
}

describe("buildFilingAnalysis", () => {
  it("honestly returns null for an unknown/invalid symbol, never fabricating an analysis", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildFilingAnalysis("NOT A TICKER!!", docs, fundamentals);
    expect(result).toBeNull();
  });

  it("produces a full analysis when the document is found, reusing buildValueResearchReport for highlights", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const result = await buildFilingAnalysis("AAPL", docs, fundamentals);
    expect(result).not.toBeNull();
    expect(result!.documentAvailable).toBe(true);
    expect(result!.filingDate).toBe("2025-11-01");
    expect(result!.sourceUrl).toContain("10k.htm");
    expect(result!.sections.every((s) => s.found)).toBe(true);
    expect(result!.keyFinancialHighlights.length).toBeGreaterThan(0);
    expect(result!.keyFinancialHighlights.some((h) => h.label === "Tom Nash Conviction")).toBe(true);
    expect(result!.confidenceLevel).toBe("High");
  });

  it("degrades honestly (not silently) when no filing is found — highlights still populate independently", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("not-found");
    const result = await buildFilingAnalysis("MSFT", docs, fundamentals);
    expect(result).not.toBeNull();
    expect(result!.documentAvailable).toBe(false);
    expect(result!.documentUnavailableReason).toMatch(/no 10-k filing was found/i);
    expect(result!.sections.every((s) => !s.found)).toBe(true);
    // The financial-highlights branch is completely independent of EDGAR.
    expect(result!.keyFinancialHighlights.length).toBeGreaterThan(0);
    expect(result!.confidenceLevel).toBe("Low");
  });

  it("degrades honestly when the document provider throws — never propagates the error, never fabricates sections", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("throw");
    const result = await buildFilingAnalysis("GOOGL", docs, fundamentals);
    expect(result).not.toBeNull();
    expect(result!.documentAvailable).toBe(false);
    expect(result!.documentUnavailableReason).toMatch(/currently unavailable/i);
    expect(result!.sections.every((s) => !s.found)).toBe(true);
    expect(result!.keyFinancialHighlights.length).toBeGreaterThan(0);
  });

  it("caches the document fetch — a second call for the same symbol does not re-fetch from the provider", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    await buildFilingAnalysis("NVDA", docs, fundamentals);
    await buildFilingAnalysis("NVDA", docs, fundamentals);
    expect(docs.callCount).toBe(1);
  });

  it("bypasses the cache when forceRefresh is set", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    await buildFilingAnalysis("META", docs, fundamentals, "10-K", { forceRefresh: true });
    await buildFilingAnalysis("META", docs, fundamentals, "10-K", { forceRefresh: true });
    expect(docs.callCount).toBe(2);
  });

  it("the executive summary is deterministic and template-based, never varying run to run for the same inputs", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found");
    const a = await buildFilingAnalysis("TSLA", docs, fundamentals, "10-K", { forceRefresh: true });
    const b = await buildFilingAnalysis("TSLA", docs, fundamentals, "10-K", { forceRefresh: true });
    expect(a!.executiveSummary).toBe(b!.executiveSummary);
  });
});

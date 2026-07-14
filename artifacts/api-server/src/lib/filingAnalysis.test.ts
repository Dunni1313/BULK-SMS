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

// Phase 4, Sprint 60 — a genuine 10-Q-shaped fixture (Part I/Part II Item
// numbering), distinct from SAMPLE_HTML's 10-K shape.
const SAMPLE_10Q_HTML = `<html><body>
  <p>Item 1. Financial Statements</p>
  <p>${"Condensed balance sheets show total assets of $4.2 billion. ".repeat(20)}</p>
  <p>Item 2. Management's Discussion and Analysis of Financial Condition and Results of Operations</p>
  <p>${"Quarterly revenue increased on strong seasonal demand. ".repeat(20)}</p>
  <p>Item 3. Quantitative and Qualitative Disclosures About Market Risk</p>
  <p>Item 1. Legal Proceedings</p>
  <p>${"The company is not currently party to any material litigation. ".repeat(10)}</p>
  <p>Item 1A. Risk Factors</p>
  <p>${"There have been no material changes to the previously disclosed risk factors. ".repeat(20)}</p>
  <p>Item 2. Unregistered Sales of Equity Securities and Use of Proceeds</p>
</body></html>`;

class FakeDocumentProvider implements DocumentProvider {
  readonly id = "fake";
  public callCount = 0;
  constructor(
    private readonly behavior: "found" | "not-found" | "throw",
    private readonly html: string = SAMPLE_HTML,
  ) {}
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
      html: this.html,
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

// Phase 4, Sprint 60 — 10-Q coverage (approved, narrowed Sprint 60 scope:
// 10-Q only, per Phase-4-Readiness-Report.md §5).
describe("buildFilingAnalysis — 10-Q", () => {
  it("produces a full 10-Q analysis when the document is found, with 10-Q's own section keys — never a fabricated 'business' section", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found", SAMPLE_10Q_HTML);
    const result = await buildFilingAnalysis("AAPL", docs, fundamentals, "10-Q");
    expect(result).not.toBeNull();
    expect(result!.documentType).toBe("10-Q");
    expect(result!.documentAvailable).toBe(true);
    expect(result!.sections.map((s) => s.key)).toEqual(["financialStatements", "mdAndA", "riskFactors"]);
    expect(result!.sections.every((s) => s.found)).toBe(true);
    expect(result!.confidenceLevel).toBe("High");
    // The financial-highlights branch is genuinely reused unchanged — same
    // labels regardless of filing type.
    expect(result!.keyFinancialHighlights.some((h) => h.label === "Tom Nash Conviction")).toBe(true);
  });

  it("honestly labels the unavailable-document reason with '10-Q', not '10-K', when no 10-Q filing is found", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("not-found");
    const result = await buildFilingAnalysis("MSFT", docs, fundamentals, "10-Q");
    expect(result).not.toBeNull();
    expect(result!.documentAvailable).toBe(false);
    expect(result!.documentUnavailableReason).toMatch(/no 10-q filing was found/i);
    // The degraded section set uses 10-Q's own key shape, not 10-K's —
    // proves withReason()/emptySections() are wired to the real documentType,
    // not hardcoded.
    expect(result!.sections.map((s) => s.key)).toEqual(["financialStatements", "mdAndA", "riskFactors"]);
    expect(result!.sections.every((s) => !s.found)).toBe(true);
    // The financial-highlights branch is completely independent of EDGAR.
    expect(result!.keyFinancialHighlights.length).toBeGreaterThan(0);
    expect(result!.confidenceLevel).toBe("Low");
  });

  it("the executive summary honestly says 10-Q, not 10-K, for a 10-Q request", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found", SAMPLE_10Q_HTML);
    const result = await buildFilingAnalysis("AAPL", docs, fundamentals, "10-Q", { forceRefresh: true });
    expect(result!.executiveSummary).toMatch(/most recent 10-Q was filed/i);
    expect(result!.executiveSummary).not.toMatch(/10-K/i);
  });

  it("honestly reports a partial 10-Q extraction (Moderate confidence) with the 10-Q-specific caveat, when a real 10-Q's Risk Factors section is legitimately absent", async () => {
    // A real, valid 10-Q with no restated Risk Factors item at all (normal
    // when there's no material change since the last 10-K) — never
    // fabricated, and never blamed on "formatting" the way a 10-K's own
    // caveat wording would.
    const html = `<html><body>
      <p>Item 1. Financial Statements</p>
      <p>${"Balance sheet detail. ".repeat(20)}</p>
      <p>Item 2. Management's Discussion and Analysis</p>
      <p>${"MD&A detail. ".repeat(20)}</p>
    </body></html>`;
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found", html);
    const result = await buildFilingAnalysis("AAPL", docs, fundamentals, "10-Q", { forceRefresh: true });
    expect(result!.confidenceLevel).toBe("Moderate");
    expect(result!.confidenceExplanation).toMatch(/no material change since its last 10-K/i);
    const risk = result!.sections.find((s) => s.key === "riskFactors")!;
    expect(risk.found).toBe(false);
  });

  it("caches per documentType — requesting 10-K then 10-Q for the same symbol fetches twice, never returning the wrong type's cached document", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider("found", SAMPLE_10Q_HTML);
    const tenK = await buildFilingAnalysis("ORCL", docs, fundamentals, "10-K");
    const tenQ = await buildFilingAnalysis("ORCL", docs, fundamentals, "10-Q");
    expect(docs.callCount).toBe(2);
    expect(tenK!.documentType).toBe("10-K");
    expect(tenQ!.documentType).toBe("10-Q");
  });
});

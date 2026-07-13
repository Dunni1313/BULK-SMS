// Phase 2, Sprint 22 — regression proof that the new Document Intelligence
// Engine (documentProviders.ts / filingExtraction.ts / filingAnalysis.ts)
// changed nothing about the existing Value Report. Unlike prior sprints,
// valueReport.ts itself was not modified at all this sprint (no new section,
// no new field) — buildFilingAnalysis() only *reads* buildValueResearchReport()'s
// output, it never feeds into it. This test proves that reuse is genuinely
// read-only.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { buildFilingAnalysis } from "./filingAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument } from "./documentProviders.js";

class NullDocumentProvider implements DocumentProvider {
  readonly id = "null";
  async fetchDocument(_symbol: string, _documentType: DocumentType): Promise<RawDocument | null> {
    return null;
  }
}

describe("buildValueResearchReport — Sprint 22 Document Intelligence integration regression", () => {
  it("buildValueResearchReport's own output for a fixed symbol is unchanged before/after a filing analysis call", async () => {
    const before = await buildValueResearchReport("AAPL");
    const fundamentals = new SimulatedFundamentalsProvider();
    await buildFilingAnalysis("AAPL", new NullDocumentProvider(), fundamentals);
    const after = await buildValueResearchReport("AAPL");
    // fetchedAt is stamped fresh on every SIMULATED call (see the same
    // exclusion established in Sprint 20's own regression test).
    expect({ ...after, fetchedAt: undefined }).toEqual({ ...before, fetchedAt: undefined });
  });

  it("the report has no filing-analysis-shaped fields — this sprint added no section or field to valueReport.ts", async () => {
    // report.sections is the report's own pre-existing list of report sections
    // (since Sprint 12) — unrelated to Document Intelligence's document
    // sections, so it's deliberately NOT asserted absent here.
    const report = await buildValueResearchReport("AAPL");
    expect(report).not.toHaveProperty("executiveSummary");
    expect(report).not.toHaveProperty("documentAvailable");
    expect(report).not.toHaveProperty("keyFinancialHighlights");
  });
});

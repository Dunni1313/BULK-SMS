// Phase 2, Sprint 23 — regression proof that the new Management Quality
// Analysis Engine changed nothing about the existing Value Report or the
// Sprint 22 Document Intelligence Engine. Like Sprint 22, valueReport.ts
// itself was not modified at all this sprint — buildManagementQualityAnalysis()
// only *reads* buildValueResearchReport()'s and buildFilingAnalysis()'s
// output, it never feeds into either.

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { buildFilingAnalysis } from "./filingAnalysis.js";
import { buildManagementQualityAnalysis } from "./managementAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument } from "./documentProviders.js";

class NullDocumentProvider implements DocumentProvider {
  readonly id = "null";
  async fetchDocument(_symbol: string, _documentType: DocumentType): Promise<RawDocument | null> {
    return null;
  }
}

describe("Sprint 23 Management Quality Analysis integration regression", () => {
  it("buildValueResearchReport's own output for a fixed symbol is unchanged before/after a management quality call", async () => {
    const before = await buildValueResearchReport("AAPL");
    const fundamentals = new SimulatedFundamentalsProvider();
    await buildManagementQualityAnalysis("AAPL", new NullDocumentProvider(), fundamentals);
    const after = await buildValueResearchReport("AAPL");
    expect({ ...after, fetchedAt: undefined }).toEqual({ ...before, fetchedAt: undefined });
  });

  it("buildFilingAnalysis's own output for a fixed symbol is unchanged before/after a management quality call, and remains independently callable", async () => {
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new NullDocumentProvider();
    const before = await buildFilingAnalysis("MSFT", docs, fundamentals, "10-K", { forceRefresh: true });
    await buildManagementQualityAnalysis("MSFT", docs, fundamentals);
    const after = await buildFilingAnalysis("MSFT", docs, fundamentals, "10-K", { forceRefresh: true });
    expect({ ...after, fetchedAt: undefined }).toEqual({ ...before, fetchedAt: undefined });
  });

  it("the report has no management-quality-shaped fields — this sprint added no section or field to valueReport.ts", async () => {
    const report = await buildValueResearchReport("AAPL");
    expect(report).not.toHaveProperty("dimensions");
    expect(report).not.toHaveProperty("confidenceExplanation");
  });
});

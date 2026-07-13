// Phase 2, Sprint 25 — regression proof that the new Earnings Intelligence
// Engine changed nothing about the existing Value Report. Like Sprints 19,
// 20, 22, and 23, valueReport.ts itself was not modified at all this sprint —
// buildEarningsIntelligence()/analyzeEarningsIntelligence() only read a
// provider's own getEarningsHistory()/getFundamentals(), they never feed into
// buildValueResearchReport().

import { describe, it, expect } from "vitest";
import { buildValueResearchReport } from "./valueReport.js";
import { buildEarningsIntelligence } from "./earningsAnalysis.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";

describe("Sprint 25 Earnings Intelligence integration regression", () => {
  it("buildValueResearchReport's own output for a fixed symbol is unchanged before/after an earnings-intelligence call", async () => {
    const before = await buildValueResearchReport("AAPL");
    const fundamentals = new SimulatedFundamentalsProvider();
    await buildEarningsIntelligence("AAPL", fundamentals);
    const after = await buildValueResearchReport("AAPL");
    expect({ ...after, fetchedAt: undefined }).toEqual({ ...before, fetchedAt: undefined });
  });

  it("the report has no earnings-intelligence-shaped fields — this sprint added no section or field to valueReport.ts", async () => {
    const report = await buildValueResearchReport("AAPL");
    expect(report).not.toHaveProperty("quarters");
    expect(report).not.toHaveProperty("epsBeatRate");
    expect(report).not.toHaveProperty("earningsGrowthTrend");
    expect(report).not.toHaveProperty("epsSurpriseStreak");
  });

  it("section count and every existing section id are unchanged (23 sections, same as Sprint 24)", async () => {
    const report = await buildValueResearchReport("AAPL");
    expect(report!.sections.length).toBe(23);
    expect(report!.sections.map((s) => s.id)).toContain("tom-nash");
    expect(report!.sections.map((s) => s.id)).toContain("investment-committee");
  });
});

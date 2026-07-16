// Phase 2, Sprint 17 — AI Investment Committee (Core) unit tests (approved Phase 2
// plan, Sprint 17).

import { describe, it, expect } from "vitest";
import { synthesizeInvestmentCommittee } from "./investmentCommittee.js";
import type { GrahamValuation } from "./grahamValuation.js";
import type { BuffettValuation } from "./buffettValuation.js";
import type { TomNashAnalysis } from "./tomNashEngine.js";

function graham(rating: "Cheap" | "Fair" | "Expensive" | "Very Expensive", available = true): GrahamValuation {
  if (!available) return { available: false, price: 150, reason: "n/a", summary: "Graham unavailable." };
  return {
    available: true,
    price: 150,
    summary: `Graham rates this ${rating}.`,
    grahamNumber: 200,
    growthFormulaValue: 210,
    fairValue: 205,
    methods: [],
    marginOfSafety: 0.1,
    marginOfSafetyLabel: "Medium",
    rating,
  };
}

function buffett(rating: "Cheap" | "Fair" | "Expensive" | "Very Expensive", available = true): BuffettValuation {
  if (!available) return { available: false, price: 150, requiredReturn: 0.07, reason: "n/a", summary: "Buffett unavailable." };
  return {
    available: true,
    price: 150,
    ownerEarnings: 9,
    requiredReturn: 0.07,
    fairValue: 180,
    methods: [],
    marginOfSafety: 0.1,
    marginOfSafetyLabel: "Medium",
    rating,
    summary: `Buffett rates this ${rating}.`,
  };
}

// dataCompleteness defaults to 1 (fully complete) so pre-Sprint-26 tests that
// don't care about the Committee's new confidence-weighting refinement keep
// asserting confidence === convictionScore unchanged.
function tomNash(verdict: "Buy" | "Hold" | "Wait", convictionScore: number, dataCompleteness = 1): TomNashAnalysis {
  return {
    businessQuality: { label: "Business Quality", score: 70, detail: "d" },
    growth: { label: "Growth", score: 70, detail: "d" },
    capitalAllocation: { label: "Capital Allocation", score: 70, detail: "d" },
    financialStrength: { label: "Financial Strength", score: 70, detail: "d" },
    valuation: { label: "Valuation", score: 70, detail: "d" },
    sectorMacro: { sector: "Technology", industry: "Software", macroRegime: "stable_rates", macroRegimeLabel: "Stable-Rate Environment", detail: "d" },
    rateSensitivity: { durationScore: 50, classification: "Blend", sensitivityLabel: "Moderate", detail: "d" },
    aiTechCycle: { score: 50, label: "Moderate", detail: "d" },
    dataCompleteness,
    convictionScore,
    verdict,
    rationale: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"],
    summary: `TEST: ${verdict} (conviction ${convictionScore}/100).`,
  };
}

describe("synthesizeInvestmentCommittee", () => {
  it("maps Graham/Buffett ratings to Buy/Hold/Wait via the approved bucket, with confidence from Tom Nash's own valuation-score table", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Buy", 80));
    const g = c.votes.find((v) => v.analyst === "Graham")!;
    expect(g.verdict).toBe("Buy");
    expect(g.confidence).toBe(100); // Cheap -> 100, reused from tomNashEngine's table
  });

  it("maps Fair -> Hold and Expensive/Very Expensive -> Wait", () => {
    expect(synthesizeInvestmentCommittee(graham("Fair"), buffett("Cheap"), tomNash("Buy", 80)).votes.find((v) => v.analyst === "Graham")!.verdict).toBe("Hold");
    expect(synthesizeInvestmentCommittee(graham("Expensive"), buffett("Cheap"), tomNash("Buy", 80)).votes.find((v) => v.analyst === "Graham")!.verdict).toBe("Wait");
    expect(synthesizeInvestmentCommittee(graham("Very Expensive"), buffett("Cheap"), tomNash("Buy", 80)).votes.find((v) => v.analyst === "Graham")!.verdict).toBe("Wait");
  });

  it("Tom Nash votes with its own verdict and convictionScore directly, unmodified", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Hold", 55));
    const tn = c.votes.find((v) => v.analyst === "Tom Nash")!;
    expect(tn.verdict).toBe("Hold");
    expect(tn.confidence).toBe(55);
  });

  it("excludes a model from voting entirely when unavailable — never fabricates a vote", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap", false), buffett("Cheap"), tomNash("Buy", 80));
    expect(c.votes.map((v) => v.analyst)).toEqual(["Buffett", "Tom Nash"]);
    expect(c.votes.length).toBe(2);
  });

  it("is unanimous when all voting analysts agree, and consolidates to that verdict", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Buy", 90));
    expect(c.agreement).toBe("unanimous");
    expect(c.consolidatedVerdict).toBe("Buy");
  });

  it("is majority when 2 of 3 agree, and consolidates to the majority verdict", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Hold", 55));
    expect(c.agreement).toBe("majority");
    expect(c.consolidatedVerdict).toBe("Buy");
  });

  it("defaults to Hold when all 3 votes genuinely disagree (split), and reports agreement as split", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Fair"), tomNash("Wait", 30));
    expect(c.agreement).toBe("split");
    expect(c.consolidatedVerdict).toBe("Hold");
  });

  it("reports insufficient-data when only one analyst votes, and consolidates to that lone vote", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap", false), buffett("Cheap", false), tomNash("Wait", 20));
    expect(c.votes.length).toBe(1);
    expect(c.agreement).toBe("insufficient-data");
    expect(c.consolidatedVerdict).toBe("Wait");
  });

  it("computes confidenceScore as the average of only the votes actually cast", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap", false), buffett("Fair"), tomNash("Hold", 50));
    // Buffett (Fair -> 65) and Tom Nash (50): (65 + 50) / 2 = 57.5
    expect(c.confidenceScore).toBe(57.5);
  });

  it("produces one reasoning line per vote plus one consolidated line, no LLM narration", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Buy", 90));
    expect(c.reasoning.length).toBe(4); // 3 votes + 1 consolidated line
    expect(c.reasoning[0]).toMatch(/Graham:/);
    expect(c.reasoning[c.reasoning.length - 1]).toMatch(/Consolidated:/);
  });

  it("always surfaces the agreement signal in the summary, regardless of consensus level", () => {
    const split = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Fair"), tomNash("Wait", 30));
    expect(split.summary).toMatch(/split/i);
    const unanimous = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Buy", 90));
    expect(unanimous.summary).toMatch(/agree/i);
  });

  it("never claims to fabricate or execute anything", () => {
    const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Buy", 90));
    const serialized = JSON.stringify(c);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });

  // Phase 2, Sprint 26 — confidence-weighting refinement. The aggregation
  // methodology itself (vote mapping, agreement classification, split->Hold
  // default, confidenceScore's own averaging formula) is unchanged — only
  // Tom Nash's own vote confidence now discounts by dataCompleteness.
  describe("Sprint 26 — Tom Nash's Committee-vote confidence discounted by dataCompleteness", () => {
    it("is byte-identical to convictionScore when dataCompleteness is 1 (the common case)", () => {
      const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Hold", 55, 1));
      const tn = c.votes.find((v) => v.analyst === "Tom Nash")!;
      expect(tn.confidence).toBe(55);
    });

    it("discounts confidence proportionally when dataCompleteness is below 1", () => {
      const c = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Cheap"), tomNash("Hold", 80, 0.75));
      const tn = c.votes.find((v) => v.analyst === "Tom Nash")!;
      expect(tn.confidence).toBe(60); // 80 * 0.75
    });

    it("does not change the vote mapping, agreement classification, or split->Hold default — aggregation methodology itself is untouched", () => {
      const complete = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Fair"), tomNash("Wait", 30, 1));
      const incomplete = synthesizeInvestmentCommittee(graham("Cheap"), buffett("Fair"), tomNash("Wait", 30, 0.5));
      expect(complete.agreement).toBe(incomplete.agreement);
      expect(complete.consolidatedVerdict).toBe(incomplete.consolidatedVerdict);
      const completeTn = complete.votes.find((v) => v.analyst === "Tom Nash")!;
      const incompleteTn = incomplete.votes.find((v) => v.analyst === "Tom Nash")!;
      expect(completeTn.verdict).toBe(incompleteTn.verdict);
      expect(completeTn.confidence).not.toBe(incompleteTn.confidence);
    });

    it("confidenceScore's own averaging formula is unchanged — it simply averages whatever confidence each vote now carries", () => {
      const c = synthesizeInvestmentCommittee(graham("Cheap", false), buffett("Fair"), tomNash("Hold", 50, 0.5));
      // Buffett (Fair -> 65) and Tom Nash (50 * 0.5 = 25): (65 + 25) / 2 = 45
      expect(c.confidenceScore).toBe(45);
    });
  });
});

// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine. Direct
// unit coverage over the pure pipeline vocabulary/helpers — the only
// genuinely new backend logic this sprint adds (persistence CRUD is
// covered live in routes/opportunityPipeline.route.test.ts).

import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_PRIORITIES,
  stageLabel,
  nextRecommendedActionFor,
  isPipelineStage,
  isOpportunityCategory,
  isOpportunityPriority,
} from "./opportunityPipeline.js";

describe("PIPELINE_STAGES", () => {
  it("defines all 7 stages named in the approved spec, in order", () => {
    expect(PIPELINE_STAGES).toEqual([
      "discovered",
      "screening",
      "research-candidate",
      "research-in-progress",
      "research-complete",
      "strategy-candidate",
      "archived",
    ]);
  });
});

describe("stageLabel", () => {
  it("returns a real human label for every defined stage", () => {
    for (const s of PIPELINE_STAGES) {
      expect(stageLabel(s).length).toBeGreaterThan(0);
    }
    expect(stageLabel("research-candidate")).toBe("Research Candidate");
  });

  it("falls back to the raw value for an unrecognized stage, never a fabricated label", () => {
    expect(stageLabel("not-a-real-stage")).toBe("not-a-real-stage");
  });
});

describe("nextRecommendedActionFor", () => {
  it("returns a distinct, non-empty, deterministic recommendation for every stage", () => {
    const actions = PIPELINE_STAGES.map((s) => nextRecommendedActionFor(s));
    for (const a of actions) expect(a.length).toBeGreaterThan(0);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it("never recommends buying or selling or predicts market direction — only existing workflow steps", () => {
    const allText = PIPELINE_STAGES.map((s) => nextRecommendedActionFor(s)).join(" ");
    expect(allText).not.toMatch(/\bbuy\b|\bsell\b|price target|will rise|will fall/i);
  });

  it("is deterministic — never varies across repeated calls for the same stage", () => {
    expect(nextRecommendedActionFor("screening")).toBe(nextRecommendedActionFor("screening"));
  });
});

describe("type guards", () => {
  it("isPipelineStage/isOpportunityCategory/isOpportunityPriority correctly accept/reject", () => {
    expect(isPipelineStage("discovered")).toBe(true);
    expect(isPipelineStage("not-a-stage")).toBe(false);
    for (const c of OPPORTUNITY_CATEGORIES) expect(isOpportunityCategory(c)).toBe(true);
    expect(isOpportunityCategory("not-a-category")).toBe(false);
    for (const p of OPPORTUNITY_PRIORITIES) expect(isOpportunityPriority(p)).toBe(true);
    expect(isOpportunityPriority("urgent")).toBe(false);
  });
});

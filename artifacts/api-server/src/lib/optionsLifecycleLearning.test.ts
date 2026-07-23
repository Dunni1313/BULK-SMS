// Phase 36 — Institutional Position Lifecycle Manager.
import { describe, it, expect } from "vitest";
import { getStageLearning, allStageLearning } from "./optionsLifecycleLearning.js";
import { LIFECYCLE_STAGES } from "./optionsLifecycle.js";

describe("getStageLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 8 lifecycle stages — zero silently-dropped, unresolvable topic keys", () => {
    for (const stage of LIFECYCLE_STAGES) {
      const learning = getStageLearning(stage);
      expect(learning).not.toBeNull();
      expect(learning!.stage).toBe(stage);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
        expect(["lesson", "strategy", "risk", "assignment"]).toContain(link.category);
      }
    }
  });

  it("connects near_expiration and assignment_risk to real Assignment Mechanics content, per the Phase 36 kickoff's explicit instruction", () => {
    for (const stage of ["near_expiration", "assignment_risk"] as const) {
      const learning = getStageLearning(stage)!;
      expect(learning.links.some((l) => l.topicKey === "foundations-assignment")).toBe(true);
    }
  });

  it("returns null for an unknown stage, never a fabricated learning bundle", () => {
    expect(getStageLearning("not_a_real_stage")).toBeNull();
    expect(getStageLearning("")).toBeNull();
  });
});

describe("allStageLearning", () => {
  it("returns exactly the 8 stages, in order, each matching its own single-stage lookup", () => {
    const all = allStageLearning();
    expect(all).toHaveLength(8);
    expect(all.map((e) => e.stage)).toEqual([...LIFECYCLE_STAGES]);
    for (const entry of all) {
      expect(entry).toEqual(getStageLearning(entry.stage));
    }
  });
});

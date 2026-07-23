// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
import { describe, it, expect } from "vitest";
import { getRiskExposureLearning, allRiskExposureLearning } from "./riskExposureLearning.js";
import { RISK_EXPOSURE_COACH_TOPICS } from "./riskExposureCoach.js";

describe("getRiskExposureLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 7 coach topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of RISK_EXPOSURE_COACH_TOPICS) {
      const learning = getRiskExposureLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
        expect(["risk", "exposure", "diversification", "concentration", "sizing", "capital", "greeks"]).toContain(link.category);
      }
    }
  });

  it("connects the 'greeks' topic to real Portfolio Greeks content", () => {
    const learning = getRiskExposureLearning("greeks")!;
    expect(learning.links.some((l) => l.topicKey === "greeks-portfolio-greeks")).toBe(true);
  });

  it("connects the 'concentration' and 'position_sizing' topics to real, distinct Learning Centre content", () => {
    const concentration = getRiskExposureLearning("concentration")!;
    expect(concentration.links.some((l) => l.topicKey === "portfolio-concentration")).toBe(true);
    const sizing = getRiskExposureLearning("position_sizing")!;
    expect(sizing.links.some((l) => l.topicKey === "portfolio-position-sizing")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getRiskExposureLearning("not_a_real_topic")).toBeNull();
    expect(getRiskExposureLearning("")).toBeNull();
  });
});

describe("allRiskExposureLearning", () => {
  it("returns exactly the 7 topics, in order, each matching its own single-topic lookup", () => {
    const all = allRiskExposureLearning();
    expect(all).toHaveLength(7);
    expect(all.map((e) => e.topic)).toEqual([...RISK_EXPOSURE_COACH_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getRiskExposureLearning(entry.topic));
    }
  });
});

// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
import { describe, it, expect } from "vitest";
import { COMPLIANCE_LEARNING_TOPICS, getComplianceLearning, allComplianceLearning } from "./complianceLearning.js";

describe("getComplianceLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 6 topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of COMPLIANCE_LEARNING_TOPICS) {
      const learning = getComplianceLearning(topic);
      expect(learning).not.toBeNull();
      expect(learning!.topic).toBe(topic);
      expect(learning!.links.length).toBeGreaterThan(0);
      for (const link of learning!.links) {
        expect(typeof link.title).toBe("string");
        expect(link.title.length).toBeGreaterThan(0);
        expect(typeof link.summary).toBe("string");
        expect(link.summary.length).toBeGreaterThan(0);
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
      }
    }
  });

  it("connects the 'portfolio_governance' topic to real, already-existing Institutional Portfolio Construction content", () => {
    const learning = getComplianceLearning("portfolio_governance")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-portfolio-construction")).toBe(true);
  });

  it("connects the 'risk_policies' topic to real, already-existing Institutional Risk Contribution content", () => {
    const learning = getComplianceLearning("risk_policies")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-risk-contribution")).toBe(true);
  });

  it("connects the 'institutional_compliance' topic to real, already-existing Process Over Prediction content", () => {
    const learning = getComplianceLearning("institutional_compliance")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-process-over-prediction")).toBe(true);
  });

  it("connects the 'diversification' topic to real, already-existing Portfolio Diversification content", () => {
    const learning = getComplianceLearning("diversification")!;
    expect(learning.links.some((l) => l.topicKey === "portfolio-diversification")).toBe(true);
  });

  it("connects the 'capital_allocation' topic to real, already-existing Institutional Capital Allocation content", () => {
    const learning = getComplianceLearning("capital_allocation")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-capital-allocation")).toBe(true);
  });

  it("connects the 'portfolio_monitoring' topic to real, already-existing Investing Monitoring content", () => {
    const learning = getComplianceLearning("portfolio_monitoring")!;
    expect(learning.links.some((l) => l.topicKey === "investing-monitoring")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getComplianceLearning("not_a_real_topic")).toBeNull();
    expect(getComplianceLearning("")).toBeNull();
  });
});

describe("allComplianceLearning", () => {
  it("returns exactly the 6 topics, in order, each matching its own single-topic lookup", () => {
    const all = allComplianceLearning();
    expect(all).toHaveLength(6);
    expect(all.map((e) => e.topic)).toEqual([...COMPLIANCE_LEARNING_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getComplianceLearning(entry.topic));
    }
  });
});

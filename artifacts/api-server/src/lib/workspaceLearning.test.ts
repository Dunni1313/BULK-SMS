// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
import { describe, it, expect } from "vitest";
import { WORKSPACE_LEARNING_TOPICS, getWorkspaceLearning, allWorkspaceLearning } from "./workspaceLearning.js";

describe("getWorkspaceLearning", () => {
  it("resolves a non-empty set of real Learning Centre links for every one of the 6 topics — zero silently-dropped, unresolvable topic keys", () => {
    for (const topic of WORKSPACE_LEARNING_TOPICS) {
      const learning = getWorkspaceLearning(topic);
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

  it("connects the 'portfolio_workflows' topic to real, already-existing Portfolio Construction / Position Management content", () => {
    const learning = getWorkspaceLearning("portfolio_workflows")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-portfolio-construction")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "institutional-position-management")).toBe(true);
  });

  it("connects the 'institutional_review_process' topic to real, already-existing Decision Quality / Process Over Prediction content", () => {
    const learning = getWorkspaceLearning("institutional_review_process")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-decision-quality")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "institutional-process-over-prediction")).toBe(true);
  });

  it("connects the 'governance' topic to real, already-existing Portfolio Construction / Decision Quality content", () => {
    const learning = getWorkspaceLearning("governance")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-portfolio-construction")).toBe(true);
  });

  it("connects the 'monitoring' topic to real, already-existing Investing Monitoring / Portfolio Health content", () => {
    const learning = getWorkspaceLearning("monitoring")!;
    expect(learning.links.some((l) => l.topicKey === "investing-monitoring")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "portfolio-health")).toBe(true);
  });

  it("connects the 'performance_review' topic to real, already-existing Expectancy / Drawdown content", () => {
    const learning = getWorkspaceLearning("performance_review")!;
    expect(learning.links.some((l) => l.topicKey === "performance-expectancy")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "performance-drawdown")).toBe(true);
  });

  it("connects the 'risk_review' topic to real, already-existing Risk Contribution / Event Risk content", () => {
    const learning = getWorkspaceLearning("risk_review")!;
    expect(learning.links.some((l) => l.topicKey === "institutional-risk-contribution")).toBe(true);
    expect(learning.links.some((l) => l.topicKey === "portfolio-event-risk")).toBe(true);
  });

  it("returns null for an unknown topic, never a fabricated learning bundle", () => {
    expect(getWorkspaceLearning("not_a_real_topic")).toBeNull();
    expect(getWorkspaceLearning("")).toBeNull();
  });
});

describe("allWorkspaceLearning", () => {
  it("returns exactly the 6 topics, in order, each matching its own single-topic lookup", () => {
    const all = allWorkspaceLearning();
    expect(all).toHaveLength(6);
    expect(all.map((e) => e.topic)).toEqual([...WORKSPACE_LEARNING_TOPICS]);
    for (const entry of all) {
      expect(entry).toEqual(getWorkspaceLearning(entry.topic));
    }
  });
});

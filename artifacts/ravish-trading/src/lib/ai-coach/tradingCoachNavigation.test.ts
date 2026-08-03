// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Smart Navigation
// mapping tests (#7 smart-nav correctness, #8 entity-id preservation).
//
// v1.6.0 Sprint 2 — Guided Workflow UX. Every href below now also carries
// ?workflowStep=<id> (Sprint 2 #7, "context preserved between every
// workflow step") — a disclosed, intentional extension of Sprint 1's own
// href shape, not a regression; every exact-href assertion below was
// updated to match. New tests cover resolveStepLearnEntry (#6, Beginner
// Mode).

import { describe, it, expect } from "vitest";
import { resolveWorkflowNavigationTarget, resolveStepLearnEntry } from "./tradingCoachNavigation";
import { DAILY_WORKFLOW_STEP_ORDER } from "./tradingCoachWorkflow";

describe("resolveWorkflowNavigationTarget — smart navigation correctness (#7)", () => {
  it("every one of the 11 steps resolves to a real, non-empty path", () => {
    for (const stepId of DAILY_WORKFLOW_STEP_ORDER) {
      const target = resolveWorkflowNavigationTarget(stepId, null);
      expect(target.path.startsWith("/")).toBe(true);
      expect(target.destinationLabel.length).toBeGreaterThan(0);
    }
  });

  it("every href always carries its own workflowStep for context preservation", () => {
    for (const stepId of DAILY_WORKFLOW_STEP_ORDER) {
      const target = resolveWorkflowNavigationTarget(stepId, null);
      expect(target.href).toContain(`workflowStep=${stepId}`);
    }
  });

  it("Market Scan opens the real Scanner page", () => {
    expect(resolveWorkflowNavigationTarget("market-scan", null).path).toBe("/scanner");
  });

  it("Execution opens the real, protected-logic-backed Trade Execution Center", () => {
    expect(resolveWorkflowNavigationTarget("execution", null).path).toBe("/trade-execution-center");
  });

  it("Trade Journal opens the real Trading Journal page", () => {
    expect(resolveWorkflowNavigationTarget("trade-journal", null).path).toBe("/trading-journal");
  });

  it("Daily Review opens the real Cross-Engine Daily Report", () => {
    expect(resolveWorkflowNavigationTarget("daily-review", null).path).toBe("/daily-report");
  });
});

describe("resolveWorkflowNavigationTarget — entity id preservation (#8)", () => {
  it("carries a known trade plan id into the deep link for plan-aware steps", () => {
    const target = resolveWorkflowNavigationTarget("decision-risk-review", 42);
    expect(target.href).toBe("/decision-workflow?planId=42&workflowStep=decision-risk-review");
  });

  it("never fabricates a planId in the URL when none is known", () => {
    const target = resolveWorkflowNavigationTarget("decision-risk-review", null);
    expect(target.href).toBe("/decision-workflow?workflowStep=decision-risk-review");
    expect(target.href).not.toContain("planId");
  });

  it("never appends a planId to a step whose destination page doesn't honestly support one", () => {
    const target = resolveWorkflowNavigationTarget("market-scan", 42);
    expect(target.href).toBe("/scanner?workflowStep=market-scan");
  });

  it("Execution Preparation and Position Monitoring both carry the same known plan id", () => {
    expect(resolveWorkflowNavigationTarget("execution-preparation", 9).href).toBe(
      "/execution-lifecycle?planId=9&workflowStep=execution-preparation",
    );
    expect(resolveWorkflowNavigationTarget("position-monitoring", 9).href).toBe(
      "/execution-lifecycle?planId=9&workflowStep=position-monitoring",
    );
  });
});

describe("resolveStepLearnEntry — contextual Beginner Mode learning (#6, Sprint 2)", () => {
  it("resolves a real, already-existing registry entry for Research", () => {
    const entry = resolveStepLearnEntry("research");
    expect(entry).not.toBeNull();
    expect(entry!.pathKey).toBe("trading-engine");
    expect(entry!.topicKey).toBe("trading-market-structure");
  });

  it("resolves a real, already-existing registry entry for Trade Planning", () => {
    const entry = resolveStepLearnEntry("trade-planning");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("ai-trade-plan");
  });

  it("resolves a real, already-existing registry entry for Trade Journal", () => {
    const entry = resolveStepLearnEntry("trade-journal");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("trading-journal");
  });

  it("never fabricates a topic for a step with no unambiguous existing match", () => {
    expect(resolveStepLearnEntry("morning-brief")).toBeNull();
    expect(resolveStepLearnEntry("market-scan")).toBeNull();
    expect(resolveStepLearnEntry("opportunity-review")).toBeNull();
    expect(resolveStepLearnEntry("decision-risk-review")).toBeNull();
    expect(resolveStepLearnEntry("execution-preparation")).toBeNull();
    expect(resolveStepLearnEntry("execution")).toBeNull();
    expect(resolveStepLearnEntry("position-monitoring")).toBeNull();
    expect(resolveStepLearnEntry("daily-review")).toBeNull();
  });
});

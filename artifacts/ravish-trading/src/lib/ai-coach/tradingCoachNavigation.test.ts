// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Smart Navigation
// mapping tests (#7 smart-nav correctness, #8 entity-id preservation).

import { describe, it, expect } from "vitest";
import { resolveWorkflowNavigationTarget } from "./tradingCoachNavigation";
import { DAILY_WORKFLOW_STEP_ORDER } from "./tradingCoachWorkflow";

describe("resolveWorkflowNavigationTarget — smart navigation correctness (#7)", () => {
  it("every one of the 11 steps resolves to a real, non-empty path", () => {
    for (const stepId of DAILY_WORKFLOW_STEP_ORDER) {
      const target = resolveWorkflowNavigationTarget(stepId, null);
      expect(target.path.startsWith("/")).toBe(true);
      expect(target.destinationLabel.length).toBeGreaterThan(0);
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
    expect(target.href).toBe("/decision-workflow?planId=42");
  });

  it("never fabricates a planId in the URL when none is known", () => {
    const target = resolveWorkflowNavigationTarget("decision-risk-review", null);
    expect(target.href).toBe("/decision-workflow");
    expect(target.href).not.toContain("planId");
  });

  it("never appends a planId to a step whose destination page doesn't honestly support one", () => {
    const target = resolveWorkflowNavigationTarget("market-scan", 42);
    expect(target.href).toBe("/scanner");
  });

  it("Execution Preparation and Position Monitoring both carry the same known plan id", () => {
    expect(resolveWorkflowNavigationTarget("execution-preparation", 9).href).toBe("/execution-lifecycle?planId=9");
    expect(resolveWorkflowNavigationTarget("position-monitoring", 9).href).toBe("/execution-lifecycle?planId=9");
  });
});

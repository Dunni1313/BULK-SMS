// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// WORKFLOW CENTER. A static, deterministic catalog of institutional review
// processes (WORKFLOW_CATALOG below) plus per-user progress tracking
// against that catalog. Every workflow only guides the user through
// EXISTING modules already built in prior phases — each step is nothing
// more than a label, a short description, and a deep link to an
// already-shipped page. There is no recommendation logic, no automation,
// and no scoring anywhere in this file: "completing" a step is a plain
// user-driven checkbox toggle, and a workflow instance's status flipping
// to "completed" is a deterministic computation (every step in the
// catalog's own step list has been checked off) — bookkeeping over a
// user's own explicit actions, never automation of any trading/execution
// behaviour.

import { db, portfolioWorkflowInstancesTable, type PortfolioWorkflowInstanceRow } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

export interface WorkflowStepDefinition {
  key: string;
  label: string;
  detail: string;
  linkPath: string;
}

export interface WorkflowDefinition {
  key: string;
  title: string;
  description: string;
  cadence: "ad_hoc" | "daily" | "weekly" | "monthly" | "quarterly";
  steps: WorkflowStepDefinition[];
}

// The 9 kickoff-named example workflows. Every step's linkPath resolves to
// an already-shipped page from an earlier phase — never a new analytical
// surface introduced by this file.
export const WORKFLOW_CATALOG: WorkflowDefinition[] = [
  {
    key: "morning_review",
    title: "Morning Review",
    description: "A quick daily pass over overnight changes: outstanding issues, watchlist moves, new risk alerts, and any fresh compliance breaches.",
    cadence: "daily",
    steps: [
      { key: "check_outstanding_issues", label: "Review Outstanding Issues", detail: "Scan the Portfolio Workspace's own merged Outstanding Issues list for anything new overnight.", linkPath: "/portfolio-workspace" },
      { key: "check_watchlists", label: "Scan Watchlists for overnight moves", detail: "Open the Watchlists Overview and check for target crossings or compliance flags on watched symbols.", linkPath: "/watchlists-engine" },
      { key: "check_risk", label: "Check Risk Overview for new alerts", detail: "Confirm no new concentration, correlation, or drawdown alerts appeared on the Risk & Exposure Engine.", linkPath: "/risk-exposure-engine" },
      { key: "check_compliance", label: "Confirm no new Compliance breaches", detail: "Review the Monitoring & Compliance Engine's own policy violations list.", linkPath: "/monitoring-compliance-engine" },
    ],
  },
  {
    key: "weekly_review",
    title: "Weekly Review",
    description: "A weekly pass over performance, scenario resilience, and watchlists, closing with a check of what was reported this week.",
    cadence: "weekly",
    steps: [
      { key: "review_performance", label: "Review Performance Overview", detail: "Check the Performance & Attribution Engine's own investing/trading/options breakdown for the week.", linkPath: "/performance-attribution-engine" },
      { key: "review_scenario", label: "Review Scenario & Stress Testing results", detail: "Re-run or review the platform's own default shock scenarios for the current portfolio.", linkPath: "/scenario-engine" },
      { key: "review_watchlists", label: "Review Watchlists Overview", detail: "Check Watchlist Health and the Opportunity Overview for every watched symbol.", linkPath: "/watchlists-engine" },
      { key: "review_reports", label: "Check Recent Reports", detail: "Confirm this week's reports were generated and saved to the Reporting Centre.", linkPath: "/reporting-centre" },
    ],
  },
  {
    key: "monthly_review",
    title: "Monthly Review",
    description: "A monthly pass over rebalancing drift, diversification, and full compliance, closing with a generated Institutional Review Report.",
    cadence: "monthly",
    steps: [
      { key: "review_rebalancing", label: "Review Rebalancing Engine for drift", detail: "Check every Investing portfolio's own target-weight drift against the platform's rebalancing threshold.", linkPath: "/rebalancing-engine" },
      { key: "review_diversification", label: "Review Diversification (Decision Support)", detail: "Review the Decision Support Engine's own Investing/Options diversification scores.", linkPath: "/decision-support-engine" },
      { key: "review_compliance", label: "Full Compliance Review", detail: "Walk every enabled policy category on the Monitoring & Compliance Engine.", linkPath: "/monitoring-compliance-engine" },
      { key: "generate_report", label: "Generate Institutional Review Report", detail: "Save an Institutional Review Report to the Reporting Centre as this month's record.", linkPath: "/reporting-centre" },
    ],
  },
  {
    key: "quarterly_review",
    title: "Quarterly Review",
    description: "The most thorough review cycle: a full pass across every overview on the Portfolio Workspace, closing with a generated Institutional Review Report.",
    cadence: "quarterly",
    steps: [
      { key: "full_portfolio_snapshot", label: "Review full Portfolio Snapshot", detail: "Review the Portfolio Workspace's own Executive Home and Portfolio Snapshot in full.", linkPath: "/portfolio-workspace" },
      { key: "full_risk_review", label: "Full Risk Overview review", detail: "Review the Risk & Exposure Engine's own Investing/Trading/Options views in full.", linkPath: "/risk-exposure-engine" },
      { key: "full_performance_review", label: "Full Performance Overview review", detail: "Review the Performance & Attribution Engine's own Investing/Trading/Options views in full.", linkPath: "/performance-attribution-engine" },
      { key: "full_compliance_review", label: "Full Compliance Overview review", detail: "Review every policy category on the Monitoring & Compliance Engine.", linkPath: "/monitoring-compliance-engine" },
      { key: "generate_report", label: "Generate Institutional Review Report", detail: "Save an Institutional Review Report to the Reporting Centre as this quarter's record.", linkPath: "/reporting-centre" },
    ],
  },
  {
    key: "portfolio_review",
    title: "Portfolio Review",
    description: "A holdings-focused review: current allocation, drift, and overall executive health.",
    cadence: "ad_hoc",
    steps: [
      { key: "review_holdings", label: "Review Holdings Overview", detail: "Review the Portfolio Workspace's own Holdings Overview for market value and top allocations.", linkPath: "/portfolio-workspace" },
      { key: "review_allocation", label: "Review Rebalancing / Allocation", detail: "Check target-weight drift on the Rebalancing Engine.", linkPath: "/rebalancing-engine" },
      { key: "review_health", label: "Review Executive Health", detail: "Review the Decision Support Engine's own Executive Health composite.", linkPath: "/decision-support-engine" },
    ],
  },
  {
    key: "risk_review",
    title: "Risk Review",
    description: "A focused review of risk, scenario impact, and concentration/correlation.",
    cadence: "ad_hoc",
    steps: [
      { key: "review_risk_overview", label: "Review Risk Overview", detail: "Review the Risk & Exposure Engine's own combined risk view.", linkPath: "/risk-exposure-engine" },
      { key: "review_scenario", label: "Review Scenario impact", detail: "Review how the current portfolio holds up under the platform's own default shock scenarios.", linkPath: "/scenario-engine" },
      { key: "review_concentration", label: "Review Concentration / Correlation", detail: "Review the Correlation & Concentration Risk page for any single-name or sector concentration.", linkPath: "/concentration-risk" },
    ],
  },
  {
    key: "compliance_review",
    title: "Compliance Review",
    description: "A full walk of every configured compliance policy category.",
    cadence: "ad_hoc",
    steps: [
      { key: "review_policy_violations", label: "Review policy violations", detail: "Review every currently-breached policy on the Monitoring & Compliance Engine.", linkPath: "/monitoring-compliance-engine" },
      { key: "review_greeks_limits", label: "Review Greeks limits", detail: "Review any configured Options Greeks exposure policies.", linkPath: "/monitoring-compliance-engine" },
      { key: "review_buying_power", label: "Review buying power limits", detail: "Review any configured buying-power policies.", linkPath: "/monitoring-compliance-engine" },
    ],
  },
  {
    key: "performance_review",
    title: "Performance Review",
    description: "A cross-engine review of Investing, Trading, and Options performance.",
    cadence: "ad_hoc",
    steps: [
      { key: "review_investing_performance", label: "Review Investing performance", detail: "Review holding-level unrealized P&L and attribution on the Performance & Attribution Engine.", linkPath: "/performance-attribution-engine" },
      { key: "review_trading_performance", label: "Review Trading performance", detail: "Review position-level realized P&L and win rate on the Performance & Attribution Engine.", linkPath: "/performance-attribution-engine" },
      { key: "review_options_performance", label: "Review Options performance", detail: "Review trade-level income and P&L on the Performance & Attribution Engine.", linkPath: "/performance-attribution-engine" },
    ],
  },
  {
    key: "scenario_review",
    title: "Scenario Review",
    description: "A focused review of market-shock resilience across every engine.",
    cadence: "ad_hoc",
    steps: [
      { key: "review_market_shocks", label: "Review market shock scenarios", detail: "Review the ±5%/±10% market scenarios across Investing and Trading holdings.", linkPath: "/scenario-engine" },
      { key: "review_stress_test", label: "Review the Options Stress Test", detail: "Review the Options portfolio's own before/after stress-test safety score.", linkPath: "/scenario-engine" },
      { key: "review_options_rate_scenarios", label: "Review Options rate scenarios", detail: "Review the Options portfolio's own interest-rate shock scenarios.", linkPath: "/scenario-engine" },
    ],
  },
];

export function getWorkflowDefinition(key: string): WorkflowDefinition | null {
  return WORKFLOW_CATALOG.find((w) => w.key === key) ?? null;
}

function toApi(row: PortfolioWorkflowInstanceRow) {
  const definition = getWorkflowDefinition(row.workflowKey);
  return {
    id: row.id,
    workflowKey: row.workflowKey,
    title: definition?.title ?? row.workflowKey,
    status: row.status,
    completedStepKeys: row.completedStepKeys,
    totalSteps: definition?.steps.length ?? 0,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type WorkflowInstanceView = ReturnType<typeof toApi>;

export async function startWorkflowInstance(userId: string, workflowKey: string): Promise<WorkflowInstanceView | null> {
  if (!getWorkflowDefinition(workflowKey)) return null;
  const [row] = await db
    .insert(portfolioWorkflowInstancesTable)
    .values({ userId, workflowKey })
    .returning();
  return toApi(row);
}

export async function listWorkflowInstances(userId: string, status?: string): Promise<WorkflowInstanceView[]> {
  const rows = status
    ? await db
        .select()
        .from(portfolioWorkflowInstancesTable)
        .where(and(eq(portfolioWorkflowInstancesTable.userId, userId), eq(portfolioWorkflowInstancesTable.status, status)))
        .orderBy(desc(portfolioWorkflowInstancesTable.startedAt))
    : await db
        .select()
        .from(portfolioWorkflowInstancesTable)
        .where(eq(portfolioWorkflowInstancesTable.userId, userId))
        .orderBy(desc(portfolioWorkflowInstancesTable.startedAt));
  return rows.map(toApi);
}

export async function getWorkflowInstance(userId: string, id: number): Promise<WorkflowInstanceView | null> {
  const [row] = await db
    .select()
    .from(portfolioWorkflowInstancesTable)
    .where(and(eq(portfolioWorkflowInstancesTable.id, id), eq(portfolioWorkflowInstancesTable.userId, userId)));
  return row ? toApi(row) : null;
}

// Toggles one step's completion. When every step in the catalog's own step
// list is now complete, the instance's status is deterministically flipped
// to "completed" — a bookkeeping computation over the user's own checklist
// actions, never automation of any trading/execution behaviour.
export async function updateWorkflowInstanceStep(userId: string, id: number, stepKey: string, completed: boolean): Promise<WorkflowInstanceView | null> {
  const [existing] = await db
    .select()
    .from(portfolioWorkflowInstancesTable)
    .where(and(eq(portfolioWorkflowInstancesTable.id, id), eq(portfolioWorkflowInstancesTable.userId, userId)));
  if (!existing) return null;
  const definition = getWorkflowDefinition(existing.workflowKey);
  if (!definition || !definition.steps.some((s) => s.key === stepKey)) return null;

  const nextCompleted = new Set(existing.completedStepKeys);
  if (completed) nextCompleted.add(stepKey);
  else nextCompleted.delete(stepKey);
  const completedStepKeys = [...nextCompleted];

  const allStepsDone = definition.steps.every((s) => completedStepKeys.includes(s.key));
  const nextStatus = allStepsDone ? "completed" : existing.status === "completed" ? "active" : existing.status;

  const [row] = await db
    .update(portfolioWorkflowInstancesTable)
    .set({
      completedStepKeys,
      status: nextStatus,
      completedAt: allStepsDone ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(portfolioWorkflowInstancesTable.id, id), eq(portfolioWorkflowInstancesTable.userId, userId)))
    .returning();
  return toApi(row);
}

export async function setWorkflowInstanceStatus(userId: string, id: number, status: "active" | "abandoned"): Promise<WorkflowInstanceView | null> {
  const [row] = await db
    .update(portfolioWorkflowInstancesTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(portfolioWorkflowInstancesTable.id, id), eq(portfolioWorkflowInstancesTable.userId, userId)))
    .returning();
  return row ? toApi(row) : null;
}

export async function deleteWorkflowInstance(userId: string, id: number): Promise<boolean> {
  const [row] = await db
    .delete(portfolioWorkflowInstancesTable)
    .where(and(eq(portfolioWorkflowInstancesTable.id, id), eq(portfolioWorkflowInstancesTable.userId, userId)))
    .returning({ id: portfolioWorkflowInstancesTable.id });
  return !!row;
}

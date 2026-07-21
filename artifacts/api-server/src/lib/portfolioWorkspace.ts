// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// PURE COMPOSITION LAYER. ORCHESTRATION AND WORKFLOW ONLY. Zero trade
// recommendations, zero buy/sell signals, zero AI predictions, zero
// portfolio optimisation, zero auto execution, zero auto hedging, zero
// machine learning, zero market forecasting. Every figure below is reused
// verbatim from an already-shipped, already-tested engine:
//   - lib/decisionSupportEngine.ts's buildDecisionSupportDashboard()
//     (Phase 40) — Executive Home + Portfolio Snapshot (executive summary,
//     portfolio health overview, risk/performance/scenario/capital-
//     allocation/exposure/diversification summaries, executive alerts,
//     outstanding issues, key metrics, executive health). Reused WHOLESALE,
//     never recomputed.
//   - lib/riskExposureEngine.ts's buildRiskExposureDashboard() (Phase 37)
//     — the full Risk Overview (Investing/Trading/Options/Combined).
//   - lib/performanceAttribution.ts's buildPerformanceDashboard() (Phase 38)
//     — the full Performance Overview.
//   - lib/rebalancingEngine.ts's buildRebalancingDashboard() (Phase 41) —
//     read only for its own already-computed per-holding rebalanceAction,
//     to surface a drifted-holdings headline count on Holdings Overview.
//   - lib/complianceEngine.ts's buildMonitoringComplianceDashboard()
//     (Phase 42) — Compliance Overview (a lean summary; full per-category
//     detail lives on its own dedicated page).
//   - lib/watchlistsEngine.ts's buildWatchlistsDashboard() (Phase 43) —
//     Watchlists Overview (a lean summary; the full Opportunity Overview
//     detail lives on its own dedicated page).
//
// Holdings/Trading/Options Overview are deliberately LEAN headline cards
// (counts, totals, top allocations) rather than a duplicate of the full
// Risk/Performance dashboards already exposed under their own named
// sections — avoiding re-serializing the same nested arrays twice under
// two different section names.
//
// Because every one of these dashboards is a whole-PORTFOLIO read (never a
// per-symbol external provider fetch), this entire workspace dashboard is
// built EAGERLY, in one call, matching lib/watchlistsEngine.ts's own
// established "reuse existing deterministic infrastructure, no N+1
// provider calls" precedent.

import { db, institutionalReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getSettingsRow } from "./serverState.js";
import { buildRiskExposureDashboard, type RiskExposureDashboard } from "./riskExposureEngine.js";
import { buildPerformanceDashboard, type PerformanceDashboard } from "./performanceAttribution.js";
import { buildDecisionSupportDashboard, type DecisionSupportDashboard } from "./decisionSupportEngine.js";
import { buildRebalancingDashboard } from "./rebalancingEngine.js";
import { buildMonitoringComplianceDashboard, type ComplianceSummary, type PolicyEvaluation } from "./complianceEngine.js";
import { buildWatchlistsDashboard, type WatchlistSummary, type WatchlistHealthEntry, type WatchlistsCrossEngineSummary, type WatchlistsDashboardSummary } from "./watchlistsEngine.js";
import { buildReportingSummary, type ExecutiveReportingSummary } from "./executiveIntelligence.js";
import { listWorkflowInstances, type WorkflowInstanceView } from "./portfolioWorkflows.js";

// ─── Holdings / Trading / Options Overview (lean headline cards) ───────────

export interface HoldingsOverview {
  portfoliosCount: number;
  holdingsCount: number;
  totalMarketValue: number | null;
  totalUnrealizedPnl: number | null;
  totalUnrealizedPnlPct: number | null;
  topAllocations: { symbol: string; marketValue: number | null; weightPct: number | null }[];
  driftedHoldingsCount: number;
  summary: string;
}

const TOP_ALLOCATIONS_LIMIT = 5;

function buildHoldingsOverview(risk: RiskExposureDashboard, performance: PerformanceDashboard, driftedHoldingsCount: number): HoldingsOverview {
  const topAllocations = [...risk.investing.allocationBySymbol]
    .filter((a) => a.weightPct != null)
    .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))
    .slice(0, TOP_ALLOCATIONS_LIMIT);

  const summary =
    risk.investing.holdingsCount === 0
      ? "No Investing holdings on record yet."
      : `${risk.investing.holdingsCount} holding(s) across ${risk.investing.portfolioCount} portfolio(s). ${driftedHoldingsCount} holding(s) have drifted from their own target weight.`;

  return {
    portfoliosCount: risk.investing.portfolioCount,
    holdingsCount: risk.investing.holdingsCount,
    totalMarketValue: performance.investing.totalMarketValue,
    totalUnrealizedPnl: performance.investing.totalUnrealizedPnl,
    totalUnrealizedPnlPct: performance.investing.totalUnrealizedPnlPct,
    topAllocations,
    driftedHoldingsCount,
    summary,
  };
}

export interface TradingOverview {
  openPositionsCount: number;
  accountValue: number | null;
  stopTargetDisciplinePct: number | null;
  totalRealizedPnl: number | null;
  winRate: number | null;
  summary: string;
}

function buildTradingOverview(risk: RiskExposureDashboard, performance: PerformanceDashboard): TradingOverview {
  const disciplinePct = risk.trading.risk.stopDiscipline.score;
  const summary =
    risk.trading.openPositionsCount === 0
      ? "No open Trading positions on record."
      : `${risk.trading.openPositionsCount} open position(s), ${disciplinePct != null ? `${disciplinePct}%` : "n/a"} stop/target discipline.`;

  return {
    openPositionsCount: risk.trading.openPositionsCount,
    accountValue: risk.trading.accountValue,
    stopTargetDisciplinePct: disciplinePct,
    totalRealizedPnl: performance.trading.totalRealizedPnl,
    winRate: performance.trading.winRate,
    summary,
  };
}

export interface OptionsOverview {
  openPositionsCount: number;
  portfolioValue: number | null;
  buyingPower: number | null;
  totalRealizedPnl: number | null;
  winRate: number | null;
  summary: string;
}

function buildOptionsOverview(risk: RiskExposureDashboard, performance: PerformanceDashboard): OptionsOverview {
  const summary =
    risk.options.dashboard.openPositionsCount === 0
      ? "No open Options positions on record."
      : `${risk.options.dashboard.openPositionsCount} open position(s), portfolio value $${risk.options.dashboard.portfolioValue.toLocaleString()}.`;

  return {
    openPositionsCount: risk.options.dashboard.openPositionsCount,
    portfolioValue: risk.options.dashboard.portfolioValue,
    buyingPower: risk.options.dashboard.buyingPower,
    totalRealizedPnl: performance.options.totalRealizedPnl,
    winRate: performance.options.winRate,
    summary,
  };
}

// ─── Compliance / Watchlists Overview (lean summaries) ──────────────────────

export interface ComplianceOverview {
  complianceSummary: ComplianceSummary;
  policyViolations: PolicyEvaluation[];
  generatedAt: string;
}

export interface WatchlistsOverview {
  watchlists: WatchlistSummary[];
  watchlistHealth: WatchlistHealthEntry[];
  crossEngineSummary: WatchlistsCrossEngineSummary;
  dashboardSummary: WatchlistsDashboardSummary;
  generatedAt: string;
}

// ─── Recent Reports ──────────────────────────────────────────────────────

const RECENT_REPORTS_LIMIT = 10;

async function loadRecentReports(userId: string): Promise<ExecutiveReportingSummary> {
  const rows = await db
    .select({ id: institutionalReportsTable.id, reportType: institutionalReportsTable.reportType, title: institutionalReportsTable.title, createdAt: institutionalReportsTable.createdAt })
    .from(institutionalReportsTable)
    .where(eq(institutionalReportsTable.userId, userId))
    .orderBy(desc(institutionalReportsTable.createdAt));
  return buildReportingSummary(rows, RECENT_REPORTS_LIMIT);
}

// ─── Outstanding Issues (merged across 3 engines' own already-computed
// issues — pure relabel + concat, never a new score) ────────────────────

export interface WorkspaceOutstandingIssue {
  source: "decision-support" | "watchlists" | "compliance";
  code: string;
  label: string;
  detail: string;
  linkPath: string;
}

function mergeOutstandingIssues(decisionSupport: DecisionSupportDashboard, watchlistsSummary: WatchlistsDashboardSummary, compliance: ComplianceOverview): WorkspaceOutstandingIssue[] {
  const issues: WorkspaceOutstandingIssue[] = [];

  for (const i of decisionSupport.outstandingIssues) {
    issues.push({ source: "decision-support", code: i.code, label: i.label, detail: i.detail, linkPath: "/decision-support-engine" });
  }
  for (const s of watchlistsSummary.outstandingIssues) {
    issues.push({ source: "watchlists", code: "watchlist_issue", label: "Watchlists", detail: s, linkPath: "/watchlists-engine" });
  }
  for (const p of compliance.policyViolations) {
    issues.push({ source: "compliance", code: `policy_breach_${p.policyId}`, label: p.label, detail: p.detail, linkPath: "/monitoring-compliance-engine" });
  }
  return issues;
}

// ─── Full workspace composition ─────────────────────────────────────────

export interface PortfolioWorkspaceDashboard {
  executiveHome: DecisionSupportDashboard["executiveSummary"];
  portfolioSnapshot: DecisionSupportDashboard;
  holdingsOverview: HoldingsOverview;
  tradingOverview: TradingOverview;
  optionsOverview: OptionsOverview;
  riskOverview: RiskExposureDashboard;
  performanceOverview: PerformanceDashboard;
  complianceOverview: ComplianceOverview;
  watchlistsOverview: WatchlistsOverview;
  recentReports: ExecutiveReportingSummary;
  activeWorkflows: WorkflowInstanceView[];
  outstandingIssues: WorkspaceOutstandingIssue[];
  generatedAt: string;
}

export async function buildPortfolioWorkspaceDashboard(userId: string): Promise<PortfolioWorkspaceDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert
  // with no upsert safety — a known, pre-existing dormant race for a
  // brand-new user, first documented in lib/riskExposureEngine.ts (Phase
  // 37) and repeated in every later composition layer through Phase 43.
  // This workspace fans out even more concurrent settings-touching reads
  // than any prior dashboard, so the same guard applies: resolve the
  // settings row once, up front.
  await getSettingsRow(userId);

  const [risk, performance, decisionSupport, rebalancing, compliance, watchlists, recentReports, activeWorkflows] = await Promise.all([
    buildRiskExposureDashboard(userId),
    buildPerformanceDashboard(userId),
    buildDecisionSupportDashboard(userId),
    buildRebalancingDashboard(userId),
    buildMonitoringComplianceDashboard(userId),
    buildWatchlistsDashboard(userId),
    loadRecentReports(userId),
    listWorkflowInstances(userId, "active"),
  ]);

  const driftedHoldingsCount = rebalancing.portfolios.reduce(
    (s, p) => s + p.allocation.holdings.filter((h) => h.rebalanceAction === "buy" || h.rebalanceAction === "sell").length,
    0,
  );

  const complianceOverview: ComplianceOverview = {
    complianceSummary: compliance.complianceSummary,
    policyViolations: compliance.policyViolations,
    generatedAt: compliance.generatedAt,
  };

  const watchlistsOverview: WatchlistsOverview = {
    watchlists: watchlists.watchlists,
    watchlistHealth: watchlists.watchlistHealth,
    crossEngineSummary: watchlists.crossEngineSummary,
    dashboardSummary: watchlists.dashboardSummary,
    generatedAt: watchlists.generatedAt,
  };

  const outstandingIssues = mergeOutstandingIssues(decisionSupport, watchlists.dashboardSummary, complianceOverview);

  return {
    executiveHome: decisionSupport.executiveSummary,
    portfolioSnapshot: decisionSupport,
    holdingsOverview: buildHoldingsOverview(risk, performance, driftedHoldingsCount),
    tradingOverview: buildTradingOverview(risk, performance),
    optionsOverview: buildOptionsOverview(risk, performance),
    riskOverview: risk,
    performanceOverview: performance,
    complianceOverview,
    watchlistsOverview,
    recentReports,
    activeWorkflows,
    outstandingIssues,
    generatedAt: new Date().toISOString(),
  };
}

// Phase 22 — Institutional Reporting & Client Presentation Engine.
//
// PURE COMPOSITION LAYER. ZERO NEW VALUATION MODELS, SCORING SYSTEMS, OR
// RECOMMENDATIONS ARE CREATED IN THIS FILE. Every section below either (a)
// is lifted verbatim from ValueResearchReport.sections — the same
// ReportSection[] valueReport.ts (Phase 2) already builds and already
// exposes via the ValueReportSection OpenAPI schema — or (b) is a thin
// ReportSection-shaped reformatting of fields an already-shipped,
// already-tested engine already computed:
//
//   - ValueResearchReport (valueReport.ts, Phase 2)              — business quality, financial
//     strength, valuation, margin of safety, investment committee sections, reused as-is.
//   - InstitutionalDecisionAnalysis (decisionEngine.ts, Phase 14) — decision, evidence, portfolio fit.
//   - InvestmentMemo (investmentMemo.ts, Phase 19)                — the full formal memo document.
//   - CoachExplanation (investingCoach.ts, Phase 21)              — AI Coach explanations.
//   - PortfolioIntelligenceAnalysis (portfolioIntelligence.ts, Phase 13)
//   - PortfolioOptimisationAnalysis (portfolioOptimisation.ts, Phase 2 Sprint 28-area)
//   - OpportunityScanResult / OpportunityBucket (opportunityDiscovery.ts)
//   - platform_notifications rows (Monitoring & Alerts)
//   - WatchlistTargetCheck (watchlistTargets.ts)
//   - CrossEngineDailyReport (crossEngineDailyReport.ts, Phase 5 Sprint 68)
//   - LearningProgressSummary (learningProgress.ts, Phase 21 Learning Centre)
//
// The output shape, InstitutionalReport, reuses the existing ReportSection
// {id, title, body, bullets?} shape everywhere — never a new section shape.
// "Section Selector" in the UI is a pure client-side filter over the
// section ids a report already returns; there is no server-side subsetting
// parameter, since every section here is cheap, pure string composition —
// zero extra provider calls beyond what the caller already made to resolve
// the underlying engine outputs passed in.

import type { ReportSection, ValueResearchReport } from "./valueReport.js";
import type { InstitutionalDecisionAnalysis } from "./decisionEngine.js";
import type { InvestmentMemo, InvestmentMemoResearchNote, InvestmentMemoMonitoringAlert } from "./investmentMemo.js";
import type { CoachExplanation } from "./investingCoach.js";
import type { PortfolioIntelligenceAnalysis } from "./portfolioIntelligence.js";
import type { PortfolioOptimisationAnalysis } from "./portfolioOptimisation.js";
import type { OpportunityScanResult, OpportunityBucket } from "./opportunityDiscovery.js";
import type { CrossEngineDailyReport } from "./crossEngineDailyReport.js";
import type { LearningProgressSummary } from "./learningProgress.js";
import type { WatchlistTargetCheck } from "./watchlistTargets.js";
import type { TradingRiskAnalysis } from "./tradingRisk.js";
import { toStrategyLearningSummary, type StrategyMetadata, type StrategyLearningSummary } from "./tradingStrategyFramework.js";
import type { TradingAnalyticsDashboard } from "./tradingAnalytics.js";
import type { ExecutiveIntelligenceHub } from "./executiveIntelligence.js";
import type { OptionsIncomeDashboard } from "./optionsIncomeAnalytics.js";
import type { OptionsPortfolioManagementView } from "./optionsPortfolioManagement.js";
import type { LifecycleSummary } from "./optionsLifecycle.js";
import type { RiskExposureDashboard } from "./riskExposureEngine.js";
import type { PerformanceDashboard } from "./performanceAttribution.js";
import { DEFAULT_SCENARIOS, type ScenarioDashboard } from "./scenarioEngine.js";
import type { DecisionSupportDashboard } from "./decisionSupportEngine.js";
import type { RebalancingDashboard, ProposedAllocationComparison } from "./rebalancingEngine.js";
import { REBALANCE_DRIFT_THRESHOLD_PCT } from "./portfolioConstruction.js";
import type { MonitoringComplianceDashboard, PolicyEvaluation } from "./complianceEngine.js";
import type { WatchlistsDashboard, SymbolAnalytics } from "./watchlistsEngine.js";
import type { PortfolioWorkspaceDashboard } from "./portfolioWorkspace.js";

export type InstitutionalReportType =
  | "investment-committee"
  | "company-research"
  | "portfolio-review"
  | "portfolio-health"
  | "watchlist"
  | "opportunity-discovery"
  | "monitoring-summary"
  | "ai-coach-summary"
  | "executive-summary"
  | "trade-planning-summary"
  | "strategy-framework-summary"
  | "trading-analytics-summary"
  | "executive-intelligence-summary"
  | "options-income-summary"
  | "options-portfolio-review"
  | "position-lifecycle-summary"
  | "risk-exposure-summary"
  | "portfolio-concentration-report"
  | "performance-summary"
  | "performance-attribution-report"
  | "scenario-analysis-report"
  | "stress-test-report"
  | "executive-decision-summary"
  | "institutional-health-report"
  | "portfolio-allocation-report"
  | "rebalancing-planning-report"
  | "compliance-report"
  | "policy-monitoring-report"
  | "watchlist-summary-report"
  | "opportunity-dashboard-report"
  | "portfolio-workspace-summary"
  | "institutional-review-report";

export const REPORT_TYPES: InstitutionalReportType[] = [
  "investment-committee",
  "company-research",
  "portfolio-review",
  "portfolio-health",
  "watchlist",
  "opportunity-discovery",
  "monitoring-summary",
  "ai-coach-summary",
  "executive-summary",
  "trade-planning-summary",
  "strategy-framework-summary",
  "trading-analytics-summary",
  "executive-intelligence-summary",
  "options-income-summary",
  "options-portfolio-review",
  "position-lifecycle-summary",
  "risk-exposure-summary",
  "portfolio-concentration-report",
  "performance-summary",
  "performance-attribution-report",
  "scenario-analysis-report",
  "stress-test-report",
  "executive-decision-summary",
  "institutional-health-report",
  "portfolio-allocation-report",
  "rebalancing-planning-report",
  "compliance-report",
  "policy-monitoring-report",
  "watchlist-summary-report",
  "opportunity-dashboard-report",
  "portfolio-workspace-summary",
  "institutional-review-report",
];

export interface ReportTypeMeta {
  reportType: InstitutionalReportType;
  label: string;
  description: string;
  requiresSymbol: boolean;
  requiresPortfolio: boolean;
}

export const REPORT_TYPE_META: ReportTypeMeta[] = [
  {
    reportType: "investment-committee",
    label: "Investment Committee Report",
    description: "The Investment Committee's consolidated verdict, the Decision Engine's synthesis, and the supporting evidence for a single security.",
    requiresSymbol: true,
    requiresPortfolio: false,
  },
  {
    reportType: "company-research",
    label: "Single Company Research Report",
    description: "The full institutional research picture for one security — business quality, financial strength, valuation, margin of safety, decision, committee, portfolio impact, and the formal Investment Memo.",
    requiresSymbol: true,
    requiresPortfolio: false,
  },
  {
    reportType: "portfolio-review",
    label: "Portfolio Review Report",
    description: "Portfolio Optimisation's own health, diversification, position-quality ranking, and upgrade/trim/exit candidates for a selected portfolio.",
    requiresSymbol: false,
    requiresPortfolio: true,
  },
  {
    reportType: "portfolio-health",
    label: "Portfolio Health Report",
    description: "Portfolio Intelligence's own quality/capital-allocation/diversification scores, allocation mix, risk, income, and performance for a selected portfolio.",
    requiresSymbol: false,
    requiresPortfolio: true,
  },
  {
    reportType: "watchlist",
    label: "Watchlist Report",
    description: "Every Watchlist item's own price/margin-of-safety target status.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "opportunity-discovery",
    label: "Opportunity Discovery Report",
    description: "The Opportunity Discovery scan's own buckets (Top Opportunities, Undervalued, High Quality, and so on).",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "monitoring-summary",
    label: "Monitoring Summary Report",
    description: "The user's own recorded monitoring alerts across every symbol.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "ai-coach-summary",
    label: "AI Coach Learning Summary",
    description: "The Learning Centre's own progress tracker — lessons, glossary, strategies, coach explanations viewed, path completion, and quiz performance.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "executive-summary",
    label: "Executive Summary",
    description: "The Cross-Engine Daily Report's own one-pager — macro context, watchlist crossings, trading risk, and options-income portfolio health.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "trade-planning-summary",
    label: "Trade Planning Summary Report",
    description: "The calling user's own Trade Plans (Institutional Trade Planning & Risk Studio) and Trading Risk analysis — position sizing, stop/target discipline, and portfolio risk budget.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "strategy-framework-summary",
    label: "Strategy Framework Summary Report",
    description: "The calling user's own registered Strategy Framework entries (Phase 30) — metadata, required evidence, and checklist-instance completion, never a strategy's own trading logic.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "trading-analytics-summary",
    label: "Trading Analytics Summary Report",
    description: "The calling user's own Trading Analytics Engine (Phase 32) — trades reviewed, strategy/checklist usage, journal, risk, learning, coach, and session activity. Pure aggregation of already-persisted data, never a signal or prediction.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "executive-intelligence-summary",
    label: "Executive Intelligence Summary Report",
    description: "The calling user's own unified Executive Intelligence Hub (Phase 33) — a single cross-engine view combining the Investing Engine's and Trading Engine's own analytics, a cross-engine risk/learning/AI-coach rollup, a Reporting Centre tally, and a chronological Activity Timeline. Pure composition of already-persisted, already-computed data, never a new signal or prediction.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "options-income-summary",
    label: "Options Income Summary Report",
    description: "The calling user's own Options Income Engine (Phase 35) — open/closed position counts, capital allocated, realized and projected premium, strategy mix, and upcoming expirations. Pure aggregation of already-persisted trades and already-computed Greeks, never a P/L prediction or trade recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "options-portfolio-review",
    label: "Options Portfolio Review",
    description: "The calling user's own Options Portfolio Management view (Phase 36) — position concentration, strategy/sector allocation, the expiration ladder, capital and buying-power utilisation, and income allocation. Pure aggregation of already-computed portfolio analytics and Options Income Engine data, never a rebalancing recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "position-lifecycle-summary",
    label: "Position Lifecycle Summary",
    description: "The calling user's own Position Lifecycle Manager (Phase 36) — every open and closed position tallied by its own real lifecycle stage (Draft/Planned/Open/Monitoring/Near Expiration/Assignment Risk/Closed/Archived) and how many positions are currently awaiting review. Pure tally of already-recorded, explicitly user-set lifecycle state, never an automated stage assessment.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "risk-exposure-summary",
    label: "Risk & Exposure Summary",
    description: "The calling user's own Institutional Risk & Exposure Intelligence Engine (Phase 37) — capital allocation, buying power, and Greeks summary across Investing, Trading, and Options, plus each engine's own overall risk read and the disclosed, non-fabricated cross-engine symbol overlap. Pure aggregation of already-computed per-engine risk analyses, never a hedging or rebalancing recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "portfolio-concentration-report",
    label: "Portfolio Concentration Report",
    description: "The calling user's own cross-engine concentration picture (Phase 37) — sector concentration (Investing + Options), strategy concentration (Options), asset allocation across all 3 engines, and a real concentration timeline from saved Investing risk snapshots and the Options Exposure Timeline. Pure aggregation of already-computed concentration figures, never a diversification recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "performance-summary",
    label: "Performance Summary Report",
    description: "The calling user's own Institutional Performance & Attribution Engine (Phase 38) — real Investing unrealized P&L, Trading and Options realized P&L, win rate, average win/loss, and the Combined cross-engine return-by-engine view. Pure aggregation of already-persisted, real trade/holding data, never a forecast or trade recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "performance-attribution-report",
    label: "Performance Attribution Report",
    description: "The calling user's own cross-engine performance-attribution picture (Phase 38) — sector attribution (Investing), strategy attribution (Trading + Options), asset attribution across all 3 engines, risk-adjusted performance (trade-return-based Sharpe/Sortino), capital efficiency, and a real Historical Performance Timeline. Pure aggregation of already-computed attribution figures, never an optimisation recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "scenario-analysis-report",
    label: "Scenario Analysis Report",
    description: "The calling user's own Institutional Scenario & Stress Testing Engine (Phase 39) — every default deterministic scenario (Market ±5%/±10%, Volatility Increase/Decrease, Interest Rate Increase/Decrease) evaluated as a hypothetical repricing across Investing, Trading, and Options, with Portfolio/Asset/Sector/Strategy Impact and a side-by-side Scenario Comparison. Analytical only — no forecasting, no probability estimates, never a trade recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "stress-test-report",
    label: "Stress Test Report",
    description: "The calling user's own Options portfolio evaluated under the platform's named severe scenarios (Market -5%, Market -10%, Volatility Increase) via the existing What-If Stress Test engine (Black-Scholes repricing) — Greeks Impact, Buying Power Impact, and Capital Impact under stress. Analytical only — no forecasting, no probability estimates, never a hedging recommendation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "executive-decision-summary",
    label: "Executive Decision Summary",
    description: "The calling user's own Institutional Decision Support & Executive Insights Engine (Phase 40) — Executive Summary, Portfolio Health Overview, deterministic Executive Alerts, Outstanding Issues, and the Key Metrics Dashboard, consolidated across Investing, Trading, and Options. Interpretation only — no trade recommendations, no buy/sell signals, no portfolio optimisation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "institutional-health-report",
    label: "Institutional Health Report",
    description: "The calling user's own cross-engine health picture (Phase 40) — Portfolio Health Overview, Risk Summary, Diversification Summary, and the 11-dimension Executive Health scorecard, reused directly from the Risk & Exposure, Performance & Attribution, and Scenario & Stress Testing engines. Interpretation only — no AI predictions, no forecasting.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "portfolio-allocation-report",
    label: "Portfolio Allocation Report",
    description: "The calling user's own Rebalancing & Allocation Planning Engine (Phase 41) — Current vs. Target Allocation and Drift per Investing portfolio, plus cross-engine Sector/Asset/Strategy/Capital Allocation and the Allocation Timeline. Planning and analysis only — no trade recommendations, no automatic rebalancing.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "rebalancing-planning-report",
    label: "Rebalancing Planning Report",
    description: "The calling user's own Rebalancing Planner output for one Investing portfolio (Phase 41) — current allocation compared against a caller-supplied set of proposed target weights, including the dollar capital movement required to close each drift. Planning and analysis only — never a suggested trade or share count.",
    requiresSymbol: false,
    requiresPortfolio: true,
  },
  {
    reportType: "compliance-report",
    label: "Compliance Report",
    description: "The calling user's own Monitoring & Compliance Engine (Phase 42) — the Compliance Summary and every current Policy Violation, reused directly from the Risk & Exposure, Portfolio Concentration, and Options Income engines. Monitoring only — no trade recommendations, no auto-remediation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "policy-monitoring-report",
    label: "Policy Monitoring Report",
    description: "The calling user's own full Policy Monitoring detail (Phase 42) — every configured policy grouped by category (Allocation, Sector, Asset, Position, Strategy, Greeks, Buying Power, Income Stability, Diversification) with its current value, limit, difference, and status, plus the Compliance Timeline. Monitoring only — no trade recommendations, no portfolio optimisation.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "watchlist-summary-report",
    label: "Watchlist Summary Report",
    description: "The calling user's own Institutional Watchlists & Opportunity Dashboard (Phase 43) — every watchlist's own Watchlist Health, the Cross-Engine Summary, and the dashboard-level summary (Highest Risk, Highest Exposure, Highest Allocation, Policy Breaches, Scenario Impact, Performance Summary, Outstanding Issues). Distinct from the existing Watchlist Report, which covers the separate, single flat price/margin-of-safety watchlist. Monitoring and organisation only — no trade recommendations, no ranked/scored opportunity signal.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "opportunity-dashboard-report",
    label: "Opportunity Dashboard Report",
    description: "The calling user's own full per-symbol Opportunity Overview (Phase 43) — every distinct watched symbol's own allocation, performance, Greeks (where applicable), scenario impact, and compliance status, reused directly from the Risk & Exposure, Performance, Scenario, and Compliance engines. Distinct from the existing Opportunity Discovery Report, which is a universe-wide screening scan, not scoped to your own watchlists. Monitoring only — no trade recommendations, no ranked/scored opportunity signal.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "portfolio-workspace-summary",
    label: "Portfolio Workspace Summary Report",
    description: "The calling user's own Institutional Portfolio Workspace (Phase 44) — a concise headline reformat of Executive Home, Portfolio Snapshot, Holdings/Trading/Options Overview, and the merged Outstanding Issues list. Orchestration only — no trade recommendations, no AI predictions.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
  {
    reportType: "institutional-review-report",
    label: "Institutional Review Report",
    description: "The calling user's own deeper review record (Phase 44) — the report a portfolio manager would generate and archive at the end of a completed Workflow Center review cycle: Risk/Compliance/Watchlists Overview detail, Active Workflows, and every merged Outstanding Issue. Orchestration only — no trade recommendations, no AI predictions.",
    requiresSymbol: false,
    requiresPortfolio: false,
  },
];

export const REPORT_DISCLAIMER =
  "Institutional Reporting — Evidence Based, Deterministic, Professional. Every section in this report is assembled " +
  "directly from an existing, already-computed platform engine (Business Quality, Financial Strength, Valuation, " +
  "Margin of Safety, the Decision Engine, the Investment Committee, Portfolio Intelligence, Portfolio Optimisation, " +
  "Opportunity Discovery, Monitoring, the Investment Memo, and the Institutional AI Coach). This module creates no " +
  "new valuation model, no new scoring system, and no new investment recommendation — it only reformats already-" +
  "approved outputs for review and presentation. Educational research only — not investment advice.";

export interface InstitutionalReport {
  reportType: InstitutionalReportType;
  title: string;
  subtitle: string;
  symbol: string | null;
  portfolioId: number | null;
  generatedAt: string;
  dataSource: string;
  sections: ReportSection[];
  disclaimer: string;
}

function section(id: string, title: string, body: string, bullets?: string[]): ReportSection {
  return bullets && bullets.length ? { id, title, body, bullets } : { id, title, body };
}

function pickReportSection(report: ValueResearchReport, id: string, fallbackTitle: string): ReportSection {
  const found = report.sections.find((s) => s.id === id);
  return found ?? section(id, fallbackTitle, "Not available for this security.");
}

// ─── Shared section builders — each a thin reformatting of an
// already-computed value, never a new calculation. ──────────────────────────

export function executiveSummarySection(decision: InstitutionalDecisionAnalysis): ReportSection {
  return section(
    "executive-summary",
    "Executive Summary",
    `${decision.summary} ${decision.explanation}`,
    decision.drivers.length ? decision.drivers : undefined,
  );
}

export function businessQualitySection(report: ValueResearchReport): ReportSection {
  return pickReportSection(report, "business", "Business Quality");
}

export function financialStrengthSection(report: ValueResearchReport): ReportSection {
  return pickReportSection(report, "financial", "Financial Strength");
}

export function valuationSection(report: ValueResearchReport): ReportSection {
  return pickReportSection(report, "valuation", "Valuation");
}

export function marginOfSafetySection(report: ValueResearchReport): ReportSection {
  return pickReportSection(report, "margin-of-safety", "Margin of Safety");
}

export function investmentCommitteeSection(report: ValueResearchReport): ReportSection {
  return pickReportSection(report, "investment-committee", "Investment Committee");
}

export function decisionEngineSection(decision: InstitutionalDecisionAnalysis): ReportSection {
  return section(
    "decision-engine",
    "Decision Engine",
    `Recommendation: ${decision.recommendation} (confidence ${decision.confidence}/100). ${decision.explanation}`,
    decision.drivers.length ? decision.drivers : undefined,
  );
}

export function portfolioImpactSection(decision: InstitutionalDecisionAnalysis): ReportSection {
  const fit = decision.portfolioFit;
  if (!fit.available) {
    return section("portfolio-impact", "Portfolio Impact", fit.reason ?? "No portfolio context was supplied for this report.");
  }
  const bullets = [
    fit.alreadyHeld != null ? `Already held in this portfolio: ${fit.alreadyHeld ? "Yes" : "No"}` : null,
    fit.currentWeightPct != null ? `Current portfolio weight: ${fit.currentWeightPct.toFixed(2)}%` : null,
    fit.sectorExposurePct != null ? `Portfolio sector exposure: ${fit.sectorExposurePct.toFixed(2)}%` : null,
  ].filter((x): x is string => x != null);
  return section(
    "portfolio-impact",
    "Portfolio Impact",
    "Portfolio fit, reused directly from the Decision Engine's own portfolio context.",
    bullets,
  );
}

export function evidenceSection(decision: InstitutionalDecisionAnalysis): ReportSection {
  const passCount = decision.checklist.filter((c) => c.status === "pass").length;
  const warnCount = decision.checklist.filter((c) => c.status === "warning").length;
  const failCount = decision.checklist.filter((c) => c.status === "fail").length;
  const bullets = [
    ...decision.supportingEvidence.map((e) => `Supporting — ${e.label}: ${e.detail}`),
    ...decision.contradictingEvidence.map((e) => `Contradicting — ${e.label}: ${e.detail}`),
  ];
  return section(
    "evidence",
    "Evidence",
    `Decision Engine checklist: ${passCount} passed, ${warnCount} flagged with a warning, ${failCount} failed, ` +
      `out of ${decision.checklist.length} items — reused directly from the Decision Engine's own checklist.`,
    bullets,
  );
}

export function investmentMemoSection(memo: InvestmentMemo): ReportSection {
  return section(
    "investment-memo",
    "Investment Memo",
    memo.overview,
    memo.sections.map((s) => `${s.heading}: ${s.paragraphs[0] ?? ""}`),
  );
}

export function aiCoachSection(explanations: CoachExplanation[]): ReportSection {
  if (!explanations.length) {
    return section("ai-coach", "AI Coach Explanations", "No Institutional AI Coach explanations were requested for this report.");
  }
  return section(
    "ai-coach",
    "AI Coach Explanations",
    `${explanations.length} Institutional AI Coach explanation${explanations.length === 1 ? "" : "s"}, reused directly from lib/investingCoach.ts.`,
    explanations.map((e) => `${e.coachLabel}: ${e.headline}`),
  );
}

export function researchNotesSection(notes: InvestmentMemoResearchNote[]): ReportSection {
  if (!notes.length) {
    return section("research-notes", "Research Notes", "No research notes have been recorded for this security yet.");
  }
  return section(
    "research-notes",
    "Research Notes",
    `${notes.length} research note${notes.length === 1 ? "" : "s"} recorded by the user.`,
    notes.map((n) => `${new Date(n.createdAt).toLocaleDateString()}: ${n.note}`),
  );
}

export function monitoringSection(alerts: InvestmentMemoMonitoringAlert[]): ReportSection {
  if (!alerts.length) {
    return section("monitoring", "Monitoring", "No monitoring alerts have been recorded for this security.");
  }
  return section(
    "monitoring",
    "Monitoring",
    `${alerts.length} monitoring alert${alerts.length === 1 ? "" : "s"} on record.`,
    alerts.map((a) => `[${a.severity ?? "info"}]${a.isRead ? "" : " (unread)"} ${a.title}: ${a.message}`),
  );
}

// ─── 1. Investment Committee Report ─────────────────────────────────────────

export function buildInvestmentCommitteeReport(
  report: ValueResearchReport,
  decision: InstitutionalDecisionAnalysis,
): InstitutionalReport {
  const sections: ReportSection[] = [
    executiveSummarySection(decision),
    investmentCommitteeSection(report),
    decisionEngineSection(decision),
    evidenceSection(decision),
    portfolioImpactSection(decision),
  ];
  return {
    reportType: "investment-committee",
    title: `Investment Committee Report — ${report.name} (${report.symbol})`,
    subtitle: `Consolidated verdict: ${decision.recommendation} (confidence ${decision.confidence}/100)`,
    symbol: report.symbol,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: report.dataSource,
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 2. Single Company Research Report ──────────────────────────────────────

export function buildCompanyResearchReport(
  report: ValueResearchReport,
  decision: InstitutionalDecisionAnalysis,
  memo: InvestmentMemo,
  researchNotes: InvestmentMemoResearchNote[] = [],
  monitoringAlerts: InvestmentMemoMonitoringAlert[] = [],
  coachExplanations: CoachExplanation[] = [],
): InstitutionalReport {
  const sections: ReportSection[] = [
    executiveSummarySection(decision),
    businessQualitySection(report),
    financialStrengthSection(report),
    valuationSection(report),
    marginOfSafetySection(report),
    decisionEngineSection(decision),
    investmentCommitteeSection(report),
    portfolioImpactSection(decision),
    evidenceSection(decision),
    monitoringSection(monitoringAlerts),
    researchNotesSection(researchNotes),
    investmentMemoSection(memo),
    aiCoachSection(coachExplanations),
  ];
  return {
    reportType: "company-research",
    title: `Single Company Research Report — ${report.name} (${report.symbol})`,
    subtitle: `${decision.recommendation} (confidence ${decision.confidence}/100), as of ${report.asOf}`,
    symbol: report.symbol,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: report.dataSource,
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 3. Portfolio Review Report ─────────────────────────────────────────────

export function buildPortfolioReviewReport(
  portfolioId: number,
  portfolioName: string,
  optimisation: PortfolioOptimisationAnalysis,
): InstitutionalReport {
  const h = optimisation.health;
  const sections: ReportSection[] = [
    section("executive-summary", "Executive Summary", optimisation.summary),
    section(
      "portfolio-health",
      "Portfolio Health",
      `Quality ${h.qualityScore ?? "n/a"} (${h.qualityLabel}). Capital allocation ${h.capitalAllocationScore ?? "n/a"}. ` +
        `Diversification ${h.diversificationScore ?? "n/a"} (${h.diversificationLabel}). Overall risk ${h.overallRiskScore ?? "n/a"} (${h.overallRiskLabel}).`,
    ),
    section(
      "diversification",
      "Diversification & Concentration",
      `Largest position: ${optimisation.diversification.largestPositionPct?.toFixed(1) ?? "n/a"}%. Top 10 exposure: ${optimisation.diversification.top10ExposurePct?.toFixed(1) ?? "n/a"}%.`,
      optimisation.diversification.bySector.map((s) => `${s.label}: ${s.weightPct.toFixed(1)}%`),
    ),
    section(
      "position-quality-ranking",
      "Position Quality Ranking",
      `${optimisation.positionQualityRanking.length} position${optimisation.positionQualityRanking.length === 1 ? "" : "s"} ranked by the Decision Engine's own synthesis score.`,
      optimisation.positionQualityRanking.map(
        (p) => `${p.symbol}: rank score ${p.rankScore.toFixed(1)}, action ${p.action} — ${p.actionReason}`,
      ),
    ),
    section(
      "portfolio-impact",
      "Portfolio Impact — Upgrade/Trim/Exit Candidates",
      `${optimisation.upgradeCandidates.length} upgrade, ${optimisation.trimCandidates.length} trim, ${optimisation.exitCandidates.length} exit candidate${optimisation.exitCandidates.length === 1 ? "" : "s"}.`,
      [
        ...optimisation.upgradeCandidates.map((c) => `Upgrade — ${c.symbol}: ${c.reason}`),
        ...optimisation.trimCandidates.map((c) => `Trim — ${c.symbol}: ${c.reason}`),
        ...optimisation.exitCandidates.map((c) => `Exit — ${c.symbol}: ${c.reason}`),
      ],
    ),
    section(
      "capital-allocation",
      "Capital Allocation Suggestions",
      optimisation.capitalAllocationSuggestions.length
        ? `${optimisation.capitalAllocationSuggestions.length} capital allocation suggestion${optimisation.capitalAllocationSuggestions.length === 1 ? "" : "s"}.`
        : "No capital allocation suggestions at this time.",
      optimisation.capitalAllocationSuggestions.map((c) => `${c.action}: ${c.detail}`),
    ),
    section(
      "opportunity-discovery",
      "Replacement & Cash Deployment Opportunities",
      `${optimisation.replacementOpportunities.length} replacement opportunit${optimisation.replacementOpportunities.length === 1 ? "y" : "ies"}, ${optimisation.cashDeploymentSuggestions.length} cash deployment suggestion${optimisation.cashDeploymentSuggestions.length === 1 ? "" : "s"} — reused directly from Opportunity Discovery via Portfolio Optimisation.`,
      [...optimisation.replacementOpportunities, ...optimisation.cashDeploymentSuggestions].map(
        (r) => `${r.symbol}${r.forSymbol ? ` (replacing ${r.forSymbol})` : ""}: ${r.evidence.rankExplanation}`,
      ),
    ),
  ];
  return {
    reportType: "portfolio-review",
    title: `Portfolio Review Report — ${portfolioName}`,
    subtitle: h.summary,
    symbol: null,
    portfolioId,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: optimisation.disclaimer || REPORT_DISCLAIMER,
  };
}

// ─── 4. Portfolio Health Report ─────────────────────────────────────────────

export function buildPortfolioHealthReport(
  portfolioId: number,
  portfolioName: string,
  intelligence: PortfolioIntelligenceAnalysis,
): InstitutionalReport {
  const sections: ReportSection[] = [
    section("executive-summary", "Executive Summary", intelligence.summary),
    section(
      "portfolio-health",
      "Portfolio Health",
      `Quality score: ${intelligence.qualityScore.score ?? "n/a"} (${intelligence.qualityScore.label}). ` +
        `Capital allocation score: ${intelligence.capitalAllocationScore.score ?? "n/a"} (${intelligence.capitalAllocationScore.label}). ` +
        `Diversification score: ${intelligence.diversificationScore.score ?? "n/a"} (${intelligence.diversificationScore.label}).`,
      [intelligence.qualityScore.detail, intelligence.capitalAllocationScore.detail, intelligence.diversificationScore.detail],
    ),
    section(
      "financial-ratios",
      "Weighted Metrics",
      "Portfolio-weighted average of each holding's own already-computed metric.",
      Object.entries(intelligence.weightedMetrics)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`),
    ),
    section(
      "diversification",
      "Allocation Mix",
      `Largest position: ${intelligence.allocation.largestPositionPct?.toFixed(1) ?? "n/a"}%. Top 10 exposure: ${intelligence.allocation.top10ExposurePct?.toFixed(1) ?? "n/a"}%. Cash: ${intelligence.allocation.cashAllocationPct?.toFixed(1) ?? "n/a"}%.`,
      intelligence.allocation.bySector.map((s) => `${s.label}: ${s.weightPct.toFixed(1)}%`),
    ),
    section(
      "portfolio-risk",
      "Risk",
      `Overall risk: ${intelligence.risk.overall.label}. Concentration: ${intelligence.risk.concentration.label}.`,
      [intelligence.risk.cashRisk.detail, intelligence.risk.dividendDependence.detail, intelligence.risk.leverageExposure.detail, intelligence.risk.qualityDrift.detail, intelligence.risk.portfolioStability.detail],
    ),
    section(
      "income",
      "Income",
      `Portfolio dividend yield: ${intelligence.income.portfolioDividendYield != null ? (intelligence.income.portfolioDividendYield * 100).toFixed(2) + "%" : "n/a"}. ` +
        `Estimated annual dividend income: ${intelligence.income.estAnnualDividendIncome != null ? "$" + intelligence.income.estAnnualDividendIncome.toFixed(2) : "n/a"}.`,
    ),
    section(
      "performance",
      "Performance",
      `Total market value: ${intelligence.performance.totalMarketValue != null ? "$" + intelligence.performance.totalMarketValue.toFixed(2) : "n/a"}. ` +
        `Total unrealized P&L: ${intelligence.performance.totalUnrealizedPnl != null ? "$" + intelligence.performance.totalUnrealizedPnl.toFixed(2) : "n/a"} ` +
        `(${intelligence.performance.totalUnrealizedPnlPct != null ? intelligence.performance.totalUnrealizedPnlPct.toFixed(2) + "%" : "n/a"}).`,
      intelligence.performance.holdingsWithoutCostBasis.length
        ? [`Holdings without a cost basis: ${intelligence.performance.holdingsWithoutCostBasis.join(", ")}`]
        : undefined,
    ),
  ];
  return {
    reportType: "portfolio-health",
    title: `Portfolio Health Report — ${portfolioName}`,
    subtitle: intelligence.summary,
    symbol: null,
    portfolioId,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 5. Watchlist Report ────────────────────────────────────────────────────

export interface WatchlistReportItem {
  symbol: string;
  category: string | null;
  reason: string | null;
  currentDecision: string | null;
  check: WatchlistTargetCheck;
}

export function buildWatchlistReport(items: WatchlistReportItem[]): InstitutionalReport {
  const crossed = items.filter((i) => i.check.priceTargetCrossed || i.check.marginOfSafetyTargetCrossed);
  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      items.length
        ? `${items.length} watchlist item${items.length === 1 ? "" : "s"} tracked, ${crossed.length} with a crossed target today.`
        : "The watchlist is empty.",
    ),
    section(
      "watchlist",
      "Watchlist Items",
      items.length ? "Each item's own current price and target-crossing status, reused directly from the Value Watchlist." : "No items to report.",
      items.map((i) => {
        const parts = [`${i.symbol}: price ${i.check.currentPrice != null ? "$" + i.check.currentPrice.toFixed(2) : "n/a"}`];
        if (i.category) parts.push(`category ${i.category}`);
        if (i.check.priceTargetCrossed != null) parts.push(`price target crossed: ${i.check.priceTargetCrossed ? "yes" : "no"}`);
        if (i.check.marginOfSafetyTargetCrossed != null) parts.push(`margin-of-safety target crossed: ${i.check.marginOfSafetyTargetCrossed ? "yes" : "no"}`);
        if (i.currentDecision) parts.push(`current decision: ${i.currentDecision}`);
        return parts.join(", ");
      }),
    ),
  ];
  return {
    reportType: "watchlist",
    title: "Watchlist Report",
    subtitle: `${items.length} item${items.length === 1 ? "" : "s"} tracked`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 6. Opportunity Discovery Report ────────────────────────────────────────

export function buildOpportunityDiscoveryReport(scan: OpportunityScanResult, buckets: OpportunityBucket[]): InstitutionalReport {
  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      `${scan.rows.length} of ${scan.universeSize} symbols in the scanned universe resolved${scan.unresolvedSymbols.length ? `; ${scan.unresolvedSymbols.length} unresolved` : ""}. Scanned at ${scan.scannedAt}.`,
    ),
    ...buckets.map((b) =>
      section(
        "opportunity-discovery",
        b.label,
        `${b.rows.length} symbol${b.rows.length === 1 ? "" : "s"} matched. Rule: ${b.rule}`,
        b.rows.slice(0, 10).map((r) => `${r.symbol}: ${r.decisionRecommendation}, rank score ${r.rankScore.toFixed(1)} — ${r.rankExplanation}`),
      ),
    ),
  ];
  return {
    reportType: "opportunity-discovery",
    title: "Opportunity Discovery Report",
    subtitle: `${scan.rows.length} symbols scanned, ${buckets.length} buckets`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 7. Monitoring Summary Report ───────────────────────────────────────────

export function buildMonitoringSummaryReport(alerts: InvestmentMemoMonitoringAlert[]): InstitutionalReport {
  const unread = alerts.filter((a) => !a.isRead);
  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      alerts.length ? `${alerts.length} monitoring alert${alerts.length === 1 ? "" : "s"} on record, ${unread.length} unread.` : "No monitoring alerts have been recorded.",
    ),
    monitoringSection(alerts),
  ];
  return {
    reportType: "monitoring-summary",
    title: "Monitoring Summary Report",
    subtitle: `${alerts.length} alert${alerts.length === 1 ? "" : "s"}, ${unread.length} unread`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 8. AI Coach Learning Summary ───────────────────────────────────────────

export function buildAiCoachLearningSummaryReport(progress: LearningProgressSummary): InstitutionalReport {
  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      `${progress.lessonsCompleted} of ${progress.lessonsViewed} lessons viewed completed. ${progress.coachesViewed} AI Coach explanation${progress.coachesViewed === 1 ? "" : "s"} viewed.`,
    ),
    section(
      "ai-coach",
      "Progress Overview",
      "Reused directly from the Learning Centre's own Progress Tracker.",
      [
        `Lessons viewed: ${progress.lessonsViewed}`,
        `Lessons completed: ${progress.lessonsCompleted}`,
        `Glossary terms viewed: ${progress.glossaryTermsViewed}`,
        `Strategies viewed: ${progress.strategiesViewed}`,
        `AI Coach explanations viewed: ${progress.coachesViewed}`,
      ],
    ),
    section(
      "portfolio-impact",
      "Path Completion",
      progress.pathCompletion.length ? `${progress.pathCompletion.length} learning path${progress.pathCompletion.length === 1 ? "" : "s"} started.` : "No learning path started yet.",
      progress.pathCompletion.map((p) => `${p.title}: ${p.topicsCompleted}/${p.topicsTotal} topics (${p.percentComplete.toFixed(0)}%)`),
    ),
    section(
      "checklist",
      "Quiz Performance",
      `Greeks quiz: ${progress.greeksQuiz.totalAttempts} attempt${progress.greeksQuiz.totalAttempts === 1 ? "" : "s"}, average ${progress.greeksQuiz.averagePercent.toFixed(0)}%. ` +
        `Value quiz: ${progress.valueQuiz.totalAttempts} attempt${progress.valueQuiz.totalAttempts === 1 ? "" : "s"}, average ${progress.valueQuiz.averagePercent.toFixed(0)}%.`,
    ),
    section(
      "monitoring",
      "Recent Activity",
      progress.recentHistory.length ? `${progress.recentHistory.length} recent learning event${progress.recentHistory.length === 1 ? "" : "s"}.` : "No recent learning activity.",
      progress.recentHistory.slice(0, 15).map((h) => `${h.itemType}: ${h.itemKey} — viewed ${new Date(h.viewedAt).toLocaleDateString()}${h.completedAt ? ", completed" : ""}`),
    ),
  ];
  return {
    reportType: "ai-coach-summary",
    title: "AI Coach Learning Summary",
    subtitle: `${progress.lessonsCompleted}/${progress.lessonsViewed} lessons completed, ${progress.coachesViewed} coach explanations viewed`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "N/A",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 9. Executive Summary ───────────────────────────────────────────────────

export function buildExecutiveSummaryReport(cross: CrossEngineDailyReport): InstitutionalReport {
  const sections: ReportSection[] = [
    section("executive-summary", "Executive Summary", cross.summary),
    section(
      "investment-committee",
      "Engine 1 — Institutional Investing",
      `Macro regime: ${cross.engine1.macro.regimeLabel}. ${cross.engine1.watchlistTotalItems} watchlist item${cross.engine1.watchlistTotalItems === 1 ? "" : "s"} tracked.`,
      cross.engine1.watchlistCrossings.map((c) => `${c.symbol}: price target crossed ${c.priceTargetCrossed ? "yes" : "no"}, margin of safety target crossed ${c.marginOfSafetyTargetCrossed ? "yes" : "no"}`),
    ),
    section(
      "portfolio-risk",
      "Engine 2 — Institutional Trading",
      `Trading risk: ${cross.engine2.risk.overall.label}.`,
    ),
    section(
      "portfolio-health",
      "Engine 3 — Options Income",
      `Health: ${cross.engine3.healthScore} (${cross.engine3.healthLabel}). ${cross.engine3.openPositions} open position${cross.engine3.openPositions === 1 ? "" : "s"}. ` +
        `Unrealized P&L: $${cross.engine3.totalUnrealizedPnl.toFixed(2)}. ${cross.engine3.attentionCount} needing attention, ${cross.engine3.criticalCount} critical.`,
      cross.engine3.topOpportunitySymbol ? [`Top opportunity: ${cross.engine3.topOpportunitySymbol} (score ${cross.engine3.topOpportunityRavishScore ?? "n/a"})`] : undefined,
    ),
  ];
  return {
    reportType: "executive-summary",
    title: `Executive Summary — ${cross.date}`,
    subtitle: cross.summary,
    symbol: null,
    portfolioId: null,
    generatedAt: cross.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: cross.disclaimer || REPORT_DISCLAIMER,
  };
}

// ─── 10. Trade Planning Summary Report (Phase 28, Institutional Trade
// Planning & Risk Studio) — thin reformatting of the calling user's own
// trading_trade_plans rows and lib/tradingRisk.ts's own already-computed
// TradingRiskAnalysis, exactly the same "reuse, never recompute" discipline
// every other report type in this file already follows. ────────────────────

export interface TradePlanSummaryItem {
  symbol: string;
  direction: string;
  status: string;
  thesis: string;
  positionSize: number | null;
  riskRewardRatio: number | null;
}

export function buildTradePlanningSummaryReport(
  plans: TradePlanSummaryItem[],
  risk: TradingRiskAnalysis,
): InstitutionalReport {
  const draft = plans.filter((p) => p.status === "draft").length;
  const active = plans.filter((p) => p.status === "active").length;
  const closed = plans.filter((p) => p.status === "closed").length;
  const cancelled = plans.filter((p) => p.status === "cancelled").length;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      plans.length
        ? `${plans.length} trade plan${plans.length === 1 ? "" : "s"} on record (${draft} draft, ${active} active, ${closed} closed, ${cancelled} cancelled). ${risk.overall.detail}`
        : `No trade plans have been created yet. ${risk.overall.detail}`,
    ),
    section(
      "trade-plans",
      "Trade Plans Overview",
      plans.length
        ? "Reused directly from the Institutional Trade Planning & Risk Studio's own trading_trade_plans rows."
        : "No trade plans to report.",
      plans.map((p) => {
        const parts = [`${p.symbol}: ${p.direction}, status ${p.status}`];
        if (p.positionSize != null) parts.push(`position size ${p.positionSize}`);
        if (p.riskRewardRatio != null) parts.push(`R:R ${p.riskRewardRatio}`);
        parts.push(p.thesis);
        return parts.join(" — ");
      }),
    ),
    section(
      "portfolio-risk",
      "Trading Risk Summary",
      `Overall: ${risk.overall.label}. ${risk.overall.detail}`,
      [
        `Position sizing: ${risk.positionSizing.detail}`,
        `Stop/target discipline: ${risk.stopDiscipline.detail}`,
        `Portfolio risk budget: ${risk.portfolioBudget.detail}`,
      ],
    ),
  ];

  return {
    reportType: "trade-planning-summary",
    title: "Trade Planning Summary Report",
    subtitle: `${plans.length} trade plan${plans.length === 1 ? "" : "s"}, risk: ${risk.overall.label}`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 11. Strategy Framework Summary Report (Phase 30, Institutional
// Strategy Framework) — thin reformatting of the calling user's own
// trading_strategies/trading_strategy_checklists rows via
// toStrategyLearningSummary() (unmodified) and each checklist's own
// already-persisted status field. No strategy logic is evaluated —
// only metadata and completion state. ──────────────────────────────────

export interface StrategyFrameworkChecklistSummaryItem {
  strategyId: number;
  strategyName: string;
  symbol: string | null;
  status: string;
}

// Phase 31 — Institutional Strategy Workbench. Both fields below are
// optional, additive extensions of this same report (not a new report
// type) — every pre-existing call site that omits them keeps working
// identically, since both default to an empty list.

export interface StrategyFrameworkLearningCoverageItem {
  strategyId: number;
  strategyName: string;
  viewed: boolean;
}

export interface StrategyFrameworkWorkspaceNoteItem {
  strategyId: number;
  strategyName: string;
  note: string;
  updatedAt: string;
}

export function buildStrategyFrameworkSummaryReport(
  strategies: StrategyMetadata[],
  checklists: StrategyFrameworkChecklistSummaryItem[],
  learningCoverage: StrategyFrameworkLearningCoverageItem[] = [],
  workspaceNotes: StrategyFrameworkWorkspaceNoteItem[] = [],
): InstitutionalReport {
  const learningSummaries: StrategyLearningSummary[] = strategies.map(toStrategyLearningSummary);
  const completeCount = checklists.filter((c) => c.status === "complete").length;
  const inProgressCount = checklists.length - completeCount;
  const viewedCount = learningCoverage.filter((l) => l.viewed).length;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      strategies.length
        ? `${strategies.length} strategy definition(s) on record, ${checklists.length} checklist instance(s) run (${completeCount} complete, ${inProgressCount} in progress).`
        : "No strategies have been registered in the Strategy Framework yet.",
    ),
    section(
      "strategy-registry",
      "Strategy Registry",
      strategies.length ? "Reused directly from the Institutional Strategy Framework's own trading_strategies rows." : "No strategies registered.",
      learningSummaries.map(
        (s) => `${s.name} (${s.category}, v${s.version}) — ${s.checklistItemCount} checklist item(s), required evidence: ${s.requiredEvidence.join(", ") || "none"}`,
      ),
    ),
    section(
      "checklist-instances",
      "Checklist Instances",
      checklists.length ? "Each row is a real, persisted checklist instance and its own completion status." : "No checklist instances have been run yet.",
      checklists.map((c) => `${c.strategyName}${c.symbol ? ` (${c.symbol})` : ""}: ${c.status}`),
    ),
    section(
      "learning-coverage",
      "Learning Coverage",
      learningCoverage.length
        ? `${viewedCount} of ${learningCoverage.length} registered strategy(ies) have had their Learning Viewer marked as viewed.`
        : "No registered strategies to report Learning Coverage for.",
      learningCoverage.map((l) => `${l.strategyName}: ${l.viewed ? "viewed" : "not yet viewed"}`),
    ),
    section(
      "workspace-notes",
      "Workspace Notes",
      workspaceNotes.length ? "Free-text notes recorded against a strategy in the Strategy Workbench." : "No workspace notes have been recorded yet.",
      workspaceNotes.map((n) => `${n.strategyName} (updated ${n.updatedAt}): ${n.note}`),
    ),
  ];

  return {
    reportType: "strategy-framework-summary",
    title: "Strategy Framework Summary Report",
    subtitle: `${strategies.length} strategy(ies), ${checklists.length} checklist instance(s)`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── Phase 32 — Institutional Trading Analytics Engine ────────────────────
// A pure reformatting of buildTradingAnalyticsDashboard()'s own already-
// computed output (lib/tradingAnalytics.ts) into the generic ReportSection
// shape — zero new aggregation logic here, every figure is read straight
// off the already-built dashboard.

export function buildTradingAnalyticsSummaryReport(dashboard: TradingAnalyticsDashboard): InstitutionalReport {
  const { overview, strategyUsage, journal, risk, learning, coach, session } = dashboard;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      `${overview.tradesReviewed} position(s) reviewed, ${overview.plansCreated} trade plan(s), ${overview.journalEntries} journal entr(y/ies), ` +
        `${overview.strategiesRegistered} strategy(ies) registered with ${overview.checklistInstances} checklist instance(s).`,
    ),
    section(
      "strategy-usage",
      "Strategy Usage",
      strategyUsage.checklistInstances
        ? `${strategyUsage.checklistsComplete} of ${strategyUsage.checklistInstances} checklist instance(s) complete (${strategyUsage.overallChecklistCompletionPct}% average completion).`
        : "No checklist instances have been run yet.",
      [
        `Strategies registered: ${strategyUsage.strategiesRegistered}`,
        `Checklist instances: ${strategyUsage.checklistInstances} (${strategyUsage.checklistsComplete} complete, ${strategyUsage.checklistsInProgress} in progress)`,
      ],
    ),
    section(
      "journal-analytics",
      "Journal Analytics",
      journal.entryCount
        ? `${journal.entryCount} journal entr(y/ies), ${journal.lessonRecordedPct}% with a lesson recorded.`
        : "No journal entries have been recorded yet.",
      journal.entryCount
        ? [
            ...Object.entries(journal.moodTally).map(([mood, count]) => `Mood — ${mood}: ${count}`),
            journal.averageRMultiple !== null ? `Average R-Multiple: ${journal.averageRMultiple}` : "Average R-Multiple: not yet recorded",
          ]
        : undefined,
    ),
    section(
      "risk-analytics",
      "Risk Analytics",
      risk.openPositionsCount
        ? `${risk.openPositionsCount} open position(s), ${risk.stopTargetDisciplinePct}% with both a stop and a target set.`
        : "No open positions to report risk analytics for.",
      [
        `Trade plans with risk parameters: ${risk.plansWithRiskParams}`,
        risk.averageAccountRiskPct !== null ? `Average account risk per plan: ${risk.averageAccountRiskPct}%` : "Average account risk per plan: not yet recorded",
        risk.averageRiskRewardRatio !== null ? `Average risk/reward ratio: ${risk.averageRiskRewardRatio}` : "Average risk/reward ratio: not yet recorded",
      ],
    ),
    section(
      "learning-analytics",
      "Learning Analytics",
      learning.totalTopics
        ? `${learning.completedTopics} of ${learning.totalTopics} learning topic(s) completed.`
        : "No Learning Centre progress recorded yet.",
      learning.weakestPaths.length ? learning.weakestPaths.map((p) => `${p.title}: ${p.percentComplete}% complete`) : undefined,
    ),
    section(
      "coach-analytics",
      "Coach Analytics",
      coach.totalCoachViews
        ? `${coach.totalCoachViews} Trading AI Coach view(s) recorded across ${coach.byType.filter((r) => r.viewCount > 0).length} of 9 coach type(s).`
        : "No Trading AI Coach views recorded yet.",
      coach.byType.filter((r) => r.viewCount > 0).map((r) => `${r.label}: ${r.viewCount} view(s)`),
    ),
    section(
      "session-analytics",
      "Session Analytics",
      session.totalClassified
        ? `${session.totalClassified} position(s) classified by real entry-timestamp trading session.`
        : "No positions with a resolvable entry timestamp to classify by session.",
      session.activity.map((a) => `${a.label}: ${a.count}`),
    ),
  ];

  return {
    reportType: "trading-analytics-summary",
    title: "Trading Analytics Summary Report",
    subtitle: `${overview.tradesReviewed} position(s), ${overview.journalEntries} journal entr(y/ies), ${overview.strategiesRegistered} strategy(ies)`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 13. Executive Intelligence Summary Report (Phase 33) — reuses
// routes/executiveIntelligence.ts's own loadExecutiveIntelligenceInputs()/
// buildExecutiveIntelligenceHub() exactly (the same functions
// GET /executive/intelligence itself calls), then reformats the
// already-computed hub into the generic ReportSection shape. Zero new
// aggregation logic in this file. ──────────────────────────────────────────

export function buildExecutiveIntelligenceSummaryReport(hub: ExecutiveIntelligenceHub): InstitutionalReport {
  const { overview, investing, trading, strategy, portfolio, risk, learning, coach, reporting, activity } = hub;

  const sections: ReportSection[] = [
    section("executive-summary", "Executive Overview", overview.summary),
    section(
      "investment-committee",
      "Investing Summary",
      `${investing.overview.portfoliosCreated} portfolio(s), ${investing.overview.holdingsTracked} holding(s), ${investing.overview.watchlistItems} watchlist item(s), ${investing.committee.snapshotCount} committee snapshot(s) saved.`,
      [
        `Research notes written: ${investing.overview.researchNotesWritten}`,
        `Risk snapshots saved: ${investing.risk.snapshotCount}${investing.risk.mostRecentOverallScore !== null ? ` (most recent score: ${investing.risk.mostRecentOverallScore})` : ""}`,
        `Optimisation reviews saved: ${investing.optimisation.reviewCount}`,
      ],
    ),
    section(
      "portfolio-risk",
      "Trading Summary",
      `${trading.overview.tradesReviewed} position(s) reviewed, ${trading.overview.plansCreated} trade plan(s), ${trading.overview.journalEntries} journal entr(y/ies).`,
      [
        `Strategies registered: ${trading.overview.strategiesRegistered}`,
        `Checklist instances: ${trading.overview.checklistInstances} (${trading.strategyUsage.checklistsComplete} complete)`,
      ],
    ),
    section(
      "strategy-usage",
      "Strategy Summary",
      strategy.checklistInstances
        ? `${strategy.checklistsComplete} of ${strategy.checklistInstances} checklist instance(s) complete (${strategy.overallChecklistCompletionPct}% average completion).`
        : "No checklist instances have been run yet.",
    ),
    section(
      "portfolio-health",
      "Portfolio Summary",
      portfolio.portfolioCount
        ? `${portfolio.portfolioCount} portfolio(s), ${portfolio.totalHoldings} total holding(s) across ${portfolio.distinctSymbolsHeld} distinct symbol(s).`
        : "No portfolios created yet.",
    ),
    section(
      "risk-analytics",
      "Risk Summary",
      `Investing: ${risk.investingRiskSnapshotsSaved} risk snapshot(s) saved. Trading: ${risk.tradingOpenPositionsCount} open position(s), ${risk.tradingStopTargetDisciplinePct}% with both a stop and a target set.`,
    ),
    section(
      "learning-analytics",
      "Learning Summary",
      learning.totalTopics
        ? `${learning.completedTopics} of ${learning.totalTopics} learning topic(s) completed across both engines.`
        : "No Learning Centre progress recorded yet.",
      learning.weakestPaths.length ? learning.weakestPaths.map((p) => `${p.title}: ${p.percentComplete}% complete`) : undefined,
    ),
    section(
      "coach-analytics",
      "AI Coach Summary",
      coach.totalCoachViews
        ? `${coach.totalCoachViews} AI Coach view(s) recorded — ${coach.investingCoachViews} Investing, ${coach.tradingCoachViews} Trading.`
        : "No AI Coach views recorded yet.",
    ),
    section(
      "monitoring",
      "Reporting Summary",
      reporting.totalReports
        ? `${reporting.totalReports} report(s) generated across ${reporting.distinctReportTypesUsed} categor${reporting.distinctReportTypesUsed === 1 ? "y" : "ies"}.`
        : "No reports generated yet.",
      reporting.byType.map((t) => `${t.reportType}: ${t.count}`),
    ),
    section(
      "checklist",
      "Activity Timeline",
      activity.length ? `${activity.length} recent activity entr(y/ies) across both engines.` : "No recent activity recorded yet.",
      activity.slice(0, 15).map((a) => `${a.label} (${a.engine}): ${a.detail} — ${new Date(a.occurredAt).toLocaleDateString()}`),
    ),
  ];

  return {
    reportType: "executive-intelligence-summary",
    title: "Executive Intelligence Summary Report",
    subtitle: overview.summary,
    symbol: null,
    portfolioId: null,
    generatedAt: overview.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 14. Options Income Summary Report (Phase 35) — reuses
// lib/optionsIncomeAnalytics.ts's own buildOptionsIncomeDashboard() exactly
// (the same function GET /options-income/dashboard itself calls), then
// reformats the already-computed dashboard into the generic ReportSection
// shape. Zero new aggregation logic in this file, zero P/L prediction or
// forecasting. ───────────────────────────────────────────────────────────

export function buildOptionsIncomeSummaryReport(dashboard: OptionsIncomeDashboard): InstitutionalReport {
  const { overview, strategyMix, upcomingExpirations } = dashboard;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Income Overview",
      overview.openPositionsCount || overview.closedPositionsCount
        ? `${overview.openPositionsCount} open position(s) with $${overview.totalCapitalAllocated.toLocaleString()} capital allocated, ` +
          `$${overview.totalCreditCollectedOpen.toLocaleString()} in open credit and $${overview.totalRealizedPremium.toLocaleString()} realized premium ` +
          `across ${overview.closedPositionsCount} closed position(s).`
        : "No open or closed options-income positions on record yet.",
      [
        `Open positions: ${overview.openPositionsCount}`,
        `Closed positions: ${overview.closedPositionsCount}`,
        `Capital allocated: $${overview.totalCapitalAllocated.toLocaleString()}`,
      ],
    ),
    section(
      "theta-income",
      "Monthly Premium (Theta Income)",
      overview.theta.daily
        ? `$${overview.theta.daily.toLocaleString()}/day, $${overview.theta.monthly.toLocaleString()}/month, ` +
          `$${overview.theta.annualized.toLocaleString()}/year projected from live position Greeks — a theta projection, never a P/L forecast.`
        : "No open positions to project theta income from.",
      overview.theta.bySymbol.length ? overview.theta.bySymbol.map((s) => `${s.key}: $${s.theta.toLocaleString()}/day`) : undefined,
    ),
    section(
      "strategy-mix",
      "Strategy Mix",
      strategyMix.length
        ? `${strategyMix.length} distinct strategy(ies) in use across open positions.`
        : "No open positions to break down by strategy yet.",
      strategyMix.map((m) => `${m.strategyLabel ?? m.strategy}: ${m.positionCount} position(s), $${m.capitalAllocated.toLocaleString()} allocated`),
    ),
    section(
      "upcoming-expirations",
      "Upcoming Expirations",
      upcomingExpirations.length
        ? `${upcomingExpirations.length} distinct expiration date(s) among open positions, soonest in ${upcomingExpirations[0].daysToExpiry} day(s).`
        : "No open positions with a recorded expiration date.",
      upcomingExpirations.map((g) => `${g.expiration} (${g.daysToExpiry}d): ${g.positions.length} position(s)`),
    ),
  ];

  return {
    reportType: "options-income-summary",
    title: "Options Income Summary Report",
    subtitle: `${overview.openPositionsCount} open position(s), $${overview.totalCapitalAllocated.toLocaleString()} allocated`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 15. Options Portfolio Review (Phase 36) — reuses
// lib/optionsPortfolioManagement.ts's own buildOptionsPortfolioManagementView()
// exactly (the same function GET /options-lifecycle/portfolio itself
// calls), then reformats the already-computed view into the generic
// ReportSection shape. Zero new allocation math in this file, zero
// rebalancing recommendation. ─────────────────────────────────────────────

export function buildOptionsPortfolioReviewReport(view: OptionsPortfolioManagementView): InstitutionalReport {
  const { positionConcentration, strategyAllocation, sectorAllocation, expirationLadder, capitalUtilisation, buyingPowerAllocation, incomeAllocation, expirationTracker } = view;

  const sections: ReportSection[] = [
    section(
      "capital-utilisation",
      "Capital Utilisation",
      `Portfolio value $${capitalUtilisation.portfolioValue.toLocaleString()}, total risk $${capitalUtilisation.totalRiskDollars.toLocaleString()} ` +
        `(${capitalUtilisation.totalRiskPct.toFixed(1)}% of portfolio value), buying power $${buyingPowerAllocation.buyingPower.toLocaleString()}.`,
      [
        `Portfolio value: $${capitalUtilisation.portfolioValue.toLocaleString()}`,
        `Total risk: $${capitalUtilisation.totalRiskDollars.toLocaleString()} (${capitalUtilisation.totalRiskPct.toFixed(1)}%)`,
        `Buying power: $${buyingPowerAllocation.buyingPower.toLocaleString()}`,
      ],
    ),
    section(
      "position-concentration",
      "Position Concentration",
      positionConcentration.length
        ? `Open risk spread across ${positionConcentration.length} symbol(s).`
        : "No open positions to break down by symbol.",
      positionConcentration.map((c) => `${c.label}: ${c.positionCount} position(s) (${c.weightPct.toFixed(1)}%)`),
    ),
    section(
      "strategy-allocation",
      "Strategy Allocation",
      strategyAllocation.length
        ? `Open risk spread across ${strategyAllocation.length} strategy(ies).`
        : "No open positions to break down by strategy.",
      strategyAllocation.map((c) => `${c.label}: ${c.positionCount} position(s) (${c.weightPct.toFixed(1)}%)`),
    ),
    section(
      "sector-allocation",
      "Sector Allocation",
      sectorAllocation.length
        ? `Open risk spread across ${sectorAllocation.length} sector(s).`
        : "No open positions to break down by sector.",
      sectorAllocation.map((c) => `${c.label}: ${c.positionCount} position(s) (${c.weightPct.toFixed(1)}%)`),
    ),
    section(
      "expiration-ladder",
      "Expiration Ladder",
      expirationLadder.length
        ? `Open risk spread across ${expirationLadder.length} expiration bucket(s).`
        : "No open positions with a recorded expiration.",
      expirationLadder.map((c) => `${c.label}: ${c.positionCount} position(s) (${c.weightPct.toFixed(1)}%)`),
    ),
    section(
      "income-allocation",
      "Income Allocation",
      incomeAllocation.strategyMix.length
        ? `${incomeAllocation.strategyMix.length} distinct strategy(ies) currently generating income.`
        : "No open positions currently generating income.",
      incomeAllocation.strategyMix.map((m) => `${m.strategyLabel ?? m.strategy}: ${m.positionCount} position(s), $${m.capitalAllocated.toLocaleString()} allocated`),
    ),
    section(
      "expiration-tracker",
      "Expiration Tracker",
      expirationTracker.length
        ? `${expirationTracker.length} distinct expiration date(s) among open positions, soonest in ${expirationTracker[0].daysToExpiry} day(s).`
        : "No open positions with a recorded expiration date.",
      expirationTracker.map((g) => `${g.expiration} (${g.daysToExpiry}d): ${g.positions.length} position(s)`),
    ),
  ];

  return {
    reportType: "options-portfolio-review",
    title: "Options Portfolio Review",
    subtitle: `$${capitalUtilisation.portfolioValue.toLocaleString()} portfolio value, ${capitalUtilisation.totalRiskPct.toFixed(1)}% risk utilised`,
    symbol: null,
    portfolioId: null,
    generatedAt: view.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 16. Position Lifecycle Summary (Phase 36) — reuses
// lib/optionsLifecycle.ts's own buildLifecycleSummary() exactly (the same
// tally OptionsPortfolioManagementView.lifecycleSummary itself carries),
// then reformats the already-computed tally into the generic ReportSection
// shape. Zero new lifecycle-scoring logic in this file. ───────────────────

export function buildPositionLifecycleSummaryReport(summary: LifecycleSummary): InstitutionalReport {
  const nonZeroStages = summary.byStage.filter((s) => s.count > 0);

  const sections: ReportSection[] = [
    section(
      "lifecycle-overview",
      "Lifecycle Overview",
      summary.totalPositions
        ? `${summary.totalPositions} position(s) on record, ${summary.positionsAwaitingReview} currently in Monitoring, Near Expiration, or Assignment Risk.`
        : "No positions on record yet.",
      [`Total positions: ${summary.totalPositions}`, `Awaiting review: ${summary.positionsAwaitingReview}`],
    ),
    section(
      "positions-by-stage",
      "Positions by Lifecycle Stage",
      nonZeroStages.length ? `${nonZeroStages.length} distinct lifecycle stage(s) represented.` : "No positions on record yet.",
      nonZeroStages.map((s) => `${s.stage}: ${s.count} position(s)`),
    ),
  ];

  return {
    reportType: "position-lifecycle-summary",
    title: "Position Lifecycle Summary",
    subtitle: `${summary.totalPositions} position(s), ${summary.positionsAwaitingReview} awaiting review`,
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 17. Risk & Exposure Summary (Phase 37) — reuses
// lib/riskExposureEngine.ts's own buildRiskExposureDashboard() exactly (the
// same function GET /risk-exposure/dashboard itself calls), then reformats
// the already-computed dashboard into the generic ReportSection shape.
// Zero new risk scoring, zero new aggregation logic, zero hedging or
// rebalancing recommendation in this file. ─────────────────────────────────

export function buildRiskExposureSummaryReport(dashboard: RiskExposureDashboard): InstitutionalReport {
  const { investing, trading, options, combined } = dashboard;

  const sections: ReportSection[] = [
    section(
      "risk-overview",
      "Risk Overview",
      `Investing: ${investing.risk.overall.label}. Trading: ${trading.risk.overall.label}. Options: ${options.dashboard.overallRiskRating.label}.`,
      [`Investing: ${investing.risk.overall.detail}`, `Trading: ${trading.risk.overall.detail}`, `Options: ${options.dashboard.healthScore.toFixed(0)}/100 health score (${options.dashboard.overallRiskRating.label})`],
    ),
    section(
      "capital-allocation",
      "Capital Allocation",
      "Real committed capital across all 3 engines, reused directly from each engine's own risk view.",
      combined.capitalAllocation.map((c) => `${c.label}: ${c.value != null ? `$${c.value.toLocaleString()}` : "unavailable"}`),
    ),
    section(
      "buying-power-overview",
      "Buying Power Overview",
      "Capital genuinely still available to deploy in Trading and Options.",
      combined.buyingPowerOverview.map((b) => `${b.label}: ${b.value != null ? `$${b.value.toLocaleString()}` : "unavailable"}`),
    ),
    section(
      "greeks-summary",
      "Greeks Summary",
      "The Options Income Engine's own net portfolio Greeks, reused directly, unmodified, from the existing Portfolio Risk Dashboard.",
      [
        `Net delta: ${combined.greeksSummary.delta.toFixed(2)}`,
        `Net gamma: ${combined.greeksSummary.gamma.toFixed(4)}`,
        `Net theta: ${combined.greeksSummary.theta.toFixed(2)}`,
        `Net vega: ${combined.greeksSummary.vega.toFixed(2)}`,
      ],
    ),
    section(
      "cross-engine-exposure",
      "Cross-Engine Exposure (Correlation Overview)",
      combined.correlationOverview.overlapSymbolCount
        ? `${combined.correlationOverview.overlapSymbolCount} symbol(s) genuinely held in more than one engine at once.`
        : "No symbol is currently held in more than one engine at once.",
      [combined.correlationOverview.note, ...combined.correlationOverview.overlaps.map((o) => `${o.symbol}: ${o.engines.join(", ")}`)],
    ),
  ];

  return {
    reportType: "risk-exposure-summary",
    title: "Risk & Exposure Summary",
    subtitle: `Investing ${investing.risk.overall.label} · Trading ${trading.risk.overall.label} · Options ${options.dashboard.overallRiskRating.label}`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 18. Portfolio Concentration Report (Phase 37) — reuses the same
// buildRiskExposureDashboard() output's own already-computed combined
// concentration/allocation figures. Zero new concentration math in this
// file, zero diversification recommendation. ────────────────────────────

export function buildPortfolioConcentrationReport(dashboard: RiskExposureDashboard): InstitutionalReport {
  const { combined } = dashboard;

  const sections: ReportSection[] = [
    section(
      "sector-concentration",
      "Sector Concentration",
      combined.sectorConcentration.length
        ? `Risk spread across ${combined.sectorConcentration.length} sector reading(s) across Investing and Options.`
        : "No sector data available across Investing or Options yet.",
      combined.sectorConcentration.map((s) => `[${s.engine}] ${s.sector}: ${s.weightPct.toFixed(1)}%`),
    ),
    section(
      "strategy-concentration",
      "Strategy Concentration",
      combined.strategyConcentration.length
        ? `Open options risk spread across ${combined.strategyConcentration.length} strategy(ies).`
        : "No open options positions to break down by strategy.",
      combined.strategyConcentration.map((s) => `${s.label ?? s.key}: ${s.positionCount} position(s) (${s.weightPct.toFixed(1)}%)`),
    ),
    section(
      "asset-allocation",
      "Asset Allocation",
      "Position/holding counts across all 3 engines.",
      [
        `Investing holdings: ${combined.assetAllocation.investingHoldingsCount} across ${combined.assetAllocation.investingPortfolioCount} portfolio(s)`,
        `Trading open positions: ${combined.assetAllocation.tradingOpenPositionsCount}`,
        `Options open positions: ${combined.assetAllocation.optionsOpenPositionsCount}`,
      ],
    ),
    section(
      "concentration-timeline",
      "Concentration Timeline",
      combined.concentrationTimeline.length
        ? `${combined.concentrationTimeline.length} real, historical data point(s) from saved Investing risk snapshots and the Options Exposure Timeline.`
        : "No historical concentration data points yet.",
      combined.concentrationTimeline.map((p) => `${p.date} [${p.source}]: ${p.detail}`),
    ),
  ];

  return {
    reportType: "portfolio-concentration-report",
    title: "Portfolio Concentration Report",
    subtitle: `${combined.assetAllocation.investingHoldingsCount + combined.assetAllocation.tradingOpenPositionsCount + combined.assetAllocation.optionsOpenPositionsCount} total position(s)/holding(s) across 3 engines`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 19. Performance Summary Report (Phase 38) — reuses
// lib/performanceAttribution.ts's own buildPerformanceDashboard() exactly
// (the same function GET /performance-attribution/dashboard itself calls),
// then reformats the already-computed dashboard into the generic
// ReportSection shape. Zero new performance calculation or aggregation
// logic in this file, zero forecast, zero trade recommendation. ───────────

function fmtPnl(v: number | null): string {
  if (v == null) return "n/a";
  return `${v >= 0 ? "+" : ""}$${v.toLocaleString()}`;
}

export function buildPerformanceSummaryReport(dashboard: PerformanceDashboard): InstitutionalReport {
  const { investing, trading, options, combined } = dashboard;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      `Investing unrealized P&L: ${fmtPnl(investing.totalUnrealizedPnl)}. Trading realized P&L: ${fmtPnl(trading.totalRealizedPnl)} (win rate ${trading.winRate != null ? trading.winRate.toFixed(1) + "%" : "n/a"}). ` +
        `Options realized P&L: ${fmtPnl(options.totalRealizedPnl)} (win rate ${options.winRate != null ? options.winRate.toFixed(1) + "%" : "n/a"}).`,
      combined.byEngine.map((e) => `${e.label}: ${fmtPnl(e.totalPnl)} (${e.pnlLabel})`),
    ),
    section(
      "investing-performance",
      "Investing Performance",
      investing.holdingsCount
        ? `${investing.holdingsCount} holding(s) across ${investing.portfolioCount} portfolio(s). Unrealized P&L ${fmtPnl(investing.totalUnrealizedPnl)}${investing.totalUnrealizedPnlPct != null ? ` (${investing.totalUnrealizedPnlPct.toFixed(2)}%)` : ""}.`
        : "No Investing holdings on record yet.",
      investing.holdings.slice(0, 15).map((h) => `${h.symbol}: unrealized P&L ${fmtPnl(h.unrealizedPnl)}${h.unrealizedPnlPct != null ? ` (${h.unrealizedPnlPct.toFixed(2)}%)` : ""}`),
    ),
    section(
      "trading-performance",
      "Trading Performance",
      trading.totalPositions
        ? `${trading.totalPositions} position(s) (${trading.openPositionsCount} open, ${trading.closedPositionsCount} closed). Win rate ${trading.winRate != null ? trading.winRate.toFixed(1) + "%" : "n/a"}, average win ${fmtPnl(trading.averageWin)}, average loss ${fmtPnl(trading.averageLoss)}.`
        : "No Trading positions on record yet.",
      [`Total realized P&L: ${fmtPnl(trading.totalRealizedPnl)}`, `Largest winner: ${fmtPnl(trading.largestWinner)}`, `Largest loser: ${fmtPnl(trading.largestLoser)}`],
    ),
    section(
      "options-performance",
      "Options Performance",
      options.openPositionsCount || options.closedPositionsCount
        ? `${options.openPositionsCount} open, ${options.closedPositionsCount} closed. Win rate ${options.winRate != null ? options.winRate.toFixed(1) + "%" : "n/a"}, average win ${fmtPnl(options.averageWin)}, average loss ${fmtPnl(options.averageLoss)}.`
        : "No Options positions on record yet.",
      [`Total realized P&L: ${fmtPnl(options.totalRealizedPnl)}`, `Total realized premium (gross credit): $${options.income.totalRealizedPremium.toLocaleString()}`],
    ),
    section(
      "capital-efficiency",
      "Capital Efficiency",
      "Real return relative to real capital committed, per engine — reused directly from each engine's own already-computed figure.",
      combined.capitalEfficiency.map((c) => `${c.label}: ${c.returnPct != null ? c.returnPct.toFixed(2) + "%" : "unavailable"}`),
    ),
  ];

  return {
    reportType: "performance-summary",
    title: "Performance Summary Report",
    subtitle: `Investing ${fmtPnl(investing.totalUnrealizedPnl)} · Trading ${fmtPnl(trading.totalRealizedPnl)} · Options ${fmtPnl(options.totalRealizedPnl)}`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 20. Performance Attribution Report (Phase 38) — reuses the same
// buildPerformanceDashboard() output's own already-computed sector/
// strategy/asset attribution, risk-adjusted performance, and historical
// timeline. Zero new attribution math in this file, zero optimisation
// recommendation. ───────────────────────────────────────────────────────

export function buildPerformanceAttributionReport(dashboard: PerformanceDashboard): InstitutionalReport {
  const { investing, trading, options, combined, timeline } = dashboard;

  const sections: ReportSection[] = [
    section(
      "sector-attribution",
      "Sector Attribution",
      investing.sectorAttribution.length ? `Investing unrealized P&L attributed across ${investing.sectorAttribution.length} sector(s).` : "No Investing sector attribution available yet.",
      investing.sectorAttribution.map((s) => `${s.label}: ${fmtPnl(s.pnl)} (${s.tradeCount} holding(s))`),
    ),
    section(
      "strategy-attribution",
      "Strategy Attribution",
      combined.strategyAttribution.length
        ? `Realized P&L attributed across ${combined.strategyAttribution.length} strategy reading(s) across Trading and Options.`
        : "No strategy attribution available yet.",
      combined.strategyAttribution.map((s) => `[${s.engine}] ${s.label}: ${fmtPnl(s.pnl)}`),
    ),
    section(
      "asset-attribution",
      "Asset Attribution",
      combined.assetAttribution.length
        ? `P&L attributed across ${combined.assetAttribution.length} asset reading(s) across all 3 engines.`
        : "No asset attribution available yet.",
      combined.assetAttribution.slice(0, 20).map((a) => `[${a.engine}] ${a.symbol}: ${fmtPnl(a.pnl)}`),
    ),
    section(
      "income-attribution",
      "Income Attribution",
      options.incomeAttribution.length
        ? `Options income allocated across ${options.incomeAttribution.length} strategy(ies) currently generating income.`
        : "No open Options positions currently generating income.",
      options.incomeAttribution.map((m) => `${m.strategyLabel ?? m.strategy}: ${m.positionCount} position(s), $${m.capitalAllocated.toLocaleString()} allocated`),
    ),
    section(
      "risk-adjusted-performance",
      "Risk-Adjusted Performance",
      "Trade-return-based Sharpe/Sortino ratios, reused directly from each engine's own already-computed figure — never a time-series forecast.",
      combined.riskAdjusted.map(
        (r) =>
          `${r.engine}: ${r.available ? `Sharpe ${r.sharpeRatio ?? "n/a"}, Sortino ${r.sortinoRatio ?? "n/a"}` : (r.engine === "investing" ? investing.riskAdjusted.reason : r.engine === "trading" ? trading.riskAdjusted.reason : options.riskAdjusted.reason) ?? "unavailable"}`,
      ),
    ),
    section(
      "capital-efficiency",
      "Capital Efficiency",
      "Real return relative to real capital committed, per engine.",
      combined.capitalEfficiency.map((c) => `${c.label}: ${c.returnPct != null ? c.returnPct.toFixed(2) + "%" : "unavailable"}`),
    ),
    section(
      "historical-performance-timeline",
      "Historical Performance Timeline",
      timeline.length
        ? `${timeline.length} real, historical data point(s) from monthly realized P&L (Trading/Options) and saved Investing portfolio snapshots.`
        : "No historical performance data points yet.",
      timeline.map((p) => `${p.monthEnd} [${p.source}]: ${p.detail}`),
    ),
  ];

  return {
    reportType: "performance-attribution-report",
    title: "Performance Attribution Report",
    subtitle: `${combined.assetAttribution.length} asset attribution reading(s) across 3 engines`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 21 & 22. Scenario Analysis Report + Stress Test Report (Phase 39) —
// both reuse lib/scenarioEngine.ts's own buildScenarioDashboard() exactly
// (the same function POST /scenario-engine/dashboard itself calls). Zero
// new scenario/repricing math in this file — a genuine, non-overlapping
// split of the same already-computed dashboard: the Scenario Analysis
// Report covers the full multi-scenario, multi-engine Portfolio/Asset/
// Sector/Strategy Impact + Scenario Comparison picture across Investing,
// Trading, and Options; the Stress Test Report narrows to the platform's
// own named severe scenarios (Market -5%, Market -10%, Volatility
// Increase) and surfaces the Options-specific Greeks/Buying Power/Capital
// Impact figures the existing What-If Stress Test engine already
// computes. ───────────────────────────────────────────────────────────

function fmtImpact(v: number | null): string {
  return v == null ? "unavailable" : fmtPnl(v);
}

const STRESS_TEST_SCENARIO_KEYS = ["market_down_5", "market_down_10", "volatility_up"];
const STRESS_TEST_SCENARIO_LABELS = new Set(DEFAULT_SCENARIOS.filter((s) => STRESS_TEST_SCENARIO_KEYS.includes(s.key)).map((s) => s.label));

export function buildScenarioAnalysisReport(dashboard: ScenarioDashboard): InstitutionalReport {
  const { scenarios, investing, trading, combined } = dashboard;
  const priceScenarios = scenarios.filter((s) => s.category === "price");

  const scenarioComparisonBullets = priceScenarios.map((s) => {
    const entries = combined.byEngine.filter((e) => e.scenarioKey === s.key);
    const parts = entries.map((e) => `${e.engine}: ${e.available ? fmtImpact(e.impactDollars) : "unavailable"}`);
    return `${s.label}: ${parts.join(", ")}`;
  });

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      `${scenarios.length} deterministic scenario(s) evaluated across Investing (${investing.holdingsCount} holding(s)), Trading (${trading.openPositionsCount} open position(s)), and Options. Every scenario is a user-named hypothetical repricing over real, already-open holdings/positions/trades — never a forecast, never a probability estimate of the move actually occurring.`,
      scenarioComparisonBullets,
    ),
    section(
      "portfolio-impact-summary",
      "Portfolio Impact Summary",
      "Total repriced impact, per engine, per scenario — reused directly from each engine's own already-computed scenario result.",
      combined.byEngine.map((e) => `[${e.engine}] ${e.scenarioLabel}: ${e.available ? fmtImpact(e.impactDollars) : "unavailable"}`),
    ),
    section(
      "asset-impact",
      "Asset Impact",
      combined.assetImpact.length
        ? `Impact attributed across ${combined.assetImpact.length} asset reading(s) across all 3 engines and every evaluated scenario.`
        : "No asset impact available yet — this user has no Investing holdings, Trading positions, or Options trades on record.",
      combined.assetImpact.slice(0, 25).map((a) => `[${a.engine}] ${a.symbol} (${a.scenarioKey}): ${fmtImpact(a.impactDollars)}`),
    ),
    section(
      "sector-impact",
      "Sector Impact",
      combined.sectorImpact.length
        ? `Investing holdings' impact attributed across ${new Set(combined.sectorImpact.map((s) => s.sector)).size} sector(s).`
        : "No Investing sector impact available yet — this user has no Investing holdings on record.",
      combined.sectorImpact.slice(0, 25).map((s) => `${s.sector} (${s.scenarioKey}): ${fmtImpact(s.impactDollars)}`),
    ),
    section(
      "strategy-impact",
      "Strategy Impact",
      combined.strategyImpact.length
        ? `Impact attributed across ${combined.strategyImpact.length} strategy reading(s) across Trading and Options.`
        : "No strategy impact available yet.",
      combined.strategyImpact.slice(0, 25).map((s) => `[${s.engine}] ${s.label} (${s.scenarioKey}): ${fmtImpact(s.impactDollars)}`),
    ),
    section(
      "scenario-comparison",
      "Scenario Comparison",
      "Every default price scenario, compared side by side across all 3 engines.",
      scenarioComparisonBullets,
    ),
  ];

  return {
    reportType: "scenario-analysis-report",
    title: "Scenario Analysis Report",
    subtitle: `${scenarios.length} scenario(s) across Investing, Trading, and Options`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

export function buildStressTestReport(dashboard: ScenarioDashboard): InstitutionalReport {
  const { options } = dashboard;
  const stressScenarios = options.stressTest.scenarios.filter((s) => STRESS_TEST_SCENARIO_LABELS.has(s.label));
  const base = options.stressTest.base;

  const worst = stressScenarios.reduce<(typeof stressScenarios)[number] | null>((acc, s) => {
    if (s.unrealizedPnlImpact == null) return acc;
    if (acc == null || (acc.unrealizedPnlImpact ?? 0) > s.unrealizedPnlImpact) return s;
    return acc;
  }, null);

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      options.stressTest.available
        ? `${stressScenarios.length} severe scenario(s) evaluated against the Options portfolio's own real, open positions via the existing What-If Stress Test engine (Black-Scholes repricing).${worst ? ` Worst modeled outcome: ${worst.label} (unrealized P&L ${fmtImpact(worst.unrealizedPnlImpact)}).` : ""}`
        : `Options stress testing is currently unavailable: ${options.stressTest.inputIssues.join("; ") || "no open Options positions on record."}`,
      stressScenarios.map((s) => `${s.label}: portfolio value ${fmtImpact(s.portfolioValueImpact)}, unrealized P&L ${fmtImpact(s.unrealizedPnlImpact)}`),
    ),
    section(
      "portfolio-impact-summary",
      "Portfolio Impact Summary (Severe Scenarios)",
      "Total repriced portfolio value and unrealized P&L impact under each severe scenario, reused directly from the existing What-If Stress Test engine's own already-computed comparison.",
      stressScenarios.map((s) => `${s.label}: portfolio value ${fmtImpact(s.portfolioValueImpact)}, unrealized P&L ${fmtImpact(s.unrealizedPnlImpact)}, drawdown ${s.drawdownPct != null ? s.drawdownPct.toFixed(2) + "%" : "unavailable"}`),
    ),
    section(
      "greeks-impact",
      "Greeks Impact",
      `Base portfolio Greeks: delta ${base.greeks.delta}, gamma ${base.greeks.gamma}, theta ${base.greeks.theta}, vega ${base.greeks.vega}. Every figure below shows the SAME real open positions' Greeks immediately after each severe scenario's shock.`,
      stressScenarios.map(
        (s) =>
          `${s.label}: delta ${s.after.greeks.delta} (${s.deltaChange >= 0 ? "+" : ""}${s.deltaChange}), gamma ${s.after.greeks.gamma} (${s.gammaChange >= 0 ? "+" : ""}${s.gammaChange}), theta ${s.after.greeks.theta} (${s.thetaChange >= 0 ? "+" : ""}${s.thetaChange}), vega ${s.after.greeks.vega} (${s.vegaChange >= 0 ? "+" : ""}${s.vegaChange})`,
      ),
    ),
    section(
      "buying-power-impact",
      "Buying Power Impact",
      `Base buying power: ${base.buyingPower != null ? `$${base.buyingPower.toLocaleString()}` : "unavailable"}.`,
      stressScenarios.map((s) => `${s.label}: ${fmtImpact(s.buyingPowerImpactDollars)}`),
    ),
    section(
      "capital-impact",
      "Capital Impact",
      `Base capital at risk: ${base.totalRiskDollars != null ? `$${base.totalRiskDollars.toLocaleString()}` : "unavailable"} (${base.totalRiskPct != null ? base.totalRiskPct.toFixed(2) + "%" : "unavailable"} of account value). A defined-risk options strategy's own reserved margin does not move purely because a price/volatility shock changed the position's mark-to-market value — this is a real property of defined-risk strategies, not an unimplemented feature.`,
      stressScenarios.map(
        (s) => `${s.label}: capital at risk ${s.after.totalRiskDollars != null ? `$${s.after.totalRiskDollars.toLocaleString()}` : "unavailable"} (${s.after.totalRiskPct != null ? s.after.totalRiskPct.toFixed(2) + "%" : "unavailable"})`,
      ),
    ),
  ];

  return {
    reportType: "stress-test-report",
    title: "Stress Test Report",
    subtitle: worst ? `Worst modeled: ${worst.label} (${fmtImpact(worst.unrealizedPnlImpact)})` : `${stressScenarios.length} severe scenario(s) evaluated`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── Institutional Decision Support & Executive Insights Engine (Phase 40) ──
// Both reuse lib/decisionSupportEngine.ts's own buildDecisionSupportDashboard()
// exactly (the same function GET /decision-support/dashboard itself calls),
// then reformat the already-computed dashboard into the generic
// ReportSection shape. Zero new decision-support math in this file. ────────

export function buildExecutiveDecisionSummaryReport(dashboard: DecisionSupportDashboard): InstitutionalReport {
  const { executiveSummary, portfolioHealthOverview, executiveAlerts, outstandingIssues, keyMetrics } = dashboard;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      executiveSummary.summary,
      [
        `Investing: ${executiveSummary.investingHoldingsCount} holding(s) across ${executiveSummary.investingPortfolioCount} portfolio(s), market value ${fmtImpact(executiveSummary.investingMarketValue)}.`,
        `Trading: ${executiveSummary.tradingOpenPositionsCount} open position(s), account value ${fmtImpact(executiveSummary.tradingAccountValue)}.`,
        `Options: ${executiveSummary.optionsOpenPositionsCount} open position(s), portfolio value ${fmtImpact(executiveSummary.optionsPortfolioValue)}, buying power ${fmtImpact(executiveSummary.optionsBuyingPower)}.`,
      ],
    ),
    section(
      "portfolio-health-overview",
      "Portfolio Health Overview",
      `Overall portfolio health ${portfolioHealthOverview.overallScore ?? "n/a"}/100 — a renormalized average of each engine's own already-computed health/risk score.`,
      [
        `Investing: ${portfolioHealthOverview.investing.available ? `${portfolioHealthOverview.investing.score}/100 (${portfolioHealthOverview.investing.label})` : "unavailable"}`,
        `Trading: ${portfolioHealthOverview.trading.available ? `${portfolioHealthOverview.trading.score}/100 (${portfolioHealthOverview.trading.label})` : "unavailable"}`,
        `Options: ${portfolioHealthOverview.options.score}/100 (${portfolioHealthOverview.options.label})`,
      ],
    ),
    section(
      "executive-alerts",
      "Executive Alerts",
      executiveAlerts.length ? `${executiveAlerts.length} deterministic executive alert(s) — real, already-computed thresholds crossed, never a forecast or a suggested action.` : "No executive alerts — every monitored threshold is currently within range.",
      executiveAlerts.map((a) => `[${a.severity}] ${a.label}: ${a.detail}`),
    ),
    section(
      "outstanding-issues",
      "Outstanding Issues",
      outstandingIssues.length ? `${outstandingIssues.length} outstanding issue(s) already flagged by the underlying engines.` : "No outstanding issues on record.",
      outstandingIssues.map((i) => `[${i.engine}] ${i.label}: ${i.detail}`),
    ),
    section(
      "key-metrics-dashboard",
      "Key Metrics Dashboard",
      "Headline figures across Investing, Trading, and Options, reused directly from already-computed engine outputs.",
      keyMetrics.map((m) => `${m.label}: ${m.value != null ? (m.unit === "usd" ? fmtImpact(m.value) : m.unit === "pct" ? `${m.value}%` : m.value) : "n/a"}`),
    ),
  ];

  return {
    reportType: "executive-decision-summary",
    title: "Executive Decision Summary",
    subtitle: `Overall health ${portfolioHealthOverview.overallScore ?? "n/a"}/100 — ${executiveAlerts.length} alert(s), ${outstandingIssues.length} issue(s)`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

export function buildInstitutionalHealthReport(dashboard: DecisionSupportDashboard): InstitutionalReport {
  const { portfolioHealthOverview, riskSummary, diversificationSummary, executiveHealth } = dashboard;

  const sections: ReportSection[] = [
    section(
      "portfolio-health-overview",
      "Portfolio Health Overview",
      `Overall portfolio health ${portfolioHealthOverview.overallScore ?? "n/a"}/100.`,
      [
        `Investing: ${portfolioHealthOverview.investing.available ? `${portfolioHealthOverview.investing.score}/100 (${portfolioHealthOverview.investing.label})` : "unavailable"}`,
        `Trading: ${portfolioHealthOverview.trading.available ? `${portfolioHealthOverview.trading.score}/100 (${portfolioHealthOverview.trading.label})` : "unavailable"}`,
        `Options: ${portfolioHealthOverview.options.score}/100 (${portfolioHealthOverview.options.label})`,
      ],
    ),
    section(
      "risk-summary",
      "Risk Summary",
      "Each engine's own already-computed overall risk score, reused directly — never blended into one cross-engine risk figure.",
      [
        `Investing risk score: ${riskSummary.investingRiskScore ?? "n/a"}`,
        `Trading risk score: ${riskSummary.tradingRiskScore ?? "n/a"}`,
        `Options risk score (base case): ${riskSummary.optionsRiskScoreBaseline ?? "n/a"}`,
      ],
    ),
    section(
      "diversification-summary",
      "Diversification Summary",
      "Each engine's own already-computed diversification/concentration score, plus the disclosed, non-fabricated cross-engine symbol overlap.",
      [
        `Investing: ${diversificationSummary.investing.available ? `${diversificationSummary.investing.score}/100` : "unavailable"} — ${diversificationSummary.investing.detail}`,
        `Trading: ${diversificationSummary.trading.available ? `${diversificationSummary.trading.score}/100` : "unavailable"} — ${diversificationSummary.trading.detail}`,
        `Options: ${diversificationSummary.options.score}/100 — ${diversificationSummary.options.detail}`,
        `Symbols held across multiple engines: ${diversificationSummary.correlationOverview.overlapSymbolCount}`,
      ],
    ),
    section(
      "executive-health-scorecard",
      "Executive Health Scorecard",
      `Composite health score ${executiveHealth.compositeScore ?? "n/a"}/100 — a renormalized average over the dimensions with a genuine, already-existing 0-100 score. Dimensions without a scoring formula are shown as raw figures, honestly excluded from the composite, never approximated.`,
      executiveHealth.dimensions.map((d) => `${d.label}${d.score != null ? ` (${d.score}/100${d.includedInComposite ? ", in composite" : ""})` : ""}: ${d.detail}`),
    ),
  ];

  return {
    reportType: "institutional-health-report",
    title: "Institutional Health Report",
    subtitle: `Composite health ${executiveHealth.compositeScore ?? "n/a"}/100`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 26. Portfolio Allocation Report (Phase 41) — reuses
// lib/rebalancingEngine.ts's own buildRebalancingDashboard() output
// directly (the same function GET /rebalancing/dashboard itself calls).
// Zero new allocation/drift math in this file. Planning and analysis
// only — no trade recommendations, no automatic rebalancing. ────────────

export function buildPortfolioAllocationReport(dashboard: RebalancingDashboard): InstitutionalReport {
  const { portfolios, crossEngineCapitalAllocation, crossEngineSectorAllocation, crossEngineStrategyAllocation, crossEngineAssetAllocation, allocationTimeline, targetAllocationAvailability } = dashboard;

  const driftedCount = portfolios.reduce((s, p) => s + p.allocation.holdings.filter((h) => h.rebalanceAction === "buy" || h.rebalanceAction === "sell").length, 0);

  const sections: ReportSection[] = [
    section(
      "current-vs-target-allocation",
      "Current vs. Target Allocation",
      dashboard.summary,
      portfolios.map(
        (p) =>
          `${p.portfolioName}: ${p.allocation.holdings.length} holding(s)` +
          (p.allocation.totalMarketValue != null ? `, market value $${p.allocation.totalMarketValue.toLocaleString()}` : ", market value unavailable") +
          (p.allocation.targetWeightSumWarning ? ` — ${p.allocation.targetWeightSumWarning}` : ""),
      ),
    ),
    section(
      "allocation-drift",
      "Allocation Drift",
      driftedCount > 0
        ? `${driftedCount} holding(s) across all portfolios have drifted more than ${REBALANCE_DRIFT_THRESHOLD_PCT}pp from their own stored target weight.`
        : "No holding has drifted more than the threshold from its own stored target weight.",
      portfolios.flatMap((p) =>
        p.allocation.holdings
          .filter((h) => h.rebalanceAction === "buy" || h.rebalanceAction === "sell")
          .map(
            (h) =>
              `[${p.portfolioName}] ${h.symbol}: current ${h.actualWeightPct ?? "n/a"}% vs. target ${h.targetWeightPct}% (drift ${h.driftPct != null ? `${h.driftPct > 0 ? "+" : ""}${h.driftPct}pp` : "n/a"}, ${h.rebalanceAction})`,
          ),
      ),
    ),
    section(
      "sector-allocation",
      "Sector Allocation",
      crossEngineSectorAllocation.length
        ? `Sector exposure across ${crossEngineSectorAllocation.length} sector reading(s) across Investing and Options, reused directly from the Risk & Exposure Engine.`
        : "No sector data available yet.",
      crossEngineSectorAllocation.map((s) => `[${s.engine}] ${s.sector}: ${s.weightPct.toFixed(1)}%`),
    ),
    section(
      "asset-allocation",
      "Asset Allocation",
      "Position/holding counts across all 3 engines, reused directly from the Risk & Exposure Engine.",
      [
        `Investing holdings: ${crossEngineAssetAllocation.investingHoldingsCount} across ${crossEngineAssetAllocation.investingPortfolioCount} portfolio(s)`,
        `Trading open positions: ${crossEngineAssetAllocation.tradingOpenPositionsCount}`,
        `Options open positions: ${crossEngineAssetAllocation.optionsOpenPositionsCount}`,
      ],
    ),
    section(
      "strategy-allocation",
      "Strategy Allocation",
      crossEngineStrategyAllocation.length
        ? `Open options risk spread across ${crossEngineStrategyAllocation.length} strategy(ies), reused directly from the Risk & Exposure Engine.`
        : "No open options positions to break down by strategy.",
      crossEngineStrategyAllocation.map((s) => `${s.label ?? s.key}: ${s.positionCount} position(s) (${s.weightPct.toFixed(1)}%)`),
    ),
    section(
      "capital-allocation",
      "Capital Allocation",
      "Real committed capital across all 3 engines, reused directly from the Risk & Exposure Engine.",
      crossEngineCapitalAllocation.map((c) => `${c.label}: ${c.value != null ? `$${c.value.toLocaleString()}` : "unavailable"}`),
    ),
    section(
      "allocation-timeline",
      "Allocation Timeline",
      allocationTimeline.length
        ? `${allocationTimeline.length} real, historical data point(s), reused directly from the Risk & Exposure Engine's own Concentration Timeline.`
        : "No historical allocation data points yet.",
      allocationTimeline.map((p) => `${p.date} [${p.source}]: ${p.detail}`),
    ),
    section(
      "target-allocation-availability",
      "Target Allocation Availability",
      "Honest disclosure of which engines have a genuine, stored target-weight concept to compare against — never approximated for an engine that has none.",
      targetAllocationAvailability.map((t) => `${t.engine}: ${t.available ? "available" : "unavailable"} — ${t.reason}`),
    ),
  ];

  return {
    reportType: "portfolio-allocation-report",
    title: "Portfolio Allocation Report",
    subtitle: `${portfolios.length} Investing portfolio(s) · ${driftedCount} holding(s) drifted`,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 27. Rebalancing Planning Report (Phase 41) — reuses
// lib/rebalancingEngine.ts's own buildProposedAllocationComparison()
// output directly (the same function POST
// /rebalancing/portfolios/:id/propose itself calls). Zero new drift/
// capital-movement math in this file. Planning and analysis only — never a
// suggested trade or share count. ─────────────────────────────────────────

export function buildRebalancingPlanningReport(comparison: ProposedAllocationComparison, portfolioName: string): InstitutionalReport {
  const { current, proposed, rows, totalCapitalToDeployDollars, totalCapitalToRaiseDollars, summary } = comparison;

  const movedCount = rows.filter((r) => r.rebalanceActionVsProposed === "buy" || r.rebalanceActionVsProposed === "sell").length;

  const sections: ReportSection[] = [
    section(
      "executive-summary",
      "Executive Summary",
      summary,
      [
        `Current market value: ${current.totalMarketValue != null ? `$${current.totalMarketValue.toLocaleString()}` : "unavailable"}`,
        `Proposed market value: ${proposed.totalMarketValue != null ? `$${proposed.totalMarketValue.toLocaleString()}` : "unavailable"}`,
      ],
    ),
    section(
      "proposed-allocation-comparison",
      "Proposed Allocation Comparison",
      `${rows.length} holding(s) compared. ${movedCount} would drift more than ${REBALANCE_DRIFT_THRESHOLD_PCT}pp from the proposed target weights.`,
      rows.map(
        (r) =>
          `${r.symbol}: current ${r.currentWeightPct ?? "n/a"}% → proposed target ${r.proposedTargetWeightPct}%` +
          (r.storedTargetWeightPct !== r.proposedTargetWeightPct ? ` (stored target was ${r.storedTargetWeightPct}%)` : "") +
          ` — drift ${r.driftFromProposedPct != null ? `${r.driftFromProposedPct > 0 ? "+" : ""}${r.driftFromProposedPct}pp` : "n/a"}, ${r.rebalanceActionVsProposed}`,
      ),
    ),
    section(
      "capital-movement-required",
      "Capital Movement Required",
      `Approximately $${(totalCapitalToDeployDollars ?? 0).toLocaleString()} would need to move in and $${(totalCapitalToRaiseDollars ?? 0).toLocaleString()} would need to move out to fully close every drift from the proposed target weights. Dollar figures only — never a suggested trade, share count, or order.`,
      rows
        .filter((r) => r.capitalMovementDollars != null && r.capitalMovementDollars !== 0)
        .map((r) => `${r.symbol}: ${r.capitalMovementDollars! > 0 ? "+" : ""}$${r.capitalMovementDollars!.toLocaleString()}`),
    ),
  ];

  return {
    reportType: "rebalancing-planning-report",
    title: `Rebalancing Planning Report — ${portfolioName}`,
    subtitle: summary,
    symbol: null,
    portfolioId: comparison.portfolioId,
    generatedAt: new Date().toISOString(),
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 28. Compliance Report (Phase 42) — reuses
// lib/complianceEngine.ts's own buildMonitoringComplianceDashboard()
// output directly (the same function GET /compliance/dashboard itself
// calls). Zero new policy-evaluation math in this file. Executive-summary
// level only — the Compliance Summary and every current Policy
// Violation. Monitoring only — no trade recommendations, no
// auto-remediation. ─────────────────────────────────────────────────────

function evaluationBullet(e: PolicyEvaluation): string {
  return `[${e.category}] ${e.label}${e.targetKey ? ` (${e.targetKey})` : ""}: ${e.detail}`;
}

export function buildComplianceReport(dashboard: MonitoringComplianceDashboard): InstitutionalReport {
  const { complianceSummary, policyViolations } = dashboard;

  const sections: ReportSection[] = [
    section(
      "compliance-summary",
      "Compliance Summary",
      complianceSummary.summary,
      [
        `Total policies: ${complianceSummary.totalPolicies} (${complianceSummary.enabledPolicies} enabled)`,
        `Compliant: ${complianceSummary.compliantCount}`,
        `Breach: ${complianceSummary.breachCount}`,
        `Unavailable: ${complianceSummary.unavailableCount}`,
        `Overall status: ${complianceSummary.overallStatus}`,
      ],
    ),
    section(
      "policy-violations",
      "Policy Violations",
      policyViolations.length
        ? `${policyViolations.length} enabled policy(ies) currently in breach. Monitoring only — no recommended remediation.`
        : "No enabled policy is currently in breach.",
      policyViolations.map(evaluationBullet),
    ),
  ];

  return {
    reportType: "compliance-report",
    title: "Compliance Report",
    subtitle: complianceSummary.summary,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 29. Policy Monitoring Report (Phase 42) — reuses the same
// MonitoringComplianceDashboard, but surfaces the full operational
// detail: every category-grouped limit section plus the Compliance
// Timeline. Zero new policy-evaluation math in this file. Monitoring
// only — no trade recommendations, no portfolio optimisation. ──────────

export function buildPolicyMonitoringReport(dashboard: MonitoringComplianceDashboard): InstitutionalReport {
  const {
    complianceSummary,
    allocationLimits,
    sectorLimits,
    assetLimits,
    positionLimits,
    strategyLimits,
    greeksLimits,
    buyingPowerLimits,
    incomeStabilityLimits,
    diversificationLimits,
    complianceTimeline,
    complianceTimelineNote,
  } = dashboard;

  const categorySection = (id: string, title: string, evaluations: PolicyEvaluation[]): ReportSection =>
    section(
      id,
      title,
      evaluations.length ? `${evaluations.length} policy(ies) configured for ${title}.` : `No policy configured for ${title} yet.`,
      evaluations.map((e) => `${evaluationBullet(e)} [current ${e.currentValue ?? "unavailable"} vs. limit ${e.limitValue}${e.differenceValue != null ? `, difference ${e.differenceValue > 0 ? "+" : ""}${e.differenceValue}` : ""}]`),
    );

  const sections: ReportSection[] = [
    section("compliance-summary", "Compliance Summary", complianceSummary.summary, [
      `Total policies: ${complianceSummary.totalPolicies} (${complianceSummary.enabledPolicies} enabled)`,
      `Overall status: ${complianceSummary.overallStatus}`,
    ]),
    categorySection("allocation-limits", "Allocation Limits", allocationLimits),
    categorySection("sector-limits", "Sector Limits", sectorLimits),
    categorySection("asset-limits", "Asset Limits", assetLimits),
    categorySection("position-limits", "Position Limits", positionLimits),
    categorySection("strategy-limits", "Strategy Limits", strategyLimits),
    categorySection("greeks-limits", "Greeks Limits", greeksLimits),
    categorySection("buying-power-limits", "Buying Power Limits", buyingPowerLimits),
    categorySection("income-stability-limits", "Income Stability Limits", incomeStabilityLimits),
    categorySection("diversification-limits", "Diversification Limits", diversificationLimits),
    section(
      "compliance-timeline",
      "Compliance Timeline",
      complianceTimeline.length ? `${complianceTimeline.length} real, historical data point(s). ${complianceTimelineNote}` : `No historical data points yet. ${complianceTimelineNote}`,
      complianceTimeline.map((p) => `${p.date} [${p.source}]: ${p.detail}`),
    ),
  ];

  return {
    reportType: "policy-monitoring-report",
    title: "Policy Monitoring Report",
    subtitle: complianceSummary.summary,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 30. Watchlist Summary Report (Phase 43) — reuses
// lib/watchlistsEngine.ts's own buildWatchlistsDashboard() output directly
// (the same function GET /investing/watchlists/dashboard itself calls).
// Zero new scoring/aggregation math in this file — executive-summary
// level only, the dashboard-level rollup (Watchlist Health per list, the
// Cross-Engine Summary, and the dashboard-level Highest Risk/Exposure/
// Allocation/Policy Breaches/Scenario Impact/Performance Summary/
// Outstanding Issues), never the full per-symbol detail (that is the
// Opportunity Dashboard Report's own job, below). Distinct from the
// existing "watchlist" report type, which covers the separate, single
// flat price/margin-of-safety value_watchlist system. Monitoring and
// organisation only — no trade recommendations, no ranked/scored
// opportunity signal. ─────────────────────────────────────────────────────

export function buildWatchlistSummaryReport(dashboard: WatchlistsDashboard): InstitutionalReport {
  const { watchlists, watchlistHealth, crossEngineSummary, dashboardSummary } = dashboard;

  const sections: ReportSection[] = [
    section(
      "watchlist-overview",
      "Watchlist Overview",
      watchlists.length ? `${watchlists.length} watchlist(s), ${dashboardSummary.itemCount} watched symbol(s) (${dashboardSummary.distinctSymbolCount} distinct), ${dashboardSummary.heldSymbolCount} currently held somewhere.` : "No watchlists have been created yet.",
      watchlists.map((w) => `${w.name} [${w.kind}]${w.archived ? " (archived)" : ""}: ${w.itemCount} symbol(s).`),
    ),
    section(
      "watchlist-health",
      "Watchlist Health",
      watchlistHealth.length ? `${watchlistHealth.length} watchlist(s) evaluated.` : "No watchlists to evaluate yet.",
      watchlistHealth.map(
        (h) =>
          `${h.name} [${h.kind}]: ${h.heldCount}/${h.itemCount} held, ${h.breachCount} breach(es)${h.totalMarketValue != null ? `, $${h.totalMarketValue.toLocaleString()} total market value` : ""}${h.totalUnrealizedPnl != null ? `, $${h.totalUnrealizedPnl.toLocaleString()} total unrealized P&L` : ""}.`,
      ),
    ),
    section(
      "cross-engine-summary",
      "Cross-Engine Summary",
      `Executive Health: ${crossEngineSummary.executiveHealth.healthScore}/100 (${crossEngineSummary.executiveHealth.overallRiskRating.label}). Compliance: ${crossEngineSummary.complianceSummary.compliantCount} compliant, ${crossEngineSummary.complianceSummary.breachCount} breach(es).`,
      [
        ...crossEngineSummary.capitalAllocation.map((c) => `${c.label}: ${c.value != null ? `$${c.value.toLocaleString()}` : "unavailable"}`),
        `Investing diversification: ${crossEngineSummary.investingDiversification.available ? `${crossEngineSummary.investingDiversification.score}/100` : "unavailable"} — ${crossEngineSummary.investingDiversification.detail}`,
        `Options diversification: ${crossEngineSummary.optionsDiversification.available ? `${crossEngineSummary.optionsDiversification.score}/100` : "unavailable"} — ${crossEngineSummary.optionsDiversification.detail}`,
      ],
    ),
    section(
      "watchlist-dashboard-summary",
      "Dashboard Summary",
      `${dashboardSummary.policyBreaches.length} enabled compliance policy(ies) currently in breach across watched symbols.`,
      [
        dashboardSummary.highestRisk ? `Highest Risk: ${dashboardSummary.highestRisk.symbol} — ${dashboardSummary.highestRisk.detail}` : "Highest Risk: unavailable (no watched symbol carries a resolvable scenario impact).",
        dashboardSummary.highestExposure ? `Highest Exposure: ${dashboardSummary.highestExposure.symbol} at ${dashboardSummary.highestExposure.weightPct}% (${dashboardSummary.highestExposure.engine}).` : "Highest Exposure: unavailable.",
        dashboardSummary.highestAllocation ? `Highest Allocation: ${dashboardSummary.highestAllocation.symbol} at $${dashboardSummary.highestAllocation.marketValue.toLocaleString()} (${dashboardSummary.highestAllocation.engine}).` : "Highest Allocation: unavailable.",
        dashboardSummary.scenarioImpact.detail,
        dashboardSummary.performanceSummary.detail,
        ...dashboardSummary.outstandingIssues,
      ],
    ),
  ];

  return {
    reportType: "watchlist-summary-report",
    title: "Watchlist Summary Report",
    subtitle: dashboardSummary.performanceSummary.detail,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 31. Opportunity Dashboard Report (Phase 43) — reuses the same
// WatchlistsDashboard's own opportunityOverview array directly. Zero new
// scoring/aggregation math in this file — the full per-symbol detail
// (allocation, performance, Greeks where applicable, scenario impact,
// compliance status) for every distinct watched symbol. Distinct from the
// existing "opportunity-discovery" report type, which is a universe-wide
// screening scan, never scoped to a user's own watchlists. Monitoring
// only — no trade recommendations, no ranked/scored opportunity signal:
// every symbol is listed in the same deterministic order the dashboard
// itself already produces (distinct-symbol discovery order), never sorted
// by an implied "best opportunity first." ───────────────────────────────

function symbolAnalyticsBullet(s: SymbolAnalytics): string {
  const parts: string[] = [];
  if (s.investing) parts.push(`Investing: $${s.investing.marketValue?.toLocaleString() ?? "?"} (${s.investing.weightPct ?? "?"}%)`);
  if (s.trading) parts.push(`Trading: ${s.trading.openPositionsCount} open position(s)`);
  if (s.options) parts.push(`Options: ${s.options.openPositionsCount} open position(s)${s.options.weightPct != null ? ` (${s.options.weightPct}%)` : ""}`);
  if (s.compliance) parts.push(`Compliance: ${s.compliance.status}`);
  if (s.scenarioWorstCaseImpactDollars != null) parts.push(`Worst-case scenario impact: $${s.scenarioWorstCaseImpactDollars.toLocaleString()}`);
  const held = s.heldInInvesting || s.heldInTrading || s.heldInOptions;
  return `${s.symbol}: ${held ? parts.join("; ") : "not currently held in any engine"}`;
}

export function buildOpportunityDashboardReport(dashboard: WatchlistsDashboard): InstitutionalReport {
  const { opportunityOverview } = dashboard;
  const heldCount = opportunityOverview.filter((s) => s.heldInInvesting || s.heldInTrading || s.heldInOptions).length;

  const sections: ReportSection[] = [
    section(
      "opportunity-overview",
      "Opportunity Overview",
      opportunityOverview.length
        ? `${opportunityOverview.length} distinct watched symbol(s), ${heldCount} currently held somewhere. Monitoring only — never a ranked or scored opportunity signal.`
        : "No watched symbols yet.",
      opportunityOverview.map(symbolAnalyticsBullet),
    ),
  ];

  return {
    reportType: "opportunity-dashboard-report",
    title: "Opportunity Dashboard Report",
    subtitle: opportunityOverview.length ? `${opportunityOverview.length} distinct watched symbol(s), ${heldCount} currently held somewhere.` : "No watched symbols yet.",
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 32. Portfolio Workspace Summary Report (Phase 44) — reuses the same
// PortfolioWorkspaceDashboard's own already-computed fields directly. Zero
// new scoring/aggregation math in this file — a concise headline reformat
// of Executive Home, Portfolio Snapshot, Holdings/Trading/Options
// Overview, and the merged Outstanding Issues list. Orchestration only —
// no trade recommendations, no AI predictions. ─────────────────────────

export function buildPortfolioWorkspaceSummaryReport(dashboard: PortfolioWorkspaceDashboard): InstitutionalReport {
  const { executiveHome, holdingsOverview, tradingOverview, optionsOverview, outstandingIssues, activeWorkflows, recentReports } = dashboard;

  const sections: ReportSection[] = [
    section("workspace-executive-home", "Executive Home", executiveHome.summary, [
      `Overall portfolio health: ${executiveHome.overallHealthScore ?? "n/a"}/100.`,
      `${executiveHome.alertCount} executive alert(s), ${executiveHome.outstandingIssueCount} outstanding issue(s) on record.`,
    ]),
    section(
      "workspace-holdings-overview",
      "Holdings Overview",
      holdingsOverview.summary,
      holdingsOverview.topAllocations.map((a) => `${a.symbol}: $${a.marketValue?.toLocaleString() ?? "n/a"} (${a.weightPct ?? "n/a"}%)`),
    ),
    section("workspace-trading-overview", "Trading Overview", tradingOverview.summary, [
      `Account value: ${tradingOverview.accountValue != null ? `$${tradingOverview.accountValue.toLocaleString()}` : "n/a"}.`,
      `Stop/target discipline: ${tradingOverview.stopTargetDisciplinePct ?? "n/a"}%.`,
    ]),
    section("workspace-options-overview", "Options Overview", optionsOverview.summary, [
      `Buying power: ${optionsOverview.buyingPower != null ? `$${optionsOverview.buyingPower.toLocaleString()}` : "n/a"}.`,
    ]),
    section(
      "workspace-active-workflows",
      "Active Workflows",
      activeWorkflows.length ? `${activeWorkflows.length} workflow(s) currently in progress.` : "No workflows currently in progress.",
      activeWorkflows.map((w) => `${w.title}: ${w.completedStepKeys.length}/${w.totalSteps} step(s) completed.`),
    ),
    section(
      "workspace-recent-reports",
      "Recent Reports",
      `${recentReports.totalReports} report(s) on record across ${recentReports.distinctReportTypesUsed} categor${recentReports.distinctReportTypesUsed === 1 ? "y" : "ies"}.`,
      recentReports.recentReports.map((r) => `${r.title} (${r.reportType})`),
    ),
    section(
      "workspace-outstanding-issues",
      "Outstanding Issues",
      outstandingIssues.length ? `${outstandingIssues.length} outstanding issue(s) across the platform.` : "No outstanding issues.",
      outstandingIssues.map((i) => `[${i.source}] ${i.label}: ${i.detail}`),
    ),
  ];

  return {
    reportType: "portfolio-workspace-summary",
    title: "Portfolio Workspace Summary Report",
    subtitle: executiveHome.summary,
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

// ─── 33. Institutional Review Report (Phase 44) — the deeper review
// record: Risk/Compliance/Watchlists Overview detail, Active Workflows,
// and every merged Outstanding Issue. Reuses the same
// PortfolioWorkspaceDashboard's own already-computed fields directly. Zero
// new scoring/aggregation math in this file. Orchestration only — no
// trade recommendations, no AI predictions. ─────────────────────────────

export function buildInstitutionalReviewReport(dashboard: PortfolioWorkspaceDashboard): InstitutionalReport {
  const { portfolioSnapshot, riskOverview, complianceOverview, watchlistsOverview, activeWorkflows, outstandingIssues } = dashboard;

  const sections: ReportSection[] = [
    section("review-portfolio-health", "Portfolio Health Overview", portfolioSnapshot.executiveSummary.summary, [
      `Overall score: ${portfolioSnapshot.portfolioHealthOverview.overallScore ?? "n/a"}/100.`,
    ]),
    section(
      "review-risk-overview",
      "Risk Overview",
      `Investing risk score: ${riskOverview.investing.risk.overall.score ?? "n/a"}/100. Trading risk score: ${riskOverview.trading.risk.overall.score ?? "n/a"}/100.`,
      [`Combined capital allocation across ${riskOverview.combined.capitalAllocation.length} engine(s) on record.`],
    ),
    section(
      "review-compliance-overview",
      "Compliance Overview",
      `${complianceOverview.complianceSummary.compliantCount} compliant, ${complianceOverview.complianceSummary.breachCount} breach(es).`,
      complianceOverview.policyViolations.map((p) => `${p.label}: ${p.detail}`),
    ),
    section(
      "review-watchlists-overview",
      "Watchlists Overview",
      watchlistsOverview.dashboardSummary.performanceSummary.detail,
      watchlistsOverview.watchlistHealth.map((h) => `${h.name} [${h.kind}]: ${h.heldCount}/${h.itemCount} held, ${h.breachCount} breach(es).`),
    ),
    section(
      "review-active-workflows",
      "Active Workflows",
      activeWorkflows.length ? `${activeWorkflows.length} review workflow(s) currently in progress.` : "No review workflow currently in progress.",
      activeWorkflows.map((w) => `${w.title} (started ${w.startedAt}): ${w.completedStepKeys.length}/${w.totalSteps} step(s) completed.`),
    ),
    section(
      "review-outstanding-issues",
      "Outstanding Issues",
      outstandingIssues.length ? `${outstandingIssues.length} outstanding issue(s) identified during this review.` : "No outstanding issues identified during this review.",
      outstandingIssues.map((i) => `[${i.source}] ${i.label}: ${i.detail}`),
    ),
  ];

  return {
    reportType: "institutional-review-report",
    title: "Institutional Review Report",
    subtitle: outstandingIssues.length ? `${outstandingIssues.length} outstanding issue(s) identified during this review.` : "No outstanding issues identified during this review.",
    symbol: null,
    portfolioId: null,
    generatedAt: dashboard.generatedAt,
    dataSource: "MIXED",
    sections,
    disclaimer: REPORT_DISCLAIMER,
  };
}

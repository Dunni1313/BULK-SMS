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
  | "trading-analytics-summary";

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

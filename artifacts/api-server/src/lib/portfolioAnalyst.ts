// AI Portfolio Analyst — Phase 8, Sprint 3. The executive portfolio
// briefing layer intelligenceEngine.ts's own header comment already
// named as a future consumer.
//
// PURE COMPOSITION. This module introduces ZERO new pricing, risk, or
// scoring calculations — every field below is either a direct
// pass-through of an already-computed value, a plain array
// filter/sort/group over already-computed values, a disclosed template
// sentence chosen from a fixed lookup table (the exact "Summary Engine"
// technique intelligenceSummary.ts already established), or the
// already-existing computeTrend() primitive applied to a genuinely
// stored historical figure (never a fabricated trend). Reused,
// unmodified: buildInstitutionalIntelligence() (Observation/Explanation
// /Health/Summary/Timeline/Learning Engines), buildPortfolioDashboard(),
// buildPortfolioEventRiskOverlay(), currentOpenTrades(),
// computeTradeGreeks(), computeThetaIncome(), computeTrend(),
// learningLinksFor(), getLearningTopic(), getGlossaryTerm(),
// getStrategyAcademyEntry(). Not an LLM, not a chatbot, not predictive
// AI, not financial advice, not trade recommendations.
//
// intelligenceEngine.ts/intelligenceHealth.ts/intelligenceSummary.ts/
// intelligenceTimeline.ts/intelligenceObservations.ts/
// intelligenceLearning.ts are read from, never modified — this file's
// own zero-line diff on those modules is confirmed by regression tests
// proving every reused figure is byte-identical to a standalone call.

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db, intelligenceSnapshotsTable, type IntelligenceSnapshotRow } from "@workspace/db";
import { buildInstitutionalIntelligence, type InstitutionalIntelligenceResult } from "./intelligenceEngine.js";
import { buildPortfolioDashboard, type PortfolioDashboardResult } from "./portfolioDashboard.js";
import { buildPortfolioEventRiskOverlay, type PositionEventRisk } from "./portfolioEventRisk.js";
import { currentOpenTrades } from "./positionSizing.js";
import { computeTradeGreeks } from "./serverState.js";
import { computeThetaIncome, type ThetaIncome } from "./thetaIncome.js";
import { computeTrend, type TrendDirection } from "./intelligenceTrend.js";
import { learningLinksFor, type LearningCategory, type LearningLink } from "./intelligenceLearning.js";
import { getLearningTopic } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";
import { getStrategyAcademyEntry, type StrategyAcademyKey } from "./strategyAcademy.js";
import type { HealthDriver } from "./intelligenceHealth.js";
import type { TimelineEntry } from "./intelligenceTimeline.js";

// ─── Portfolio Snapshot ──────────────────────────────────────────────────────
// Direct pass-through of lib/portfolioDashboard.ts's own already-computed
// fields (Portfolio Health, Overall Score, Buying Power, Open Positions,
// Total Exposure) plus the exact same 3-function theta composition
// intelligenceEngine.ts's own header comment documents
// (currentOpenTrades -> computeTradeGreeks -> computeThetaIncome) for
// Monthly Theta. Net Liquidation and Daily P/L are deliberately NOT
// duplicated here — they live in the pre-existing Options Income
// Engine's own GET /portfolio/summary (routes/portfolio.ts), which the
// frontend calls directly via its own already-generated hook, mirroring
// CommandCenter.tsx's own established multi-engine composition pattern
// rather than re-deriving that route's own inline arithmetic a second
// time in this file.

export interface PortfolioSnapshot {
  healthScore: number;
  overallRiskRating: { code: string; label: string };
  buyingPower: number;
  openPositionsCount: number;
  monthlyTheta: number;
  dailyTheta: number;
  totalRiskDollars: number;
  totalRiskPct: number;
  generatedAt: string;
}

// The exact same 3-function composition routes/portfolio.ts's own
// GET /portfolio/theta route AND intelligenceEngine.ts's own (private,
// unexported) buildThetaIncome() both already use — reused directly
// here rather than modifying intelligenceEngine.ts to export its own
// private helper. Confirmed byte-identical to intelligenceEngine.ts's
// own internal theta figure by a dedicated regression test, since both
// call the identical underlying functions over the identical data.
async function buildThetaIncome(userId: string): Promise<ThetaIncome> {
  const trades = await currentOpenTrades(userId);
  const positions = trades.map((t) => ({
    symbol: t.symbol,
    strategy: t.strategy,
    theta: computeTradeGreeks(t).theta,
  }));
  return computeThetaIncome(positions);
}

function buildSnapshot(dash: PortfolioDashboardResult, theta: ThetaIncome): PortfolioSnapshot {
  return {
    healthScore: dash.healthScore,
    overallRiskRating: dash.overallRiskRating,
    buyingPower: dash.buyingPower,
    openPositionsCount: dash.openPositionsCount,
    monthlyTheta: theta.monthly,
    dailyTheta: theta.daily,
    totalRiskDollars: dash.totalRiskDollars,
    totalRiskPct: dash.totalRiskPct,
    generatedAt: dash.generatedAt,
  };
}

// ─── Health Summary ──────────────────────────────────────────────────────────
// Reuses the Health Engine's own already-sorted (worst-first)
// healthDrivers array — strengths/weaknesses are a pure slice of that
// same array, zero new scoring.

export interface HealthSummarySection {
  overallHealthScore: number;
  overallRiskRating: { code: string; label: string };
  trend: TrendDirection;
  trendDetail: string;
  strengths: HealthDriver[];
  weaknesses: HealthDriver[];
  drivers: HealthDriver[];
  summary: string;
}

const STRENGTH_WEAKNESS_COUNT = 3;

function buildHealthSummary(intel: InstitutionalIntelligenceResult): HealthSummarySection {
  const health = intel.health;
  // healthDrivers is already sorted worst-first by the Health Engine.
  const weaknesses = health.healthDrivers.slice(0, STRENGTH_WEAKNESS_COUNT);
  const strengths = [...health.healthDrivers].slice(-STRENGTH_WEAKNESS_COUNT).reverse();
  return {
    overallHealthScore: health.overallHealthScore,
    overallRiskRating: health.overallRiskRating,
    trend: health.healthTrend,
    trendDetail: health.healthTrendDetail,
    strengths,
    weaknesses,
    drivers: health.healthDrivers,
    summary: health.healthSummary,
  };
}

// ─── Risk Summary ────────────────────────────────────────────────────────────
// Reuses Stress Testing (dash.stressTestSummary), Event Risk
// (dash.highestEventRisk), Concentration (dash.highestConcentration),
// Correlation/Diversification (the "diversification" health factor),
// and Position Sizing (dash.largestPosition) — all already-computed
// pass-through fields off buildPortfolioDashboard(). Risk trend reuses
// computeTrend() against the genuinely stored prior day's own
// totalRiskPct (intelligence_snapshots.total_risk_pct).

export interface RiskSummarySection {
  highestRisk: string;
  riskTrend: TrendDirection;
  largestExposure: string;
  diversificationScore: number | null;
  worstStressScenario: { label: string; portfolioValueImpact: number; riskScoreAfter: number } | null;
  guidance: PortfolioDashboardResult["guidance"];
}

function buildRiskSummary(dash: PortfolioDashboardResult, prior: IntelligenceSnapshotRow | null): RiskSummarySection {
  const worstStress = [...dash.stressTestSummary].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0] ?? null;
  const riskTrend = computeTrend(dash.totalRiskPct, prior?.totalRiskPct ?? null).direction;
  const diversification = dash.healthFactors.find((f) => f.code === "diversification");

  let highestRisk = "No elevated risk detected";
  if (dash.highestEventRisk && (dash.highestEventRisk.riskLevel === "high" || dash.highestEventRisk.riskLevel === "medium")) {
    highestRisk = `Event Risk (${dash.highestEventRisk.symbol}, ${dash.highestEventRisk.riskLevel})`;
  } else if (dash.guidance.some((g) => g.code === "elevated_concentration" || g.code === "review_large_positions")) {
    highestRisk = "Concentration";
  }

  const largestExposure = dash.highestConcentration
    ? `${dash.highestConcentration.bucket.label} (${dash.highestConcentration.bucket.weightPct.toFixed(1)}% of deployed risk)`
    : dash.largestPosition
      ? `${dash.largestPosition.symbol} (${dash.largestPosition.pctOfAccount.toFixed(2)}% of account)`
      : "No open positions";

  return {
    highestRisk,
    riskTrend,
    largestExposure,
    diversificationScore: diversification?.score ?? null,
    worstStressScenario: worstStress
      ? { label: worstStress.label, portfolioValueImpact: worstStress.portfolioValueImpact, riskScoreAfter: worstStress.riskScoreAfter }
      : null,
    guidance: dash.guidance,
  };
}

// ─── Income Summary ──────────────────────────────────────────────────────────
// Theta Income is the one genuinely already-built income metric for
// this platform's real Paper Trading positions (Premium Collected,
// Income Forecast, and Historical Income for real trades do not exist
// anywhere in this codebase and are honestly NOT fabricated here — see
// docs/AI-Portfolio-Analyst.md for the full disclosure). Income Health
// reuses the exact same computeTrend() comparison the Observation
// Engine's own theta_income_improving/slowing codes are already derived
// from (same inputs, same formula — never a second, competing metric).

export interface IncomeSummarySection {
  monthlyTheta: number;
  weeklyTheta: number;
  dailyTheta: number;
  annualizedTheta: number;
  incomeHealth: TrendDirection;
  incomeHealthDetail: string;
  bySymbol: ThetaIncome["bySymbol"];
  byStrategy: ThetaIncome["byStrategy"];
}

function buildIncomeSummary(theta: ThetaIncome, prior: IntelligenceSnapshotRow | null): IncomeSummarySection {
  const trend = computeTrend(theta.monthly, prior?.thetaMonthly ?? null);
  const incomeHealthDetail =
    trend.direction === "insufficient_history"
      ? "No prior recorded snapshot exists yet — income trend will be available after the next recorded day."
      : trend.direction === "stable"
        ? `Monthly theta income is stable at ${theta.monthly.toFixed(2)} (prior: ${prior!.thetaMonthly.toFixed(2)}).`
        : trend.direction === "improving"
          ? `Monthly theta income rose from ${prior!.thetaMonthly.toFixed(2)} to ${theta.monthly.toFixed(2)}.`
          : `Monthly theta income fell from ${prior!.thetaMonthly.toFixed(2)} to ${theta.monthly.toFixed(2)}.`;

  return {
    monthlyTheta: theta.monthly,
    weeklyTheta: theta.weekly,
    dailyTheta: theta.daily,
    annualizedTheta: theta.annualized,
    incomeHealth: trend.direction,
    incomeHealthDetail,
    bySymbol: theta.bySymbol,
    byStrategy: theta.byStrategy,
  };
}

// ─── Greeks Summary ──────────────────────────────────────────────────────────
// Current values + largest contributor are direct pass-through of
// dash.netGreeks/dash.largestRiskContributor. Only Delta has a genuinely
// stored historical value (intelligence_snapshots.net_delta) — Gamma/
// Theta/Vega trends are honestly reported unavailable rather than
// fabricated, since no prior-day figure is persisted for them.

export interface GreeksSummarySection {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  largestContributor: PortfolioDashboardResult["largestRiskContributor"];
  deltaTrend: TrendDirection;
  deltaTrendDetail: string;
  educationalLinks: LearningLink[];
}

function buildGreeksSummary(dash: PortfolioDashboardResult, prior: IntelligenceSnapshotRow | null): GreeksSummarySection {
  const trend = computeTrend(dash.netGreeks.delta, prior?.netDelta ?? null);
  const deltaTrendDetail =
    trend.direction === "insufficient_history"
      ? "No prior recorded snapshot exists yet — Delta trend will be available after the next recorded day."
      : trend.direction === "stable"
        ? `Net Delta is stable at ${dash.netGreeks.delta} (prior: ${prior!.netDelta}).`
        : trend.direction === "improving"
          ? `Net Delta increased from ${prior!.netDelta} to ${dash.netGreeks.delta}.`
          : `Net Delta decreased from ${prior!.netDelta} to ${dash.netGreeks.delta}.`;

  return {
    delta: dash.netGreeks.delta,
    gamma: dash.netGreeks.gamma,
    theta: dash.netGreeks.theta,
    vega: dash.netGreeks.vega,
    largestContributor: dash.largestRiskContributor,
    deltaTrend: trend.direction,
    deltaTrendDetail,
    educationalLinks: learningLinksFor("greeks_exposure"),
  };
}

// ─── Event Summary ───────────────────────────────────────────────────────────
// Reuses buildPortfolioEventRiskOverlay()'s own full per-position list
// (unmodified) for "Safe Positions" (riskLevel === "none"); Expiration
// Clusters reuses dash.expirationDistribution (already a Concentration
// overlay bucket list).

export interface EventSummarySection {
  upcomingEvents: PortfolioDashboardResult["eventTimelineSummary"];
  highestRiskEvent: PortfolioDashboardResult["highestEventRisk"];
  safePositionsCount: number;
  atRiskPositionsCount: number;
  expirationClusters: PortfolioDashboardResult["expirationDistribution"];
}

function buildEventSummary(dash: PortfolioDashboardResult, eventPositions: PositionEventRisk[]): EventSummarySection {
  const safePositions = eventPositions.filter((p) => p.riskLevel === "none");
  return {
    upcomingEvents: dash.eventTimelineSummary,
    highestRiskEvent: dash.highestEventRisk,
    safePositionsCount: safePositions.length,
    atRiskPositionsCount: eventPositions.length - safePositions.length,
    expirationClusters: dash.expirationDistribution,
  };
}

// ─── Learning Summary ────────────────────────────────────────────────────────
// Every section links to a related lesson + related glossary term
// (reusing intelligenceLearning.ts's own per-category catalog, built by
// the AI Teacher & Learning Centre sprint) plus a related Strategy
// Academy entry (the one small, disclosed new mapping this file adds —
// a category-to-strategy-key lookup table, following the exact same
// "reuse real keys, honestly omit when no match exists" precedent
// intelligenceLearning.ts's own CATEGORY_LESSON/CATEGORY_GLOSSARY maps
// already established).

export interface LearningCrossLink {
  category: string;
  lessonHref: string | null;
  lessonTitle: string | null;
  glossaryHref: string | null;
  glossaryTerm: string | null;
  strategyHref: string | null;
  strategyLabel: string | null;
}

// Maps each Learning Summary section (not a raw Observation category) to
// a representative strategy — never fabricated, only real
// StrategyAcademyKey values.
const SECTION_STRATEGY: Record<string, StrategyAcademyKey> = {
  health: "iron_condor",
  risk: "vertical_spread",
  income: "covered_call",
  greeks: "iron_condor",
  event: "calendar_spread",
};

const SECTION_CATEGORY: Record<string, LearningCategory> = {
  health: "portfolio_health",
  risk: "concentration",
  income: "theta_income",
  greeks: "greeks_exposure",
  event: "event_risk",
};

function crossLinkFor(section: keyof typeof SECTION_CATEGORY): LearningCrossLink {
  const category = SECTION_CATEGORY[section];
  const links = learningLinksFor(category);
  const lesson = links.find((l) => l.label.startsWith("Lesson:")) ?? null;
  const glossary = links.find((l) => l.label.startsWith("Glossary:")) ?? null;
  const strategyKey = SECTION_STRATEGY[section];
  const strategy = strategyKey ? getStrategyAcademyEntry(strategyKey) : null;
  return {
    category,
    lessonHref: lesson?.href ?? null,
    lessonTitle: lesson ? lesson.label.replace(/^Lesson:\s*/, "") : null,
    glossaryHref: glossary?.href ?? null,
    glossaryTerm: glossary ? glossary.label.replace(/^Glossary:\s*/, "") : null,
    strategyHref: strategy ? `/learn/strategy-academy/${strategy.key}` : null,
    strategyLabel: strategy?.label ?? null,
  };
}

export interface LearningSummarySection {
  health: LearningCrossLink;
  risk: LearningCrossLink;
  income: LearningCrossLink;
  greeks: LearningCrossLink;
  event: LearningCrossLink;
}

function buildLearningSummary(): LearningSummarySection {
  return {
    health: crossLinkFor("health"),
    risk: crossLinkFor("risk"),
    income: crossLinkFor("income"),
    greeks: crossLinkFor("greeks"),
    event: crossLinkFor("event"),
  };
}

// ─── Timeline (Yesterday / Today / This Week) ───────────────────────────────
// Reuses the Timeline Engine's own already-built entries (grouped by
// their own already-computed status, zero new diffing logic) for
// Resolved/New/Persistent Issues and the Yesterday/Today comparison.
// "This Week" is a genuinely new, but strictly read-only, query against
// the same already-persisted intelligence_snapshots table (a plain
// SELECT + min/max/computeTrend() over already-stored healthScore
// values spanning the last 7 calendar days) — never a new scoring
// formula, honestly reporting insufficient history when fewer than 2
// days have been recorded.

export interface WeeklyHealthSummary {
  daysRecorded: number;
  healthScoreMin: number | null;
  healthScoreMax: number | null;
  trend: TrendDirection;
}

async function buildWeeklySummary(userId: string, now: Date): Promise<WeeklyHealthSummary> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(intelligenceSnapshotsTable)
    .where(and(eq(intelligenceSnapshotsTable.userId, userId), gte(intelligenceSnapshotsTable.snapshotDate, cutoff)))
    .orderBy(intelligenceSnapshotsTable.snapshotDate);

  if (rows.length === 0) {
    return { daysRecorded: 0, healthScoreMin: null, healthScoreMax: null, trend: "insufficient_history" };
  }
  const scores = rows.map((r) => r.healthScore);
  const trend = rows.length >= 2 ? computeTrend(scores[scores.length - 1], scores[0]).direction : "insufficient_history";
  return {
    daysRecorded: rows.length,
    healthScoreMin: Math.min(...scores),
    healthScoreMax: Math.max(...scores),
    trend,
  };
}

export interface PortfolioTimelineSection {
  asOf: string;
  comparedTo: string | null;
  newIssues: TimelineEntry[];
  resolvedIssues: TimelineEntry[];
  persistentIssues: TimelineEntry[];
  healthChange: InstitutionalIntelligenceResult["timeline"]["healthChange"];
  incomeChange: InstitutionalIntelligenceResult["timeline"]["incomeChange"];
  thisWeek: WeeklyHealthSummary;
}

function buildTimelineSection(intel: InstitutionalIntelligenceResult, weekly: WeeklyHealthSummary): PortfolioTimelineSection {
  const timeline = intel.timeline;
  return {
    asOf: timeline.asOf,
    comparedTo: timeline.comparedTo,
    newIssues: timeline.entries.filter((e) => e.status === "new"),
    resolvedIssues: timeline.entries.filter((e) => e.status === "resolved"),
    persistentIssues: timeline.entries.filter((e) => e.status === "persistent"),
    healthChange: timeline.healthChange,
    incomeChange: timeline.incomeChange,
    thisWeek: weekly,
  };
}

// ─── Executive Briefing ──────────────────────────────────────────────────────
// The core briefing is the Summary Engine's own executiveSummary,
// reused verbatim (its bullets already read "Portfolio Health remains
// strong.", "No elevated Event Risk detected.", "Buying Power remains
// healthy.", etc. — the exact worked-example style this sprint asks
// for). Two additional sentences extend the SAME fixed-template-lookup
// technique (never a new calculation) for the two signals the Summary
// Engine doesn't already cover: Net Delta trend (real stored history)
// and the current largest concentration (a point-in-time fact, never a
// fabricated trend, since no per-sector history is persisted).

function deltaBriefingSentence(greeks: GreeksSummarySection): string | null {
  if (greeks.deltaTrend === "improving") return `Net Delta increased to ${greeks.delta}.`;
  if (greeks.deltaTrend === "declining") return `Net Delta decreased to ${greeks.delta}.`;
  return null;
}

function concentrationFactSentence(risk: RiskSummarySection): string | null {
  if (risk.largestExposure === "No open positions") return null;
  return `Largest exposure: ${risk.largestExposure}.`;
}

export interface ExecutiveBriefing {
  headline: string;
  bullets: string[];
  generatedAt: string;
}

function buildExecutiveBriefing(
  intel: InstitutionalIntelligenceResult,
  greeks: GreeksSummarySection,
  risk: RiskSummarySection,
): ExecutiveBriefing {
  const bullets = [...intel.executiveSummary.bullets];
  const delta = deltaBriefingSentence(greeks);
  if (delta) bullets.push(delta);
  const concentration = concentrationFactSentence(risk);
  if (concentration) bullets.push(concentration);
  return {
    headline: intel.executiveSummary.headline,
    bullets,
    generatedAt: intel.executiveSummary.generatedAt,
  };
}

// ─── Institutional Insights ──────────────────────────────────────────────────
// Deterministic executive observations, in the sprint's own requested
// style ("Portfolio remains well diversified.", "Theta income remains
// consistent.", "Capital efficiency remains high."). Every sentence is
// a fixed-template lookup gated by an already-computed threshold —
// never a new score, never a trade recommendation.

export interface InstitutionalInsight {
  text: string;
  category: string;
}

function buildInstitutionalInsights(
  dash: PortfolioDashboardResult,
  health: HealthSummarySection,
  income: IncomeSummarySection,
  risk: RiskSummarySection,
): InstitutionalInsight[] {
  const insights: InstitutionalInsight[] = [];

  const diversification = dash.healthFactors.find((f) => f.code === "diversification");
  if (diversification && diversification.score >= 70) {
    insights.push({ text: "Portfolio remains well diversified.", category: "diversification" });
  } else if (diversification && diversification.score < 50) {
    insights.push({ text: "Portfolio diversification is below target — a small number of positions dominate exposure.", category: "diversification" });
  }

  if (income.incomeHealth === "improving") {
    insights.push({ text: "Theta income is trending higher.", category: "income" });
  } else if (income.incomeHealth === "stable" && income.monthlyTheta > 0) {
    insights.push({ text: "Theta income remains consistent.", category: "income" });
  }

  if (health.trend === "improving") {
    insights.push({ text: "Risk profile improved since the prior recorded day.", category: "health" });
  } else if (health.trend === "declining") {
    insights.push({ text: "Risk profile has declined since the prior recorded day — review recommended.", category: "health" });
  }

  const positionSizingFactor = dash.healthFactors.find((f) => f.code === "position_sizing_quality");
  if (positionSizingFactor && positionSizingFactor.score >= 70) {
    insights.push({ text: "Capital efficiency remains high — position sizing is well within risk limits.", category: "capital" });
  }

  if (risk.riskTrend === "declining") {
    insights.push({ text: "Total portfolio risk is trending lower.", category: "risk" });
  } else if (risk.riskTrend === "improving") {
    insights.push({ text: "Total portfolio risk is trending higher — monitor position sizing.", category: "risk" });
  }

  if (dash.openPositionsCount === 0) {
    insights.push({ text: "No open positions — the portfolio is currently flat.", category: "portfolio" });
  }

  return insights;
}

// ─── Top-level assembly ──────────────────────────────────────────────────────

export interface PortfolioAnalystResult {
  paperTradingMode: true;
  deterministicAnalysis: true;
  executiveBriefing: ExecutiveBriefing;
  snapshot: PortfolioSnapshot;
  healthSummary: HealthSummarySection;
  riskSummary: RiskSummarySection;
  incomeSummary: IncomeSummarySection;
  greeksSummary: GreeksSummarySection;
  eventSummary: EventSummarySection;
  learningSummary: LearningSummarySection;
  timeline: PortfolioTimelineSection;
  institutionalInsights: InstitutionalInsight[];
  generatedAt: string;
}

export async function buildPortfolioAnalyst(userId: string, now: Date = new Date()): Promise<PortfolioAnalystResult> {
  // Sequential, not Promise.all. Several of these sub-builders
  // independently resolve the same per-user settings row via
  // serverState.ts's own pre-existing getSettingsRow() (a plain
  // check-then-insert, not an upsert) — for a genuinely brand-new user
  // whose row doesn't exist yet, firing them concurrently races two
  // inserts against the same unique constraint. Not this sprint's file
  // to fix (getSettingsRow() itself is shared, foundational code); a
  // sequential await here avoids the race entirely with no other
  // behavior change, since generating one executive briefing is not a
  // latency-sensitive path.
  const intel = await buildInstitutionalIntelligence(userId);
  const dash = await buildPortfolioDashboard(userId);
  const theta = await buildThetaIncome(userId);
  const eventRisk = await buildPortfolioEventRiskOverlay(userId, now.getTime());
  const weekly = await buildWeeklySummary(userId, now);

  // getPriorSnapshot() itself is private to intelligenceTimeline.ts;
  // intel.timeline.comparedTo already discloses whether a real prior
  // snapshot exists. The per-field prior VALUES (totalRiskPct/netDelta/
  // thetaMonthly) needed by Risk/Greeks/Income Summary are read via the
  // same lightweight, read-only query buildWeeklySummary() already
  // makes, taking its own last (most recent, prior-to-today) row —
  // avoiding a second, separate getPriorSnapshot()-shaped call.
  const priorRow = await mostRecentPriorSnapshot(userId, now);

  const healthSummary = buildHealthSummary(intel);
  const riskSummary = buildRiskSummary(dash, priorRow);
  const incomeSummary = buildIncomeSummary(theta, priorRow);
  const greeksSummary = buildGreeksSummary(dash, priorRow);
  const eventSummary = buildEventSummary(dash, eventRisk.positions);
  const learningSummary = buildLearningSummary();
  const timeline = buildTimelineSection(intel, weekly);
  const institutionalInsights = buildInstitutionalInsights(dash, healthSummary, incomeSummary, riskSummary);
  const executiveBriefing = buildExecutiveBriefing(intel, greeksSummary, riskSummary);
  const snapshot = buildSnapshot(dash, theta);

  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    executiveBriefing,
    snapshot,
    healthSummary,
    riskSummary,
    incomeSummary,
    greeksSummary,
    eventSummary,
    learningSummary,
    timeline,
    institutionalInsights,
    generatedAt: now.toISOString(),
  };
}

// Mirrors intelligenceTimeline.ts's own getPriorSnapshot() query exactly
// (same table, same "most recent row strictly before today" logic,
// same desc-order + limit(1) shape) — duplicated as a query, not as
// business logic, since that function is not exported; kept here as a
// single, private, read-only SELECT rather than modifying
// intelligenceTimeline.ts's own exports.
async function mostRecentPriorSnapshot(userId: string, now: Date): Promise<IntelligenceSnapshotRow | null> {
  const today = now.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(intelligenceSnapshotsTable)
    .where(and(eq(intelligenceSnapshotsTable.userId, userId), lt(intelligenceSnapshotsTable.snapshotDate, today)))
    .orderBy(desc(intelligenceSnapshotsTable.snapshotDate))
    .limit(1);
  return rows[0] ?? null;
}

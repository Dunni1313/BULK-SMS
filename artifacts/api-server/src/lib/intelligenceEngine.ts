// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation).
//
// The top-level orchestrator composing every sub-engine (Observation,
// Explanation, Health, Summary, Timeline, Learning) into one result.
// This is the reusable "intelligence layer" every future AI module
// (AI Coach, AI Teacher, AI Portfolio Analyst, AI Trade Journal,
// Institutional Mentor, Learning Centre) is meant to consume — it
// exposes no execution/pricing/risk calculation of its own; it only
// composes already-existing, unmodified modules:
//
//   - lib/portfolioDashboard.ts's buildPortfolioDashboard() — itself
//     already a composition of Position Sizing, the Portfolio Stress
//     Test, the Earnings & Event Risk Portfolio Overlay, and the
//     Correlation & Concentration Risk Overlay (see that file's own
//     header). This is the primary data source for nearly everything
//     below.
//   - lib/thetaIncome.ts's computeThetaIncome(), fed by
//     lib/positionSizing.ts's currentOpenTrades() and
//     lib/serverState.ts's computeTradeGreeks() — the EXACT same
//     3-function composition routes/portfolio.ts's own
//     GET /portfolio/theta route already uses, reused here rather than
//     re-derived, so this engine's own theta income figure is never a
//     second, competing calculation.
//
// This is NOT an LLM integration, NOT a chatbot, and NOT a statistical
// prediction engine — every field in the returned result is either a
// direct pass-through of an already-computed value or a deterministic,
// disclosed rule (a threshold comparison, a template lookup, a set
// diff) applied to those already-computed values. No trade
// recommendation and no execution suggestion is ever generated.

import { currentOpenTrades } from "./positionSizing.js";
import { computeTradeGreeks } from "./serverState.js";
import { computeThetaIncome, type ThetaIncome } from "./thetaIncome.js";
import { buildPortfolioDashboard, type PortfolioDashboardResult } from "./portfolioDashboard.js";
import { buildObservations, type Observation } from "./intelligenceObservations.js";
import { buildHealthOverview, type HealthOverview } from "./intelligenceHealth.js";
import { buildDailySummary, type DailySummary } from "./intelligenceSummary.js";
import {
  getPriorSnapshot,
  recordSnapshotIfNeeded,
  buildTimeline,
  type Timeline,
} from "./intelligenceTimeline.js";
import { learningLinksFor, type LearningLink } from "./intelligenceLearning.js";

export interface InstitutionalIntelligenceResult {
  paperTradingMode: true;
  deterministicAnalysis: true;
  executiveSummary: DailySummary;
  observations: Observation[];
  highestPriority: Observation[];
  health: HealthOverview;
  timeline: Timeline;
  learningLinks: LearningLink[];
  portfolioInsights: Observation[];
  incomeInsights: Observation[];
  riskInsights: Observation[];
  generatedAt: string;
}

const PORTFOLIO_CATEGORIES = new Set(["portfolio_health", "buying_power"]);
const INCOME_CATEGORIES = new Set(["theta_income"]);
const RISK_CATEGORIES = new Set([
  "concentration",
  "diversification",
  "directional_exposure",
  "greeks_exposure",
  "event_risk",
  "broker_status",
  "credentials_status",
]);

// The exact same 3-function composition routes/portfolio.ts's own
// GET /portfolio/theta route already uses — reused here, not re-derived.
async function buildThetaIncome(userId: string): Promise<ThetaIncome> {
  const trades = await currentOpenTrades(userId);
  const positions = trades.map((t) => ({
    symbol: t.symbol,
    strategy: t.strategy,
    theta: computeTradeGreeks(t).theta,
  }));
  return computeThetaIncome(positions);
}

function dedupeLearningLinks(observations: Observation[]): LearningLink[] {
  const seen = new Map<string, LearningLink>();
  for (const o of observations) {
    for (const link of o.learningLinks) {
      const key = link.href ?? `coming-soon:${link.label}`;
      if (!seen.has(key)) seen.set(key, link);
    }
  }
  // Always include every category's own links even for an entirely
  // healthy, observation-free portfolio, so Learning Links is never
  // honestly empty just because nothing is currently elevated.
  if (seen.size === 0) {
    for (const link of learningLinksFor("portfolio_health")) {
      const key = link.href ?? `coming-soon:${link.label}`;
      if (!seen.has(key)) seen.set(key, link);
    }
  }
  return [...seen.values()];
}

export async function buildInstitutionalIntelligence(userId: string): Promise<InstitutionalIntelligenceResult> {
  const now = new Date();
  const [dash, theta, prior]: [PortfolioDashboardResult, ThetaIncome, Awaited<ReturnType<typeof getPriorSnapshot>>] =
    await Promise.all([buildPortfolioDashboard(userId), buildThetaIncome(userId), getPriorSnapshot(userId, now)]);

  const observations = buildObservations(dash, theta, prior, now.toISOString());
  const health = buildHealthOverview(dash, prior);
  const executiveSummary = buildDailySummary(health, observations, now);
  const timeline = buildTimeline(observations, prior, dash, theta, now);

  // Persisted AFTER computing the timeline (which needs the PRIOR day's
  // row, not today's just-computed one) — at most once per calendar day
  // per user, via a real DB-level upsert; never more than once, never
  // automatically polled.
  await recordSnapshotIfNeeded(userId, dash, theta, observations, now);

  const highestPriority = observations.filter((o) => o.severity === "elevated");
  const portfolioInsights = observations.filter((o) => PORTFOLIO_CATEGORIES.has(o.category));
  const incomeInsights = observations.filter((o) => INCOME_CATEGORIES.has(o.category));
  const riskInsights = observations.filter((o) => RISK_CATEGORIES.has(o.category));

  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    executiveSummary,
    observations,
    highestPriority,
    health,
    timeline,
    learningLinks: dedupeLearningLinks(observations),
    portfolioInsights,
    incomeInsights,
    riskInsights,
    generatedAt: now.toISOString(),
  };
}

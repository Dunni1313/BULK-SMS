// AI Teacher & Learning Centre sprint — Explain Mode / Portfolio
// Learning Mode's shared backend. A deterministic (never LLM) module
// answering "what does this metric mean, what's my current real value,
// where did it come from, and why does it matter" for a curated set of
// major platform metrics.
//
// Reuses the Institutional Intelligence Engine's own Explanation Engine
// (intelligenceObservations.ts's explainObservation()) whenever a real,
// currently-emitted Observation exists for the metric being explained —
// genuine reuse of that sprint's own machinery, never a second,
// competing "why did this happen" formatter. When no Observation is
// currently emitted for a metric (the common, healthy case — nothing
// notable is happening right now), this module falls back to reading
// the SAME already-computed dashboard/health figures directly, since
// Explain Mode must always answer "what is my current value," not only
// "what changed."
//
// Never accepts a client-supplied value to "explain" — every value
// explained here is resolved server-side from the calling user's own
// real, already-computed data, so an Explain Mode response can never be
// used to attach a real-sounding explanation to a fabricated number.

import { db, tradesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { buildInstitutionalIntelligence, type InstitutionalIntelligenceResult } from "./intelligenceEngine.js";
import { explainObservation, type Observation, type ObservationMetric } from "./intelligenceObservations.js";
import { buildPortfolioDashboard } from "./portfolioDashboard.js";
import { getSnapshot } from "./optionsMath.js";
import { computeExpectedMove } from "./earnings.js";
import { deltaPlain, thetaPlain, gammaPlain, vegaPlain } from "./coach.js";

export type MetricCode =
  | "portfolio_health"
  | "buying_power"
  | "event_risk"
  | "concentration"
  | "stress_test"
  | "delta"
  | "theta"
  | "gamma"
  | "vega"
  | "probability_of_profit"
  | "max_profit"
  | "max_loss"
  | "expected_move";

export const METRIC_CODES: MetricCode[] = [
  "portfolio_health",
  "buying_power",
  "event_risk",
  "concentration",
  "stress_test",
  "delta",
  "theta",
  "gamma",
  "vega",
  "probability_of_profit",
  "max_profit",
  "max_loss",
  "expected_move",
];

const METRIC_LABELS: Record<MetricCode, string> = {
  portfolio_health: "Portfolio Health",
  buying_power: "Buying Power",
  event_risk: "Event Risk",
  concentration: "Concentration",
  stress_test: "Stress Test",
  delta: "Delta",
  theta: "Theta",
  gamma: "Gamma",
  vega: "Vega",
  probability_of_profit: "Probability of Profit",
  max_profit: "Maximum Profit",
  max_loss: "Maximum Loss",
  expected_move: "Expected Move",
};

// Maps each portfolio-wide metric to the Observation code(s) that, if
// currently emitted, represent that metric's own "notable" state —
// used to decide whether a real Observation exists to reuse via
// explainObservation(), never to fabricate one.
const METRIC_OBSERVATION_CODES: Partial<Record<MetricCode, string[]>> = {
  portfolio_health: ["portfolio_health_improved", "portfolio_health_declined"],
  buying_power: ["buying_power_increasing", "buying_power_decreasing"],
  event_risk: ["event_risk_elevated"],
  concentration: ["concentration_elevated"],
};

const RELATED_GLOSSARY: Record<MetricCode, string[]> = {
  portfolio_health: ["portfolio-health", "concentration", "diversification"],
  buying_power: ["buying-power", "position-sizing"],
  event_risk: ["event-risk", "earnings-volatility"],
  concentration: ["concentration", "diversification", "correlation"],
  stress_test: ["stress-testing", "event-risk"],
  delta: ["delta", "portfolio-greeks"],
  theta: ["theta", "theta-income"],
  gamma: ["gamma", "delta"],
  vega: ["vega", "implied-volatility"],
  probability_of_profit: ["probability-of-profit", "expected-value"],
  max_profit: ["max-profit", "max-loss"],
  max_loss: ["max-loss", "max-profit", "buying-power"],
  expected_move: ["expected-move", "implied-volatility"],
};

const RELATED_LESSON: Record<MetricCode, string | null> = {
  portfolio_health: "/learn/paths/portfolio/portfolio-health",
  buying_power: "/learn/paths/portfolio/portfolio-buying-power",
  event_risk: "/learn/paths/portfolio/portfolio-event-risk",
  concentration: "/learn/paths/portfolio/portfolio-concentration",
  stress_test: "/learn/paths/portfolio/portfolio-stress-testing",
  delta: "/learn/paths/greeks/greeks-delta",
  theta: "/learn/paths/greeks/greeks-theta",
  gamma: "/learn/paths/greeks/greeks-gamma",
  vega: "/learn/paths/greeks/greeks-vega",
  probability_of_profit: "/learn/paths/performance/performance-win-rate",
  max_profit: "/learn/paths/performance/performance-return-on-capital",
  max_loss: "/learn/paths/performance/performance-return-on-capital",
  expected_move: "/learn/paths/volatility/volatility-expected-move",
};

export interface MetricExplanation {
  code: MetricCode;
  label: string;
  currentValue: string;
  plainEnglish: string;
  sourceCalculation: string;
  whyItMatters: string;
  relatedLessonHref: string | null;
  relatedGlossaryKeys: string[];
  reusedObservation: boolean;
}

export class MetricExplainerError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Reuses explainObservation() (the Explanation Engine, unmodified) when
// a real, currently-emitted Observation matches this metric — genuine
// reuse, never a fabricated Observation object.
function reuseExplanationEngine(
  intel: InstitutionalIntelligenceResult,
  code: MetricCode,
): { explanation: string; metrics: ObservationMetric[]; sourceModule: string } | null {
  const candidateCodes = METRIC_OBSERVATION_CODES[code];
  if (!candidateCodes) return null;
  const observation: Observation | undefined = intel.observations.find((o) => candidateCodes.includes(o.code));
  if (!observation) return null;
  const explained = explainObservation(observation);
  return { explanation: explained.why, metrics: explained.contributingMetrics, sourceModule: explained.sourceModule };
}

async function explainPortfolioWideMetric(code: MetricCode, userId: string): Promise<MetricExplanation> {
  const intel = await buildInstitutionalIntelligence(userId);
  const dash = intel.health; // reused, never a second score
  const reused = reuseExplanationEngine(intel, code);

  let currentValue = "";
  let plainEnglish = "";
  let sourceCalculation = "";
  let whyItMatters = "";

  switch (code) {
    case "portfolio_health":
      currentValue = `${dash.overallHealthScore}/100 (${dash.overallRiskRating.label})`;
      plainEnglish = reused?.explanation ?? dash.healthSummary;
      sourceCalculation = "lib/portfolioDashboard.ts — healthScore (an equal-weighted average of 8 already-computed risk factors)";
      whyItMatters = "Portfolio Health is the single number that summarizes whether the account's overall risk posture is healthy right now — a fast way to spot a deteriorating account before checking every individual overlay.";
      break;
    case "buying_power": {
      // Buying Power isn't on the Health Overview itself — reuse the
      // underlying dashboard directly for the raw dollar figure while
      // still reusing the Explanation Engine's own trend text when a
      // real buying_power observation exists.
      const bpDash = await buildPortfolioDashboard(userId);
      currentValue = fmtUsd(bpDash.buyingPower);
      plainEnglish = reused?.explanation ?? `Current buying power is ${fmtUsd(bpDash.buyingPower)} — the capital available to open new positions after accounting for the risk already committed to open trades.`;
      sourceCalculation = "lib/portfolioDashboard.ts — buyingPower (reused from the Portfolio Stress Test's own base-case figure)";
      whyItMatters = "Buying power determines how much new risk can actually be taken on — running it too low, or accepting excessive leverage against it, is one of this platform's own monitored risk-warning categories.";
      break;
    }
    case "event_risk": {
      const erDash = await buildPortfolioDashboard(userId);
      const highest = erDash.highestEventRisk;
      currentValue = highest ? `${highest.symbol}: ${highest.riskLevel}` : "None — no tracked upcoming events";
      plainEnglish = reused?.explanation ?? (highest ? `The highest event-risk position right now is ${highest.symbol}, classified "${highest.riskLevel}" by the Earnings & Event Risk Portfolio Overlay.` : "No open position currently carries an elevated event-risk classification.");
      sourceCalculation = "lib/portfolioEventRisk.ts — summary.highestRiskPosition";
      whyItMatters = "A known upcoming event (earnings, an economic release, a dividend date) can move a position suddenly before you can react — event risk flags which positions carry that exposure right now.";
      break;
    }
    case "concentration": {
      const cDash = await buildPortfolioDashboard(userId);
      const factor = cDash.healthFactors.find((f) => f.code === "concentration");
      currentValue = factor ? `${factor.score}/100 concentration health score` : "unavailable";
      plainEnglish = reused?.explanation ?? (cDash.highestConcentration ? `${cDash.highestConcentration.bucket.label} accounts for the largest share of deployed portfolio risk.` : "Portfolio risk is currently spread across positions with no single dominant concentration.");
      sourceCalculation = "lib/portfolioConcentration.ts — breakdowns.symbol.concentrationScore (a Herfindahl-Hirschman-Index concentration score)";
      whyItMatters = "High concentration means one adverse move in a single symbol, sector, or strategy can affect a large share of the account at once.";
      break;
    }
    case "stress_test": {
      const sDash = await buildPortfolioDashboard(userId);
      const worst = [...sDash.stressTestSummary].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0];
      currentValue = worst ? `${worst.label}: ${fmtUsd(worst.portfolioValueImpact)} impact` : "No scenarios evaluated";
      plainEnglish = worst
        ? `Under the "${worst.label}" scenario, the Portfolio Stress Test estimates a ${fmtUsd(worst.portfolioValueImpact)} change in portfolio value, leaving a risk score of ${worst.riskScoreAfter}/100.`
        : "No stress scenarios have been evaluated for the current portfolio.";
      sourceCalculation = "lib/portfolioStressTest.ts — stressTestSummary (repricing every open position under a hypothetical shock)";
      whyItMatters = "Stress testing shows how the portfolio would actually behave under a hypothetical shock BEFORE it happens, rather than discovering the answer live.";
      break;
    }
    default:
      throw new MetricExplainerError(`Unsupported portfolio-wide metric: ${code}`, 400);
  }

  return {
    code,
    label: METRIC_LABELS[code],
    currentValue,
    plainEnglish,
    sourceCalculation: reused ? `${sourceCalculation}; explanation reused from the Institutional Intelligence Engine's own Explanation Engine (${reused.sourceModule})` : sourceCalculation,
    whyItMatters,
    relatedLessonHref: RELATED_LESSON[code],
    relatedGlossaryKeys: RELATED_GLOSSARY[code],
    reusedObservation: reused !== null,
  };
}

async function explainPortfolioGreek(code: "delta" | "theta" | "gamma" | "vega", userId: string): Promise<MetricExplanation> {
  const { buildPortfolioDashboard } = await import("./portfolioDashboard.js");
  const dash = await buildPortfolioDashboard(userId);
  const value = dash.netGreeks[code];
  const plainMap = { delta: deltaPlain, theta: thetaPlain, gamma: gammaPlain, vega: vegaPlain };
  return {
    code,
    label: METRIC_LABELS[code],
    currentValue: `${value >= 0 ? "+" : ""}${value}`,
    plainEnglish: plainMap[code](value),
    sourceCalculation: "lib/portfolioConcentration.ts — netGreeks (the sum of every open position's own Greeks, reused directly on the Portfolio Dashboard)",
    whyItMatters: `Portfolio ${METRIC_LABELS[code]} is the net figure across every open position — the number that actually describes total ${code === "delta" ? "directional" : code === "theta" ? "time-decay" : code === "gamma" ? "delta-acceleration" : "volatility"} exposure, not any single position's own value in isolation.`,
    relatedLessonHref: RELATED_LESSON[code],
    relatedGlossaryKeys: RELATED_GLOSSARY[code],
    reusedObservation: false,
  };
}

async function explainTradeMetric(
  code: "probability_of_profit" | "max_profit" | "max_loss" | "expected_move",
  userId: string,
  tradeId: number,
): Promise<MetricExplanation> {
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)))
    .limit(1);
  if (!trade) throw new MetricExplainerError("Trade not found", 404);

  if (code === "probability_of_profit") {
    return {
      code,
      label: METRIC_LABELS[code],
      currentValue: `${trade.pop.toFixed(0)}%`,
      plainEnglish: `${trade.symbol} ${trade.strategy.replace(/_/g, " ")}'s probability of profit is ${trade.pop.toFixed(0)}%, computed with a volatility-risk-premium haircut applied to implied volatility (since implied volatility tends to overstate realized volatility).`,
      sourceCalculation: "trades.pop — computed at entry by optionsMath.ts's own pricing engine, the exact figure stored with this trade",
      whyItMatters: "POP estimates the chance this specific position finishes profitable — but a high POP alone doesn't guarantee positive expected value; always read it alongside Expected Value.",
      relatedLessonHref: RELATED_LESSON[code],
      relatedGlossaryKeys: RELATED_GLOSSARY[code],
      reusedObservation: false,
    };
  }
  if (code === "max_profit") {
    return {
      code,
      label: METRIC_LABELS[code],
      currentValue: fmtUsd(trade.maxProfit),
      plainEnglish: `${trade.symbol} ${trade.strategy.replace(/_/g, " ")}'s maximum possible profit is ${fmtUsd(trade.maxProfit)}, fixed and known since entry.`,
      sourceCalculation: "trades.max_profit — computed at entry, the same defined-risk figure shown on the Trade Ticket",
      whyItMatters: "Knowing the maximum possible profit up front is what makes a defined-risk structure's return on capital computable before the trade is even entered.",
      relatedLessonHref: RELATED_LESSON[code],
      relatedGlossaryKeys: RELATED_GLOSSARY[code],
      reusedObservation: false,
    };
  }
  if (code === "max_loss") {
    return {
      code,
      label: METRIC_LABELS[code],
      currentValue: fmtUsd(trade.maxLoss),
      plainEnglish: `${trade.symbol} ${trade.strategy.replace(/_/g, " ")}'s maximum possible loss is ${fmtUsd(trade.maxLoss)} — this position can never lose more than that, since it's a defined-risk structure.`,
      sourceCalculation: "trades.max_loss — computed at entry, the same figure this platform's own buying-power calculation reserves against",
      whyItMatters: "Maximum loss is the number position sizing is actually built around — every risk-warning category on this platform ultimately traces back to how large max loss is relative to the account.",
      relatedLessonHref: RELATED_LESSON[code],
      relatedGlossaryKeys: RELATED_GLOSSARY[code],
      reusedObservation: false,
    };
  }

  // expected_move
  const snap = getSnapshot(trade.symbol);
  if (!snap) {
    return {
      code,
      label: METRIC_LABELS[code],
      currentValue: "unavailable",
      plainEnglish: `Expected move is currently unavailable for ${trade.symbol} — no live pricing snapshot could be resolved.`,
      sourceCalculation: "optionsMath.ts — getSnapshot() (no snapshot resolved)",
      whyItMatters: "Expected move estimates the market-implied range a stock is likely to trade within — useful context for how far outside a position's own breakevens the market itself expects the underlying to travel.",
      relatedLessonHref: RELATED_LESSON[code],
      relatedGlossaryKeys: RELATED_GLOSSARY[code],
      reusedObservation: false,
    };
  }
  const daysToExpiry = trade.expiration
    ? Math.max(1, Math.round((new Date(trade.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 30;
  const move = computeExpectedMove(snap.price, snap.iv, daysToExpiry);
  return {
    code,
    label: METRIC_LABELS[code],
    currentValue: `±${move.pct.toFixed(1)}% (±${fmtUsd(move.dollars)})`,
    plainEnglish: `${trade.symbol} is expected to move about ±${move.pct.toFixed(1)}% (±${fmtUsd(move.dollars)}) over the next ${daysToExpiry} days, a one-standard-deviation range implied by current volatility — roughly a 68% chance the stock stays inside it.`,
    sourceCalculation: "lib/earnings.ts — computeExpectedMove() (implied volatility × √(days remaining / 365)), applied here to this trade's own current snapshot and days-to-expiry",
    whyItMatters: "Comparing this range to the position's own breakevens is a quick sanity check on whether the structure sits comfortably outside what the market itself expects, or uncomfortably close to it.",
    relatedLessonHref: RELATED_LESSON[code],
    relatedGlossaryKeys: RELATED_GLOSSARY[code],
    reusedObservation: false,
  };
}

export interface ExplainMetricOptions {
  tradeId?: number;
}

export async function explainMetric(code: string, userId: string, opts: ExplainMetricOptions = {}): Promise<MetricExplanation> {
  if (!METRIC_CODES.includes(code as MetricCode)) {
    throw new MetricExplainerError(`Unknown metric: ${code}`, 400);
  }
  const metric = code as MetricCode;
  if (metric === "delta" || metric === "theta" || metric === "gamma" || metric === "vega") {
    return explainPortfolioGreek(metric, userId);
  }
  if (metric === "probability_of_profit" || metric === "max_profit" || metric === "max_loss" || metric === "expected_move") {
    if (opts.tradeId == null) {
      throw new MetricExplainerError(`${METRIC_LABELS[metric]} requires a tradeId — it is a per-position figure, not a portfolio-wide one`, 400);
    }
    return explainTradeMetric(metric, userId, opts.tradeId);
  }
  return explainPortfolioWideMetric(metric, userId);
}

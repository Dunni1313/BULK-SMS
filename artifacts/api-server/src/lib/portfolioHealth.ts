// Task #38 — Portfolio AI scoring engine (deterministic core).
//
// Pure functions that turn the portfolio's aggregate Greeks, the risk-limit
// status, the theta-income engine and the per-position adjustment severities
// into three 0-100 scores (overall health, market exposure, risk concentration)
// plus a GREEN/YELLOW/RED threat mapping. Every number here is the source of
// truth; the LLM briefing layer only narrates prose around these figures.
//
// This is intentionally I/O-free so it is unit-testable without a database and
// produces identical output for identical inputs.

import type { AdjustmentSeverity } from "./adjustment.js";

export type ThreatLevel = "green" | "yellow" | "red";

// Map the deterministic adjustment severity onto a traffic-light threat level.
// info/none are healthy (GREEN), warning is caution (YELLOW), critical is RED.
export function threatFromSeverity(severity: AdjustmentSeverity): ThreatLevel {
  if (severity === "critical") return "red";
  if (severity === "warning") return "yellow";
  return "green";
}

export interface ScoreCard {
  score: number; // 0-100, rounded
  label: string;
  detail: string;
}

export interface PortfolioHealthComponent {
  key: string;
  label: string;
  score: number;
  weight: number; // 0-1
  detail: string;
}

export interface SymbolRisk {
  symbol: string;
  riskDollars: number;
}

export interface PortfolioHealthInput {
  accountValue: number;
  openTrades: number;
  // Aggregate portfolio Greeks.
  netDelta: number;
  netTheta: number; // dollars/day (positive = collecting)
  netVega: number;
  netGamma: number;
  // Risk-limit status (from computePortfolioRisk).
  portfolioRiskUsedPct: number; // % of account currently at risk
  maxPortfolioRiskPct: number;
  withinLimits: boolean;
  perTradeOverCap: number; // count of open trades above the per-trade cap
  // Risk distribution across underlyings (for concentration / HHI).
  symbolRisk: SymbolRisk[];
  // Adjustment pressure (from evaluateTradeAdjustment severities).
  attentionCount: number; // open trades whose recommendation is not hold/do_nothing
  criticalCount: number; // subset of the above at "critical" severity
}

export interface PortfolioHealth {
  health: ScoreCard; // overall 0-100
  exposure: ScoreCard; // market-exposure balance 0-100
  riskConcentration: ScoreCard; // risk diversification + budget 0-100
  components: PortfolioHealthComponent[]; // contributors to the overall health
  netDelta: number;
  netTheta: number;
  netVega: number;
  netGamma: number;
  largestSymbol: string | null;
  largestSymbolPct: number; // share of total risk held by the single largest symbol
  threatCounts: { green: number; yellow: number; red: number };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number): number {
  return Math.round(x);
}

// Banded scorer: returns the score of the first band whose ceiling the value is
// at or below. Bands must be ascending by ceiling.
function band(value: number, bands: [ceiling: number, score: number][], fallback: number): number {
  for (const [ceiling, score] of bands) {
    if (value <= ceiling) return score;
  }
  return fallback;
}

function healthLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 65) return "Stable";
  if (score >= 50) return "Caution";
  if (score >= 35) return "Stressed";
  return "Critical";
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 35) return "Elevated";
  return "Poor";
}

// ─── Market-exposure score ──────────────────────────────────────────────────
// Ravish's framework targets a delta-neutral, premium-collecting book. The
// exposure score rewards directional neutrality, controlled gamma, and a book
// that is actually collecting theta.
function computeExposure(i: PortfolioHealthInput): ScoreCard {
  if (i.openTrades === 0) {
    return { score: 100, label: "Flat", detail: "No open exposure — the book is entirely in cash." };
  }
  const deltaPerPos = Math.abs(i.netDelta) / i.openTrades;
  const directional = band(
    deltaPerPos,
    [
      [0.1, 100],
      [0.25, 85],
      [0.5, 65],
      [1.0, 45],
    ],
    25,
  );

  const gammaPerPos = Math.abs(i.netGamma) / i.openTrades;
  const gammaControl = band(
    gammaPerPos,
    [
      [0.02, 100],
      [0.05, 80],
      [0.1, 60],
    ],
    40,
  );

  // A premium-selling book should be collecting theta. Positive theta is the
  // norm; flat/negative theta is a red flag for this strategy.
  const thetaQuality = i.netTheta > 0 ? 100 : i.netTheta === 0 ? 60 : 30;

  const score = round(directional * 0.6 + gammaControl * 0.2 + thetaQuality * 0.2);
  const dir =
    Math.abs(i.netDelta) < 0.25 * i.openTrades
      ? "delta-neutral"
      : i.netDelta > 0
        ? "net long"
        : "net short";
  return {
    score,
    label: gradeLabel(score),
    detail: `Book is ${dir} (net Δ ${i.netDelta.toFixed(2)}), collecting $${i.netTheta.toFixed(0)}/day of theta.`,
  };
}

// ─── Risk-concentration score ───────────────────────────────────────────────
// Blends how much of the portfolio risk budget is used, how diversified the risk
// is across underlyings (largest-symbol share), and per-trade cap compliance.
function computeRiskConcentration(i: PortfolioHealthInput): {
  card: ScoreCard;
  largestSymbol: string | null;
  largestSymbolPct: number;
} {
  if (i.openTrades === 0) {
    return {
      card: { score: 100, label: "Excellent", detail: "No capital at risk." },
      largestSymbol: null,
      largestSymbolPct: 0,
    };
  }

  const budgetRatio = i.maxPortfolioRiskPct > 0 ? i.portfolioRiskUsedPct / i.maxPortfolioRiskPct : 1;
  const budget = band(
    budgetRatio,
    [
      [0.5, 100],
      [0.75, 82],
      [1.0, 58],
    ],
    25,
  );

  const totalRisk = i.symbolRisk.reduce((s, r) => s + r.riskDollars, 0);
  let largestSymbol: string | null = null;
  let largestSymbolPct = 0;
  if (totalRisk > 0) {
    const top = [...i.symbolRisk].sort((a, b) => b.riskDollars - a.riskDollars)[0];
    largestSymbol = top.symbol;
    largestSymbolPct = top.riskDollars / totalRisk;
  }
  const diversification = band(
    largestSymbolPct,
    [
      [0.34, 100],
      [0.5, 82],
      [0.7, 58],
    ],
    32,
  );

  const compliance = i.perTradeOverCap === 0 ? 100 : Math.max(20, 100 - i.perTradeOverCap * 35);

  const score = round(budget * 0.4 + diversification * 0.4 + compliance * 0.2);
  const pctLabel = `${(largestSymbolPct * 100).toFixed(0)}%`;
  return {
    card: {
      score,
      label: gradeLabel(score),
      detail:
        largestSymbol != null
          ? `${i.portfolioRiskUsedPct.toFixed(1)}% of account at risk; largest single name ${largestSymbol} (${pctLabel} of risk).`
          : `${i.portfolioRiskUsedPct.toFixed(1)}% of account at risk.`,
    },
    largestSymbol,
    largestSymbolPct,
  };
}

// ─── Overall health ─────────────────────────────────────────────────────────
export function computePortfolioHealth(i: PortfolioHealthInput): PortfolioHealth {
  const exposure = computeExposure(i);
  const { card: riskConcentration, largestSymbol, largestSymbolPct } = computeRiskConcentration(i);

  // Adjustment pressure: critical recommendations hurt much more than soft ones.
  const nonCritical = Math.max(0, i.attentionCount - i.criticalCount);
  const attentionScore =
    i.openTrades === 0 ? 100 : clamp(100 - i.criticalCount * 30 - nonCritical * 12, 0, 100);

  // Theta engine: is the book actually producing income relative to its size?
  const thetaScore = i.openTrades === 0 ? 100 : i.netTheta > 0 ? 100 : i.netTheta === 0 ? 55 : 25;

  const components: PortfolioHealthComponent[] = [
    { key: "exposure", label: "Market exposure", score: exposure.score, weight: 0.3, detail: exposure.detail },
    {
      key: "risk_concentration",
      label: "Risk concentration",
      score: riskConcentration.score,
      weight: 0.3,
      detail: riskConcentration.detail,
    },
    {
      key: "position_threats",
      label: "Position threats",
      score: attentionScore,
      weight: 0.25,
      detail:
        i.attentionCount === 0
          ? "No open position needs attention."
          : `${i.attentionCount} position(s) need attention (${i.criticalCount} critical).`,
    },
    {
      key: "theta_engine",
      label: "Income engine",
      score: thetaScore,
      weight: 0.15,
      detail: `Net theta $${i.netTheta.toFixed(0)}/day across ${i.openTrades} position(s).`,
    },
  ];

  let healthScore = round(components.reduce((s, c) => s + c.score * c.weight, 0));
  // A breached risk limit caps health regardless of the blend.
  if (!i.withinLimits) healthScore = Math.min(healthScore, 55);
  // Any critical position caps health below the "Stable" band.
  if (i.criticalCount > 0) healthScore = Math.min(healthScore, 64);

  const detailBits: string[] = [];
  if (!i.withinLimits) detailBits.push("risk limit breached");
  if (i.criticalCount > 0) detailBits.push(`${i.criticalCount} critical position(s)`);
  if (detailBits.length === 0) detailBits.push("all systems within tolerance");

  return {
    health: {
      score: healthScore,
      label: healthLabel(healthScore),
      detail: `Composite of exposure, concentration, threats and income — ${detailBits.join(", ")}.`,
    },
    exposure,
    riskConcentration,
    components,
    netDelta: i.netDelta,
    netTheta: i.netTheta,
    netVega: i.netVega,
    netGamma: i.netGamma,
    largestSymbol,
    largestSymbolPct: Math.round(largestSymbolPct * 1000) / 1000,
    threatCounts: {
      green: Math.max(0, i.openTrades - i.attentionCount),
      yellow: nonCritical,
      red: i.criticalCount,
    },
  };
}

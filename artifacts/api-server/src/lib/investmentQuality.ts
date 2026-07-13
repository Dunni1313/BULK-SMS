// Phase 2, Sprint 15 — Investment Quality Engine (approved Phase 2 plan, Sprint 15
// after the roadmap renumbering that inserted this sprint ahead of Tom Nash Core).
//
// A reusable, provider-agnostic, metric-by-metric quality scoring engine intended
// as SHARED INFRASTRUCTURE — the Buffett Engine, the future Tom Nash Engine, the
// AI Investment Committee, future valuation models, and Portfolio AI should all
// consume this instead of each hand-rolling its own quality scoring.
//
// Distinct from (and does not replace) analyzeBusinessQuality in valueInvesting.ts:
// that function blends a handful of factors into one composite "business quality"
// score already consumed by Buffett's required-return adjustment. This engine is a
// finer-grained sibling — 12 individually-scored metrics, each independently
// inspectable — that later sprints can pull individual factors from without
// re-deriving them from Fundamentals each time. Nothing about analyzeBusinessQuality,
// analyzeFinancialStrength, or any of the four valuation models (blended, Graham,
// DCF, Buffett) is changed by this module's existence.
//
// SAFETY CONTRACT: never fabricates. Share Dilution / Buybacks and Insider
// Ownership are scored when Fundamentals.sharesOutstandingChange5y /
// insiderOwnershipPct are non-null, and honestly reported `unavailable` with an
// explicit reason otherwise. Until Phase 2, Sprint 24 (Tom Nash Investment Engine
// — Enhancement I), neither field existed on Fundamentals for any provider, so
// both metrics were unconditionally unavailable; Sprint 24 added deterministic
// SIMULATED values and a best-effort FMP fetch for sharesOutstandingChange5y —
// Alpha Vantage and FMP's insiderOwnershipPct remain honestly null, per that
// sprint's disclosed scope. Confidence level is computed directly from the
// fraction of metrics with real data, so it self-corrects toward "High" as more
// providers/fields land — no code change needed here when they do.

import type { Fundamentals } from "./fundamentals.js";
import { leverageScore, coverageScore, cashPositionScore } from "./valueInvesting.js";

function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}
function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type MetricAvailability = "available" | "unavailable";
export type QualityConfidenceLevel = "High" | "Moderate" | "Low";

export interface QualityMetricScore {
  metric: string;
  availability: MetricAvailability;
  score: number | null; // 0-100, null when unavailable
  weight: number; // this metric's fixed design weight (sum of all 12 = 1.0); applied only to available metrics and renormalized over their combined weight
  detail: string;
  reason?: string; // present only when availability is "unavailable"
}

export interface InvestmentQualityAnalysis {
  score: number | null; // 0-100, null only if every metric is somehow unavailable
  metrics: QualityMetricScore[]; // all 12, in the requested order
  strengths: string[]; // human-readable, best-scoring available metrics
  weaknesses: string[]; // human-readable, worst-scoring available metrics
  confidenceLevel: QualityConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

// Fixed design weights across all 12 metrics (sum to 1.0). Applied only to
// AVAILABLE metrics and renormalized over their combined weight below, so the two
// permanently-unavailable metrics don't silently zero out part of every score —
// they're excluded from the average, not penalized twice.
const WEIGHTS = {
  revenueGrowth: 0.10,
  epsGrowth: 0.10,
  fcfGrowth: 0.10,
  roe: 0.10,
  roic: 0.12,
  grossMargin: 0.06,
  operatingMargin: 0.07,
  netMargin: 0.07,
  debtLevels: 0.10,
  cashPosition: 0.08,
  dilutionBuybacks: 0.05,
  insiderOwnership: 0.05,
} as const;

const NO_DILUTION_DATA_REASON =
  "this provider does not supply a share-count history, so a buyback/dilution trend cannot be computed without fabricating a number";
const NO_INSIDER_OWNERSHIP_DATA_REASON =
  "this provider does not supply insider-ownership data";

// Derives a five-year FCF CAGR from Fundamentals.fcfHistory (oldest → newest).
// Honestly unavailable (not estimated) when either endpoint isn't positive, since
// a CAGR through zero or negative FCF isn't a meaningful growth rate.
// Exported (Phase 2, Sprint 20) so the Industry Comparison Engine can reuse the
// exact same derivation for peer FCF-growth ranking — zero duplicated logic.
export function fcfGrowth5y(f: Fundamentals): number | null {
  const h = f.fcfHistory;
  if (h.length < 2) return null;
  const first = h[0];
  const last = h[h.length - 1];
  if (first <= 0 || last <= 0) return null;
  const years = h.length - 1;
  return Math.pow(last / first, 1 / years) - 1;
}

export function analyzeInvestmentQuality(f: Fundamentals): InvestmentQualityAnalysis {
  const metrics: QualityMetricScore[] = [];

  metrics.push({
    metric: "Revenue Growth",
    availability: "available",
    score: round(clamp((f.revenueGrowth5y / 0.20) * 100)),
    weight: WEIGHTS.revenueGrowth,
    detail: `${(f.revenueGrowth5y * 100).toFixed(0)}% five-year revenue CAGR`,
  });

  metrics.push({
    metric: "EPS Growth",
    availability: "available",
    score: round(clamp((f.epsGrowth5y / 0.25) * 100)),
    weight: WEIGHTS.epsGrowth,
    detail: `${(f.epsGrowth5y * 100).toFixed(0)}% five-year EPS CAGR`,
  });

  const fcfG = fcfGrowth5y(f);
  if (fcfG != null) {
    metrics.push({
      metric: "Free Cash Flow Growth",
      availability: "available",
      score: round(clamp((fcfG / 0.20) * 100)),
      weight: WEIGHTS.fcfGrowth,
      detail: `${(fcfG * 100).toFixed(0)}% five-year FCF CAGR (derived from FCF/share history)`,
    });
  } else {
    metrics.push({
      metric: "Free Cash Flow Growth",
      availability: "unavailable",
      score: null,
      weight: WEIGHTS.fcfGrowth,
      detail: "",
      reason: "Free cash flow was not positive at both ends of the available history, so a growth rate cannot be computed without fabricating a number.",
    });
  }

  metrics.push({
    metric: "Return on Equity",
    availability: "available",
    score: round(clamp((f.roe / 0.35) * 100)),
    weight: WEIGHTS.roe,
    detail: `${(f.roe * 100).toFixed(0)}% ROE`,
  });

  metrics.push({
    metric: "Return on Invested Capital",
    availability: "available",
    score: round(clamp((f.roic / 0.30) * 100)),
    weight: WEIGHTS.roic,
    detail: `${(f.roic * 100).toFixed(0)}% ROIC`,
  });

  metrics.push({
    metric: "Gross Margin",
    availability: "available",
    score: round(clamp((f.grossMargin / 0.60) * 100)),
    weight: WEIGHTS.grossMargin,
    detail: `${(f.grossMargin * 100).toFixed(0)}% gross margin`,
  });

  metrics.push({
    metric: "Operating Margin",
    availability: "available",
    score: round(clamp((f.operatingMargin / 0.25) * 100)),
    weight: WEIGHTS.operatingMargin,
    detail: `${(f.operatingMargin * 100).toFixed(0)}% operating margin`,
  });

  metrics.push({
    metric: "Net Margin",
    availability: "available",
    score: round(clamp((f.netMargin / 0.30) * 100)),
    weight: WEIGHTS.netMargin,
    detail: `${(f.netMargin * 100).toFixed(0)}% net margin`,
  });

  // Debt Levels / Cash Position reuse valueInvesting.ts's exact leverage /
  // interest-coverage / net-cash formulas (Sprint 15 extraction) so this engine
  // never scores the same underlying signal differently from analyzeFinancialStrength.
  const lev = leverageScore(f);
  const cov = coverageScore(f);
  // Combined at leverage:coverage's existing 0.25:0.20 relative weighting from
  // analyzeFinancialStrength (i.e. 5:4).
  const debtScore = lev * (5 / 9) + cov * (4 / 9);
  metrics.push({
    metric: "Debt Levels",
    availability: "available",
    score: round(clamp(debtScore)),
    weight: WEIGHTS.debtLevels,
    detail: `Debt/Equity ${f.debtToEquity.toFixed(2)}, ${f.interestCoverage >= 100 ? "effectively no debt burden" : `${f.interestCoverage.toFixed(0)}× interest coverage`}`,
  });

  metrics.push({
    metric: "Cash Position",
    availability: "available",
    score: round(clamp(cashPositionScore(f))),
    weight: WEIGHTS.cashPosition,
    detail: f.netCashPerShare >= 0 ? `Net cash $${f.netCashPerShare.toFixed(2)}/sh` : `Net debt $${Math.abs(f.netCashPerShare).toFixed(2)}/sh`,
  });

  // Phase 2, Sprint 24 — scored when the provider supplies a real five-year
  // share-count trend, honestly unavailable otherwise. Negative change (net
  // buybacks) scores higher than positive change (net dilution); the ramp
  // spans a -15% buyback (100) to a +20% dilution (0) benchmark band.
  if (f.sharesOutstandingChange5y != null) {
    const x = f.sharesOutstandingChange5y;
    const score = round(clamp(((0.20 - x) / 0.35) * 100));
    metrics.push({
      metric: "Share Dilution / Buybacks",
      availability: "available",
      score,
      weight: WEIGHTS.dilutionBuybacks,
      detail: x < 0
        ? `${Math.abs(x * 100).toFixed(0)}% net share buybacks over five years`
        : `${(x * 100).toFixed(0)}% net share dilution over five years`,
    });
  } else {
    metrics.push({
      metric: "Share Dilution / Buybacks",
      availability: "unavailable",
      score: null,
      weight: WEIGHTS.dilutionBuybacks,
      detail: "",
      reason: `No share-count history or buyback data source available — ${NO_DILUTION_DATA_REASON}.`,
    });
  }

  // Phase 2, Sprint 24 — scored when the provider supplies a real insider-
  // ownership percentage, honestly unavailable otherwise (currently only the
  // SIMULATED provider supplies this field; FMP and Alpha Vantage do not).
  if (f.insiderOwnershipPct != null) {
    const score = round(clamp((f.insiderOwnershipPct / 0.20) * 100));
    metrics.push({
      metric: "Insider Ownership",
      availability: "available",
      score,
      weight: WEIGHTS.insiderOwnership,
      detail: `${(f.insiderOwnershipPct * 100).toFixed(1)}% of shares held by insiders`,
    });
  } else {
    metrics.push({
      metric: "Insider Ownership",
      availability: "unavailable",
      score: null,
      weight: WEIGHTS.insiderOwnership,
      detail: "",
      reason: `No insider-ownership data source available — ${NO_INSIDER_OWNERSHIP_DATA_REASON}.`,
    });
  }

  const available = metrics.filter(
    (m): m is QualityMetricScore & { score: number } => m.availability === "available" && m.score != null,
  );
  const totalWeight = available.reduce((a, m) => a + m.weight, 0);
  const score = totalWeight > 0
    ? round(clamp(available.reduce((a, m) => a + m.score * m.weight, 0) / totalWeight))
    : null;

  const byScoreDesc = [...available].sort((a, b) => b.score - a.score);
  const byScoreAsc = [...available].sort((a, b) => a.score - b.score);
  const strengths = byScoreDesc
    .filter((m) => m.score >= 70)
    .slice(0, 4)
    .map((m) => `${m.metric}: ${m.score}/100 — ${m.detail}`);
  const weaknesses = byScoreAsc
    .filter((m) => m.score < 40)
    .slice(0, 4)
    .map((m) => `${m.metric}: ${m.score}/100 — ${m.detail}`);

  const unavailable = metrics.filter((m) => m.availability === "unavailable");
  const availabilityRatio = metrics.length > 0 ? available.length / metrics.length : 0;
  let confidenceLevel: QualityConfidenceLevel = "Low";
  if (availabilityRatio >= 0.95) confidenceLevel = "High";
  else if (availabilityRatio >= 0.8) confidenceLevel = "Moderate";

  const confidenceExplanation =
    unavailable.length === 0
      ? `All ${metrics.length} quality metrics have usable data for ${f.symbol}.`
      : `${available.length} of ${metrics.length} quality metrics have usable data for ${f.symbol}; ${unavailable.length} (${unavailable.map((m) => m.metric).join(", ")}) await future data sources.`;

  const kindNote =
    f.kind === "etf"
      ? " As a diversified fund, these per-company metrics reflect the fund's blended holdings rather than a single business."
      : "";
  const summary =
    score != null
      ? `${f.symbol} scores ${score}/100 on investment quality across ${available.length} scored metrics (${confidenceLevel} confidence).${kindNote}`
      : `${f.symbol}: investment quality could not be scored — no metric had usable data.`;

  return { score, metrics, strengths, weaknesses, confidenceLevel, confidenceExplanation, summary };
}

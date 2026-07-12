// Task #66 — Deterministic value-investing analysis engines (Buffett-style).
//
// These are PURE functions over a SIMULATED `Fundamentals` snapshot. They are the
// source of truth for every number the value-research module shows; the LLM only
// narrates around them. Mirrors the deterministic style of optionsMath / eventRisk.
//
// SAFETY CONTRACT:
//  - Advisory / education ONLY. Nothing here executes, schedules, or sizes a trade.
//  - Fair value is NEVER fabricated. When inputs are insufficient, valuation returns
//    an explicit `{ available: false }` state and downstream UI shows "unavailable".
//  - All inputs are SIMULATED; the data source is surfaced so the UI can label it.

import type { Fundamentals } from "./fundamentals.js";
import type { Snapshot } from "./optionsMath.js";

function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}
function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ─── Business Quality ────────────────────────────────────────────────────────
export type BusinessQualityRating = "Wonderful" | "Good" | "Average" | "Weak";

export interface FactorScore {
  label: string;
  score: number; // 0-100
  detail: string;
}

export interface BusinessQuality {
  score: number; // 0-100
  rating: BusinessQualityRating;
  factors: FactorScore[];
  summary: string;
}

function qualityRating(score: number): BusinessQualityRating {
  if (score >= 72) return "Wonderful";
  if (score >= 58) return "Good";
  if (score >= 42) return "Average";
  return "Weak";
}

export function analyzeBusinessQuality(f: Fundamentals): BusinessQuality {
  // Returns on capital — the single most important quality signal for Buffett.
  const roicScore = clamp((f.roic / 0.30) * 100);
  const roeScore = clamp((f.roe / 0.35) * 100);
  // Profitability / margins.
  const marginScore = clamp((f.netMargin / 0.30) * 100);
  // Consistency of cash generation.
  const consistencyScore = clamp((f.fcfPositiveYears / 10) * 100);
  // Durable growth.
  const growthScore = clamp((f.epsGrowth5y / 0.25) * 100);
  // Qualitative business strength.
  const q = f.qualitative;
  const qualScore = clamp(
    avg([q.pricingPower, q.brand, q.customerLoyalty, q.recurringRevenue, q.scale]),
  );

  const factors: FactorScore[] = [
    { label: "Return on invested capital", score: round(roicScore), detail: `ROIC ${(f.roic * 100).toFixed(0)}%` },
    { label: "Return on equity", score: round(roeScore), detail: `ROE ${(f.roe * 100).toFixed(0)}%` },
    { label: "Net margin", score: round(marginScore), detail: `${(f.netMargin * 100).toFixed(0)}% net margin` },
    { label: "Cash-flow consistency", score: round(consistencyScore), detail: `${f.fcfPositiveYears}/10 yrs positive FCF` },
    { label: "Durable growth", score: round(growthScore), detail: `${(f.epsGrowth5y * 100).toFixed(0)}% 5y EPS CAGR` },
    { label: "Qualitative strength", score: round(qualScore), detail: "Pricing power, brand, loyalty, recurring revenue, scale" },
  ];

  // ROIC and qualitative strength are weighted most heavily.
  const score = round(
    clamp(
      roicScore * 0.28 +
        roeScore * 0.14 +
        marginScore * 0.14 +
        consistencyScore * 0.14 +
        growthScore * 0.10 +
        qualScore * 0.20,
    ),
  );
  const rating = qualityRating(score);

  const kindNote =
    f.kind === "etf"
      ? "As a diversified fund, quality reflects the blended basket rather than a single business."
      : "";
  const summary =
    `${f.symbol} scores ${score}/100 on business quality (${rating}). ` +
    `The strongest driver is returns on capital (ROIC ${(f.roic * 100).toFixed(0)}%). ${kindNote}`.trim();

  return { score, rating, factors, summary };
}

// ─── Economic Moat ───────────────────────────────────────────────────────────
export type MoatRating = "Wide" | "Medium" | "Narrow" | "None";

export interface MoatSource {
  source: string;
  strength: number; // 0-100
}

export interface MoatAnalysis {
  rating: MoatRating;
  score: number; // 0-100
  durabilityYears: number; // SIMULATED estimate of moat durability
  sources: MoatSource[];
  summary: string;
}

export function analyzeMoat(f: Fundamentals): MoatAnalysis {
  const q = f.qualitative;
  const candidates: MoatSource[] = [
    { source: "Switching costs", strength: q.switchingCost },
    { source: "Network effect", strength: q.networkEffect },
    { source: "Intangible assets / brand", strength: Math.round((q.brand + q.ipStrength) / 2) },
    { source: "Cost advantage / scale", strength: q.scale },
    { source: "Pricing power", strength: q.pricingPower },
    { source: "Distribution / efficient scale", strength: q.distribution },
  ];
  const sources = candidates.filter((c) => c.strength >= 60).sort((a, b) => b.strength - a.strength);

  // A moat must show up in the numbers too: durable high ROIC is the financial
  // fingerprint of a real moat.
  const qualMoat = avg(candidates.map((c) => c.strength));
  const roicEvidence = clamp((f.roic / 0.25) * 100);
  let score = round(clamp(qualMoat * 0.6 + roicEvidence * 0.4));

  // ETFs are diversified baskets — no single-company moat.
  if (f.kind === "etf") {
    score = Math.min(score, 40);
  }

  let rating: MoatRating = "None";
  if (score >= 70) rating = "Wide";
  else if (score >= 58) rating = "Medium";
  else if (score >= 48) rating = "Narrow";

  const durabilityYears =
    rating === "Wide" ? 15 : rating === "Medium" ? 10 : rating === "Narrow" ? 6 : 2;

  const summary =
    f.kind === "etf"
      ? `${f.symbol} is a diversified fund, so it has no single-company moat; durability comes from broad index exposure.`
      : sources.length
        ? `${f.symbol} shows a ${rating.toLowerCase()} moat built primarily on ${sources
            .slice(0, 2)
            .map((s) => s.source.toLowerCase())
            .join(" and ")}, corroborated by ${(f.roic * 100).toFixed(0)}% ROIC.`
        : `${f.symbol} shows no clearly identifiable durable competitive advantage.`;

  return { rating, score, durabilityYears, sources, summary };
}

// ─── Financial Strength ──────────────────────────────────────────────────────
export type FinancialStrengthRating = "Strong" | "Acceptable" | "Weak" | "Risky";

export interface FinancialStrength {
  rating: FinancialStrengthRating;
  score: number; // 0-100
  metrics: FactorScore[];
  flags: string[];
  summary: string;
}

export function analyzeFinancialStrength(f: Fundamentals): FinancialStrength {
  const leverageScore = clamp(100 - (f.debtToEquity / 1.5) * 100);
  const coverageScore = clamp((Math.min(f.interestCoverage, 50) / 20) * 100);
  const liquidityScore = f.kind === "etf" ? 70 : clamp((f.currentRatio / 2) * 100);
  const cashScore = clamp(50 + (f.netCashPerShare > 0 ? 50 : Math.max(-50, (f.netCashPerShare / f.price) * 100 * 5)));
  const fcfScore = clamp((f.fcfPositiveYears / 10) * 100);

  const metrics: FactorScore[] = [
    { label: "Leverage", score: round(leverageScore), detail: `Debt/Equity ${f.debtToEquity.toFixed(2)}` },
    { label: "Interest coverage", score: round(coverageScore), detail: f.interestCoverage >= 100 ? "Effectively no debt burden" : `${f.interestCoverage.toFixed(0)}× EBIT/interest` },
    { label: "Liquidity", score: round(liquidityScore), detail: f.kind === "etf" ? "Fund liquidity" : `Current ratio ${f.currentRatio.toFixed(2)}` },
    { label: "Net cash", score: round(cashScore), detail: f.netCashPerShare >= 0 ? `Net cash $${f.netCashPerShare.toFixed(2)}/sh` : `Net debt $${Math.abs(f.netCashPerShare).toFixed(2)}/sh` },
    { label: "FCF reliability", score: round(fcfScore), detail: `${f.fcfPositiveYears}/10 yrs positive FCF` },
  ];

  const score = round(
    clamp(leverageScore * 0.25 + coverageScore * 0.2 + liquidityScore * 0.15 + cashScore * 0.2 + fcfScore * 0.2),
  );

  const flags: string[] = [];
  if (f.debtToEquity > 1.0) flags.push("Elevated leverage (Debt/Equity > 1.0)");
  if (f.interestCoverage < 5) flags.push("Thin interest coverage (< 5×)");
  if (f.currentRatio < 1 && f.kind !== "etf") flags.push("Current ratio below 1.0");
  if (f.fcfPositiveYears < 7) flags.push("Inconsistent free cash flow history");
  if (f.netCashPerShare < 0) flags.push("Net debt position");

  let rating: FinancialStrengthRating = "Risky";
  if (score >= 72) rating = "Strong";
  else if (score >= 55) rating = "Acceptable";
  else if (score >= 40) rating = "Weak";

  const summary = `${f.symbol} balance sheet rates ${rating} (${score}/100)${flags.length ? `; watch: ${flags[0].toLowerCase()}` : "."}`;

  return { rating, score, metrics, flags, summary };
}

// ─── Valuation & Margin of Safety ────────────────────────────────────────────
export type ValuationRating = "Cheap" | "Fair" | "Expensive" | "Very Expensive";
export type MarginOfSafetyLabel = "High" | "Medium" | "Low" | "None";

interface FairValueMethod {
  method: string;
  fairValue: number;
  detail: string;
}

export type Valuation =
  | {
      available: true;
      dataSource: Fundamentals["dataSource"];
      price: number;
      fairValue: number;
      fairValueLow: number;
      fairValueHigh: number;
      methods: FairValueMethod[];
      marginOfSafety: number; // fraction; positive => undervalued
      marginOfSafetyLabel: MarginOfSafetyLabel;
      rating: ValuationRating;
      summary: string;
    }
  | {
      available: false;
      dataSource: Fundamentals["dataSource"];
      price: number;
      reason: string;
      summary: string;
    };

// A "reasonable" earnings multiple anchored on quality + growth (Buffett would pay
// up for quality, but only within reason). Bounded so we never extrapolate hype.
function fairMultiple(f: Fundamentals): number {
  const base = 15;
  const growthBonus = clamp(f.epsGrowth5y * 100 * 0.6, 0, 18); // up to +18 for growth
  const qualityBonus = clamp((f.roic - 0.15) * 100 * 0.4, -6, 10); // returns on capital
  return clamp(base + growthBonus + qualityBonus, 8, 40);
}

export function analyzeValuation(f: Fundamentals): Valuation {
  const methods: FairValueMethod[] = [];

  // Earnings method — prefer forward EPS, fall back to trailing.
  const eps = f.epsFwd ?? f.epsTtm;
  if (eps != null && eps > 0) {
    const mult = fairMultiple(f);
    const fv = round(eps * mult, 2);
    methods.push({
      method: "Earnings multiple",
      fairValue: fv,
      detail: `${eps.toFixed(2)} EPS × ${mult.toFixed(1)} fair P/E`,
    });
  }

  // Free-cash-flow yield method — required yield eases for higher-quality names.
  if (f.fcfPerShare > 0) {
    const requiredYield = clamp(0.07 - (f.roic - 0.15) * 0.08, 0.04, 0.09);
    const fv = round(f.fcfPerShare / requiredYield, 2);
    methods.push({
      method: "FCF yield",
      fairValue: fv,
      detail: `$${f.fcfPerShare.toFixed(2)} FCF/sh ÷ ${(requiredYield * 100).toFixed(1)}% required yield`,
    });
  }

  if (methods.length === 0) {
    return {
      available: false,
      dataSource: f.dataSource,
      price: f.price,
      reason:
        "No positive forward earnings or free cash flow to anchor an intrinsic-value estimate.",
      summary: `${f.symbol}: fair value unavailable — insufficient profitability inputs to estimate intrinsic value without fabricating a number.`,
    };
  }

  const fairValues = methods.map((m) => m.fairValue);
  const fairValue = round(avg(fairValues), 2);
  const fairValueLow = round(Math.min(...fairValues) * 0.9, 2);
  const fairValueHigh = round(Math.max(...fairValues) * 1.1, 2);

  const marginOfSafety = round((fairValue - f.price) / fairValue, 4) as number; // fraction
  let mosLabel: MarginOfSafetyLabel = "None";
  if (marginOfSafety >= 0.25) mosLabel = "High";
  else if (marginOfSafety >= 0.12) mosLabel = "Medium";
  else if (marginOfSafety > 0) mosLabel = "Low";

  let rating: ValuationRating = "Fair";
  if (marginOfSafety >= 0.15) rating = "Cheap";
  else if (marginOfSafety <= -0.3) rating = "Very Expensive";
  else if (marginOfSafety <= -0.1) rating = "Expensive";

  const mosPct = (marginOfSafety * 100).toFixed(0);
  const summary =
    `${f.symbol} trades at $${f.price.toFixed(2)} vs a SIMULATED fair-value estimate of ` +
    `$${fairValue.toFixed(2)} ($${fairValueLow.toFixed(2)}–$${fairValueHigh.toFixed(2)}), a ${mosPct}% ` +
    `margin of safety (${mosLabel}). Rated ${rating}.`;

  return {
    available: true,
    dataSource: f.dataSource,
    price: f.price,
    fairValue,
    fairValueLow,
    fairValueHigh,
    methods,
    marginOfSafety,
    marginOfSafetyLabel: mosLabel,
    rating,
    summary,
  };
}

// ─── Value-Investor Decision ─────────────────────────────────────────────────
export type ValueDecisionVerdict =
  | "LONG-TERM BUY"
  | "BUY ONLY ON PULLBACK"
  | "WATCHLIST"
  | "HOLD"
  | "TRIM"
  | "AVOID";

export interface ValueDecision {
  verdict: ValueDecisionVerdict;
  conviction: number; // 0-100
  rationale: string[];
  summary: string;
}

export function analyzeValueDecision(
  f: Fundamentals,
  bq: BusinessQuality,
  moat: MoatAnalysis,
  fin: FinancialStrength,
  val: Valuation,
): ValueDecision {
  const rationale: string[] = [];
  const qualityOk = bq.score >= 58;
  const moatOk = moat.rating !== "None";
  const finOk = fin.rating === "Strong" || fin.rating === "Acceptable";
  const finBad = fin.rating === "Weak" || fin.rating === "Risky";

  rationale.push(`Business quality: ${bq.rating} (${bq.score}/100).`);
  rationale.push(`Moat: ${moat.rating}.`);
  rationale.push(`Financial strength: ${fin.rating}.`);

  let verdict: ValueDecisionVerdict;
  let conviction = 50;

  if (finBad || bq.score < 42) {
    verdict = "AVOID";
    conviction = 25;
    rationale.push(
      finBad
        ? "Balance-sheet weakness fails the quality-first filter."
        : "Business quality is below the investable threshold.",
    );
  } else if (!val.available) {
    verdict = "WATCHLIST";
    conviction = 40;
    rationale.push("Fair value is unavailable, so no margin-of-safety judgment can be made — research only.");
  } else {
    const mos = val.marginOfSafety;
    if (qualityOk && moatOk && finOk && mos >= 0.2) {
      verdict = "LONG-TERM BUY";
      conviction = 85;
      rationale.push(`A ${(mos * 100).toFixed(0)}% margin of safety on a moat-protected compounder.`);
    } else if (qualityOk && finOk && mos >= 0.05) {
      verdict = "BUY ONLY ON PULLBACK";
      conviction = 68;
      rationale.push(
        `A quality business with only a ${(mos * 100).toFixed(0)}% margin of safety — add on further weakness.`,
      );
    } else if (qualityOk && mos <= -0.3) {
      verdict = "TRIM";
      conviction = 55;
      rationale.push(`Overvalued by ${Math.abs(mos * 100).toFixed(0)}% — rich enough to trim into strength.`);
    } else if (qualityOk && mos >= -0.1) {
      verdict = "HOLD";
      conviction = 60;
      rationale.push("Fairly valued quality business — hold, but there is no new margin of safety to add on.");
    } else {
      verdict = "WATCHLIST";
      conviction = 45;
      rationale.push(`Overvalued by ${Math.abs(mos * 100).toFixed(0)}% — wait for a better price.`);
    }
  }

  const summary = `${f.symbol}: ${verdict} (conviction ${conviction}/100). ${rationale[rationale.length - 1]}`;
  return { verdict, conviction, rationale, summary };
}

// ─── Stock vs. Options ───────────────────────────────────────────────────────
export type StockVsOptionsVerdict =
  | "Long-term stock"
  | "Options income"
  | "Both"
  | "Watchlist only"
  | "Avoid";

export interface StockVsOptions {
  verdict: StockVsOptionsVerdict;
  ivRank: number | null;
  stockCase: string;
  optionsCase: string;
  summary: string;
}

// Bridges the value module back to the options engine. Buffett-style ownership is
// best when there is a real margin of safety on a wonderful business; the options
// premium-selling engine shines when the name is fairly/​richly valued with high IV.
export function analyzeStockVsOptions(
  f: Fundamentals,
  bq: BusinessQuality,
  moat: MoatAnalysis,
  val: Valuation,
  snap: Snapshot | null,
): StockVsOptions {
  const ivRank = snap?.ivRank ?? null;
  const mos = val.available ? val.marginOfSafety : null;
  const wonderful = bq.score >= 65 && moat.rating !== "None";
  const cheap = mos != null && mos >= 0.15;
  const rich = mos != null && mos <= -0.1;
  const highIv = ivRank != null && ivRank >= 50;

  let verdict: StockVsOptionsVerdict;
  if (bq.score < 42) verdict = "Avoid";
  else if (wonderful && cheap) verdict = "Long-term stock";
  else if (rich && highIv) verdict = "Options income";
  else if (rich && !highIv) verdict = "Watchlist only";
  else if (highIv) verdict = "Options income";
  else verdict = "Both";

  const stockCase = wonderful
    ? "Owning the business captures long-term compounding, dividends, and moat durability — ideal when bought with a margin of safety."
    : "Direct ownership only makes sense with both a quality business and a discount to intrinsic value, which is not clearly present here.";
  const optionsCase = highIv
    ? `Elevated IV rank (${ivRank}) means premium is rich — the defined-risk options engine can harvest that without taking a long-term ownership view.`
    : "IV is not elevated, so option premiums are thin relative to the risk of selling them here.";

  const summary = `${f.symbol}: ${verdict}. ${verdict === "Long-term stock" ? stockCase : optionsCase}`;
  return { verdict, ivRank, stockCase, optionsCase, summary };
}

// ─── Investment Suitability (scanner ranking) ────────────────────────────────
// A thin, deterministic COMPOSITE over the engine outputs above — it invents no
// new data, it only re-expresses the existing pillar scores as two ranking
// numbers plus a use-case/action label so the Stock Scanner can sort the
// universe. Advisory / education only; never sizes or places a trade.
export type InvestmentUseCase = "Stock" | "Options" | "Both" | "Watchlist" | "Avoid";

export interface InvestmentSuitability {
  stockInvestmentScore: number; // 0-100 — attractiveness as a long-term owner
  optionsSuitabilityScore: number; // 0-100 — suitability for premium-selling income
  useCase: InvestmentUseCase;
  suggestedAction: string;
}

// Margin-of-safety expressed on a 0-100 scale (50 = fairly valued). When fair
// value is unavailable we cannot judge a discount, so we return a neutral-low
// score rather than fabricate one.
function mosScore(val: Valuation): number {
  if (!val.available) return 40;
  return clamp(50 + val.marginOfSafety * 200);
}

const USE_CASE_FROM_SVO: Record<StockVsOptionsVerdict, InvestmentUseCase> = {
  "Long-term stock": "Stock",
  "Options income": "Options",
  Both: "Both",
  "Watchlist only": "Watchlist",
  Avoid: "Avoid",
};

const ACTION_FROM_DECISION: Record<ValueDecisionVerdict, string> = {
  "LONG-TERM BUY": "Accumulate",
  "BUY ONLY ON PULLBACK": "Wait for pullback",
  WATCHLIST: "Watchlist & monitor",
  HOLD: "Hold",
  TRIM: "Trim into strength",
  AVOID: "Avoid",
};

export function analyzeInvestmentSuitability(
  bq: BusinessQuality,
  moat: MoatAnalysis,
  fin: FinancialStrength,
  val: Valuation,
  svo: StockVsOptions,
  decision: ValueDecision,
): InvestmentSuitability {
  // Stock ownership attractiveness — quality-first, weighted toward business
  // quality and moat, with the balance sheet and a real margin of safety
  // rounding it out (the Buffett "wonderful business at a fair price" lens).
  const stockInvestmentScore = round(
    clamp(bq.score * 0.35 + moat.score * 0.25 + fin.score * 0.2 + mosScore(val) * 0.2),
  );

  // Options premium-selling suitability — driven by IV richness, helped when the
  // name is NOT deeply undervalued (you'd rather own a cheap compounder), with a
  // quality floor so we never favour selling premium on a junk underlying.
  const ivScore = svo.ivRank != null ? clamp(svo.ivRank) : 50;
  const richScore = val.available ? clamp(50 - val.marginOfSafety * 150) : 50;
  const optionsSuitabilityScore = round(
    clamp(ivScore * 0.5 + richScore * 0.25 + bq.score * 0.25),
  );

  return {
    stockInvestmentScore,
    optionsSuitabilityScore,
    useCase: USE_CASE_FROM_SVO[svo.verdict],
    suggestedAction: ACTION_FROM_DECISION[decision.verdict],
  };
}

// Phase 2, Sprint 29 — Portfolio Risk Analysis (approved Phase 2 plan, Sprint
// 29). Architecture deliberately modeled on portfolioHealth.ts's pattern: a
// pure, I/O-free scorer that turns already-resolved portfolio data into a
// handful of 0-100 scores plus a deterministic, human-readable narrative —
// unit-testable without a database or a FundamentalsProvider, and produces
// identical output for identical inputs.
//
// computePortfolioRisk() takes a portfolio's already-computed holding
// allocations directly (the same PortfolioHoldingAllocation shape
// portfolioConstruction.ts already produces, extended in this sprint with
// per-holding sector/beta) — zero new provider calls, 100% reuse of data
// resolved once by buildPortfolioAllocation().
//
// SAFETY CONTRACT: never fabricates. Concentration/sector/beta scores are
// honestly reported "insufficient-data" (never a fake 100 or 0) whenever
// there isn't enough resolvable market value to compute them; a holding
// with unknown sector/beta is excluded from that specific metric's weighted
// calculation (renormalized over the holdings that do have the data), never
// silently treated as 0 or averaged in as if known.

export type RiskLevel = "insufficient-data" | "low" | "moderate" | "elevated" | "high";

// Approved Sprint 29 defaults: a single holding above this share of total
// market value, or a single sector above this share, trips a hard warning
// flag. Named/adjustable, same precedent as portfolioConstruction.ts's
// REBALANCE_DRIFT_THRESHOLD_PCT.
export const SINGLE_SYMBOL_CONCENTRATION_CAP_PCT = 25;
export const SECTOR_CONCENTRATION_CAP_PCT = 40;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Banded scorer, same convention as portfolioHealth.ts's band(): returns the
// score of the first band whose ceiling the value is at or below.
//
// Phase 13 — exported (behavior-preserving, this module's own callers are
// unaffected) so lib/portfolioIntelligence.ts's own extended risk dimensions
// (Leverage Exposure, Dividend Dependence, Cash Risk) reuse the exact same
// banding convention and 5-tier gradeLabel() vocabulary instead of a second,
// subtly different classifier.
export function band(value: number, bands: [ceiling: number, score: number][], fallback: number): number {
  for (const [ceiling, score] of bands) {
    if (value <= ceiling) return score;
  }
  return fallback;
}

export function gradeLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 35) return "Elevated";
  return "Poor";
}

function betaSensitivityLabel(beta: number): string {
  if (beta < 0.8) return "Low";
  if (beta < 1.15) return "Moderate";
  if (beta < 1.5) return "Elevated";
  return "High";
}

export interface RiskInputHolding {
  symbol: string;
  marketValue: number | null;
  sector: string | null;
  beta: number | null;
}

export interface ScoreCard {
  score: number | null; // null only when genuinely insufficient data
  label: string;
  detail: string;
}

export interface RiskComponent {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  detail: string;
}

export interface SectorExposureRow {
  sector: string;
  marketValue: number;
  weightPct: number;
}

export interface ConcentrationRisk extends ScoreCard {
  largestSymbol: string | null;
  largestSymbolWeightPct: number | null;
  capBreached: boolean;
}

export interface SectorExposureRisk extends ScoreCard {
  largestSector: string | null;
  largestSectorWeightPct: number | null;
  capBreached: boolean;
  breakdown: SectorExposureRow[];
  unclassifiedWeightPct: number | null;
}

export interface BetaEstimateRisk extends ScoreCard {
  portfolioBeta: number | null;
  coveragePct: number | null; // share of total market value with a known beta
}

export interface PortfolioRiskAnalysis {
  overall: ScoreCard;
  concentration: ConcentrationRisk;
  sectorExposure: SectorExposureRisk;
  betaEstimate: BetaEstimateRisk;
  components: RiskComponent[];
  totalMarketValue: number | null;
  unresolvedSymbols: string[];
}

function computeConcentration(holdings: RiskInputHolding[], totalMarketValue: number | null): ConcentrationRisk {
  if (totalMarketValue == null || totalMarketValue <= 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No resolvable market value — add shares or resolvable symbols to score concentration.",
      largestSymbol: null,
      largestSymbolWeightPct: null,
      capBreached: false,
    };
  }
  const priced = holdings.filter((h) => h.marketValue != null && h.marketValue > 0);
  if (priced.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No holdings could be priced.",
      largestSymbol: null,
      largestSymbolWeightPct: null,
      capBreached: false,
    };
  }
  const top = [...priced].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))[0];
  const largestSymbolWeightPct = round(((top.marketValue ?? 0) / totalMarketValue) * 100);
  const capBreached = largestSymbolWeightPct > SINGLE_SYMBOL_CONCENTRATION_CAP_PCT;
  const score = round(
    band(
      largestSymbolWeightPct,
      [
        [SINGLE_SYMBOL_CONCENTRATION_CAP_PCT * 0.6, 100],
        [SINGLE_SYMBOL_CONCENTRATION_CAP_PCT, 75],
        [SINGLE_SYMBOL_CONCENTRATION_CAP_PCT * 1.5, 45],
      ],
      20,
    ),
  );
  return {
    score,
    label: gradeLabel(score),
    detail: capBreached
      ? `${top.symbol} is ${largestSymbolWeightPct}% of the portfolio, above the ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% single-symbol concentration cap.`
      : `Largest single holding ${top.symbol} at ${largestSymbolWeightPct}% of the portfolio, within the ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% cap.`,
    largestSymbol: top.symbol,
    largestSymbolWeightPct,
    capBreached,
  };
}

function computeSectorExposure(holdings: RiskInputHolding[], totalMarketValue: number | null): SectorExposureRisk {
  if (totalMarketValue == null || totalMarketValue <= 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No resolvable market value — sector exposure cannot be scored.",
      largestSector: null,
      largestSectorWeightPct: null,
      capBreached: false,
      breakdown: [],
      unclassifiedWeightPct: null,
    };
  }
  const priced = holdings.filter((h) => h.marketValue != null && h.marketValue > 0);
  const classified = priced.filter((h) => h.sector != null);
  if (classified.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No holding has a known sector classification.",
      largestSector: null,
      largestSectorWeightPct: null,
      capBreached: false,
      breakdown: [],
      unclassifiedWeightPct: priced.length > 0 ? 100 : null,
    };
  }

  const bySector = new Map<string, number>();
  for (const h of classified) {
    bySector.set(h.sector as string, (bySector.get(h.sector as string) ?? 0) + (h.marketValue ?? 0));
  }
  const breakdown: SectorExposureRow[] = [...bySector.entries()]
    .map(([sector, marketValue]) => ({ sector, marketValue: round(marketValue), weightPct: round((marketValue / totalMarketValue) * 100) }))
    .sort((a, b) => b.weightPct - a.weightPct);

  const top = breakdown[0];
  const capBreached = top.weightPct > SECTOR_CONCENTRATION_CAP_PCT;
  const unclassifiedValue = priced.filter((h) => h.sector == null).reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const unclassifiedWeightPct = round((unclassifiedValue / totalMarketValue) * 100);

  const score = round(
    band(
      top.weightPct,
      [
        [SECTOR_CONCENTRATION_CAP_PCT * 0.6, 100],
        [SECTOR_CONCENTRATION_CAP_PCT, 75],
        [SECTOR_CONCENTRATION_CAP_PCT * 1.5, 45],
      ],
      20,
    ),
  );

  return {
    score,
    label: gradeLabel(score),
    detail: capBreached
      ? `${top.sector} is ${top.weightPct}% of the portfolio, above the ${SECTOR_CONCENTRATION_CAP_PCT}% single-sector concentration cap.`
      : `Largest sector exposure is ${top.sector} at ${top.weightPct}%, within the ${SECTOR_CONCENTRATION_CAP_PCT}% cap.`,
    largestSector: top.sector,
    largestSectorWeightPct: top.weightPct,
    capBreached,
    breakdown,
    unclassifiedWeightPct,
  };
}

function computeBetaEstimate(holdings: RiskInputHolding[], totalMarketValue: number | null): BetaEstimateRisk {
  if (totalMarketValue == null || totalMarketValue <= 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No resolvable market value — beta cannot be estimated.",
      portfolioBeta: null,
      coveragePct: null,
    };
  }
  const priced = holdings.filter((h) => h.marketValue != null && h.marketValue > 0);
  const knownBeta = priced.filter((h) => h.beta != null);
  if (knownBeta.length === 0) {
    return {
      score: null,
      label: "Insufficient data",
      detail: "No holding has a known beta.",
      portfolioBeta: null,
      coveragePct: priced.length > 0 ? 0 : null,
    };
  }

  // Weighted average over only the holdings with a known beta, renormalized
  // over their combined market value — never averaging in an unknown beta as
  // if it were 0 or 1.
  const knownValue = knownBeta.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const weightedBeta = knownBeta.reduce((s, h) => s + (h.beta as number) * ((h.marketValue ?? 0) / knownValue), 0);
  const portfolioBeta = round(weightedBeta);
  const coveragePct = round((knownValue / totalMarketValue) * 100);

  const score = round(
    band(
      portfolioBeta,
      [
        [0.8, 100],
        [1.15, 82],
        [1.5, 58],
      ],
      32,
    ),
  );

  return {
    score,
    label: betaSensitivityLabel(portfolioBeta),
    detail: `Weighted-average portfolio beta ${portfolioBeta} (${betaSensitivityLabel(portfolioBeta).toLowerCase()} market sensitivity), covering ${coveragePct}% of priced market value.`,
    portfolioBeta,
    coveragePct,
  };
}

export function computePortfolioRisk(holdings: RiskInputHolding[]): PortfolioRiskAnalysis {
  const priced = holdings.filter((h) => h.marketValue != null && h.marketValue > 0);
  const totalMarketValue = priced.length > 0 ? round(priced.reduce((s, h) => s + (h.marketValue ?? 0), 0)) : null;
  const unresolvedSymbols = [...new Set(holdings.filter((h) => h.marketValue == null).map((h) => h.symbol))];

  const concentration = computeConcentration(holdings, totalMarketValue);
  const sectorExposure = computeSectorExposure(holdings, totalMarketValue);
  const betaEstimate = computeBetaEstimate(holdings, totalMarketValue);

  const components: RiskComponent[] = [
    { key: "concentration", label: "Single-symbol concentration", score: concentration.score, weight: 0.4, detail: concentration.detail },
    { key: "sector_exposure", label: "Sector exposure", score: sectorExposure.score, weight: 0.35, detail: sectorExposure.detail },
    { key: "beta_estimate", label: "Market-sensitivity (beta)", score: betaEstimate.score, weight: 0.25, detail: betaEstimate.detail },
  ];

  const scored = components.filter((c) => c.score != null);
  let overallScore: number | null = null;
  if (scored.length > 0) {
    const weightSum = scored.reduce((s, c) => s + c.weight, 0);
    overallScore = round(scored.reduce((s, c) => s + (c.score as number) * c.weight, 0) / weightSum);
    // Hard-cap override: breaching either concentration cap caps the overall
    // score below the "Strong" band, regardless of how the blend computes —
    // the same pattern portfolioHealth.ts uses for a breached risk limit.
    if (concentration.capBreached || sectorExposure.capBreached) overallScore = Math.min(overallScore, 60);
  }

  const capNotes: string[] = [];
  if (concentration.capBreached) capNotes.push("single-symbol concentration cap breached");
  if (sectorExposure.capBreached) capNotes.push("sector concentration cap breached");

  return {
    overall: {
      score: overallScore,
      label: overallScore == null ? "Insufficient data" : gradeLabel(overallScore),
      detail:
        overallScore == null
          ? "Not enough resolvable, priced holdings to score portfolio risk yet."
          : `Composite of concentration, sector exposure, and beta sensitivity${capNotes.length > 0 ? ` — ${capNotes.join(", ")}` : ""}.`,
    },
    concentration,
    sectorExposure,
    betaEstimate,
    components,
    totalMarketValue,
    unresolvedSymbols,
  };
}

// Adapter so the route layer can hand this the same
// PortfolioHoldingAllocation[] shape portfolioConstruction.ts already
// produces (holdings resolved once, reused here with zero new provider
// calls) without this module taking a dependency on that module's types.
export function computePortfolioRiskFromAllocation(
  holdings: { symbol: string; marketValue: number | null; sector: string | null; beta: number | null }[],
): PortfolioRiskAnalysis {
  return computePortfolioRisk(holdings.map((h) => ({ symbol: h.symbol, marketValue: h.marketValue, sector: h.sector, beta: h.beta })));
}

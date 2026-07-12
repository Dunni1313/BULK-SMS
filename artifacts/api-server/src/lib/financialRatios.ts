// Phase 2, Sprint 18 — Financial Ratio Analysis (approved Phase 2 plan, Sprint 18).
// Promotes the existing flat "Key Metrics" list into a dedicated, grouped ratio
// analysis surface with multi-year trend data — purely additive; the existing
// "Key Metrics" section/field is untouched, this is a second, differently-grouped
// presentation over the same and a few new underlying numbers.
//
// Pure + deterministic, provider-agnostic: every ratio here is derived directly
// from `Fundamentals`, never refetched or recomputed by a different formula than
// wherever else in the codebase already computes the same figure.
//
// SAFETY CONTRACT: never fabricates. Of the 4 ratios requested for this sprint,
// only Payout Ratio is honestly computable from fields that exist today. Quick
// Ratio, Return on Assets, and Asset Turnover all need balance-sheet detail
// (inventory, total assets, current-liability breakdown) that does not exist
// anywhere in `Fundamentals` for any provider yet — rather than approximate them
// (e.g. via a DuPont-identity shortcut that would silently distort the number for
// asset-heavy or highly-levered companies), all three are honestly reported
// `available: false` with an explicit reason, pending the Financial Statement
// Analysis sprint's full balance-sheet line items.

import type { Fundamentals } from "./fundamentals.js";

function pct(x: number, dp = 0): string {
  return `${(x * 100).toFixed(dp)}%`;
}

const BALANCE_SHEET_REASON =
  "requires full balance-sheet line items not yet available; planned for the Financial Statement Analysis sprint";

export interface RatioMetric {
  label: string;
  value: number | null; // raw value (fraction or multiple), null when unavailable
  displayValue: string;
  available: boolean;
  reason?: string; // present only when unavailable
}

export interface RatioTrend {
  label: string;
  history: number[]; // reused directly from Fundamentals, oldest -> newest
}

export interface FinancialRatiosAnalysis {
  valuation: RatioMetric[];
  profitability: RatioMetric[];
  liquidityAndLeverage: RatioMetric[];
  trends: RatioTrend[];
  summary: string;
}

function available(label: string, value: number, displayValue: string): RatioMetric {
  return { label, value, displayValue, available: true };
}

function unavailable(label: string, reason: string): RatioMetric {
  return { label, value: null, displayValue: "n/a", available: false, reason };
}

export function analyzeFinancialRatios(f: Fundamentals): FinancialRatiosAnalysis {
  const valuation: RatioMetric[] = [
    f.pe != null ? available("P/E (trailing)", f.pe, `${f.pe}`) : unavailable("P/E (trailing)", "No positive trailing EPS."),
    f.forwardPe != null ? available("P/E (forward)", f.forwardPe, `${f.forwardPe}`) : unavailable("P/E (forward)", "No positive forward EPS."),
    f.peg != null ? available("PEG", f.peg, `${f.peg}`) : unavailable("PEG", "P/E or growth not computable."),
    f.ps != null ? available("P/S", f.ps, `${f.ps}`) : unavailable("P/S", "Sales per share not positive."),
    f.pb != null ? available("P/B", f.pb, `${f.pb}`) : unavailable("P/B", "Book value per share not positive."),
    f.fcfYield != null ? available("FCF Yield", f.fcfYield, pct(f.fcfYield, 1)) : unavailable("FCF Yield", "Free cash flow not positive."),
    available("Dividend Yield", f.dividendYield, pct(f.dividendYield, 2)),
  ];

  const payoutRatio: RatioMetric =
    f.epsTtm != null && f.epsTtm > 0
      ? available("Payout Ratio", f.dividendPerShare / f.epsTtm, pct(f.dividendPerShare / f.epsTtm))
      : unavailable("Payout Ratio", "No positive trailing EPS to compute a payout ratio.");

  const profitability: RatioMetric[] = [
    available("Return on Equity", f.roe, pct(f.roe)),
    available("Return on Invested Capital", f.roic, pct(f.roic)),
    unavailable("Return on Assets", `Return on Assets ${BALANCE_SHEET_REASON}.`),
    available("Gross Margin", f.grossMargin, pct(f.grossMargin)),
    available("Operating Margin", f.operatingMargin, pct(f.operatingMargin)),
    available("Net Margin", f.netMargin, pct(f.netMargin)),
    payoutRatio,
  ];

  const liquidityAndLeverage: RatioMetric[] = [
    f.kind === "etf"
      ? unavailable("Current Ratio", "Not meaningful for a diversified fund.")
      : available("Current Ratio", f.currentRatio, f.currentRatio.toFixed(2)),
    unavailable("Quick Ratio", `Quick Ratio ${BALANCE_SHEET_REASON}.`),
    available("Debt/Equity", f.debtToEquity, f.debtToEquity.toFixed(2)),
    available(
      "Interest Coverage",
      f.interestCoverage,
      f.interestCoverage >= 100 ? "100×+" : `${f.interestCoverage.toFixed(0)}×`,
    ),
    unavailable("Asset Turnover", `Asset Turnover ${BALANCE_SHEET_REASON}.`),
  ];

  const trends: RatioTrend[] = [
    { label: "Revenue per Share", history: f.revenueHistory },
    { label: "EPS", history: f.epsHistory },
    { label: "Free Cash Flow per Share", history: f.fcfHistory },
  ];

  const all = [...valuation, ...profitability, ...liquidityAndLeverage];
  const availableCount = all.filter((m) => m.available).length;
  const unavailableCount = all.length - availableCount;
  const summary =
    unavailableCount === 0
      ? `${f.symbol}: all ${all.length} financial ratios computed.`
      : `${f.symbol}: ${availableCount} of ${all.length} financial ratios computed; ${unavailableCount} await full balance-sheet data (planned for the Financial Statement Analysis sprint).`;

  return { valuation, profitability, liquidityAndLeverage, trends, summary };
}

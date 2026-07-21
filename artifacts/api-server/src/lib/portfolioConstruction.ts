// Phase 2, Sprint 28 — Portfolio Construction Engine (approved Phase 2 plan,
// Sprint 28). Advisory/education only, same discipline as the Watchlist —
// this module never places, schedules, or submits any order, and never
// touches a real brokerage account.
//
// computePortfolioAllocation() is a pure, provider-agnostic function (never
// touches a FundamentalsProvider directly — it's handed already-resolved
// prices, mirroring earningsAnalysis.ts's analyzeEarningsIntelligence()
// pattern) that computes each holding's actual (market-value-weighted)
// allocation against its stored target weight and derives a deterministic
// rebalance signal. buildPortfolioAllocation() is the thin orchestrator that
// resolves live/simulated prices per distinct symbol (deduped) and calls it.
//
// SAFETY CONTRACT: never fabricates. A holding's currentPrice/marketValue/
// actualWeightPct/driftPct are all honestly null whenever the data needed to
// compute them isn't available (no shares entered, symbol unresolvable) —
// never approximated. Current price/value is deliberately never persisted;
// it's resolved fresh every time this is called (the same never-persist-a-
// price discipline Sprint 27's Watchlist target-checking established).

import type { FundamentalsProvider } from "./fundamentals.js";
import { resolveFundamentals } from "./fundamentals.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Approved Sprint 28 default: a holding drifting more than this many
// percentage points from its target weight is flagged for rebalancing — a
// common real-world rebalancing-band convention. Named/adjustable.
export const REBALANCE_DRIFT_THRESHOLD_PCT = 5;

// A target-weight sum outside 100% +/- this tolerance surfaces an
// informational warning — target weights are never silently normalized or
// rewritten, only reported honestly.
const TARGET_WEIGHT_SUM_TOLERANCE_PCT = 1;

export type RebalanceAction = "buy" | "sell" | "hold" | "unknown";

export interface PortfolioHoldingInput {
  id: number;
  symbol: string;
  targetWeightPct: number;
  shares: number | null;
  notes: string;
  // Phase 13 — Institutional Portfolio Manager. Optional so every
  // pre-existing 4-field call site (including this module's own Sprint 28
  // unit tests) keeps compiling and behaving identically. Read only by
  // lib/portfolioIntelligence.ts's Performance Analytics — never touched by
  // computePortfolioAllocation()/buildPortfolioAllocation() themselves.
  avgCostBasis?: number | null;
}

// Phase 2, Sprint 29 — sector/beta per symbol, sourced from the exact same
// Fundamentals resolution buildPortfolioAllocation() already performs to get
// price (zero new provider calls). Kept as a separate, optional third
// parameter to computePortfolioAllocation() rather than changing the
// existing `prices` map's shape, so every pre-existing 2-argument call site
// (including Sprint 28's own unit tests) keeps compiling and behaving
// identically — honest null for both fields when no meta is supplied.
export interface SymbolMeta {
  sector: string | null;
  beta: number | null;
  // Phase 13 — Institutional Portfolio Manager. Sourced from the exact same
  // Fundamentals resolution buildPortfolioAllocation() already performs (the
  // same reuse precedent as sector/beta itself) — zero new provider calls.
  // Optional so every pre-existing 2-field meta object literal (including
  // Sprint 29's own unit tests) keeps compiling and behaving identically.
  industry?: string | null;
  marketCap?: number | null;
}

export interface PortfolioHoldingAllocation {
  id: number;
  symbol: string;
  targetWeightPct: number;
  shares: number | null;
  avgCostBasis: number | null;
  notes: string;
  currentPrice: number | null;
  marketValue: number | null;
  actualWeightPct: number | null;
  driftPct: number | null;
  rebalanceAction: RebalanceAction;
  sector: string | null;
  beta: number | null;
  // Phase 13 — Institutional Portfolio Manager. Same honest-null-when-
  // unresolvable discipline as every other field here.
  industry: string | null;
  marketCap: number | null;
}

export interface PortfolioAllocationResult {
  holdings: PortfolioHoldingAllocation[];
  totalMarketValue: number | null;
  totalTargetWeightPct: number;
  targetWeightSumWarning: string | null;
  unresolvedSymbols: string[];
  summary: string;
}

export function computePortfolioAllocation(
  holdings: PortfolioHoldingInput[],
  prices: Map<string, number | null>,
  meta: Map<string, SymbolMeta> = new Map(),
): PortfolioAllocationResult {
  const withPrice = holdings.map((h) => {
    const currentPrice = prices.get(h.symbol) ?? null;
    const marketValue = h.shares != null && currentPrice != null ? h.shares * currentPrice : null;
    const m = meta.get(h.symbol);
    return {
      h,
      currentPrice,
      marketValue,
      sector: m?.sector ?? null,
      beta: m?.beta ?? null,
      industry: m?.industry ?? null,
      marketCap: m?.marketCap ?? null,
    };
  });

  const totalMarketValue = withPrice.some((w) => w.marketValue != null)
    ? round(withPrice.reduce((a, w) => a + (w.marketValue ?? 0), 0))
    : null;

  const resultHoldings: PortfolioHoldingAllocation[] = withPrice.map(({ h, currentPrice, marketValue, sector, beta, industry, marketCap }) => {
    const actualWeightPct =
      marketValue != null && totalMarketValue != null && totalMarketValue > 0
        ? round((marketValue / totalMarketValue) * 100)
        : null;
    const driftPct = actualWeightPct != null ? round(actualWeightPct - h.targetWeightPct) : null;

    let rebalanceAction: RebalanceAction = "unknown";
    if (driftPct != null) {
      if (driftPct > REBALANCE_DRIFT_THRESHOLD_PCT) rebalanceAction = "sell";
      else if (driftPct < -REBALANCE_DRIFT_THRESHOLD_PCT) rebalanceAction = "buy";
      else rebalanceAction = "hold";
    }

    return {
      id: h.id,
      symbol: h.symbol,
      targetWeightPct: h.targetWeightPct,
      shares: h.shares,
      avgCostBasis: h.avgCostBasis ?? null,
      notes: h.notes,
      currentPrice,
      marketValue,
      actualWeightPct,
      driftPct,
      rebalanceAction,
      sector,
      beta,
      industry,
      marketCap,
    };
  });

  const totalTargetWeightPct = round(holdings.reduce((a, h) => a + h.targetWeightPct, 0));
  const targetWeightSumWarning =
    Math.abs(totalTargetWeightPct - 100) > TARGET_WEIGHT_SUM_TOLERANCE_PCT
      ? `Target weights sum to ${totalTargetWeightPct}%, not 100% — this portfolio's targets are not fully allocated.`
      : null;

  const unresolvedSymbols = [...new Set(withPrice.filter((w) => w.currentPrice == null).map((w) => w.h.symbol))];

  const rebalanceCount = resultHoldings.filter((h) => h.rebalanceAction === "buy" || h.rebalanceAction === "sell").length;
  const summary =
    holdings.length === 0
      ? "This portfolio has no holdings yet."
      : `${holdings.length} holding${holdings.length === 1 ? "" : "s"}` +
        (totalMarketValue != null ? `, total market value ${totalMarketValue.toFixed(2)}` : ", market value unavailable (no shares entered yet)") +
        `. ${rebalanceCount} holding${rebalanceCount === 1 ? "" : "s"} drifted more than ${REBALANCE_DRIFT_THRESHOLD_PCT}pp from target.` +
        (unresolvedSymbols.length > 0 ? ` ${unresolvedSymbols.length} symbol(s) could not be priced.` : "");

  return {
    holdings: resultHoldings,
    totalMarketValue,
    totalTargetWeightPct,
    targetWeightSumWarning,
    unresolvedSymbols,
    summary,
  };
}

// Extracted (Phase 41 — Institutional Rebalancing & Allocation Planning
// Engine) from buildPortfolioAllocation()'s own inline resolution loop, so a
// caller that needs the SAME resolved prices/meta for more than one
// computePortfolioAllocation() call (e.g. a "current vs. proposed target"
// comparison) can resolve once and reuse — never a second, duplicate set of
// provider calls for the same holdings. buildPortfolioAllocation() itself is
// unchanged in behavior, confirmed by its own pre-existing tests.
export async function resolvePricesAndMeta(
  holdings: PortfolioHoldingInput[],
  provider: FundamentalsProvider,
): Promise<{ prices: Map<string, number | null>; meta: Map<string, SymbolMeta> }> {
  const prices = new Map<string, number | null>();
  const meta = new Map<string, SymbolMeta>();
  const distinctSymbols = [...new Set(holdings.map((h) => h.symbol))];
  await Promise.all(
    distinctSymbols.map(async (symbol) => {
      const f = await resolveFundamentals(provider, symbol).catch(() => null);
      prices.set(symbol, f?.price ?? null);
      meta.set(symbol, {
        sector: f?.sector ?? null,
        beta: f?.beta ?? null,
        industry: f?.industry ?? null,
        marketCap: f?.marketCap ?? null,
      });
    }),
  );
  return { prices, meta };
}

// Orchestration helper for the route: resolves a live/simulated price per
// distinct symbol (deduped — a portfolio may list the same symbol only once
// by design, but this stays defensive) and calls the pure engine above.
export async function buildPortfolioAllocation(
  holdings: PortfolioHoldingInput[],
  provider: FundamentalsProvider,
): Promise<PortfolioAllocationResult> {
  const { prices, meta } = await resolvePricesAndMeta(holdings, provider);
  return computePortfolioAllocation(holdings, prices, meta);
}

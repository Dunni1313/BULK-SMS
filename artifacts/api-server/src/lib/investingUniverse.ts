// Phase 2, Sprint 11 — the Investing Engine's own simulated-price/universe
// module (approved Phase 2 plan §2.1 "Universe decoupling").
//
// Previously, SimulatedFundamentalsProvider (fundamentals.ts) sourced SIMULATED
// price from optionsMath.ts's getSnapshot()/UNIVERSE, which hard-gated the
// Value Investing module's simulated research to exactly the 10 symbols the
// options-income scanner covers. That is an accidental cross-engine coupling
// this codebase's own architecture principle forbids ("engines never depend on
// each other's internals") — this module removes it.
//
// INVESTING_UNIVERSE below intentionally duplicates (does not import) the same
// 10 symbols and base prices optionsMath.ts's UNIVERSE used historically, so
// SIMULATED price output for those 10 symbols is byte-for-byte unchanged (see
// investingUniverse.test.ts and fundamentals.ts's regression coverage). Any
// other symbol is still fully supported via a stable, deterministic synthetic
// base price — never a real quote, always SIMULATED-labelled downstream.

import { makeRng } from "./deterministic.js";

export interface InvestingUniverseEntry {
  symbol: string;
  name: string;
  basePrice: number;
}

// Default coverage universe for the Investing Engine's scan/sidebar UI
// (GET /stock-analyst/value-universe). Base prices match optionsMath.ts's
// UNIVERSE for these 10 symbols exactly, on purpose.
export const INVESTING_UNIVERSE: InvestingUniverseEntry[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", basePrice: 540 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", basePrice: 460 },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", basePrice: 200 },
  { symbol: "NVDA", name: "NVIDIA Corporation", basePrice: 900 },
  { symbol: "META", name: "Meta Platforms Inc", basePrice: 510 },
  { symbol: "AAPL", name: "Apple Inc", basePrice: 195 },
  { symbol: "AMZN", name: "Amazon.com Inc", basePrice: 185 },
  { symbol: "MSFT", name: "Microsoft Corporation", basePrice: 420 },
  { symbol: "GOOGL", name: "Alphabet Inc", basePrice: 175 },
  { symbol: "TSLA", name: "Tesla Inc", basePrice: 175 },
];

export const INVESTING_UNIVERSE_SYMBOLS = INVESTING_UNIVERSE.map((u) => u.symbol);

// A ticker-shaped string: 1-5 letters, optionally a share-class suffix like
// BRK.B. Rejects obvious non-tickers (e.g. "NOTASYMBOL") so unsupported input
// still honestly reports "unknown symbol" rather than fabricating a report for
// arbitrary text.
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;
export function isValidTickerShape(symbol: string): boolean {
  return TICKER_RE.test(symbol.toUpperCase());
}

// Stable per-symbol synthetic base price for any symbol NOT in
// INVESTING_UNIVERSE. Deterministic (same symbol -> same base always), and
// deliberately not derived from any real-world data source.
function syntheticBasePrice(symbol: string): number {
  const rng = makeRng(`${symbol}|investing-base-price`);
  return Math.round((20 + rng() * 380) * 100) / 100; // plausible $20-$400 range
}

// Deterministic per-symbol/day SIMULATED price. For the 10 default-universe
// symbols this reproduces the exact formula (and therefore the exact output)
// optionsMath.ts's getSnapshot() used for price historically: same seed string
// format (`${symbol}|${dateStr}`), same base price, same +/-4% day-drift. For
// any other symbol, the base price comes from syntheticBasePrice() instead of
// a hand-authored value, but the drift formula is identical.
export function investingPrice(symbol: string, dateStr: string): number {
  const sym = symbol.toUpperCase();
  const entry = INVESTING_UNIVERSE.find((u) => u.symbol === sym);
  const base = entry?.basePrice ?? syntheticBasePrice(sym);
  const rng = makeRng(`${sym}|${dateStr}`);
  const drift = (rng() - 0.5) * 0.04;
  return Math.round(base * (1 + drift) * 100) / 100;
}

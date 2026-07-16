// Pure data-quality filters for option quotes. These guard the live scanner against
// stale, illiquid, or malformed contracts. Each check returns a structured result so
// the market-data health panel can attribute rejections to a specific reason.

import type { OptionQuote } from "./providers/types.js";

export const MAX_QUOTE_AGE_MS = 15 * 60 * 1000; // 15 minutes
export const MIN_OPEN_INTEREST = 100;
export const MIN_VOLUME = 10;
export const MAX_SPREAD_PCT = 0.15; // 15% of mid

export type RejectKind = "liquidity" | "freshness" | "data";

export interface FilterResult {
  ok: boolean;
  kind: RejectKind | null;
  reason: string | null;
}

const OK: FilterResult = { ok: true, kind: null, reason: null };

function reject(kind: RejectKind, reason: string): FilterResult {
  return { ok: false, kind, reason };
}

// Spread as a fraction of mid; falls back to mid of bid/ask when mid is absent.
export function spreadPct(q: Pick<OptionQuote, "bid" | "ask" | "mid">): number {
  const mid = q.mid > 0 ? q.mid : (q.bid + q.ask) / 2;
  if (mid <= 0) return Infinity;
  return (q.ask - q.bid) / mid;
}

// Greeks + IV present and bid/ask well-formed.
export function checkData(q: OptionQuote): FilterResult {
  if (q.iv === undefined || q.iv === null || !Number.isFinite(q.iv) || q.iv <= 0) {
    return reject("data", "Missing IV");
  }
  for (const [name, val] of [
    ["delta", q.delta],
    ["theta", q.theta],
    ["vega", q.vega],
    ["gamma", q.gamma],
  ] as const) {
    if (val === undefined || val === null || !Number.isFinite(val)) {
      return reject("data", `Missing ${name}`);
    }
  }
  if (!Number.isFinite(q.bid) || !Number.isFinite(q.ask) || q.ask < q.bid || q.ask <= 0) {
    return reject("data", "Invalid bid/ask");
  }
  return OK;
}

// Quote no older than the freshness window.
export function checkFreshness(
  q: OptionQuote,
  now: number = Date.now(),
  maxAgeMs: number = MAX_QUOTE_AGE_MS,
): FilterResult {
  const t = Date.parse(q.quoteTime);
  if (!Number.isFinite(t)) return reject("freshness", "Missing quote timestamp");
  const age = now - t;
  if (age > maxAgeMs) {
    return reject("freshness", `Stale quote (${Math.round(age / 60000)}m old)`);
  }
  return OK;
}

// Liquidity gate: open interest, volume, spread, and no zero-bid.
export function checkLiquidity(q: OptionQuote): FilterResult {
  if (q.bid <= 0) return reject("liquidity", "Zero-bid option");
  if (q.openInterest < MIN_OPEN_INTEREST) {
    return reject("liquidity", `Open interest ${q.openInterest} < ${MIN_OPEN_INTEREST}`);
  }
  if (q.volume < MIN_VOLUME) {
    return reject("liquidity", `Volume ${q.volume} < ${MIN_VOLUME}`);
  }
  const sp = spreadPct(q);
  if (sp > MAX_SPREAD_PCT) {
    return reject("liquidity", `Spread ${(sp * 100).toFixed(1)}% > ${MAX_SPREAD_PCT * 100}%`);
  }
  return OK;
}

// Run all gates in order: data validity, freshness, then liquidity.
export function checkContract(
  q: OptionQuote,
  now: number = Date.now(),
): FilterResult {
  const data = checkData(q);
  if (!data.ok) return data;
  const fresh = checkFreshness(q, now);
  if (!fresh.ok) return fresh;
  return checkLiquidity(q);
}

// Deterministic mock options provider. Wraps the seeded options-math engine so the
// scanner's live pipeline can be developed and tested without any external data
// feed. Quotes are stamped with the current time so they always pass freshness.

import {
  getSnapshot,
  bs,
  strikeStep,
  expirationFromDte,
  makeRng,
  todayStr,
} from "../optionsMath.js";
import type { OptionChainData, OptionQuote, OptionsProvider } from "./types.js";

const DEFAULT_DTES = [30, 45, 60];

export class MockOptionsProvider implements OptionsProvider {
  readonly name = "mock" as const;

  isAvailable(): boolean {
    return true;
  }

  async getChain(
    symbol: string,
    opts: { dteHints?: number[] } = {},
  ): Promise<OptionChainData | null> {
    const snap = getSnapshot(symbol);
    if (!snap) return null;

    const dtes = opts.dteHints && opts.dteHints.length > 0 ? opts.dteHints : DEFAULT_DTES;
    const step = strikeStep(snap.price);
    const atm = Math.round(snap.price / step) * step;
    const half = snap.spreadPct / 2;
    const now = new Date().toISOString();
    const contracts: OptionQuote[] = [];

    for (const dte of dtes) {
      const T = dte / 365;
      const expiration = expirationFromDte(dte);
      const rng = makeRng(`${snap.symbol}|chain|${dte}|${todayStr()}`);
      for (let i = -10; i <= 10; i++) {
        const strike = atm + i * step;
        if (strike <= 0) continue;
        for (const type of ["call", "put"] as const) {
          const g = bs(snap.price, strike, T, snap.iv, type);
          const mid = g.price;
          contracts.push({
            symbol: snap.symbol,
            strike,
            type,
            expiration,
            bid: Math.max(0.01, Math.round(mid * (1 - half) * 100) / 100),
            ask: Math.round(mid * (1 + half) * 100) / 100,
            mid: Math.round(mid * 100) / 100,
            delta: Math.round(g.delta * 1000) / 1000,
            theta: Math.round(g.theta * 1000) / 1000,
            vega: Math.round(g.vega * 1000) / 1000,
            gamma: Math.round(g.gamma * 10000) / 10000,
            iv: snap.iv,
            openInterest: Math.round(snap.openInterest * (0.4 + rng() * 1.2)),
            volume: Math.round(snap.openInterest * (0.05 + rng() * 0.3)),
            quoteTime: now,
          });
        }
      }
    }

    return {
      symbol: snap.symbol,
      underlyingPrice: snap.price,
      ivRank: snap.ivRank,
      iv30: snap.iv,
      earningsDate:
        snap.earningsInDays !== null ? expirationFromDte(snap.earningsInDays) : null,
      quoteTime: now,
      contracts,
    };
  }
}

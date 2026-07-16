// Options market-data provider abstraction. A provider returns option chains with
// fully-populated quotes (prices, greeks, IV, liquidity, and a quote timestamp) so
// the scanner can build and filter strategies from a single shape regardless of the
// underlying data source (Alpaca, Polygon, or the deterministic mock engine).

export type ProviderName = "alpaca" | "polygon" | "mock";

export interface OptionQuote {
  symbol: string; // underlying
  strike: number;
  type: "call" | "put";
  expiration: string; // ISO date (YYYY-MM-DD)
  bid: number;
  ask: number;
  mid: number;
  delta: number;
  theta: number; // per day, per share
  vega: number; // per 1% vol, per share
  gamma: number;
  iv: number;
  openInterest: number;
  volume: number;
  quoteTime: string; // ISO timestamp of when the quote was produced
}

export interface OptionChainData {
  symbol: string;
  underlyingPrice: number;
  ivRank: number;
  iv30: number;
  earningsDate: string | null;
  quoteTime: string; // ISO timestamp for the chain as a whole
  contracts: OptionQuote[];
}

export interface OptionsProvider {
  readonly name: ProviderName;
  // Whether this provider has the credentials/config needed to serve live data.
  isAvailable(): boolean;
  // Returns a chain (multiple expirations around `dteHints`) or null if unavailable.
  getChain(
    symbol: string,
    opts?: { dteHints?: number[] },
  ): Promise<OptionChainData | null>;
}

export interface ProviderSelection {
  provider: OptionsProvider;
  requested: ProviderName; // what settings asked for
  active: ProviderName; // what we actually use after fallback
  mode: "mock" | "live"; // scanner mode from settings
  connected: boolean; // true when a live provider is actually serving data
  reason: string; // human-readable explanation of the active selection
}

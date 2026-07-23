// Phase 24 — Institutional Trading Engine Foundation.
//
// Market Data service boundary. Every other Engine 2 module (Analysis,
// Strategies, Trade Plans) is meant to reach market data through this one
// facade, not by importing lib/tradingMarketData.ts directly — a clean
// seam that lets the underlying provider (SIMULATED today, a real live
// vendor in the future, per the still-deferred Phase 3 plan §25 Decision 7)
// evolve without every consumer changing.
//
// Zero new logic: this file re-exports lib/tradingMarketData.ts's own
// already-tested, already-shipped provider seam (Sprint 32) unmodified.

export {
  getMarketDataProvider,
  isValidTradingTickerShape,
  TRADING_MARKET_UNIVERSE,
} from "../tradingMarketData.js";

export type {
  Timeframe,
  Candle,
  MarketQuote,
  MarketDataProvider,
  TradingUniverseEntry,
} from "../tradingMarketData.js";

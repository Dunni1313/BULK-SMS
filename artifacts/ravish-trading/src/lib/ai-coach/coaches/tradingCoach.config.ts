// v1.5.0 Sprint 3 — Specialist Coach Adapters: Trading AI Coach.
//
// Domain: lib/tradingCoach.ts (Phase 3, Sprint 47/48) — Engine 2's free-form
// Q&A endpoint, POST /trading/coach/ask/stream, backed since v1.5.0 Sprint 2
// by the shared createCoachAskHandlers() factory (routes/tradingCoach.ts).
// This is TradingResearch.tsx's own embedded "AI Trade Coach" panel (the
// page's own deprecated-but-still-functional "legacy inline assistant" —
// distinct from the unified, cross-engine "AI Trading Assistant" dockable
// panel, which is TradingCoachWorkspace.tsx's own separate domain, already
// migrated in Sprint 2).
//
// Grounded in Market Structure, Multi-Timeframe, Liquidity, Regime,
// Probability, and Risk analysis for the searched symbol — never Investing
// Engine fundamentals/valuation, never Options Engine Greeks/strategy data.

import type { CoachConfig } from "../types";

export interface TradingCoachParams {
  symbol: string | null;
}

export const tradingCoachConfig: CoachConfig<TradingCoachParams> = {
  id: "trading",
  displayName: "Trading AI Coach",
  description:
    "Free-form Q&A grounded in Engine 2's Market Structure, Multi-Timeframe, Liquidity, Regime, Probability, and Risk analysis for the searched symbol.",
  capabilities: ["market-structure", "multi-timeframe", "liquidity", "regime", "probability", "trading-risk"],
  endpoint: "/trading/coach/ask/stream",
  buildRequestBody: (question, { symbol }) => ({ symbol, question }),
  isDisabled: ({ symbol }) => !symbol,
  errorMessage: "Failed to get an answer — please try again.",
  starterPrompts: ({ symbol }) =>
    symbol ? [`What does my portfolio risk look like for ${symbol}?`, `Is now a good time to look at ${symbol}?`] : [],
};

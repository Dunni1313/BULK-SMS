// Phase 29 — Institutional Trading AI Coach. Mirrors Phase 21's own
// use-coach-explanation.ts hook precedent (Engine 1), adapted for Engine 2's
// split symbol-scoped / account-scoped coach routes (see
// lib/tradingCoach.ts's own SYMBOL_SCOPED_TRADING_COACHES /
// ACCOUNT_SCOPED_TRADING_COACHES). The scenario coach is intentionally not
// wrapped here — it's a stateless POST, used directly via the generated
// useExplainTradingScenario() mutation hook, the same way
// TradePlanningStudio.tsx already calls useCompareTradingScenarios()
// directly for the identical shape of request.

import {
  useGetTradingCoachExplanation,
  useGetTradingCoachAccountExplanation,
  getGetTradingCoachExplanationQueryKey,
  getGetTradingCoachAccountExplanationQueryKey,
  type TradingCoachExplanation,
} from "@workspace/api-client-react";

export type SymbolScopedTradingCoach = "structure" | "liquidity" | "session" | "risk" | "trade-plan";
export type AccountScopedTradingCoach = "journal" | "psychology";
export type TradingCoachType = SymbolScopedTradingCoach | AccountScopedTradingCoach;

export const SYMBOL_SCOPED_TRADING_COACHES: SymbolScopedTradingCoach[] = ["structure", "liquidity", "session", "risk", "trade-plan"];
export const ACCOUNT_SCOPED_TRADING_COACHES: AccountScopedTradingCoach[] = ["journal", "psychology"];

export function isAccountScopedTradingCoach(coach: TradingCoachType): coach is AccountScopedTradingCoach {
  return (ACCOUNT_SCOPED_TRADING_COACHES as string[]).includes(coach);
}

export function useTradingCoachExplanation(coach: TradingCoachType, symbol: string) {
  const symbolCoach = coach as SymbolScopedTradingCoach;
  const accountCoach = coach as AccountScopedTradingCoach;

  const symbolScoped = useGetTradingCoachExplanation(symbolCoach, symbol, {
    query: { queryKey: getGetTradingCoachExplanationQueryKey(symbolCoach, symbol), enabled: !isAccountScopedTradingCoach(coach) && !!symbol },
  });
  const accountScoped = useGetTradingCoachAccountExplanation(accountCoach, {
    query: { queryKey: getGetTradingCoachAccountExplanationQueryKey(accountCoach), enabled: isAccountScopedTradingCoach(coach) },
  });

  return isAccountScopedTradingCoach(coach) ? accountScoped : symbolScoped;
}

export type { TradingCoachExplanation };

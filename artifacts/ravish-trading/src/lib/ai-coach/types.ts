// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework
// (Frontend). Shared types for the reusable conversation engine
// (useCoachConversation.ts) that every specialist AI Coach surface in this
// app is built on: the dockable "AI Trading Assistant" (TradingCoachWorkspace),
// the original Options Engine "AI Assistant" (Assistant.tsx), and the four
// embedded deterministic-coach panels on TradeWorkspace.tsx,
// MarketStructureWorkbench.tsx, TradePlanningStudio.tsx, and
// LiquidityWorkbench.tsx.

/** One completed question/answer exchange. */
export interface CoachTurn {
  question: string;
  answer: string;
}

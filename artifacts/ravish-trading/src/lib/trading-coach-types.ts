// v1.5.0 Sprint 1 — AI Coach Architecture Consolidation. Extracted out of
// the former components/coach/TradingCoachDrawer.tsx, whose own drawer
// component was never rendered anywhere in the app (pages/TradingAICoach.tsx
// — the "Trading AI Coach," Phase 29's deterministic per-topic explanation
// page — always used its own inline Evidence Explorer UI instead, and
// imported only these two constants). The component and its now-redundant
// dedicated test file were removed as dead code; these two constants are
// the only part of that file that was actually load-bearing, so they live
// on here, unchanged.

import type { TradingCoachType } from "@/hooks/use-trading-coach-explanation";

export const TRADING_COACH_TYPES: TradingCoachType[] = ["structure", "liquidity", "session", "risk", "trade-plan", "journal", "psychology"];

export const TRADING_COACH_TYPE_LABELS: Record<TradingCoachType, string> = {
  structure: "Structure Coach",
  liquidity: "Liquidity Coach",
  session: "Session Coach",
  risk: "Risk Coach",
  "trade-plan": "Trade Plan Coach",
  journal: "Journal Coach",
  psychology: "Psychology & Discipline Coach",
};

// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI (approved design doc:
// docs/v1.3.0-AI-Trading-Coach-Design.md, §4/§6). A single, thin React
// Context — the same shape §4 already specified ("mounted once at the
// AppLayout level... the same shape as the existing
// SidebarPreferencesProvider") — that owns exactly two things:
//
//   1. Whether the dockable panel (TradingCoachPanel) is open.
//   2. Which "focus" (symbol / scanner candidate / trading position) the
//      Coach should ground its next question in.
//
// It deliberately does NOT own conversation history or streaming state —
// that's server-persisted (GET /trading-coach/messages) and rendered
// locally by TradingCoachWorkspace itself, mirroring pages/Assistant.tsx's
// own established pattern (Sprint 59) exactly. Nor does it fetch any
// context data itself — every field on TradingCoachFocus is supplied by
// the calling page from data it already has in memory (a Scanner row, a
// Trade Execution Center candidate, a Trading Positions row), via the
// small adapter functions in lib/trading-coach-context.ts. This keeps
// page-specific shapes out of both this file and the Coach components
// themselves, per the "use shared context adapters rather than
// page-specific logic in the Coach components" instruction.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface TradingCoachFocus {
  /** A specific symbol in focus — grounds the answer in Market
   * Structure/Multi-Timeframe/Liquidity/Regime/Probability for that symbol
   * (POST /trading-coach/ask[/stream]'s own `symbol` field). */
  symbol?: string;
  /** A specific scanner_results row id owned by the calling user — the
   * Scanner / Trade Execution Center "candidate in focus"
   * (`scannerCandidateId`). */
  scannerCandidateId?: number;
  /** A short, human-readable label for the scanner candidate above (e.g.
   * "AAPL Iron Condor"), purely for the Context Panel's own chip — never
   * sent to the backend, which resolves the real candidate server-side. */
  scannerCandidateLabel?: string;
  /** A specific trading_positions row id owned by the calling user
   * (`tradingPositionId`). */
  tradingPositionId?: number;
  /** A short, human-readable label for the trading position above (e.g.
   * "AAPL long"), purely for the Context Panel's own chip. */
  tradingPositionLabel?: string;
}

export const EMPTY_TRADING_COACH_FOCUS: TradingCoachFocus = {};

interface TradingCoachContextValue {
  open: boolean;
  focus: TradingCoachFocus;
  setOpen: (open: boolean) => void;
  /** Sets the focus without necessarily opening the panel — used by a
   * page that wants to prime the Coach's context ahead of time. */
  setFocus: (focus: TradingCoachFocus) => void;
  /** Sets the focus AND opens the panel in one step — the "Ask the Coach
   * about this" call sites (Scanner rows, the Trade Execution Center's
   * current candidate, etc.) use this exclusively. */
  openWithFocus: (focus: TradingCoachFocus) => void;
  clearFocus: () => void;
  closePanel: () => void;
}

const TradingCoachContext = createContext<TradingCoachContextValue | null>(null);

export function TradingCoachProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocusState] = useState<TradingCoachFocus>(EMPTY_TRADING_COACH_FOCUS);

  const setFocus = useCallback((next: TradingCoachFocus) => setFocusState(next), []);
  const openWithFocus = useCallback((next: TradingCoachFocus) => {
    setFocusState(next);
    setOpen(true);
  }, []);
  const clearFocus = useCallback(() => setFocusState(EMPTY_TRADING_COACH_FOCUS), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const value = useMemo<TradingCoachContextValue>(
    () => ({ open, focus, setOpen, setFocus, openWithFocus, clearFocus, closePanel }),
    [open, focus, setFocus, openWithFocus, clearFocus, closePanel],
  );

  return <TradingCoachContext.Provider value={value}>{children}</TradingCoachContext.Provider>;
}

export function useTradingCoach(): TradingCoachContextValue {
  const ctx = useContext(TradingCoachContext);
  if (!ctx) {
    throw new Error("useTradingCoach() must be used within a TradingCoachProvider");
  }
  return ctx;
}

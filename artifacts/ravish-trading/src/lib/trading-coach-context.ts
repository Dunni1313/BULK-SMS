// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI. Shared context adapters and the
// static suggested-prompts/suggested-actions rule tables — kept in one
// small, page-agnostic module so no page-specific shape or navigation
// logic lives inside the Coach components themselves (TradingCoachPanel/
// Workspace/ContextPanel/SuggestedPrompts/SuggestedActions only ever
// import from here), per the explicit "use shared context adapters rather
// than placing page-specific logic directly inside the Coach components"
// instruction.
//
// Suggested actions are DELIBERATELY restrained to deep-links that work
// end-to-end today without modifying any other page's own logic — never a
// fabricated "your risk is elevated" condition, since POST
// /trading-coach/ask[/stream] only ever returns `{ answer, answerSource }`
// to the frontend (no risk figures to react to client-side). This mirrors
// the approved design doc's own §8 rule 1: every Coach action is `wouter`
// navigation only, never a mutation.

import type { TradingCoachFocus } from "@/hooks/use-trading-coach";

/** Builds a focus object for "I searched/selected this symbol" (a
 * Workbench page's own search box, a Trading Research lookup, etc.). */
export function focusFromSymbol(symbol: string): TradingCoachFocus {
  return { symbol: symbol.toUpperCase() };
}

/** Builds a focus object for a specific Scanner / Trade Execution Center
 * candidate row — the only shape this function needs from the caller's
 * own row type, so Scanner.tsx/TradeExecutionCenter.tsx never have to
 * import or duplicate a Coach-specific type. */
export function focusFromScannerCandidate(row: { id: number; symbol: string; strategy: string }): TradingCoachFocus {
  return {
    symbol: row.symbol,
    scannerCandidateId: row.id,
    scannerCandidateLabel: `${row.symbol} ${row.strategy.replace(/_/g, " ")}`,
  };
}

/** Builds a focus object for a specific Engine 2 trading_positions row
 * (e.g. TradingResearch.tsx's own Portfolio Risk position list). */
export function focusFromTradingPosition(row: { id: number; symbol: string; side?: string }): TradingCoachFocus {
  return {
    symbol: row.symbol,
    tradingPositionId: row.id,
    tradingPositionLabel: row.side ? `${row.symbol} ${row.side}` : row.symbol,
  };
}

/**
 * Context-aware quick-fill prompt suggestions. Always includes a small set
 * of general prompts; adds a few more specific ones when a scanner
 * candidate, symbol, or trading position is in focus. Deduplicated and
 * capped so the chip row never grows unbounded.
 */
export function getSuggestedPrompts(focus: TradingCoachFocus): string[] {
  const prompts: string[] = [];

  if (focus.scannerCandidateId != null) {
    prompts.push("Explain this opportunity", "What are the key risks?", "Teach me this strategy", "What would invalidate this setup?");
  } else if (focus.symbol) {
    prompts.push(`Explain ${focus.symbol}'s current market structure`, "What are the key risks?");
  }

  if (focus.tradingPositionId != null) {
    prompts.push("Review this trade setup", "Help me prepare a trade checklist");
  }

  prompts.push("Explain the Greeks", "Review my portfolio concentration", "Explain the current market structure");

  return Array.from(new Set(prompts)).slice(0, 6);
}

export interface TradingCoachSuggestedAction {
  label: string;
  href: string;
}

/**
 * Static, auditable deep-link rule table — never a second AI call, never a
 * fabricated data-driven condition. Every entry below is a real, already-
 * shipped route that resolves correctly with no query-string dependency,
 * confirmed against App.tsx's own route table before being added here.
 */
export function getSuggestedActions(focus: TradingCoachFocus): TradingCoachSuggestedAction[] {
  const actions: TradingCoachSuggestedAction[] = [];

  if (focus.scannerCandidateId != null) {
    actions.push({ label: "Open in Trade Execution Center", href: `/ticket/${focus.scannerCandidateId}` });
  }
  if (focus.tradingPositionId != null) {
    actions.push({ label: "Review in Trading Research (Portfolio Risk)", href: "/trading-research" });
  }
  actions.push({ label: "View Options Dashboard", href: "/options-dashboard" });
  actions.push({ label: "View Options Income Portfolio", href: "/portfolio-ai" });

  return actions;
}

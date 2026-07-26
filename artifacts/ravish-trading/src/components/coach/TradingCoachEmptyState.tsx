// v1.3.1 — AI Trading Coach, Frontend UI. The first-open, no-history-yet
// state (design doc §3's own wireframe). Deliberately contains no
// suggested-prompt chips of its own — TradingCoachSuggestedPrompts is a
// separate, reusable row TradingCoachWorkspace renders once, always above
// the composer, so the same chips are never duplicated between this state
// and the general "quick fill" row.

import { Bot } from "lucide-react";

export function TradingCoachEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center" data-testid="trading-coach-empty">
      <Bot className="h-10 w-10 text-indigo-400 opacity-40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground/90">Ask me about your scanner opportunities, open positions, or market structure.</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Every answer is grounded in your own already-computed data — education, not investment advice.
      </p>
    </div>
  );
}

// v1.3.1 — AI Trading Coach, Frontend UI. Renders only the context chips
// that genuinely apply — never a fabricated chip for a signal that isn't
// actually in focus, matching the design doc's own wireframe note ("only
// the ones actually resolved"). Two rows, clearly separated:
//   1. "Viewing" — the current route/page, informational only, never sent
//      to the backend (POST /trading-coach/ask[/stream] has no "page"
//      field at all).
//   2. "Shared with Coach" — every field that IS actually transmitted on
//      the next question: the optional symbol/scanner-candidate/trading-
//      position focus (when set) plus the two signals the backend ALWAYS
//      composes regardless of focus (buildUnifiedCoachContext() always
//      calls resolveTradingPositionsRisk() and assembleDailyReport()) —
//      shown as generic labels, never a specific number this component
//      doesn't actually have (the ask response carries no risk figures).

import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, LineChart, Layers, Wallet, ShieldCheck, PieChart, X } from "lucide-react";
import type { TradingCoachFocus } from "@/hooks/use-trading-coach";

// A small, readable label per known route — falls back to the raw path for
// any route not explicitly named here, so a genuinely new page never shows
// a blank "Viewing" chip.
const ROUTE_LABELS: Record<string, string> = {
  "/": "Institutional Home",
  "/scanner": "Scanner",
  "/trade-execution-center": "Trade Execution Center",
  "/trading-research": "Trading Research",
  "/options-dashboard": "Options Dashboard",
  "/portfolio": "Portfolio Greeks",
  "/portfolio-ai": "Options Income Portfolio",
  "/ai-trading-coach": "AI Trading Coach",
};

function routeLabel(path: string): string {
  return ROUTE_LABELS[path] ?? path;
}

export function TradingCoachContextPanel({
  focus,
  onClearFocus,
}: {
  focus: TradingCoachFocus;
  /** Removes the optional symbol/candidate/position focus (never the
   * always-on trading-position-risk/options-portfolio signals below, which
   * aren't optional — they're composed by the backend on every question
   * regardless of focus). Omitted entirely when there's no focus to clear. */
  onClearFocus: () => void;
}) {
  const [location] = useLocation();
  const hasFocus = Boolean(focus.symbol || focus.scannerCandidateLabel || focus.tradingPositionLabel);

  return (
    <div className="space-y-1.5" data-testid="trading-coach-context-panel">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span>
          Viewing: <span className="font-medium text-foreground/80">{routeLabel(location)}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" data-testid="trading-coach-context-chips">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Shared with Coach:</span>

        {focus.symbol && (
          <Badge variant="outline" className="gap-1 text-[10px]" data-testid="trading-coach-context-chip-symbol">
            <LineChart className="h-3 w-3" aria-hidden="true" />
            {focus.symbol}
          </Badge>
        )}

        {focus.scannerCandidateLabel && (
          <Badge variant="outline" className="gap-1 text-[10px]" data-testid="trading-coach-context-chip-candidate">
            <Layers className="h-3 w-3" aria-hidden="true" />
            {focus.scannerCandidateLabel}
          </Badge>
        )}

        {focus.tradingPositionLabel && (
          <Badge variant="outline" className="gap-1 text-[10px]" data-testid="trading-coach-context-chip-position">
            <Wallet className="h-3 w-3" aria-hidden="true" />
            {focus.tradingPositionLabel}
          </Badge>
        )}

        {/* Always shared — buildUnifiedCoachContext() unconditionally
            resolves both, regardless of any focus above. */}
        <Badge variant="outline" className="gap-1 text-[10px]" data-testid="trading-coach-context-chip-risk">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Trading position risk
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px]" data-testid="trading-coach-context-chip-portfolio">
          <PieChart className="h-3 w-3" aria-hidden="true" />
          Options portfolio
        </Badge>

        {hasFocus && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onClearFocus}
            data-testid="button-trading-coach-clear-context"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

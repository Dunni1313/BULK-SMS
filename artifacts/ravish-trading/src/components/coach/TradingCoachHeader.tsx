// v1.3.1 — AI Trading Coach, Frontend UI. Shared header used by both the
// dockable panel (TradingCoachPanel) and the full-page surface
// (pages/AITradingCoach.tsx) — a small, premium-institutional title block
// with the badges every other coach surface in this codebase already uses
// (Educational / Paper Trading), matching TradingCoachDrawer.tsx's own
// established badge-row convention.

import { Bot, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TradingCoachHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2" data-testid="trading-coach-header">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Bot className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">AI Trading Coach</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
            Paper Trading Only
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Cross-Engine Aware
          </Badge>
        </div>
      </div>
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Close AI Trading Coach"
          data-testid="button-trading-coach-close"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// v1.3.1 — AI Trading Coach, Frontend UI. An honest failure turn — mirrors
// pages/Assistant.tsx's own "erroredReply" convention exactly (Phase 4,
// Sprint 59): a genuine mid-stream server `error` SSE event, or a request
// that failed before the stream even opened, renders this instead of
// silently leaving the just-sent question stuck on screen with no reply.
// Never a fabricated answer.

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TradingCoachErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground"
      data-testid="trading-coach-error"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="flex-1 space-y-1.5">
        <p>Failed to get an answer — please try again.</p>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onRetry} data-testid="button-trading-coach-retry">
          <RotateCcw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    </div>
  );
}

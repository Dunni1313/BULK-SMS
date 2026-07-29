// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only — see
// docs/v1.5.0-Sprint-01-AI-Coach-Consolidation.md), Frontend UI. The
// persistent header launcher — mounted once in AppLayout.tsx, next to
// NotificationBell, per the approved design doc's §3 wireframe. Works
// identically regardless of sidebar expanded/collapsed state, since it
// lives in the header, not the sidebar itself.

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTradingCoach } from "@/hooks/use-trading-coach";

export function TradingCoachLauncher() {
  const { setOpen } = useTradingCoach();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-indigo-400 hover:text-indigo-300"
      aria-label="Open AI Trading Assistant"
      title="AI Trading Assistant"
      onClick={() => setOpen(true)}
      data-testid="button-trading-coach-launcher"
    >
      <Bot className="h-4 w-4" />
    </Button>
  );
}

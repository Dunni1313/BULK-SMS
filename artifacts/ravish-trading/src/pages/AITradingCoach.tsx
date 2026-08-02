// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1 — Coach Architecture Consolidation, to resolve its naming
// collision with Phase 29's separate, deterministic "Trading AI Coach";
// see docs/v1.5.0-Sprint-01-AI-Coach-Consolidation.md — no behavioral
// change, label only), Frontend UI (approved design doc:
// docs/v1.3.0-AI-Trading-Coach-Design.md). The sidebar-nav entry point —
// reuses the exact same TradingCoachWorkspace the header launcher's Sheet
// panel (TradingCoachPanel.tsx) uses, just rendered full-page instead of
// docked, so there is zero duplicated Coach logic between the two entry
// points. No `onClose` is supplied here (there's nothing to close — this
// is a real, permanent page).

import { Card, CardContent } from "@/components/ui/card";
import { TradingCoachWorkspace } from "@/components/coach/TradingCoachWorkspace";

export default function AITradingCoach() {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4" data-testid="page-ai-trading-coach">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Trading Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Persistent, cross-engine-aware coaching — grounded in your own Trading Positions risk, options-income
          Portfolio/Dashboard/Scanner data, and Trading Journal reflections. Advisory and educational only.
        </p>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card border-border">
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <TradingCoachWorkspace />
        </CardContent>
      </Card>
    </div>
  );
}

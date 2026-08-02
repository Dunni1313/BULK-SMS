// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in v1.5.0
// Sprint 1 — Coach Architecture Consolidation, to resolve its naming
// collision with Phase 29's separate, deterministic "Trading AI Coach";
// see docs/v1.5.0-Sprint-01-AI-Coach-Consolidation.md — no behavioral
// change, label only). Approved design doc's §3/§4: "a dockable panel,
// not a new page ... reachable from anywhere via a persistent launcher".

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useTradingCoach } from "@/hooks/use-trading-coach";
import { TradingCoachWorkspace } from "./TradingCoachWorkspace";

export function TradingCoachPanel() {
  const { open, setOpen, closePanel } = useTradingCoach();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden sm:max-w-lg"
        data-testid="sheet-trading-coach-panel"
      >
        {/* Visually hidden — Radix's Sheet requires an accessible title/
            description; TradingCoachHeader (rendered by Workspace below)
            is the real, visible header. */}
        <SheetTitle className="sr-only">AI Trading Assistant</SheetTitle>
        <SheetDescription className="sr-only">
          Ask the AI Trading Assistant about your scanner opportunities, open positions, or market structure.
        </SheetDescription>
        <TradingCoachWorkspace onClose={closePanel} />
      </SheetContent>
    </Sheet>
  );
}

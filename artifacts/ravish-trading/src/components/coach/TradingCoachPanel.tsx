// v1.3.1 — AI Trading Coach, Frontend UI (approved design doc's §3/§4: "a
// dockable panel, not a new page ... reachable from anywhere via a
// persistent launcher"). Sheet width/side conventions mirror
// TradingCoachDrawer.tsx's own established shape (side="right",
// sm:max-w-lg) exactly — no new visual system.

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
        <SheetTitle className="sr-only">AI Trading Coach</SheetTitle>
        <SheetDescription className="sr-only">
          Ask the AI Trading Coach about your scanner opportunities, open positions, or market structure.
        </SheetDescription>
        <TradingCoachWorkspace onClose={closePanel} />
      </SheetContent>
    </Sheet>
  );
}

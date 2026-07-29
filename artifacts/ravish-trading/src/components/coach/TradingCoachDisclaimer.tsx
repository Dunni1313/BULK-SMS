// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI. A single, concise, always-visible
// advisory line — kept deliberately short (one line, not a paragraph) so
// it never overwhelms the panel, per the explicit "concise, professional
// advisory disclaimer without overwhelming the UI" requirement. The
// server's own COACH_DISCLAIMER is already appended into every answer's
// text by lib/ai-core's applyDisclaimer() (enforced centrally, unmodified —
// see coachLLM.ts's narrateTradeFreeform/Stream), so this footer is a
// second, structural reinforcement of the same safety framing, not a
// substitute for it.

import { ShieldAlert } from "lucide-react";

export function TradingCoachDisclaimer() {
  return (
    <p
      className="flex items-start gap-1.5 border-t border-border px-1 pt-2 text-[10px] leading-relaxed text-muted-foreground/80"
      data-testid="text-trading-coach-disclaimer"
    >
      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        Advisory and educational only — not financial advice or a guarantee of any outcome. The Coach never places,
        modifies, or closes an order and cannot enable live trading; every trade remains a manual decision you
        confirm yourself.
      </span>
    </p>
  );
}

// v1.4.0, Sprint L1 — Learning Centre Foundation.
//
// The reusable "Ask AI Coach" launcher every future lesson uses. This is
// deliberately a THIN wrapper, not a new chat component: it reuses the
// existing, already-global TradingCoachProvider/TradingCoachPanel
// (mounted once in AppLayout.tsx, v1.3.1) via useTradingCoach() — the
// same generic free-form Q&A endpoint (POST /trading-coach/ask/stream,
// lib/tradingCoachUnified.ts) that already composes cross-engine context
// (Options + Trading + Journal) without requiring a specific symbol or
// position, making it the one existing coach surface genuinely suited to
// answering a platform-basics or cross-engine question. No new coach,
// no new streaming logic, no new persistence — this component owns
// nothing beyond "open the existing panel."
//
// A suggestedQuestion is shown as a hint only (never auto-submitted) —
// per this sprint's explicit "do not create dozens of prompts yet"
// scope, wiring a real prefill-and-send flow into the panel is deferred
// to a later sprint once more lessons actually need it.
//
// Opens via openWithFocus({}) — the exact call Dashboard.tsx's/
// Portfolio.tsx's own generic "Ask AI Coach" buttons already use — rather
// than a bare setOpen(true), so a stale symbol/position focus left over
// from whatever page the user was on before navigating here is cleared to
// a neutral context, appropriate for a platform-basics question.

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTradingCoach } from "@/hooks/use-trading-coach";

export function AskCoachLauncher({
  suggestedQuestion,
  label = "Ask AI Coach",
}: {
  suggestedQuestion?: string;
  label?: string;
}) {
  const { openWithFocus } = useTradingCoach();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => openWithFocus({})}
        data-testid="button-ask-coach-launcher"
      >
        <Bot className="w-3.5 h-3.5 text-indigo-400" /> {label}
      </Button>
      {suggestedQuestion && (
        <p className="text-[11px] text-muted-foreground/80" data-testid="text-ask-coach-suggested-question">
          Try asking: &ldquo;{suggestedQuestion}&rdquo;
        </p>
      )}
    </div>
  );
}

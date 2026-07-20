// Phase 30/31 — Institutional Strategy Framework / Strategy Workbench.
//
// Shared Strategy Coach panel — renders the 9th deterministic Trading
// Coach's explanation of a registered strategy's own metadata and
// checklist-completion state (GET /trading/coach/strategy/:strategyId,
// lib/tradingCoach.ts's explainStrategyCoach()). Never evaluates whether
// the strategy's own methodology is sound; the disclaimer is always
// rendered verbatim, never summarized away.
//
// Originally built inline in StrategyFramework.tsx (Phase 30); extracted
// here, unmodified in behavior, for reuse by StrategyWorkbench.tsx
// (Phase 31).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTradingCoachStrategyExplanation, getGetTradingCoachStrategyExplanationQueryKey } from "@workspace/api-client-react";
import { MessageCircle } from "lucide-react";

export function StrategyCoachExplanationPanel({ strategyId }: { strategyId: number }) {
  const { data: coach, isLoading } = useGetTradingCoachStrategyExplanation(strategyId, {
    query: { queryKey: getGetTradingCoachStrategyExplanationQueryKey(strategyId) },
  });

  return (
    <Card data-testid="panel-strategy-coach">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Strategy Coach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <Skeleton className="h-16 w-full" />}
        {coach && (
          <>
            <p data-testid="text-strategy-coach-headline">{coach.headline}</p>
            <p className="text-muted-foreground">{coach.whyThisExists}</p>
            <ul className="space-y-1">
              {coach.metricsUsed.map((m, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{m.label}:</span> {m.detail}
                </li>
              ))}
            </ul>
            {coach.risksReducingConfidence.length > 0 && (
              <ul className="list-disc list-inside text-amber-500 text-xs" data-testid="list-strategy-coach-risks">
                {coach.risksReducingConfidence.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground italic">{coach.disclaimer}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

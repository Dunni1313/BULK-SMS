// Phase 30/31 — Institutional Strategy Framework / Strategy Workbench.
//
// Shared Learning Viewer/Panel: a thin, read-only view of a strategy's own
// educationalNotes/references fields (never a separately-authored lesson),
// plus the one user-state mutation this whole framework introduces —
// recording that the strategy's own Learning content was viewed
// (itemType: "strategy", itemKey: `strategy-framework:<id>`), reused by the
// Learning Centre's own Learning Progress system unmodified.
//
// Originally built inline in StrategyFramework.tsx (Phase 30); extracted
// here, unmodified in behavior, for reuse by StrategyWorkbench.tsx
// (Phase 31).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRecordLearningItemViewed, type TradingStrategy } from "@workspace/api-client-react";
import { BookOpen } from "lucide-react";

export function StrategyLearningPanel({ strategy }: { strategy: TradingStrategy }) {
  const recordViewed = useRecordLearningItemViewed();

  return (
    <Card data-testid="panel-learning-viewer">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Learning Viewer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p data-testid="text-strategy-educational-notes">{strategy.educationalNotes || "No educational notes recorded."}</p>
        {strategy.references.length > 0 && (
          <ul className="list-disc list-inside text-muted-foreground" data-testid="list-strategy-references">
            {strategy.references.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          variant="outline"
          data-testid="button-mark-strategy-learning-viewed"
          onClick={() => recordViewed.mutate({ data: { itemType: "strategy", itemKey: `strategy-framework:${strategy.id}` } })}
        >
          Mark as viewed
        </Button>
      </CardContent>
    </Card>
  );
}

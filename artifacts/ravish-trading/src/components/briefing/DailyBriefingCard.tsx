// v1.5.0, Sprint 12 — Institutional Command Centre.
//
// The one reusable "AI Daily Briefing" component the sprint explicitly
// asks for. Extracted, not duplicated, from pages/CrossEngineDailyReport.tsx
// (Phase 5, Sprint 68) — that page's own deterministic summary + "Narrate
// My Day" button is byte-for-byte the same UI/behavior this component now
// renders, just pulled out so a second surface (the new Command Centre)
// can embed it without copy-pasting the streaming logic a second time.
//
// Reuses, unmodified:
//   - GET /cross-engine-report (useGetCrossEngineDailyReport) — Engine 1's
//     macro regime + watchlist crossings, Engine 2's trading risk, Engine
//     3's options income health, already composed server-side.
//   - POST /cross-engine-report/narrate/stream via streamCoach() — the
//     same SSE client every other coach panel in this codebase uses.
//
// Zero new calculations, zero new endpoints, zero new streaming
// infrastructure. `compact` only controls presentation (hides the date
// heading, used on the Command Centre where the page itself already has
// its own "Today" framing); the underlying data/behavior is identical.
//
// Preserves every data-testid CrossEngineDailyReport.test.tsx already
// asserts on for the summary/narrate block (card-daily-report-summary,
// daily-report-summary-text, narrate-daily-report-button,
// narrate-daily-report-error) — that test file needed zero changes after
// this extraction, confirmed by re-running it unmodified. This component's
// own self-contained loading/error states (only ever reachable when it is
// the sole consumer of the report, i.e. on the standalone Command Centre —
// on CrossEngineDailyReport.tsx itself, the page's own outer `{report &&
// (...)}` gate means this card never mounts before the same-cache-key
// query has already resolved) use their own, newly-introduced testids.

import { useState } from "react";
import { useGetCrossEngineDailyReport, getGetCrossEngineDailyReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import { streamCoach } from "@/lib/coach-stream";
import { Sparkles } from "lucide-react";

export function DailyBriefingCard({ compact = false }: { compact?: boolean }) {
  const { data: report, isLoading, isError } = useGetCrossEngineDailyReport({
    query: { queryKey: getGetCrossEngineDailyReportQueryKey() },
  });

  const [narrative, setNarrative] = useState("");
  const [narrating, setNarrating] = useState(false);
  const [narrationError, setNarrationError] = useState(false);

  const handleNarrate = () => {
    if (narrating) return;
    setNarrating(true);
    setNarrative("");
    setNarrationError(false);
    streamCoach(
      "/cross-engine-report/narrate/stream",
      {},
      {
        onDelta: (text) => setNarrative((prev) => prev + text),
        onDone: (data) => {
          const d = data as { narrative?: string };
          if (d.narrative) setNarrative(d.narrative);
          setNarrating(false);
        },
        onError: () => {
          setNarrationError(true);
          setNarrating(false);
        },
      },
    ).catch(() => {
      setNarrationError(true);
      setNarrating(false);
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="daily-briefing-card-loading">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !report) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive" data-testid="daily-briefing-card-error">
            Could not load today's briefing — please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-daily-report-summary">
      {!compact && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today — {report.date}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "pt-6 space-y-3" : "space-y-3"}>
        <p className="text-sm text-muted-foreground" data-testid="daily-report-summary-text">
          {report.summary}
        </p>
        <div className="pt-1 border-t border-border/60">
          {narrative ? (
            <div className="pt-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI-Narrated Synthesis
              </p>
              <div className="text-xs text-muted-foreground">
                <Markdown className="text-xs inline">{narrative}</Markdown>
                {narrating && <span className="inline-block w-1 h-3 ml-0.5 align-middle bg-indigo-400 animate-pulse" />}
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={narrating}
              onClick={handleNarrate}
              className="mt-2 h-7 text-[11px] border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
              data-testid="narrate-daily-report-button"
            >
              <Sparkles className="w-3 h-3 mr-1.5" />
              {narrating ? "Narrating…" : "Narrate My Day"}
            </Button>
          )}
          {narrationError && (
            <p className="text-[11px] text-destructive mt-1" data-testid="narrate-daily-report-error">
              Failed to narrate your day — please try again.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

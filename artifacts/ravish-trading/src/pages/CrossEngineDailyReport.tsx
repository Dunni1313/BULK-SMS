// Phase 5, Sprint 68 — Cross-Engine Daily Report (approved Phase 5 roadmap
// review). On-demand only: this page fetches the report when opened —
// nothing is scheduled, emailed, pushed, or run on a cron/background job.
//
// Pure COMPOSITION layer, zero new calculations of its own — every figure on
// this page comes from GET /cross-engine-report (lib/crossEngineDailyReport.ts),
// itself a thin composition over already-shipped Engine 1/2/3 outputs.
// Portfolio/user-wide, not per-symbol, so unlike TradingResearch.tsx/
// StockResearch.tsx this page needs no symbol-search box — it fetches
// immediately on mount, the same eager pattern InstitutionalDashboard.tsx's
// own always-visible Portfolio Risk/Journal/Backtest section already uses.
//
// The deterministic summary and all 3 engine sections stay visible
// unconditionally; "Narrate My Day" is a separate, explicit, on-demand
// action reusing the exact streamCoach() SSE client every other coach panel
// in this codebase already uses (mirrors StockResearch.tsx's own "Narrate
// this verdict" button, Sprint 61) — never blocking or replacing the
// deterministic data above it.
//
// v1.5.0, Sprint 12 — Institutional Command Centre. The summary+narrate
// card below was extracted, unmodified in behavior/testids, into the new
// shared components/briefing/DailyBriefingCard.tsx, so the new Command
// Centre page can embed the identical "AI Daily Briefing" experience
// without duplicating the streaming logic. This page's own loading/error
// handling and 3-engine-card grid are untouched.

import { useGetCrossEngineDailyReport, getGetCrossEngineDailyReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsd, riskGradeBadgeClass } from "@/lib/trading-format";
import { DailyBriefingCard } from "@/components/briefing/DailyBriefingCard";
import { Landmark, Scale, Briefcase, Newspaper } from "lucide-react";
import { AiTradingCoachPanel } from "@/components/coach/AiTradingCoachPanel";
import { PageShell } from "@/components/layout/PageShell";

// Engine 1's own macro/rate-regime vocabulary (rising_rates/falling_rates/
// stable_rates, lib/investingMacro.ts) — kept local rather than imported
// from trading-format.tsx, since that shared module's own header comment
// establishes it holds only Engine 2's vocabulary; this mirrors
// InstitutionalDashboard.tsx's own identically-named local helper (Sprint 55).
function macroRegimeBadgeClass(regime: string): string {
  if (regime === "rising_rates") return "border-amber-500/40 text-amber-400";
  if (regime === "falling_rates") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

export default function CrossEngineDailyReport() {
  const { data: report, isLoading, isError } = useGetCrossEngineDailyReport({
    query: { queryKey: getGetCrossEngineDailyReportQueryKey() },
  });

  return (
    <div className="space-y-6 p-6" data-testid="page-cross-engine-daily-report">
      <AiTradingCoachPanel />
      <PageShell
        icon={Newspaper}
        title="Cross-Engine Daily Report"
        journeyStage="performance"
        whyItMatters="The natural closing stop of a trading day — one place to see how all 3 engines read the same day before you log off."
        description="Your day across all 3 engines — Engine 1's macro regime and watchlist target crossings, Engine 2's trading risk, and Engine 3's options income portfolio health — in one on-demand summary. SIMULATED market data, advisory only. Generated only when you open this page; never scheduled, emailed, or pushed."
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="daily-report-loading">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive" data-testid="daily-report-error">
          Could not load today's report — please try again.
        </p>
      )}

      {report && (
        <>
          <DailyBriefingCard />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card data-testid="card-daily-report-engine1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4" />
                  Engine 1 — Investing
                </CardTitle>
                <CardDescription>Macro regime + watchlist target crossings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className={macroRegimeBadgeClass(report.engine1.macro.regime)}>
                  {report.engine1.macro.regimeLabel}
                </Badge>
                {report.engine1.watchlistCrossings.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {report.engine1.watchlistCrossings.map((c) => (
                      <li key={c.symbol} data-testid={`watchlist-crossing-${c.symbol}`}>
                        <span className="font-mono">{c.symbol}</span>
                        {c.currentPrice !== null && <span className="text-muted-foreground"> — {fmtUsd(c.currentPrice)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-daily-report-no-crossings">
                    {report.engine1.watchlistTotalItems > 0
                      ? "No watchlist symbols crossed a target today."
                      : "Watchlist is empty."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-daily-report-engine2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4" />
                  Engine 2 — Trading
                </CardTitle>
                <CardDescription>Your own open trading positions' risk status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className={riskGradeBadgeClass(report.engine2.risk.overall.label)}>
                  {report.engine2.risk.overall.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{report.engine2.risk.overall.detail}</p>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-report-engine3">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4" />
                  Engine 3 — Options Income
                </CardTitle>
                <CardDescription>Portfolio health + top scanner opportunity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    Health {report.engine3.healthScore} ({report.engine3.healthLabel})
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      report.engine3.totalUnrealizedPnl >= 0
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-rose-500/40 text-rose-400"
                    }
                  >
                    {fmtUsd(report.engine3.totalUnrealizedPnl)} P&L
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {report.engine3.openPositions} open position{report.engine3.openPositions === 1 ? "" : "s"}
                  {report.engine3.criticalCount > 0
                    ? `, ${report.engine3.criticalCount} need${report.engine3.criticalCount === 1 ? "s" : ""} attention`
                    : ""}
                  .
                </p>
                {report.engine3.topOpportunitySymbol && (
                  <div className="flex items-center gap-1 text-sm">
                    <Newspaper className="h-3 w-3 text-muted-foreground" />
                    Top opportunity: <span className="font-mono">{report.engine3.topOpportunitySymbol}</span>
                    {report.engine3.topOpportunityRavishScore !== null && (
                      <span className="text-muted-foreground"> ({report.engine3.topOpportunityRavishScore})</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">{report.disclaimer}</p>
        </>
      )}
    </div>
  );
}

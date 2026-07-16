// Trade History, Performance Analytics & Trading Journal sprint. Dashboard
// cards over lib/tradeAnalytics.ts's own pure, already-tested
// computePerformanceAnalytics()/computeReconciliationSuccess() — this page
// adds zero calculation logic of its own. Named "Trade Performance"
// (distinct from the existing, unrelated options-side "Performance" page
// at /performance) to avoid colliding with it — this page is entirely
// about LOCAL trade-history analytics, not Engine 3's options-income
// performance metrics.
//
// Every figure is explicitly local-data-only: this platform has no
// broker-side realized P&L source (see
// docs/Alpaca-Paper-Trading-Architecture.md §4.6), so every calculation
// here is derived from the local `trades` table, never invented or
// approximated from broker data. Reconciliation success percentage is the
// one figure that does touch the broker layer, via the existing, unmodified
// GET /broker/reconciliation — fetched only on an explicit "Check
// Reconciliation" click, never automatically.

import { useMemo } from "react";
import { useListTrades, useGetBrokerReconciliation, getGetBrokerReconciliationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw } from "lucide-react";
import { computePerformanceAnalytics, computeReconciliationSuccess } from "@/lib/tradeAnalytics";

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function fmtDays(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}d`;
}

interface CardSpec {
  label: string;
  value: string;
  testId: string;
}

export default function TradePerformance() {
  const { data: trades, isLoading: tradesLoading, isError: tradesError } = useListTrades({ limit: 500 });
  const {
    data: reconciliation,
    isFetching: reconciliationFetching,
    refetch: refetchReconciliation,
  } = useGetBrokerReconciliation({ query: { queryKey: getGetBrokerReconciliationQueryKey(), enabled: false } });

  const analytics = useMemo(() => computePerformanceAnalytics(trades ?? []), [trades]);
  const reconciliationSuccess = useMemo(
    () => computeReconciliationSuccess(reconciliation?.available ? reconciliation.orders : undefined),
    [reconciliation],
  );

  const cards: CardSpec[] = [
    { label: "Total Trades", value: String(analytics.totalTrades), testId: "card-total-trades" },
    { label: "Winning Trades", value: String(analytics.winningTrades), testId: "card-winning-trades" },
    { label: "Losing Trades", value: String(analytics.losingTrades), testId: "card-losing-trades" },
    { label: "Win Rate", value: fmtPercent(analytics.winRate), testId: "card-win-rate" },
    { label: "Average Win", value: fmtCurrency(analytics.averageWin), testId: "card-average-win" },
    { label: "Average Loss", value: fmtCurrency(analytics.averageLoss), testId: "card-average-loss" },
    { label: "Average Holding Time", value: fmtDays(analytics.averageHoldingDays), testId: "card-average-holding-time" },
    { label: "Largest Winner", value: fmtCurrency(analytics.largestWinner), testId: "card-largest-winner" },
    { label: "Largest Loser", value: fmtCurrency(analytics.largestLoser), testId: "card-largest-loser" },
    { label: "Current Open Trades", value: String(analytics.openTrades), testId: "card-open-trades" },
    { label: "Closed Trades", value: String(analytics.closedTrades), testId: "card-closed-trades" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Trade Performance</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-local-data-disclosure">
          All figures below are calculated from local trade history only — this platform has no broker-side
          realized profit/loss source, so nothing here is invented or approximated from Alpaca data.
        </p>
      </div>

      {tradesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="performance-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : tradesError ? (
        <p className="text-sm text-destructive" data-testid="text-performance-error">
          Could not load trade history for analytics. Try again in a moment.
        </p>
      ) : analytics.totalTrades === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-trades-for-analytics">
          No trades yet — analytics will appear once trades exist.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Card key={c.testId} className="bg-card border-border" data-testid={c.testId}>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-xl font-bold font-mono mt-1">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Reconciliation Success</CardTitle>
            <CardDescription>
              Percentage of local trades' orders reconciled cleanly against Alpaca, from GET /broker/reconciliation.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchReconciliation()}
            disabled={reconciliationFetching}
            data-testid="button-check-reconciliation"
          >
            {reconciliationFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Check Reconciliation
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {reconciliation && !reconciliation.available ? (
            <p className="text-sm text-destructive" data-testid="text-reconciliation-unavailable">
              {reconciliation.unavailableReason}
            </p>
          ) : (
            <div className="text-2xl font-bold font-mono" data-testid="text-reconciliation-success-percentage">
              {reconciliationSuccess.successPercentage === null ? "Not yet checked" : fmtPercent(reconciliationSuccess.successPercentage)}
            </div>
          )}
          {reconciliationSuccess.successPercentage !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              {reconciliationSuccess.matchedCount} of {reconciliationSuccess.consideredCount} order comparisons clean.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

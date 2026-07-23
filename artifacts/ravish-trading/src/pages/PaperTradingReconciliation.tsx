// Alpaca Paper Order Lifecycle & Reconciliation Foundation sprint. A
// read-only panel over GET /api/broker/reconciliation — compares this
// platform's own local trade records against Alpaca's real Paper Trading
// orders and positions. Entirely manual: fetched on page load and via an
// explicit Refresh button only, never on a timer or schedule, and never
// corrects, cancels, or closes anything — see
// docs/Alpaca-Paper-Trading-Architecture.md for the full read-only
// contract this page's own backend enforces.
//
// No distinct "admin" role exists anywhere in this platform (confirmed,
// see docs/Operations-Handbook.md §6.5) — this page is reachable by any
// signed-in user viewing their own account's reconciliation, the same
// per-user model every other page in this app already follows, not a
// system-wide admin panel.

import { useGetBrokerReconciliation, getGetBrokerReconciliationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

// Relative-time label, mirroring Settings.tsx's own fmtFetchedAt helper.
function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(t).toLocaleString();
}

function fmtQty(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return String(n);
}

function fmtPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(2)}`;
}

const ISSUE_LABELS: Record<string, string> = {
  missing_at_broker: "Missing at broker",
  missing_locally: "Missing locally",
  status_mismatch: "Status mismatch",
  quantity_mismatch: "Quantity mismatch",
  symbol_mismatch: "Symbol mismatch",
};

export default function PaperTradingReconciliation() {
  const { data, isLoading, isFetching, isError, refetch } = useGetBrokerReconciliation({
    query: { queryKey: getGetBrokerReconciliationQueryKey() },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paper Trading Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compares local trade records against Alpaca's real Paper Trading orders and positions.
            Read-only — nothing is ever corrected, cancelled, or closed automatically. Manual only:
            checked on page load and when you click Refresh, never on a schedule.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-reconciliation"
        >
          {isFetching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-reconciliation-request-error">
              Could not reach the reconciliation endpoint. Try Refresh again in a moment.
            </p>
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Summary
                {data.available ? (
                  data.fullyReconciled ? (
                    <Badge
                      className="bg-success/15 text-success border-success/30"
                      data-testid="badge-reconciliation-status"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Fully Reconciled
                    </Badge>
                  ) : (
                    <Badge
                      className="bg-amber-500/15 text-amber-400 border-amber-500/30"
                      data-testid="badge-reconciliation-status"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" /> {data.issueCount} Issue{data.issueCount === 1 ? "" : "s"}
                    </Badge>
                  )
                ) : (
                  <Badge
                    className="bg-muted text-muted-foreground border-border"
                    data-testid="badge-reconciliation-status"
                  >
                    Unavailable
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!data.available && (
                <p className="text-sm text-destructive" data-testid="text-reconciliation-unavailable-reason">
                  {data.unavailableReason}
                </p>
              )}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Local Orders Considered</div>
                  <div className="font-mono" data-testid="text-local-orders-considered">
                    {data.localOrdersConsidered}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Broker Orders Considered</div>
                  <div className="font-mono" data-testid="text-broker-orders-considered">
                    {data.brokerOrdersConsidered}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Checked</div>
                  <div className="font-mono" data-testid="text-last-checked">
                    {fmtRelative(data.generatedAt)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Order Reconciliation</CardTitle>
              <CardDescription>Broker order status alongside local order status, fill status, and any mismatches.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-order-entries">
                  {data.available ? "No local or broker orders to reconcile." : "No data — reconciliation unavailable."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Local Status</TableHead>
                      <TableHead>Broker Status</TableHead>
                      <TableHead>Local Qty</TableHead>
                      <TableHead>Broker Qty</TableHead>
                      <TableHead>Filled Qty</TableHead>
                      <TableHead>Avg Fill Price</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((o, i) => (
                      <TableRow key={o.alpacaOrderId ?? `local-${o.tradeId}-${i}`} data-testid={`row-order-${i}`}>
                        <TableCell className="font-mono">{o.localSymbol ?? o.brokerSymbol ?? "—"}</TableCell>
                        <TableCell data-testid={`text-local-status-${i}`}>{o.localStatus ?? "—"}</TableCell>
                        <TableCell data-testid={`text-broker-status-${i}`}>{o.brokerStatus ?? "—"}</TableCell>
                        <TableCell className="font-mono">{fmtQty(o.localQuantity)}</TableCell>
                        <TableCell className="font-mono">{fmtQty(o.brokerQuantity)}</TableCell>
                        <TableCell className="font-mono">{fmtQty(o.filledQuantity)}</TableCell>
                        <TableCell className="font-mono">{fmtPrice(o.averageFillPrice)}</TableCell>
                        <TableCell>
                          {o.issues.length === 0 ? (
                            <span className="text-xs text-success" data-testid={`text-issues-${i}`}>
                              OK
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1" data-testid={`text-issues-${i}`}>
                              {o.issues.map((issue) => (
                                <Badge
                                  key={issue}
                                  className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]"
                                >
                                  {ISSUE_LABELS[issue] ?? issue}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Position Comparison</CardTitle>
              <CardDescription>Local open-position quantities compared against Alpaca's real Paper Trading positions.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.positions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-position-entries">
                  {data.available ? "No open positions to compare." : "No data — reconciliation unavailable."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Local Qty</TableHead>
                      <TableHead>Broker Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.positions.map((p, i) => (
                      <TableRow key={p.occSymbol} data-testid={`row-position-${i}`}>
                        <TableCell className="font-mono">{p.occSymbol}</TableCell>
                        <TableCell className="font-mono">{fmtQty(p.localQuantity)}</TableCell>
                        <TableCell className="font-mono">{fmtQty(p.brokerQuantity)}</TableCell>
                        <TableCell>
                          {p.mismatch ? (
                            <Badge
                              className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]"
                              data-testid={`badge-position-mismatch-${i}`}
                            >
                              Mismatch
                            </Badge>
                          ) : (
                            <Badge
                              className="bg-success/15 text-success border-success/30 text-[10px]"
                              data-testid={`badge-position-mismatch-${i}`}
                            >
                              Matched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

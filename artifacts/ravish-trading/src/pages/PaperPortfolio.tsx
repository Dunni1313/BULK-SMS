// Paper Portfolio Dashboard & Position Monitoring sprint. Composes three
// already-existing, independent read-only endpoints — GET /api/broker/health,
// GET /api/broker/positions, and GET /api/broker/reconciliation — into one
// dashboard. Zero new business logic on the backend beyond the one thin
// GET /api/broker/positions pass-through route this sprint added (a direct
// sibling of the pre-existing GET /api/broker/orders); every number shown
// here is either an unmodified pass-through of Alpaca's own real response
// or an honest "not available"/"not yet checked" placeholder — never a
// simulated or fabricated figure.
//
// "Keep all refreshes user-initiated only" (this sprint's own explicit
// scope constraint) is taken literally: none of the three hooks below fetch
// automatically on mount (all start `enabled: false`) — every section,
// including its very first load, only ever populates in response to its
// own Refresh button being clicked. There is no polling, timer, or
// scheduled job anywhere on this page.

import { useGetBrokerHealth, getGetBrokerHealthQueryKey, useGetBrokerPositions, getGetBrokerPositionsQueryKey, useGetBrokerReconciliation, getGetBrokerReconciliationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
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

export default function PaperPortfolio() {
  const {
    data: health,
    isFetching: healthFetching,
    refetch: refetchHealth,
  } = useGetBrokerHealth({ query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false } });

  const {
    data: portfolio,
    isFetching: portfolioFetching,
    refetch: refetchPortfolio,
  } = useGetBrokerPositions({ query: { queryKey: getGetBrokerPositionsQueryKey(), enabled: false } });

  const {
    data: reconciliation,
    isFetching: reconciliationFetching,
    refetch: refetchReconciliation,
  } = useGetBrokerReconciliation({ query: { queryKey: getGetBrokerReconciliationQueryKey(), enabled: false } });

  // Unrealized P/L is only ever a real number once Portfolio has been
  // successfully checked this session — never fabricated as $0 beforehand.
  const unrealizedPl =
    portfolio?.available && portfolio.positions.length > 0
      ? portfolio.positions.reduce((sum, p) => sum + p.unrealizedPl, 0)
      : null;

  function reconciliationStatusFor(symbol: string): { label: string; mismatch: boolean | null; detail: string | null } {
    if (!reconciliation || !reconciliation.available) return { label: "Not yet checked", mismatch: null, detail: null };
    const entry = reconciliation.positions.find((p) => p.occSymbol === symbol);
    if (!entry) return { label: "Not compared", mismatch: null, detail: null };
    return { label: entry.mismatch ? "Mismatch" : "Matched", mismatch: entry.mismatch, detail: entry.detail };
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Paper Portfolio</h1>
          <Badge
            className="bg-amber-500/15 text-amber-400 border-amber-500/30"
            data-testid="badge-paper-trading-mode"
          >
            Paper Trading Mode
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Account status, positions, and orders from your Alpaca Paper Trading account. Read-only —
          nothing here places, modifies, or cancels an order, or corrects any local record. Every
          section is refreshed only when you click its own Refresh button; nothing polls
          automatically.
        </p>
      </div>

      {/* ─── Broker Health ─────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>From GET /api/broker/health.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
            disabled={healthFetching}
            data-testid="button-refresh-broker-health"
          >
            {healthFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Broker Health
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!health ? (
            <p className="text-sm text-muted-foreground" data-testid="text-health-not-checked">
              Not yet checked — click Refresh Broker Health to load.
            </p>
          ) : (
            <div className="space-y-3">
              {!health.connected && (
                <p className="text-sm text-destructive" data-testid="text-health-unavailable-reason">
                  {health.reason}
                </p>
              )}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Account Status</div>
                  <div className="font-mono" data-testid="text-account-status">
                    {health.accountStatus ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Buying Power</div>
                  <div className="font-mono" data-testid="text-buying-power">
                    {fmtCurrency(health.buyingPower)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cash Balance</div>
                  <div className="font-mono" data-testid="text-cash-balance">
                    {fmtCurrency(health.cashBalance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="font-mono" data-testid="text-portfolio-value">
                    {fmtCurrency(health.portfolioValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Open Positions</div>
                  <div className="font-mono" data-testid="text-open-positions-count">
                    {health.openPositionsCount ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Open Orders</div>
                  <div className="font-mono" data-testid="text-open-orders-count">
                    {health.openOrdersCount ?? "—"}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-last-health-check">
                Last Broker Health check: {fmtRelative(health.lastSuccessfulCheckAt)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── P/L summary ────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Profit &amp; Loss</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Unrealized P/L</div>
            <div className="font-mono" data-testid="text-unrealized-pl">
              {unrealizedPl === null ? "Not available" : fmtCurrency(unrealizedPl)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Realized P/L</div>
            <div className="font-mono text-muted-foreground" data-testid="text-realized-pl">
              Not available
            </div>
            <div className="text-[11px] text-muted-foreground/80 mt-0.5" data-testid="text-realized-pl-reason">
              Alpaca's realized P&amp;L requires the portfolio history/activities endpoints, which this
              platform does not fetch.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Portfolio (positions) ──────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>Open positions from GET /api/broker/positions.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchPortfolio()}
            disabled={portfolioFetching}
            data-testid="button-refresh-portfolio"
          >
            {portfolioFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Portfolio
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!portfolio ? (
            <p className="text-sm text-muted-foreground" data-testid="text-portfolio-not-checked">
              Not yet checked — click Refresh Portfolio to load.
            </p>
          ) : !portfolio.available ? (
            <p className="text-sm text-destructive" data-testid="text-portfolio-unavailable-reason">
              {portfolio.unavailableReason}
            </p>
          ) : portfolio.positions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-positions">
              No open positions.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {portfolio.positions.map((p, i) => {
                const recon = reconciliationStatusFor(p.symbol);
                return (
                  <div
                    key={p.symbol}
                    className="p-4 border border-border rounded-lg bg-background space-y-2"
                    data-testid={`card-position-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{p.symbol}</span>
                      <Badge
                        className={
                          p.side === "long"
                            ? "bg-success/15 text-success border-success/30 text-[10px]"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"
                        }
                        data-testid={`badge-position-status-${i}`}
                      >
                        {p.side === "long" ? "Long" : "Short"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Quantity: </span>
                        <span className="font-mono">{p.qty}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Cost: </span>
                        <span className="font-mono">{fmtCurrency(p.avgEntryPrice)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Market Value: </span>
                        <span className="font-mono">{fmtCurrency(p.marketValue)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Unrealized P/L: </span>
                        <span className="font-mono">{fmtCurrency(p.unrealizedPl)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-1 border-t border-border">
                      <span className="text-[11px] text-muted-foreground">Reconciliation:</span>
                      <Badge
                        className={
                          recon.mismatch === true
                            ? "bg-destructive/15 text-destructive border-destructive/30 text-[10px]"
                            : recon.mismatch === false
                              ? "bg-success/15 text-success border-success/30 text-[10px]"
                              : "bg-muted text-muted-foreground border-border text-[10px]"
                        }
                        data-testid={`badge-position-reconciliation-${i}`}
                      >
                        {recon.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Reconciliation ─────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Reconciliation</CardTitle>
            <CardDescription>From GET /api/broker/reconciliation. Full detail: Broker Reconciliation page.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchReconciliation()}
            disabled={reconciliationFetching}
            data-testid="button-refresh-reconciliation"
          >
            {reconciliationFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Reconciliation
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!reconciliation ? (
            <p className="text-sm text-muted-foreground" data-testid="text-reconciliation-not-checked">
              Not yet checked — click Refresh Reconciliation to load.
            </p>
          ) : !reconciliation.available ? (
            <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-reconciliation-unavailable-reason">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {reconciliation.unavailableReason}
            </p>
          ) : (
            <div className="text-sm" data-testid="text-reconciliation-summary">
              {reconciliation.fullyReconciled ? (
                <span className="text-success">Fully reconciled.</span>
              ) : (
                <span className="text-amber-400">
                  {reconciliation.issueCount} issue{reconciliation.issueCount === 1 ? "" : "s"} found.
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground" data-testid="text-last-reconciliation-run">
            Last Reconciliation run: {fmtRelative(reconciliation?.generatedAt)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

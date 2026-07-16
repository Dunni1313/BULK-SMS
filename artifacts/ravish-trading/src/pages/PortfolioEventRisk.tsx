// Earnings & Event Risk Portfolio Overlay sprint.
//
// A dedicated, read-only overlay: shows every current open position
// together with its own upcoming earnings/dividend/macro event risk,
// reusing eventRisk.ts's existing, unmodified getEventRiskForSymbol()
// via GET /portfolio/event-risk (lib/portfolioEventRisk.ts, backend).
// This page never submits, closes, or modifies anything — it is a pure
// read-only analysis surface.
//
// Scope note, honestly disclosed rather than silently narrowed: "FDA
// decisions" and "product launches" have no data source anywhere in
// this codebase — the backend's own unsupportedEventCategories field is
// rendered directly below, never silently hidden. Every one of the 7
// real event categories this platform's event-risk engine actually
// supports (earnings, dividend, FOMC, CPI, jobs, economic, news) is
// shown.

import { useMemo, useState } from "react";
import {
  useGetPortfolioEventRisk,
  useGetBrokerHealth,
  getGetBrokerHealthQueryKey,
  type PositionEventRisk,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventRiskBadge } from "@/components/ui/event-risk-badge";
import { Loader2, RefreshCw } from "lucide-react";

type StatusFilter = "all" | "has_events" | "no_events";
type RiskFilter = "all" | "none" | "low" | "medium" | "high";
type SortKey = "symbol" | "risk_level" | "days_remaining" | "portfolio_weight";

const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function confidenceLabel(c: string | null): string {
  if (c === "scheduled") return "Scheduled";
  if (c === "simulated_estimate") return "Simulated Estimate";
  return "—";
}

function guidanceBadgeClass(code: string): string {
  if (code === "consider_adjustment") return "bg-destructive/15 text-destructive border-destructive/30";
  if (code === "consider_review") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (code === "monitor") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function PortfolioEventRisk() {
  const { data: result, isLoading, isError } = useGetPortfolioEventRisk();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk_level");

  const {
    data: brokerHealth,
    isFetching: brokerHealthFetching,
    refetch: refetchBrokerHealth,
  } = useGetBrokerHealth({ query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false } });

  const filteredSorted: PositionEventRisk[] = useMemo(() => {
    if (!result) return [];
    let rows = result.positions;
    if (statusFilter !== "all") rows = rows.filter((p) => p.eventStatus === statusFilter);
    if (riskFilter !== "all") rows = rows.filter((p) => p.riskLevel === riskFilter);
    const sorted = [...rows];
    if (sortKey === "symbol") {
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortKey === "risk_level") {
      sorted.sort((a, b) => RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel]);
    } else if (sortKey === "days_remaining") {
      sorted.sort((a, b) => {
        const ad = a.primaryEvent?.daysAway ?? Number.MAX_SAFE_INTEGER;
        const bd = b.primaryEvent?.daysAway ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    } else if (sortKey === "portfolio_weight") {
      sorted.sort((a, b) => b.portfolioWeightPct - a.portfolioWeightPct);
    }
    return sorted;
  }, [result, statusFilter, riskFilter, sortKey]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Portfolio Event Risk</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-read-only-event-risk">
            Read-Only Event Risk Analysis
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Every current open position together with its own upcoming earnings, dividend, and macro
          event risk before expiration. Informational only — nothing here places, closes, or modifies
          a real order, and no execution recommendation is ever generated.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="event-risk-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-event-risk-error">
              Failed to load portfolio event risk. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Portfolio Summary ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-event-risk-summary">
            <CardHeader>
              <CardTitle>Portfolio Summary</CardTitle>
              <CardDescription>Current portfolio data — not event metadata.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">With Upcoming Events</div>
                <div className="font-mono text-lg" data-testid="text-summary-with-events">{result.summary.positionsWithEvents}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Without Events</div>
                <div className="font-mono text-lg" data-testid="text-summary-without-events">{result.summary.positionsWithoutEvents}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">High-Risk Events</div>
                <div className="font-mono text-lg text-destructive" data-testid="text-summary-high-risk">{result.summary.highRiskCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Aggregate Event Exposure</div>
                <div className="font-mono text-lg" data-testid="text-summary-aggregate-exposure">{fmtPct(result.summary.aggregateExposurePct)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 1 Day</div>
                <div className="font-mono" data-testid="text-summary-within-1">{result.summary.within1Day}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 3 Days</div>
                <div className="font-mono" data-testid="text-summary-within-3">{result.summary.within3Days}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 7 Days</div>
                <div className="font-mono" data-testid="text-summary-within-7">{result.summary.within7Days}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 14 Days</div>
                <div className="font-mono" data-testid="text-summary-within-14">{result.summary.within14Days}</div>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <div className="text-xs text-muted-foreground">Highest-Risk Position</div>
                {result.summary.highestRiskPosition ? (
                  <div data-testid="text-summary-highest-risk">
                    {result.summary.highestRiskPosition.symbol} —{" "}
                    <span className="uppercase">{result.summary.highestRiskPosition.riskLevel}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-summary-no-highest-risk">
                    No positions currently carry event risk.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Unsupported categories disclosure ─────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Event Categories</CardTitle>
              <CardDescription>
                Supported: Earnings, Dividends, FOMC, CPI, Jobs, Economic Releases, Company/News
                Events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1" data-testid="list-unsupported-categories">
                {result.unsupportedEventCategories.map((c) => (
                  <li key={c.category} className="text-sm text-muted-foreground" data-testid={`text-unsupported-${c.category}`}>
                    <span className="font-medium text-foreground">{c.label}</span> — not supported: {c.reason}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ─── Broker status context ─────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Broker Connection Status</CardTitle>
                <CardDescription>From GET /api/broker/health — checked only when you click Refresh.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchBrokerHealth()}
                disabled={brokerHealthFetching}
                data-testid="button-refresh-broker-health"
              >
                {brokerHealthFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh Broker Health
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {!brokerHealth ? (
                <p className="text-sm text-muted-foreground" data-testid="text-broker-health-not-checked">
                  Not yet checked this session.
                </p>
              ) : (
                <Badge
                  className={
                    brokerHealth.connected
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }
                  data-testid="badge-broker-connection-status"
                >
                  {brokerHealth.connected ? "Connected" : "Disconnected"}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* ─── Positions overlay ──────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Positions &amp; Event Risk</CardTitle>
              <CardDescription>Current portfolio positions — event data is Simulated, computed fresh on every load.</CardDescription>
              <div className="flex flex-wrap gap-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Event Status</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="bg-background w-44" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      <SelectItem value="has_events">Has Upcoming Events</SelectItem>
                      <SelectItem value="no_events">No Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Risk Level</label>
                  <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
                    <SelectTrigger className="bg-background w-40" data-testid="select-risk-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger className="bg-background w-48" data-testid="select-sort-key">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="risk_level">Risk Level</SelectItem>
                      <SelectItem value="days_remaining">Days Remaining</SelectItem>
                      <SelectItem value="symbol">Symbol</SelectItem>
                      <SelectItem value="portfolio_weight">Portfolio Weight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {result.positions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-open-positions">
                  No open positions.
                </p>
              ) : filteredSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-filtered-positions">
                  No positions match the current filters.
                </p>
              ) : (
                <ul className="space-y-3" data-testid="list-event-risk-positions">
                  {filteredSorted.map((p) => (
                    <li
                      key={p.tradeId}
                      className="rounded-md border border-border p-3 space-y-2"
                      data-testid={`row-position-${p.tradeId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium" data-testid={`text-position-header-${p.tradeId}`}>
                          {p.symbol} · {p.strategy.replace(/_/g, " ")} · Qty {p.quantity}
                        </div>
                        <div className="flex items-center gap-2">
                          <EventRiskBadge level={p.riskLevel} events={p.events} />
                          <Badge className={guidanceBadgeClass(p.riskGuidance)} data-testid={`badge-guidance-${p.tradeId}`}>
                            {p.riskGuidanceLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div data-testid={`text-position-weight-${p.tradeId}`}>Weight: {fmtPct(p.portfolioWeightPct)}</div>
                        <div data-testid={`text-position-status-${p.tradeId}`}>
                          Status: {p.eventStatus === "has_events" ? "Has Events" : p.eventStatus === "no_events" ? "No Events" : "Expiration Unknown"}
                        </div>
                        <div data-testid={`text-position-source-${p.tradeId}`}>Source: {p.eventSource}</div>
                        <div data-testid={`text-position-updated-${p.tradeId}`}>Updated: {new Date(p.lastUpdated).toLocaleString()}</div>
                      </div>
                      {p.primaryEvent ? (
                        <div className="text-xs" data-testid={`text-primary-event-${p.tradeId}`}>
                          Next: <span className="font-medium">{p.primaryEvent.label}</span> ({p.primaryEvent.type}) on{" "}
                          {p.primaryEvent.date} — {p.primaryEvent.daysAway}d away · Confidence: {confidenceLabel(p.confidence)}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground" data-testid={`text-no-primary-event-${p.tradeId}`}>
                          No upcoming event before this position's expiration.
                        </div>
                      )}
                      {p.events.length > 1 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5" data-testid={`list-position-events-${p.tradeId}`}>
                          {p.events.map((e, i) => (
                            <li key={i}>
                              {e.date} · {e.label} ({e.type}, {e.daysAway}d away)
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

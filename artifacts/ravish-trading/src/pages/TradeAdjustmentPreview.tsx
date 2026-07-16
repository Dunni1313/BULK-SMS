// Trade Adjustment & Roll/Convert Preview Simulator sprint.
//
// A dedicated dry-run page: pick an existing open position and an
// adjustment intent, and see a full before/after comparison — WITHOUT
// ever submitting the adjustment. Calls POST
// /execution/adjustment/preview-simulator (lib/tradeAdjustmentPreview.ts,
// backend), which itself only ever reads local data and reuses
// execution.ts's own existing, unmodified buildAdjustmentTicket()/
// previewAdjustmentOrder()/previewOptionOrder(). This page never calls a
// submit endpoint and has no submit button at all.
//
// 3 of the 8 requested adjustment intents (Roll Forward, Convert
// Position, Close & Replace) are genuinely computable by the reused
// engine; the other 5 (Roll Out, Roll Up, Roll Down, Roll Out & Up, Roll
// Out & Down) are still shown as selectable options — never hidden — but
// always honestly report unavailable with a disclosed reason, since the
// reused engine has no strike-shift parameter independent of a full
// re-center. See docs/Trade-Adjustment.md for the full disclosure.

import { useState } from "react";
import {
  usePreviewTradeAdjustment,
  useListTrades,
  useGetBrokerHealth,
  getGetBrokerHealthQueryKey,
  type AdjustmentIntent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Loader2, Minus, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

const INTENTS: { value: AdjustmentIntent; label: string }[] = [
  { value: "roll_forward", label: "Roll Forward" },
  { value: "roll_out", label: "Roll Out" },
  { value: "roll_up", label: "Roll Up" },
  { value: "roll_down", label: "Roll Down" },
  { value: "roll_out_up", label: "Roll Out & Up" },
  { value: "roll_out_down", label: "Roll Out & Down" },
  { value: "convert", label: "Convert Position" },
  { value: "close_replace", label: "Close & Replace" },
];

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function warningBadgeClass(status: "ok" | "warning" | "blocked"): string {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "warning") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function warningIcon(status: "ok" | "warning" | "blocked") {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />;
}

function directionBadgeClass(direction: "improved" | "worse" | "neutral" | "unknown"): string {
  if (direction === "improved") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (direction === "worse") return "bg-destructive/15 text-destructive border-destructive/30";
  if (direction === "neutral") return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

function DirectionIcon({ direction }: { direction: "improved" | "worse" | "neutral" | "unknown" }) {
  if (direction === "improved") return <TrendingUp className="w-3.5 h-3.5" />;
  if (direction === "worse") return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

export default function TradeAdjustmentPreview() {
  const [tradeId, setTradeId] = useState<string>("");
  const [intent, setIntent] = useState<AdjustmentIntent>("roll_forward");
  const [quantity, setQuantity] = useState("");

  const { data: trades, isLoading: tradesLoading } = useListTrades({ limit: 500 });
  const openTrades = (trades ?? []).filter((t) => t.status === "open");

  const preview = usePreviewTradeAdjustment();
  const result = preview.data;

  const {
    data: brokerHealth,
    isFetching: brokerHealthFetching,
    refetch: refetchBrokerHealth,
  } = useGetBrokerHealth({ query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false } });

  function runPreview() {
    const parsedQuantity = quantity.trim() === "" ? null : Number(quantity);
    preview.mutate({
      data: {
        tradeId: tradeId === "" ? null : Number(tradeId),
        intent,
        quantity: parsedQuantity === null || Number.isNaN(parsedQuantity) ? null : parsedQuantity,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Trade Adjustment &amp; Roll/Convert Preview</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-preview-only">
            Preview Only — No adjustment will be submitted
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Simulate a roll, convert, or close &amp; replace on an existing open position before deciding.
          This page has no submit action — nothing here places, closes, or modifies a real order.
        </p>
      </div>

      {/* ─── Input form ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Select a Position &amp; Adjustment</CardTitle>
          <CardDescription>Choose an open position and an adjustment intent, then Preview Only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Position</label>
              {tradesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={tradeId} onValueChange={setTradeId}>
                  <SelectTrigger className="bg-background" data-testid="select-adjustment-position">
                    <SelectValue placeholder="Select an open position" />
                  </SelectTrigger>
                  <SelectContent>
                    {openTrades.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground" data-testid="text-no-open-positions">
                        No open positions
                      </div>
                    ) : (
                      openTrades.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          #{t.id} · {t.symbol} · {t.strategy.replace(/_/g, " ")}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Adjustment</label>
              <Select value={intent} onValueChange={(v) => setIntent(v as AdjustmentIntent)}>
                <SelectTrigger className="bg-background" data-testid="select-adjustment-intent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENTS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity (optional — defaults to current lots)</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                data-testid="input-adjustment-quantity"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={runPreview}
            disabled={preview.isPending || tradeId === ""}
            data-testid="button-preview-adjustment"
          >
            {preview.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Simulating...
              </>
            ) : (
              "Preview Only"
            )}
          </Button>
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
              className={brokerHealth.connected ? warningBadgeClass("ok") : warningBadgeClass("warning")}
              data-testid="badge-broker-connection-status"
            >
              {brokerHealth.connected ? "Connected" : "Disconnected"}
            </Badge>
          )}
        </CardContent>
      </Card>

      {preview.isPending && (
        <Card className="bg-card border-border" data-testid="adjustment-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {preview.isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-adjustment-error">
              Failed to generate an adjustment preview. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && !result.available && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preview Not Available</CardTitle>
            <CardDescription>No adjustment was submitted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.inputIssues.length > 0 && (
              <ul className="space-y-1" data-testid="list-adjustment-input-issues">
                {result.inputIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-destructive flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span data-testid={`text-adjustment-input-issue-${issue.field}`}>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.intentUnavailableReason && (
              <p className="text-sm text-destructive" data-testid="text-intent-unavailable-reason">
                {result.intentUnavailableReason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {result && result.available && result.existingPosition && result.proposedPosition && (
        <Card className="bg-card border-border" data-testid="card-adjustment-comparison">
          <CardHeader>
            <CardTitle>Before / After Comparison</CardTitle>
            <CardDescription>
              Existing position (currently open) vs. proposed position (a simulation — never submitted).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div data-testid="section-existing-position">
                <h3 className="text-sm font-semibold mb-2">Existing Position</h3>
                <div className="text-sm space-y-1">
                  <div data-testid="text-existing-symbol-strategy">
                    {result.existingPosition.symbol} — {result.existingPosition.strategyLabel}
                  </div>
                  <div data-testid="text-existing-max-risk">Max risk: {fmtCurrency(result.existingPosition.maxLoss)}</div>
                  <div data-testid="text-existing-max-reward">Max reward: {fmtCurrency(result.existingPosition.maxProfit)}</div>
                  {result.greeksBefore && (
                    <div data-testid="text-greeks-before">
                      Δ {result.greeksBefore.delta} / Γ {result.greeksBefore.gamma} / Θ {result.greeksBefore.theta} / V {result.greeksBefore.vega}
                    </div>
                  )}
                  {result.breakEvenBefore.length > 0 ? (
                    <div data-testid="text-break-even-before">
                      Break-even: {result.breakEvenBefore.map((be) => `${be.label} ${fmtCurrency(be.price)}`).join(" / ")}
                    </div>
                  ) : (
                    <div className="text-muted-foreground" data-testid="text-break-even-before-unavailable">
                      {result.breakEvenBeforeUnavailableReason}
                    </div>
                  )}
                </div>
              </div>
              <div data-testid="section-proposed-position">
                <h3 className="text-sm font-semibold mb-2">Proposed Position</h3>
                <div className="text-sm space-y-1">
                  <div data-testid="text-proposed-symbol-strategy">
                    {result.proposedPosition.symbol} — {result.proposedPosition.strategy.replace(/_/g, " ")}
                  </div>
                  <div data-testid="text-proposed-max-risk">Max risk: {fmtCurrency(result.proposedPosition.maxLoss)}</div>
                  <div data-testid="text-proposed-max-reward">Max reward: {fmtCurrency(result.proposedPosition.maxProfit)}</div>
                  {result.greeksAfter && (
                    <div data-testid="text-greeks-after">
                      Δ {result.greeksAfter.delta} / Γ {result.greeksAfter.gamma} / Θ {result.greeksAfter.theta} / V {result.greeksAfter.vega}
                    </div>
                  )}
                  {result.breakEvenAfter.length > 0 ? (
                    <div data-testid="text-break-even-after">
                      Break-even: {result.breakEvenAfter.map((be) => `${be.label} ${fmtCurrency(be.price)}`).join(" / ")}
                    </div>
                  ) : (
                    <div className="text-muted-foreground" data-testid="text-break-even-after-unavailable">
                      {result.breakEvenAfterUnavailableReason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Debit / Credit for this adjustment</div>
              <div className={`font-mono text-sm ${result.netCashflow !== null && result.netCashflow < 0 ? "text-destructive" : "text-emerald-400"}`} data-testid="text-net-cashflow">
                {result.netCashflow === null ? "—" : `${result.netCashflow >= 0 ? "Credit" : "Debit"} ${fmtCurrency(Math.abs(result.netCashflow))}`}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Metric Comparison</h3>
              <ul className="space-y-2" data-testid="list-comparisons">
                {result.comparisons.map((c) => (
                  <li key={c.code} className="flex items-center justify-between text-sm" data-testid={`comparison-item-${c.code}`}>
                    <span>{c.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground" data-testid={`text-comparison-before-${c.code}`}>
                        {typeof c.before === "number" ? c.before.toFixed(2) : "—"}
                      </span>
                      <span>→</span>
                      <span className="font-mono" data-testid={`text-comparison-after-${c.code}`}>
                        {typeof c.after === "number" ? c.after.toFixed(2) : "—"}
                      </span>
                      <Badge className={`${directionBadgeClass(c.direction)} flex items-center gap-1`} data-testid={`badge-comparison-direction-${c.code}`}>
                        <DirectionIcon direction={c.direction} />
                        {c.direction}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {result.portfolioExposureAfter && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Portfolio Exposure</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div data-testid="text-portfolio-before">
                    Before: {fmtCurrency(result.portfolioExposureBefore.totalRiskDollars)} ({fmtPct(result.portfolioExposureBefore.totalRiskPct)})
                  </div>
                  <div data-testid="text-portfolio-after">
                    After: {fmtCurrency(result.portfolioExposureAfter.totalRiskDollars)} ({fmtPct(result.portfolioExposureAfter.totalRiskPct)})
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Risk Warnings</CardTitle>
            <CardDescription>
              Informational only — this is a dry-run preview, so nothing here ever blocks a real
              submission because no submission is ever made.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" data-testid="list-adjustment-risk-warnings">
              {result.riskWarnings.map((w) => (
                <li key={w.code} className="flex items-start gap-2 text-sm" data-testid={`adjustment-warning-item-${w.code}`}>
                  {warningIcon(w.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{w.label}</span>
                      <Badge className={warningBadgeClass(w.status)} data-testid={`badge-adjustment-warning-${w.code}`}>
                        {w.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{w.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

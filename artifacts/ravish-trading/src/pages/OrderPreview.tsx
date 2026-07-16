// Paper Trading Order Preview & Risk Simulator sprint.
//
// A dedicated dry-run page: type in a symbol/strategy/quantity and see the
// full estimated economics of the order plus an 8-item pre-trade checklist
// — WITHOUT ever placing an order. The "Preview Only" action calls the new
// POST /execution/order-preview endpoint (lib/orderPreview.ts, backend),
// which itself only ever reads local data and reuses execution.ts's own
// existing, unmodified previewOptionOrder()/canonicalQuote() functions —
// the exact same numbers a real ticket build would compute. This page
// never calls a submit endpoint and has no submit button at all.
//
// Broker connection status/last check are read from the already-existing,
// manual-only GET /api/broker/health endpoint (same enabled:false +
// explicit-refresh convention established on Settings.tsx/PaperPortfolio.tsx)
// — this page never auto-triggers a live broker call on mount.

import { useState } from "react";
import {
  usePreviewOrder,
  useGetBrokerHealth,
  getGetBrokerHealthQueryKey,
  type OrderPreviewInputStrategy,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

const STRATEGIES = [
  { value: "iron_condor", label: "Iron Condor" },
  { value: "iron_fly", label: "Iron Fly" },
  { value: "calendar_spread", label: "Calendar Spread" },
  { value: "earnings", label: "Earnings Play" },
] as const;

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

function checklistBadgeClass(status: "ok" | "warning" | "blocked"): string {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "warning") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function checklistIcon(status: "ok" | "warning" | "blocked") {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />;
}

export default function OrderPreview() {
  const [symbol, setSymbol] = useState("");
  const [strategy, setStrategy] = useState<string>("iron_condor");
  const [quantity, setQuantity] = useState("1");

  const preview = usePreviewOrder();

  const {
    data: brokerHealth,
    isFetching: brokerHealthFetching,
    refetch: refetchBrokerHealth,
  } = useGetBrokerHealth({ query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false } });

  const result = preview.data;

  function runPreview() {
    const parsedQuantity = quantity.trim() === "" ? null : Number(quantity);
    preview.mutate({
      data: {
        symbol: symbol.trim() === "" ? null : symbol.trim(),
        strategy: (strategy || null) as OrderPreviewInputStrategy,
        quantity: parsedQuantity === null || Number.isNaN(parsedQuantity) ? null : parsedQuantity,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Order Preview &amp; Risk Simulator</h1>
          <Badge
            className="bg-amber-500/15 text-amber-400 border-amber-500/30"
            data-testid="badge-paper-trading-mode"
          >
            Paper Trading Mode
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-no-order-submitted-notice">
          Simulate and inspect an order before it is ever submitted. This page never contacts a
          broker execution endpoint and has no way to place an order — <strong>no order will be
          submitted during preview.</strong>
        </p>
      </div>

      {/* ─── Input form ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Enter a symbol, strategy, and quantity, then Preview Only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                data-testid="input-preview-symbol"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Strategy</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="bg-background" data-testid="select-preview-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-preview-quantity"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={runPreview}
            disabled={preview.isPending}
            data-testid="button-preview-only"
          >
            {preview.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Previewing...
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
              Not yet checked this session. The preview below still works fully without a broker
              check — it uses your local Paper Trading account value as an estimate.
            </p>
          ) : (
            <div className="text-sm space-y-1">
              <div>
                Status:{" "}
                <Badge
                  className={brokerHealth.connected ? checklistBadgeClass("ok") : checklistBadgeClass("warning")}
                  data-testid="badge-broker-connection-status"
                >
                  {brokerHealth.connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              {!brokerHealth.connected && (
                <div className="text-muted-foreground" data-testid="text-broker-health-reason">
                  {brokerHealth.reason}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Preview result ─────────────────────────────────────────── */}
      {preview.isPending && (
        <Card className="bg-card border-border" data-testid="preview-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {preview.isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-preview-error">
              Failed to generate a preview. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && !result.available && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preview Not Available</CardTitle>
            <CardDescription>Fix the issues below and try again — no order was submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1" data-testid="list-input-issues">
              {result.inputIssues.map((issue, i) => (
                <li key={i} className="text-sm text-destructive flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span data-testid={`text-input-issue-${issue.field}`}>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && result.available && result.ticket && (
        <Card className="bg-card border-border" data-testid="card-preview-result">
          <CardHeader>
            <CardTitle>
              {result.ticket.symbol} — {STRATEGIES.find((s) => s.value === result.ticket!.strategy)?.label ?? result.ticket.strategy}
            </CardTitle>
            <CardDescription>
              Order type: multi-leg limit &middot; Side: {result.ticket.isCredit ? "Sell to Open (Credit)" : "Buy to Open (Debit)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Quantity</div>
                <div className="font-mono" data-testid="text-preview-quantity">
                  {result.ticket.quantity}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Entry Price</div>
                <div className="font-mono" data-testid="text-preview-entry-price">
                  {fmtCurrency(result.ticket.entryPricePerSpread)} / spread
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Notional Value</div>
                <div className="font-mono" data-testid="text-preview-notional-value">
                  {fmtCurrency(result.ticket.notionalValue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Buying Power Impact</div>
                <div className="font-mono" data-testid="text-preview-buying-power-impact">
                  -{fmtCurrency(result.ticket.buyingPowerRequired)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Margin Impact</div>
                <div className="font-mono" data-testid="text-preview-margin-impact">
                  {fmtCurrency(result.ticket.marginImpact)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Maximum Risk</div>
                <div className="font-mono text-destructive" data-testid="text-preview-max-risk">
                  {fmtCurrency(result.ticket.maxLoss)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Reward</div>
                <div className="font-mono text-emerald-400" data-testid="text-preview-max-reward">
                  {fmtCurrency(result.ticket.maxProfit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk/Reward Ratio</div>
                <div className="font-mono" data-testid="text-preview-risk-reward-ratio">
                  {result.ticket.riskRewardRatio === null ? "N/A" : `1 : ${result.ticket.riskRewardRatio.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Local Account Value</div>
                <div className="font-mono" data-testid="text-preview-account-value">
                  {fmtCurrency(result.accountValue)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-local-data-disclosure">
              Buying power and account value are based on this platform&apos;s local Paper Trading
              account computation, not a live Alpaca figure, unless the Broker Connection Status
              above shows a successful check. Last Broker Health check:{" "}
              {fmtRelative(result.lastBrokerCheckAt)}.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Pre-Trade Checklist</CardTitle>
            <CardDescription>
              Informational only — this is a dry-run preview, so nothing here ever blocks a real
              submission because no submission is ever made.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" data-testid="list-pretrade-checklist">
              {result.preTradeChecklist.map((item) => (
                <li key={item.code} className="flex items-start gap-2 text-sm" data-testid={`checklist-item-${item.code}`}>
                  {checklistIcon(item.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.label}</span>
                      <Badge className={checklistBadgeClass(item.status)} data-testid={`badge-checklist-${item.code}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{item.detail}</div>
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

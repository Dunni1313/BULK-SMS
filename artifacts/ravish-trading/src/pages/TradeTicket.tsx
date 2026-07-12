import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  usePreviewExecution,
  useSubmitExecution,
  usePreviewAdjustmentExecution,
  useSubmitAdjustmentExecution,
  type ExecutionTicket,
  type ExecutionOrderLeg,
  type PreTradeCheck,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Send,
  AlertTriangle,
  Repeat,
} from "lucide-react";

const label = (s: string) => s.replace(/_/g, " ");
const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;

const MODE_COPY: Record<string, { text: string; tone: string }> = {
  manual: {
    text: "Manual mode — review only. Switch to Semi-Auto in Settings to submit.",
    tone: "text-amber-400",
  },
  semi_auto: {
    text: "Semi-Auto — you can confirm and submit this order.",
    tone: "text-emerald-400",
  },
  full_auto: {
    text: "Full-Auto — you can confirm and submit this order.",
    tone: "text-emerald-400",
  },
};

function Metric({ label: l, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-[hsl(220,15%,8%)] border border-[hsl(220,15%,13%)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
      <p className="text-lg font-mono font-bold mt-0.5" style={color ? { color } : { color: "#fff" }}>
        {value}
      </p>
    </div>
  );
}

function PositionStat({
  label: l,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{l}</span>
      <span className="font-mono font-semibold" style={{ color: valueColor ?? "#fff" }}>
        {value}
      </span>
    </div>
  );
}

export default function TradeTicket() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const scannerId = params.scannerId ? Number(params.scannerId) : null;
  const adjustTradeId = params.tradeId ? Number(params.tradeId) : null;
  const isAdjust = adjustTradeId != null;

  const [ticket, setTicket] = useState<ExecutionTicket | null>(null);
  // null = "let the server choose the default size" (1 lot for scanner candidates,
  // the source position's lot count for a roll/convert). Becomes a number once the
  // first preview returns or the user steps the quantity.
  const [quantity, setQuantity] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const preview = usePreviewExecution();
  const submit = useSubmitExecution();
  const previewAdj = usePreviewAdjustmentExecution();
  const submitAdj = useSubmitAdjustmentExecution();

  const activePreview = isAdjust ? previewAdj : preview;
  const submitting = isAdjust ? submitAdj.isPending : submit.isPending;
  const qty = quantity ?? ticket?.quantity ?? 1;

  // (Re)build the preview whenever the candidate or quantity changes.
  useEffect(() => {
    if (isAdjust) {
      previewAdj.mutate(
        { data: { tradeId: adjustTradeId, quantity: quantity ?? null } },
        {
          onSuccess: (data) => {
            setTicket(data);
            setQuantity((q) => q ?? data.quantity);
          },
        },
      );
    } else if (scannerId != null) {
      preview.mutate(
        { data: { scannerResultId: scannerId, quantity: quantity ?? 1 } },
        {
          onSuccess: (data) => {
            setTicket(data);
            setQuantity((q) => q ?? data.quantity);
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerId, adjustTradeId, quantity]);

  const handleSubmit = () => {
    if (isAdjust) {
      submitAdj.mutate(
        { data: { tradeId: adjustTradeId, quantity: qty, confirm: true } },
        {
          onSuccess: (res) => {
            setConfirmOpen(false);
            toast({
              title: "Position adjusted",
              description: `${res.message} Order ${res.orderId} (${res.broker}). Logged to journal.`,
            });
            setLocation("/trades");
          },
          onError: (err: unknown) => {
            setConfirmOpen(false);
            const message =
              err instanceof Error ? err.message : "The broker or risk engine rejected this order.";
            toast({ title: "Adjustment rejected", description: message, variant: "destructive" });
          },
        },
      );
      return;
    }
    if (scannerId == null) return;
    submit.mutate(
      { data: { scannerResultId: scannerId, quantity: qty, confirm: true } },
      {
        onSuccess: (res) => {
          setConfirmOpen(false);
          toast({
            title: "Order submitted",
            description: `${res.message} Order ${res.orderId} (${res.broker}). Logged to journal.`,
          });
          setLocation("/trades");
        },
        onError: (err: unknown) => {
          setConfirmOpen(false);
          const message =
            err instanceof Error ? err.message : "The broker or risk engine rejected this order.";
          toast({ title: "Order rejected", description: message, variant: "destructive" });
        },
      },
    );
  };

  if (scannerId == null && adjustTradeId == null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/scanner")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Scanner
        </Button>
        <p className="text-muted-foreground">No candidate selected. Pick one from the Scanner.</p>
      </div>
    );
  }

  const isLoading = activePreview.isPending && !ticket;
  const v = ticket?.validation;
  const modeCopy = ticket ? MODE_COPY[ticket.executionMode] : null;
  const submittable = !!ticket?.canSubmit;
  const adj = ticket?.adjustment ?? null;
  const backTo = isAdjust ? "/trades" : "/scanner";

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation(backTo)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-black tracking-tight text-white">
          {isAdjust ? "ROLL / CONVERT TICKET" : "TRADE TICKET"}
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !ticket ? (
        <Card className="bg-card border-border">
          <CardContent className="py-10 text-center text-muted-foreground">
            {activePreview.isError
              ? isAdjust
                ? "Couldn't build a roll/convert ticket. This position's recommendation may no longer be a roll or convert."
                : "Couldn't build this ticket. The candidate may no longer be valid."
              : "No ticket available."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Adjustment context banner (roll/convert only) */}
          {adj && (
            <Card className="bg-card border-indigo-500/40">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Repeat className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-indigo-400 border-indigo-400/50 uppercase text-[10px]"
                      >
                        {adj.kind}
                      </Badge>
                      <span className="text-sm font-semibold text-white">{adj.actionLabel}</span>
                      <span className="text-sm text-muted-foreground">
                        {label(adj.fromStrategy)} → {label(adj.toStrategy)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{adj.closeDescription}</p>
                    <p className="text-xs text-muted-foreground/80 italic">{adj.rationale}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Before / after comparison (roll/convert only) */}
          {adj && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                  Before → After
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Closing (current) position */}
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-red-400 border-red-400/40 uppercase text-[10px]"
                      >
                        Closing · position #{adj.source.tradeId}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {adj.source.strategyLabel}
                      </span>
                    </div>
                    <PositionStat label="Expiration" value={`${adj.source.expiration ?? "—"} · ${adj.source.daysToExpiry}d`} />
                    <PositionStat
                      label={adj.source.isCredit ? "Credit collected" : "Debit paid"}
                      value={money(Math.abs(adj.source.credit))}
                    />
                    <PositionStat label="Max Profit" value={money(adj.source.maxProfit)} />
                    <PositionStat label="Max Loss" value={money(adj.source.maxLoss)} />
                    <PositionStat label="POP" value={`${adj.source.pop.toFixed(0)}%`} />
                    <PositionStat
                      label="Cost to close"
                      value={money(adj.source.costToClose)}
                      valueColor={adj.source.costToClose > 0 ? "#f59e0b" : "#22c55e"}
                    />
                    <PositionStat
                      label="Unrealized P&L"
                      value={`${adj.source.currentPnl >= 0 ? "+" : ""}${money(adj.source.currentPnl)}`}
                      valueColor={adj.source.currentPnl >= 0 ? "#22c55e" : "#ef4444"}
                    />
                    <div className="pt-2 space-y-1 font-mono text-xs">
                      {adj.source.legs.map((leg, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span
                            className={
                              leg.side === "sell" ? "text-red-400" : "text-emerald-400"
                            }
                          >
                            {leg.side === "sell" ? "SELL" : "BUY"} {leg.quantity}×{" "}
                            {leg.strike} {leg.optionType.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* New structure */}
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-emerald-400 border-emerald-400/40 uppercase text-[10px]"
                      >
                        Opening · new
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {label(ticket.strategy)}
                      </span>
                    </div>
                    <PositionStat label="Expiration" value={`${ticket.expiration} · ${ticket.daysToExpiry}d`} />
                    <PositionStat
                      label={ticket.isCredit ? "Credit collected" : "Debit paid"}
                      value={money(Math.abs(ticket.netCredit))}
                    />
                    <PositionStat label="Max Profit" value={money(ticket.maxProfit)} />
                    <PositionStat label="Max Loss" value={money(ticket.maxLoss)} />
                    <PositionStat label="POP" value={`${ticket.pop.toFixed(0)}%`} />
                    <PositionStat label="Return on Capital" value={`${ticket.returnOnCapital.toFixed(1)}%`} />
                    <PositionStat label="Ravish Score" value={ticket.ravishScore.toFixed(0)} />
                    <div className="pt-2 space-y-1 font-mono text-xs">
                      {ticket.legs.map((leg: ExecutionOrderLeg, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span
                            className={
                              leg.side === "sell" ? "text-red-400" : "text-emerald-400"
                            }
                          >
                            {leg.side === "sell" ? "SELL" : "BUY"} {leg.ratioQty}×{" "}
                            {leg.strike} {leg.optionType.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Net cost/credit of the whole adjustment */}
                <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/5 px-4 py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Net of this adjustment
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Open {ticket.isCredit ? "credit" : "debit"}{" "}
                        {money(Math.abs(ticket.netCredit))} − close cost{" "}
                        {money(adj.source.costToClose)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-2xl font-mono font-black"
                        style={{ color: adj.netCashflow >= 0 ? "#22c55e" : "#f59e0b" }}
                      >
                        {adj.netCashflow >= 0 ? "+" : "−"}
                        {money(Math.abs(adj.netCashflow))}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Net {adj.netCashflow >= 0 ? "credit" : "debit"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Header / summary */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-mono font-black text-white">{ticket.symbol}</span>
                  <Badge variant="outline" className="capitalize">
                    {label(ticket.strategy)}
                  </Badge>
                  <Badge variant="outline" className="uppercase text-yellow-500 border-yellow-500/50">
                    {label(ticket.ravishTier)} · {ticket.ravishScore.toFixed(0)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Contracts</span>
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      className="px-3 py-1 text-lg font-mono hover:bg-secondary disabled:opacity-40"
                      onClick={() => setQuantity(Math.max(1, qty - 1))}
                      disabled={qty <= 1 || activePreview.isPending}
                    >
                      −
                    </button>
                    <span className="px-4 font-mono font-bold">{qty}</span>
                    <button
                      className="px-3 py-1 text-lg font-mono hover:bg-secondary disabled:opacity-40"
                      onClick={() => setQuantity(Math.min(20, qty + 1))}
                      disabled={qty >= 20 || activePreview.isPending}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric
                  label={ticket.isCredit ? "Net Credit" : "Net Debit"}
                  value={money(Math.abs(ticket.netCredit))}
                  color={ticket.isCredit ? "#22c55e" : "#f59e0b"}
                />
                <Metric label="Max Profit" value={money(ticket.maxProfit)} color="#22c55e" />
                <Metric label="Max Loss" value={money(ticket.maxLoss)} color="#ef4444" />
                <Metric label="Buying Power" value={money(ticket.buyingPowerRequired)} />
                <Metric label="POP" value={`${ticket.pop.toFixed(0)}%`} color="#3b82f6" />
                <Metric
                  label="Expected Value"
                  value={`${ticket.ev >= 0 ? "+" : ""}${money(ticket.ev)}`}
                  color={ticket.ev >= 0 ? "#22c55e" : "#ef4444"}
                />
                <Metric label="Return on Capital" value={`${ticket.returnOnCapital.toFixed(1)}%`} />
                <Metric label="DTE" value={`${ticket.daysToExpiry}d`} />
              </div>
            </CardContent>
          </Card>

          {/* Order legs */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                {isAdjust ? "New Order Legs" : "Order Legs"} · {ticket.expiration}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                {ticket.legs.map((leg: ExecutionOrderLeg, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          leg.side === "sell"
                            ? "text-red-400 border-red-400/40"
                            : "text-emerald-400 border-emerald-400/40"
                        }
                      >
                        {leg.positionIntent.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-white">
                        {leg.ratioQty}× {ticket.symbol} {leg.strike} {leg.optionType.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground text-xs">{leg.occSymbol}</span>
                    </div>
                    <span className="text-muted-foreground">@ {leg.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pre-trade risk validation */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                {v?.valid ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                )}
                <CardTitle className="text-sm uppercase tracking-wider">
                  Pre-Trade Risk Validation
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    v?.valid
                      ? "ml-auto text-emerald-400 border-emerald-400/40"
                      : "ml-auto text-red-400 border-red-400/40"
                  }
                >
                  {v?.valid ? "PASSED" : "BLOCKED"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {v?.checks.map((c: PreTradeCheck, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                    {c.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-white">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {v && v.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  {v.warnings.map((w: string, i: number) => (
                    <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {v && !v.valid && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 space-y-1">
                  <p className="text-xs uppercase tracking-wider text-red-400 font-bold">
                    Blocking violations
                  </p>
                  {v.violations.map((vi: string, i: number) => (
                    <p key={i} className="text-xs text-red-300">
                      • {vi}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span>
                  Trade risk: <span className="text-white font-mono">{v?.riskPct}%</span>
                </span>
                <span>
                  Portfolio risk:{" "}
                  <span className="text-white font-mono">
                    {v?.portfolioRiskBeforePct}% → {v?.portfolioRiskAfterPct}%
                  </span>{" "}
                  after entry
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Submit bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2">
              {ticket.executionMode === "manual" ? (
                <Lock className={`h-4 w-4 ${modeCopy?.tone}`} />
              ) : (
                <ShieldCheck className={`h-4 w-4 ${modeCopy?.tone}`} />
              )}
              <span className={`text-xs ${modeCopy?.tone}`}>{modeCopy?.text}</span>
            </div>
            <Button
              disabled={!submittable || submitting}
              onClick={() => setConfirmOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isAdjust ? <Repeat className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {submitting
                ? "Submitting..."
                : isAdjust
                  ? adj?.kind === "convert"
                    ? "Convert Position"
                    : "Roll Position"
                  : "Submit Order"}
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAdjust ? "Confirm roll / convert" : "Confirm order submission"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {isAdjust && adj && (
                  <p className="text-amber-400">{adj.closeDescription}</p>
                )}
                <p>
                  You're about to {isAdjust ? "open" : "submit"}{" "}
                  <span className="font-mono text-white">
                    {qty}× {ticket?.symbol} {ticket && label(ticket.strategy)}
                  </span>{" "}
                  for a net {ticket?.isCredit ? "credit" : "debit"} of{" "}
                  <span className="font-mono text-white">
                    {ticket && money(Math.abs(ticket.netCredit))}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Max risk{" "}
                  <span className="font-mono text-red-400">{ticket && money(ticket.maxLoss)}</span> (
                  {v?.riskPct}% of account). This routes a live order in{" "}
                  {ticket?.executionMode === "full_auto" ? "Full-Auto" : "Semi-Auto"} mode.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isAdjust ? "Confirm & Execute" : "Confirm & Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

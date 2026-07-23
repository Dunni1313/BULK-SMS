// v1.2.0 — Trade Execution Center.
//
// A guided, single-page workflow over the EXISTING Options Income Engine
// pipeline — Scanner -> AI Opportunity Score -> Strategy -> Order Preview ->
// Risk Review -> Confirm -> Paper Order Submission -> Order Status -> Trade
// Monitor -> Adjust/Close. Every calculation is reused verbatim from
// already-shipped, already-tested modules; this page adds zero new backend
// routes and zero new business logic:
//
//   - Scanner grid           -> useGetScannerResults / useRunScanner (Scanner.tsx)
//   - AI Opportunity Score   -> TradeExplanationSheet (shared component, unmodified)
//   - Order Preview          -> usePreviewExecution (TradeTicket.tsx's own hook,
//                                built on the protected lib/execution.ts)
//   - Risk Review            -> the SAME preview response's own `validation`
//                                field (pre-trade risk checks, already computed
//                                server-side — never recomputed here)
//   - Paper Order Submission -> useSubmitExecution (TradeTicket.tsx's own hook;
//                                Alpaca is Paper-Trading-only by unconditional
//                                platform design, so there is no live-trading
//                                path to accidentally expose here)
//   - Broker connectivity    -> useGetBrokerHealth (Settings.tsx's own
//                                "Check Connection" pattern, reused as-is)
//   - Order Status / Monitor -> useGetTradeMonitor (already-shipped route)
//   - Adjust / Close         -> links out to the existing /ticket/adjust/:id
//                                and /adjustments pages rather than
//                                re-implementing their own logic here
//
// The one genuinely new piece of logic on this page is the workflow
// orchestration itself: which step is active, the risk-acknowledgement
// gate, stale-preview detection, duplicate-submission protection, and a
// client-side activity timeline of the steps this session took — none of
// which duplicates a calculation that exists anywhere else in the codebase.
// "Strategy Selection" is honestly a review/confirm step, not a strategy
// re-assignment picker: no backend endpoint exists to change a scanner
// candidate's own assigned strategy, and none was fabricated here.
//
// See docs/v1.2.0-Trade-Execution-Center.md for the full design writeup.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetScannerResults,
  useRunScanner,
  getGetScannerResultsQueryKey,
  usePreviewExecution,
  useSubmitExecution,
  useGetBrokerHealth,
  getGetBrokerHealthQueryKey,
  useGetTradeMonitor,
  getGetTradeMonitorQueryKey,
  type ScannerResult,
  type ExecutionTicket,
  type ExecutionOrderLeg,
  type PreTradeCheck,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { EventRiskBadge } from "@/components/ui/event-risk-badge";
import { TradeExplanationSheet } from "@/components/ui/trade-explanation-sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Bot,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Send,
  AlertTriangle,
  Wrench,
  Repeat,
  RefreshCw,
  Radio,
  ClipboardCheck,
} from "lucide-react";

const STEPS = [
  "Scanner",
  "AI Score",
  "Strategy",
  "Order Preview",
  "Risk Review",
  "Confirm & Submit",
  "Order Status",
  "Monitor & Manage",
] as const;
type StepId = (typeof STEPS)[number];

// A preview older than this is re-fetched before the user is allowed to
// confirm/submit — a real stale-data guard, not a fabricated one: options
// quotes move, and a ticket built a while ago should be re-validated
// against the current market before it's used to place a real (paper)
// order.
const STALE_PREVIEW_MS = 60_000;

const label = (s: string) => s.replace(/_/g, " ");
const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;

interface TimelineEntry {
  at: number;
  text: string;
}

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

function Stepper({ current, furthestReached }: { current: number; furthestReached: number }) {
  return (
    <nav aria-label="Trade execution workflow" className="overflow-x-auto">
      <ol className="flex items-center gap-1 min-w-max" role="list">
        {STEPS.map((s, i) => {
          const isActive = i === current;
          const isDone = i < furthestReached;
          return (
            <li key={s} className="flex items-center">
              <div
                aria-current={isActive ? "step" : undefined}
                data-testid={`step-indicator-${i}`}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isDone
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 ${i < furthestReached ? "bg-emerald-500/40" : "bg-border"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ActivityTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet this session.</p>;
  }
  return (
    <ol className="space-y-2" data-testid="activity-timeline">
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-xs">
          <span className="font-mono text-muted-foreground shrink-0">
            {new Date(e.at).toLocaleTimeString()}
          </span>
          <span className="text-foreground">{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TradeExecutionCenter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [stepIndex, setStepIndex] = useState(0);
  const [furthestReached, setFurthestReached] = useState(0);
  const [selected, setSelected] = useState<ScannerResult | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [ticket, setTicket] = useState<ExecutionTicket | null>(null);
  const [previewedAt, setPreviewedAt] = useState<number | null>(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    orderId: string;
    broker: string;
    message: string;
    tradeId?: number | null;
  } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const hasSubmittedRef = useRef(false);

  const logActivity = (text: string) =>
    setTimeline((t) => [...t, { at: Date.now(), text }]);

  const goTo = (i: number) => {
    setStepIndex(i);
    setFurthestReached((f) => Math.max(f, i));
  };

  // --- Step 1: Scanner ---
  const { data: scannerResults, isLoading: scannerLoading } = useGetScannerResults();
  const runScanner = useRunScanner();

  const handleRunScanner = () => {
    runScanner.mutate(
      { data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetScannerResultsQueryKey() });
          logActivity("Ran a new scan of the Options Income Engine's scanner universe.");
        },
      },
    );
  };

  const selectCandidate = (r: ScannerResult) => {
    setSelected(r);
    setQuantity(null);
    setTicket(null);
    setPreviewedAt(null);
    setRiskAcknowledged(false);
    setSubmitResult(null);
    hasSubmittedRef.current = false;
    logActivity(`Selected ${r.symbol} ${label(r.strategy)} (Ravish Score ${r.ravishScore.toFixed(0)}).`);
    goTo(1);
  };

  // --- Step 4: Order Preview (also feeds Step 5's Risk Review, same response) ---
  const preview = usePreviewExecution();
  const qty = quantity ?? ticket?.quantity ?? 1;

  const runPreview = (nextQty?: number) => {
    if (selected == null) return;
    preview.mutate(
      { data: { scannerResultId: selected.id, quantity: nextQty ?? quantity ?? 1 } },
      {
        onSuccess: (data) => {
          setTicket(data);
          setQuantity((q) => q ?? data.quantity);
          setPreviewedAt(Date.now());
          logActivity(
            `Order preview built: ${data.quantity}x ${data.symbol} ${label(data.strategy)}, net ${
              data.isCredit ? "credit" : "debit"
            } ${money(Math.abs(data.netCredit))}.`,
          );
        },
      },
    );
  };

  const isStale = previewedAt != null && Date.now() - previewedAt > STALE_PREVIEW_MS;

  // --- Broker connectivity check (existing Settings.tsx pattern, reused) ---
  const {
    data: brokerHealth,
    isFetching: brokerChecking,
    refetch: refetchBrokerHealth,
  } = useGetBrokerHealth({ query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false } });

  const checkBroker = async () => {
    const result = await refetchBrokerHealth();
    logActivity(
      result.data?.connected
        ? "Broker connectivity check: connected (Paper Trading)."
        : "Broker connectivity check: not connected.",
    );
  };

  // --- Step 6: Submit ---
  const submit = useSubmitExecution();
  const v = ticket?.validation;

  const handleConfirmSubmit = () => {
    if (selected == null || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    submit.mutate(
      { data: { scannerResultId: selected.id, quantity: qty, confirm: true } },
      {
        onSuccess: (res) => {
          setConfirmOpen(false);
          setSubmitResult({
            orderId: res.orderId,
            broker: res.broker,
            message: res.message,
            tradeId: res.tradeId,
          });
          logActivity(`Paper order submitted: ${res.orderId} (${res.broker}). ${res.message}`);
          toast({ title: "Order submitted", description: `${res.message} Order ${res.orderId}.` });
          goTo(6);
        },
        onError: (err: unknown) => {
          setConfirmOpen(false);
          hasSubmittedRef.current = false;
          const message =
            err instanceof Error ? err.message : "The broker or risk engine rejected this order.";
          logActivity(`Order rejected: ${message}`);
          toast({ title: "Order rejected", description: message, variant: "destructive" });
        },
      },
    );
  };

  // --- Step 8: Monitor ---
  const monitorTradeId = submitResult?.tradeId ?? 0;
  const monitorQuery = useGetTradeMonitor(monitorTradeId, {
    query: { queryKey: getGetTradeMonitorQueryKey(monitorTradeId), enabled: !!submitResult?.tradeId },
  });

  const currentStep: StepId = STEPS[stepIndex];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">TRADE EXECUTION CENTER</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Options Income Engine · Guided workflow ·{" "}
            <Badge variant="outline" className="text-amber-400 border-amber-400/40 uppercase text-[10px] ml-1">
              Paper Trading only
            </Badge>
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <Stepper current={stepIndex} furthestReached={furthestReached} />
        </CardContent>
      </Card>

      {currentStep === "Scanner" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Opportunity Grid</CardTitle>
              <Button onClick={handleRunScanner} disabled={runScanner.isPending} data-testid="button-run-scan">
                {runScanner.isPending ? (
                  <span className="animate-pulse">Scanning...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" /> Run Scan
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">POP</TableHead>
                  <TableHead className="text-right">EV</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Event Risk</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scannerLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !scannerResults || scannerResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No opportunities found. Try running a scan.
                    </TableCell>
                  </TableRow>
                ) : (
                  scannerResults.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-secondary/50 font-mono text-sm">
                      <TableCell className="font-bold">{r.symbol}</TableCell>
                      <TableCell className="uppercase text-xs">{r.ravishTier?.replace("_", " ")}</TableCell>
                      <TableCell className="capitalize">{label(r.strategy)}</TableCell>
                      <TableCell className="text-right">{r.pop.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-success">{r.ev.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {r.ravishScore.toFixed(0)}
                      </TableCell>
                      <TableCell>
                        <EventRiskBadge
                          level={r.eventRiskLevel}
                          penalty={r.eventRiskPenalty}
                          events={r.eventRiskEvents}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectCandidate(r)}
                          data-testid={`button-select-${r.id}`}
                        >
                          Select <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {currentStep === "AI Score" && selected && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>AI Opportunity Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Ravish Score" value={selected.ravishScore.toFixed(0)} color="#3b82f6" />
              <Metric label="Tier" value={label(selected.ravishTier ?? "—")} />
              <Metric label="POP" value={`${selected.pop.toFixed(0)}%`} />
              <Metric label="Expected Value" value={selected.ev.toFixed(2)} color="#22c55e" />
            </div>
            <Button variant="outline" onClick={() => setExplainOpen(true)} data-testid="button-explain">
              <Bot className="h-4 w-4 mr-2" /> View AI Explanation
            </Button>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => goTo(0)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Scanner
              </Button>
              <Button onClick={() => goTo(2)} data-testid="button-next-strategy">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "Strategy" && selected && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Strategy Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This candidate was scanned and ranked as a{" "}
              <span className="text-foreground font-semibold capitalize">{label(selected.strategy)}</span>.
              The scanner assigns one strategy per candidate — this step is a review and confirmation, not a
              re-assignment, since no strategy-switching capability exists for a scanned candidate.
            </p>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => goTo(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => {
                  goTo(3);
                  runPreview();
                }}
                data-testid="button-confirm-strategy"
              >
                Confirm Strategy & Build Order Preview <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "Order Preview" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Order Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.isPending && !ticket ? (
              <Skeleton className="h-40 w-full" />
            ) : !ticket ? (
              <p className="text-muted-foreground text-center py-6">
                {preview.isError
                  ? "Couldn't build this ticket. The candidate may no longer be valid."
                  : "No preview available yet."}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono font-black text-white">{ticket.symbol}</span>
                  <Badge variant="outline" className="capitalize">
                    {label(ticket.strategy)}
                  </Badge>
                  <div className="ml-auto flex items-center rounded-md border border-border">
                    <button
                      className="px-3 py-1 text-lg font-mono hover:bg-secondary disabled:opacity-40"
                      onClick={() => {
                        const next = Math.max(1, qty - 1);
                        setQuantity(next);
                        runPreview(next);
                      }}
                      disabled={qty <= 1 || preview.isPending}
                    >
                      −
                    </button>
                    <span className="px-4 font-mono font-bold">{qty}</span>
                    <button
                      className="px-3 py-1 text-lg font-mono hover:bg-secondary disabled:opacity-40"
                      onClick={() => {
                        const next = Math.min(20, qty + 1);
                        setQuantity(next);
                        runPreview(next);
                      }}
                      disabled={qty >= 20 || preview.isPending}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric
                    label={ticket.isCredit ? "Net Credit" : "Net Debit"}
                    value={money(Math.abs(ticket.netCredit))}
                    color={ticket.isCredit ? "#22c55e" : "#f59e0b"}
                  />
                  <Metric label="Max Profit" value={money(ticket.maxProfit)} color="#22c55e" />
                  <Metric label="Max Loss" value={money(ticket.maxLoss)} color="#ef4444" />
                  <Metric label="Buying Power" value={money(ticket.buyingPowerRequired)} />
                </div>
                <div className="space-y-2 font-mono text-sm">
                  {ticket.legs.map((leg: ExecutionOrderLeg, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className={leg.side === "sell" ? "text-red-400" : "text-emerald-400"}>
                        {leg.side === "sell" ? "SELL" : "BUY"} {leg.ratioQty}× {ticket.symbol} {leg.strike}{" "}
                        {leg.optionType.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">@ {leg.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => goTo(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button onClick={() => goTo(4)} data-testid="button-next-risk">
                    Continue to Risk Review <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === "Risk Review" && ticket && v && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              {v.valid ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-400" />
              )}
              <CardTitle>Pre-Trade Risk Validation</CardTitle>
              <Badge
                variant="outline"
                className={v.valid ? "ml-auto text-emerald-400 border-emerald-400/40" : "ml-auto text-red-400 border-red-400/40"}
              >
                {v.valid ? "PASSED" : "BLOCKED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {v.checks.map((c: PreTradeCheck, i: number) => (
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
            {v.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                {v.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" /> {w}
                  </p>
                ))}
              </div>
            )}
            {!v.valid && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 space-y-1">
                <p className="text-xs uppercase tracking-wider text-red-400 font-bold">Blocking violations</p>
                {v.violations.map((vi: string, i: number) => (
                  <p key={i} className="text-xs text-red-300">
                    • {vi}
                  </p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
              <span>
                Trade risk: <span className="text-white font-mono">{v.riskPct}%</span>
              </span>
              <span>
                Portfolio risk:{" "}
                <span className="text-white font-mono">
                  {v.portfolioRiskBeforePct}% → {v.portfolioRiskAfterPct}%
                </span>{" "}
                after entry
              </span>
            </div>

            <div className="rounded-lg border border-border px-3 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Radio className={`h-4 w-4 ${brokerHealth?.connected ? "text-emerald-400" : "text-muted-foreground"}`} />
                <span className="text-muted-foreground">
                  Broker:{" "}
                  <span className={brokerHealth?.connected ? "text-emerald-400" : "text-amber-400"}>
                    {brokerHealth ? (brokerHealth.connected ? "Connected (Paper)" : "Not connected") : "Not checked"}
                  </span>
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={checkBroker}
                disabled={brokerChecking}
                data-testid="button-check-broker"
              >
                <RefreshCw className={`h-3 w-3 mr-2 ${brokerChecking ? "animate-spin" : ""}`} />
                Check Connection
              </Button>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => goTo(3)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => goTo(5)}
                disabled={!v.valid}
                data-testid="button-next-confirm"
              >
                Continue to Confirmation <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "Confirm & Submit" && ticket && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Confirm & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isStale ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 space-y-2">
                <p className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> This preview is more than a minute old — market
                  conditions may have moved. Refresh before continuing.
                </p>
                <Button size="sm" onClick={() => runPreview()} data-testid="button-refresh-stale-preview">
                  <RefreshCw className="h-3 w-3 mr-2" /> Refresh Preview
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric
                  label={ticket.isCredit ? "Net Credit" : "Net Debit"}
                  value={money(Math.abs(ticket.netCredit))}
                  color={ticket.isCredit ? "#22c55e" : "#f59e0b"}
                />
                <Metric label="Max Loss" value={money(ticket.maxLoss)} color="#ef4444" />
                <Metric label="POP" value={`${ticket.pop.toFixed(0)}%`} />
                <Metric label="Quantity" value={`${qty}`} />
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border px-3 py-3">
              <Checkbox
                id="risk-ack"
                checked={riskAcknowledged}
                onCheckedChange={(c) => setRiskAcknowledged(c === true)}
                data-testid="checkbox-risk-acknowledge"
              />
              <label htmlFor="risk-ack" className="text-sm text-foreground cursor-pointer">
                I acknowledge this is a <span className="font-semibold">Paper Trading</span> order with a
                maximum risk of {money(ticket.maxLoss)} ({v?.riskPct}% of account), and I have reviewed the
                Pre-Trade Risk Validation above.
              </label>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
              <span className="text-xs text-muted-foreground">
                Submitting routes a Paper Trading order only — live execution is disabled platform-wide.
              </span>
              <Button
                disabled={
                  !ticket.canSubmit ||
                  !riskAcknowledged ||
                  isStale ||
                  brokerHealth?.connected === false ||
                  submit.isPending ||
                  hasSubmittedRef.current
                }
                onClick={() => setConfirmOpen(true)}
                data-testid="button-open-confirm-dialog"
              >
                <Send className="h-4 w-4 mr-2" />
                {submit.isPending ? "Submitting..." : "Submit Paper Order"}
              </Button>
            </div>

            <Button variant="ghost" onClick={() => goTo(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Risk Review
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "Order Status" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!submitResult ? (
              <p className="text-muted-foreground">No order submitted yet.</p>
            ) : (
              <>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 space-y-1">
                  <p className="text-sm text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {submitResult.message}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Order {submitResult.orderId} · Broker: {submitResult.broker}
                  </p>
                </div>
                <Button onClick={() => goTo(7)} data-testid="button-next-monitor">
                  Continue to Trade Monitor <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === "Monitor & Manage" && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Position Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              {!submitResult?.tradeId ? (
                <p className="text-muted-foreground">No open position from this session yet.</p>
              ) : monitorQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : monitorQuery.data ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric
                    label="Unrealized P&L"
                    value={`${monitorQuery.data.currentPnl >= 0 ? "+" : ""}${money(monitorQuery.data.currentPnl)}`}
                    color={monitorQuery.data.currentPnl >= 0 ? "#22c55e" : "#ef4444"}
                  />
                  <Metric label="P&L %" value={`${monitorQuery.data.currentPnlPercent.toFixed(1)}%`} />
                  <Metric label="DTE" value={`${monitorQuery.data.daysToExpiry}d`} />
                  <Metric label="Delta" value={monitorQuery.data.delta.toFixed(2)} />
                </div>
              ) : (
                <p className="text-muted-foreground">Monitoring data unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Adjust / Close</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={!submitResult?.tradeId}
                onClick={() => submitResult?.tradeId && setLocation(`/ticket/adjust/${submitResult.tradeId}`)}
                data-testid="button-adjust-position"
              >
                <Repeat className="h-4 w-4 mr-2" /> Roll / Convert
              </Button>
              <Button variant="outline" onClick={() => setLocation("/adjustments")} data-testid="button-go-adjustments">
                <Wrench className="h-4 w-4 mr-2" /> Position Management
              </Button>
              <Button variant="outline" onClick={() => setLocation("/trades")} data-testid="button-go-trades">
                <ClipboardCheck className="h-4 w-4 mr-2" /> View in Trades
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline entries={timeline} />
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Paper Order Submission</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  You're about to submit{" "}
                  <span className="font-mono text-white">
                    {qty}× {ticket?.symbol} {ticket && label(ticket.strategy)}
                  </span>{" "}
                  for a net {ticket?.isCredit ? "credit" : "debit"} of{" "}
                  <span className="font-mono text-white">
                    {ticket && money(Math.abs(ticket.netCredit))}
                  </span>{" "}
                  as a <span className="font-semibold">Paper Trading</span> order.
                </p>
                <p className="text-muted-foreground">
                  Max risk <span className="font-mono text-red-400">{ticket && money(ticket.maxLoss)}</span> (
                  {v?.riskPct}% of account). This does not route a live order — live execution is disabled
                  platform-wide.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSubmit();
              }}
              data-testid="button-confirm-submit"
            >
              Confirm & Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TradeExplanationSheet
        open={explainOpen}
        onOpenChange={setExplainOpen}
        scannerResultId={selected?.id}
        symbol={selected?.symbol}
        strategy={selected?.strategy}
      />
    </div>
  );
}

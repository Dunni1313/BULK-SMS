import { useEffect, useId, useRef, useState } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
  useGetAutoExecutionStatus,
  getGetAutoExecutionStatusQueryKey,
  useListTradeAdjustments,
  getListTradeAdjustmentsQueryKey,
  useGetAutoAdjustmentLog,
  getGetAutoAdjustmentLogQueryKey,
  useRunAutoAdjustmentCycle,
  useCloseTrade,
  getListTradesQueryKey,
  TradeAdjustment,
  AutoExecutionLogEntry,
  GetAutoAdjustmentLogParams,
  GetAutoAdjustmentLogDecision,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeAdjustmentSheet } from "@/components/ui/trade-adjustment-sheet";
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
import { Wrench, ShieldAlert, Power, Play, Activity, AlertTriangle, XCircle, Filter, X } from "lucide-react";

const label = (s: string | null) => (s ? s.replace(/_/g, " ") : "—");

// Group log rows into cycles by runId. Rows arrive newest-first (desc id); this
// keeps that ordering for the groups (first-seen runId = newest cycle) and for the
// rows within each group.
function groupByRunId(rows: AutoExecutionLogEntry[]): { runId: string; rows: AutoExecutionLogEntry[] }[] {
  const order: string[] = [];
  const byRun = new Map<string, AutoExecutionLogEntry[]>();
  for (const r of rows) {
    if (!byRun.has(r.runId)) {
      byRun.set(r.runId, []);
      order.push(r.runId);
    }
    byRun.get(r.runId)!.push(r);
  }
  return order.map((runId) => ({ runId, rows: byRun.get(runId)! }));
}

// Severity ranking used to sort the attention queue (highest first).
const SEVERITY_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1, none: 0 };

// A position "needs attention" when the deterministic engine recommends something
// other than holding/doing nothing.
function needsAttention(a: TradeAdjustment): boolean {
  return a.action !== "hold" && a.action !== "do_nothing" && a.severity !== "none";
}

const severityStyle: Record<string, string> = {
  critical: "border-destructive/40 text-destructive bg-destructive/10",
  warning: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  info: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  none: "border-muted text-muted-foreground bg-muted/10",
};

const decisionStyle: Record<string, string> = {
  executed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  skipped: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Adjustments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: status } = useGetAutoExecutionStatus({
    query: { queryKey: getGetAutoExecutionStatusQueryKey(), refetchInterval: 15000 },
  });
  const { data: adjustments, isLoading: adjLoading } = useListTradeAdjustments({
    query: { queryKey: getListTradeAdjustmentsQueryKey(), refetchInterval: 20000 },
  });
  // Decision-log filters (server-side). "all" sentinels mean no filter.
  const [decisionFilter, setDecisionFilter] = useState<GetAutoAdjustmentLogDecision | "all">("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");

  const logParams: GetAutoAdjustmentLogParams = {
    ...(decisionFilter !== "all" ? { decision: decisionFilter } : {}),
    ...(symbolFilter !== "all" ? { symbol: symbolFilter } : {}),
  };
  const { data: log } = useGetAutoAdjustmentLog(logParams, {
    query: { queryKey: getGetAutoAdjustmentLogQueryKey(logParams), refetchInterval: 20000 },
  });
  // Unfiltered fetch purely to populate the symbol dropdown with every symbol
  // that has appeared in the log, regardless of the current filters.
  const { data: logAll } = useGetAutoAdjustmentLog(undefined, {
    query: { queryKey: getGetAutoAdjustmentLogQueryKey(), refetchInterval: 20000 },
  });
  const updateSettings = useUpdateSettings();
  const runCycle = useRunAutoAdjustmentCycle();
  const closeTrade = useCloseTrade();

  const [adjustTradeId, setAdjustTradeId] = useState<number>();
  // The de-risk-eligible row awaiting close confirmation.
  const [closeTarget, setCloseTarget] = useState<TradeAdjustment>();

  const [triggers, setTriggers] = useState({
    adjDeltaDriftTrigger: 0.3,
    adjShortStrikeProximityPct: 2.0,
    adjPopDropTrigger: 15.0,
    stopLossMultiplier: 2.0,
    profitTarget50: 0.5,
    adjIvExpansionTrigger: 25.0,
    adjDteTrigger: 21,
  });

  useEffect(() => {
    if (settings) {
      setTriggers({
        adjDeltaDriftTrigger: settings.adjDeltaDriftTrigger ?? 0.3,
        adjShortStrikeProximityPct: settings.adjShortStrikeProximityPct ?? 2.0,
        adjPopDropTrigger: settings.adjPopDropTrigger ?? 15.0,
        stopLossMultiplier: settings.stopLossMultiplier ?? 2.0,
        profitTarget50: settings.profitTarget50 ?? 0.5,
        adjIvExpansionTrigger: settings.adjIvExpansionTrigger ?? 25.0,
        adjDteTrigger: settings.adjDteTrigger ?? 21,
      });
    }
  }, [settings]);

  // ─── Live alert: toast when a NEW threatened position appears ────────────────
  const seenAttention = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!adjustments) return;
    const attentionIds = adjustments.filter(needsAttention).map((a) => a.tradeId);
    if (seenAttention.current === null) {
      // First load — seed the baseline without alerting.
      seenAttention.current = new Set(attentionIds);
      return;
    }
    const fresh = attentionIds.filter((id) => !seenAttention.current!.has(id));
    if (fresh.length > 0) {
      const list = adjustments.filter((a) => fresh.includes(a.tradeId));
      const top = list[0];
      toast({
        title:
          fresh.length === 1
            ? `${top.symbol} needs attention`
            : `${fresh.length} positions need attention`,
        description:
          fresh.length === 1
            ? `Recommended: ${top.actionLabel}`
            : list.map((a) => a.symbol).join(", "),
        variant: list.some((a) => a.severity === "critical") ? "destructive" : "default",
      });
    }
    seenAttention.current = new Set(attentionIds);
  }, [adjustments, toast]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAutoExecutionStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTradeAdjustmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAutoAdjustmentLogQueryKey() });
  };

  const isFullAuto = status?.executionMode === "full_auto";
  const masterArmed = status?.autoExecuteEnabled ?? false;
  const autoAdjustOn = settings?.autoAdjustEnabled ?? false;
  // The auto-adjust loop only fires when all three switches line up.
  const autoAdjustArmed = isFullAuto && masterArmed && autoAdjustOn;

  // Distinct symbols seen across the full (unfiltered) log, for the dropdown.
  const logSymbols = Array.from(
    new Set((logAll ?? []).map((r) => r.symbol).filter((s): s is string => !!s)),
  ).sort();

  // Group the (filtered) log rows by cycle (runId), preserving newest-first order.
  const logGroups = groupByRunId(log ?? []);
  const filtersActive = decisionFilter !== "all" || symbolFilter !== "all";

  const attention = (adjustments ?? [])
    .filter(needsAttention)
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));

  const toggleAutoAdjust = (next: boolean) => {
    updateSettings.mutate(
      { data: { autoAdjustEnabled: next } },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: next ? "Auto-adjust ARMED" : "Auto-adjust disarmed",
            variant: next ? "default" : "destructive",
          });
        },
        onError: () => toast({ title: "Failed to update switch", variant: "destructive" }),
      },
    );
  };

  const saveTriggers = () => {
    updateSettings.mutate(
      {
        data: {
          adjDeltaDriftTrigger: Number(triggers.adjDeltaDriftTrigger),
          adjShortStrikeProximityPct: Number(triggers.adjShortStrikeProximityPct),
          adjPopDropTrigger: Number(triggers.adjPopDropTrigger),
          stopLossMultiplier: Number(triggers.stopLossMultiplier),
          profitTarget50: Number(triggers.profitTarget50),
          adjIvExpansionTrigger: Number(triggers.adjIvExpansionTrigger),
          adjDteTrigger: Number(triggers.adjDteTrigger),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Triggers saved" });
        },
        onError: () => toast({ title: "Failed to save triggers", variant: "destructive" }),
      },
    );
  };

  const confirmClose = () => {
    if (!closeTarget) return;
    const t = closeTarget;
    closeTrade.mutate(
      { id: t.tradeId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradeAdjustmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          toast({ title: `${t.symbol} position closed`, description: t.actionLabel });
          setCloseTarget(undefined);
        },
        onError: () => {
          toast({ title: "Failed to close position", variant: "destructive" });
          setCloseTarget(undefined);
        },
      },
    );
  };

  const runNow = () => {
    runCycle.mutate(undefined, {
      onSuccess: (res) => {
        invalidate();
        if (res.blocked) {
          toast({ title: "Cycle blocked", description: res.blockReason ?? "", variant: "destructive" });
        } else {
          toast({
            title: "Adjustment cycle complete",
            description: `${res.scanned} scanned · ${res.executed} de-risked · ${res.skipped} advisory-only`,
          });
        }
      },
      onError: () => toast({ title: "Cycle failed", variant: "destructive" }),
    });
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Adjustments</h1>
            <p className="text-sm text-muted-foreground">
              Open-position cockpit — at-a-glance positions needing attention, trigger tuning, and the auto de-risk
              audit trail.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            attention.length > 0
              ? "border-amber-500/40 bg-amber-500/15 text-amber-400 text-sm px-3 py-1"
              : "border-zinc-600 bg-zinc-800/40 text-zinc-400 text-sm px-3 py-1"
          }
        >
          {attention.length > 0 ? `● ${attention.length} need attention` : "○ All clear"}
        </Badge>
      </div>

      {/* Attention queue */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Positions Needing Attention
          </CardTitle>
          <CardDescription>
            Open trades whose deterministic recommendation is not "hold", sorted by severity. Click a row for the full
            recommendation and AI rationale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adjLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No open positions need attention right now. Every position is inside its thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Severity</th>
                    <th className="py-2 pr-4 font-medium">Symbol</th>
                    <th className="py-2 pr-4 font-medium">Strategy</th>
                    <th className="py-2 pr-4 font-medium">Recommendation</th>
                    <th className="py-2 pr-4 font-medium text-right">P&L</th>
                    <th className="py-2 pr-4 font-medium text-right">POP</th>
                    <th className="py-2 pr-4 font-medium text-right">DTE</th>
                    <th className="py-2 pr-4 font-medium">Auto</th>
                    <th className="py-2 pr-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map((a) => (
                    <tr
                      key={a.tradeId}
                      className="border-b border-border/50 cursor-pointer hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => setAdjustTradeId(a.tradeId)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Review adjustment for ${a.symbol}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAdjustTradeId(a.tradeId);
                        }
                      }}
                    >
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={severityStyle[a.severity] ?? ""}>
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono font-bold">{a.symbol}</td>
                      <td className="py-2 pr-4">{a.strategyLabel}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-muted-foreground" />
                          {a.actionLabel}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-mono ${
                          a.currentPnl >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        ${a.currentPnl.toFixed(0)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{a.currentPop.toFixed(0)}%</td>
                      <td className="py-2 pr-4 text-right font-mono">{a.daysToExpiry}</td>
                      <td className="py-2 pr-4">
                        {a.autoActionable ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                            de-risk
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">advisory</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {a.autoActionable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCloseTarget(a);
                            }}
                            disabled={closeTrade.isPending}
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-7 px-2"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Close
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-adjust controls */}
      <Card className={autoAdjustArmed ? "bg-card border-red-500/30" : "bg-card border-border"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" /> Auto-Adjust Master Switch
          </CardTitle>
          <CardDescription>
            When armed, the engine auto-closes / de-risks (close-for-profit, close-for-loss, reduce-risk) only —
            it never rolls or converts. Rolls and converts always stay manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4">
            <div>
              <div className="font-medium flex items-center gap-2">
                Auto-Adjust Enabled
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-xs text-muted-foreground">
                Subordinate to AutoPilot — requires Full-Auto mode AND the AutoPilot master kill switch to be on.
              </div>
            </div>
            <Switch
              checked={autoAdjustOn}
              onCheckedChange={toggleAutoAdjust}
              disabled={updateSettings.isPending}
            />
          </div>

          {autoAdjustOn && !autoAdjustArmed && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Auto-adjust is switched on but inactive:{" "}
                {!isFullAuto
                  ? "Full-Auto mode is not active"
                  : "the AutoPilot master kill switch is OFF"}
                . Enable both on the AutoPilot page to arm it.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <SwitchStatus label="Full-Auto mode" on={isFullAuto} />
            <SwitchStatus label="Master kill switch" on={masterArmed} />
            <SwitchStatus label="Auto-adjust" on={autoAdjustOn} />
          </div>

          <Button onClick={runNow} disabled={runCycle.isPending} variant="outline" className="gap-2">
            <Play className="h-4 w-4" />
            {runCycle.isPending ? "Running cycle…" : "Run cycle now"}
          </Button>
        </CardContent>
      </Card>

      {/* Trigger thresholds */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Trigger Thresholds</CardTitle>
          <CardDescription>
            The deterministic bands that decide each recommendation. They apply to both the advisory recommendations
            and the auto de-risk loop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field
              label="Delta Drift Trigger"
              hint="Net delta to flag rebalance"
              value={triggers.adjDeltaDriftTrigger}
              step="0.05"
              onChange={(v) => setTriggers({ ...triggers, adjDeltaDriftTrigger: v })}
            />
            <Field
              label="Short-Strike Proximity (%)"
              hint="Spot distance to short to flag tested"
              value={triggers.adjShortStrikeProximityPct}
              step="0.5"
              onChange={(v) => setTriggers({ ...triggers, adjShortStrikeProximityPct: v })}
            />
            <Field
              label="POP Drop Trigger (pts)"
              hint="POP erosion since entry"
              value={triggers.adjPopDropTrigger}
              step="1"
              onChange={(v) => setTriggers({ ...triggers, adjPopDropTrigger: v })}
            />
            <Field
              label="Stop Loss (× credit)"
              hint="Loss multiple to hard-exit"
              value={triggers.stopLossMultiplier}
              step="0.25"
              onChange={(v) => setTriggers({ ...triggers, stopLossMultiplier: v })}
            />
            <Field
              label="Profit Target (fraction)"
              hint="Profit % to take profit (0.5 = 50%)"
              value={triggers.profitTarget50}
              step="0.05"
              onChange={(v) => setTriggers({ ...triggers, profitTarget50: v })}
            />
            <Field
              label="IV Expansion Trigger (%)"
              hint="IV increase since entry"
              value={triggers.adjIvExpansionTrigger}
              step="1"
              onChange={(v) => setTriggers({ ...triggers, adjIvExpansionTrigger: v })}
            />
            <Field
              label="DTE Trigger (days)"
              hint="DTE where gamma management begins"
              value={triggers.adjDteTrigger}
              step="1"
              onChange={(v) => setTriggers({ ...triggers, adjDteTrigger: v })}
            />
          </div>
          <Button onClick={saveTriggers} disabled={updateSettings.isPending}>
            Save Triggers
          </Button>
        </CardContent>
      </Card>

      {/* Auto-adjust decision log */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Auto-Adjust Decision Log
          </CardTitle>
          <CardDescription>
            Every auto-adjustment decision — de-risk executed, advisory-only skipped, or blocked by a switch.
            Grouped by cycle, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filter
            </div>
            <Select
              value={decisionFilter}
              onValueChange={(v) => setDecisionFilter(v as GetAutoAdjustmentLogDecision | "all")}
            >
              <SelectTrigger className="h-8 w-[150px] bg-background text-sm">
                <SelectValue placeholder="Decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decisions</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={symbolFilter} onValueChange={setSymbolFilter}>
              <SelectTrigger className="h-8 w-[140px] bg-background text-sm">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All symbols</SelectItem>
                {logSymbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setDecisionFilter("all");
                  setSymbolFilter("all");
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {!log || log.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {filtersActive
                ? "No decisions match the current filters."
                : "No auto-adjustment activity yet. Arm auto-adjust or run a cycle to see decisions here."}
            </div>
          ) : (
            <div className="space-y-5">
              {logGroups.map((group) => (
                <div key={group.runId} className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between bg-secondary/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Cycle</span>
                      <span className="font-mono">{group.runId.slice(0, 8)}</span>
                      <span className="text-muted-foreground/60">
                        {new Date(group.rows[0].createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {group.rows.length} {group.rows.length === 1 ? "decision" : "decisions"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="py-2 px-3 font-medium">Time</th>
                          <th className="py-2 pr-4 font-medium">Decision</th>
                          <th className="py-2 pr-4 font-medium">Symbol</th>
                          <th className="py-2 pr-4 font-medium">Strategy</th>
                          <th className="py-2 pr-4 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className={decisionStyle[row.decision] ?? ""}>
                                {row.decision}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 font-mono">{row.symbol ?? "—"}</td>
                            <td className="py-2 pr-4">{label(row.strategy)}</td>
                            <td className="py-2 pr-4 text-muted-foreground max-w-md truncate">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TradeAdjustmentSheet
        open={adjustTradeId !== undefined}
        onOpenChange={(o) => !o && setAdjustTradeId(undefined)}
        tradeId={adjustTradeId}
      />

      <AlertDialog
        open={closeTarget !== undefined}
        onOpenChange={(o) => !o && !closeTrade.isPending && setCloseTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {closeTarget?.symbol} {closeTarget?.strategyLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This acts on the recommendation{" "}
              <span className="font-medium text-foreground">{closeTarget?.actionLabel}</span> and
              closes the position now (PAPER/MOCK). Current P&amp;L:{" "}
              <span
                className={
                  (closeTarget?.currentPnl ?? 0) >= 0 ? "text-success" : "text-destructive"
                }
              >
                ${closeTarget?.currentPnl.toFixed(0)}
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeTrade.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmClose();
              }}
              disabled={closeTrade.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closeTrade.isPending ? "Closing…" : "Close position"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SwitchStatus({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2">
      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-zinc-600"}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`ml-auto font-medium ${on ? "text-emerald-400" : "text-zinc-500"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  const inputId = useId();
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={inputId}>{label}</label>
      <Input
        id={inputId}
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-background font-mono"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
  useGetAutoExecutionStatus,
  getGetAutoExecutionStatusQueryKey,
  useGetAutoExecutionLog,
  getGetAutoExecutionLogQueryKey,
  useRunAutoExecutionCycle,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, ShieldAlert, Power, Play, Activity } from "lucide-react";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const label = (s: string | null) => (s ? s.replace(/_/g, " ") : "—");

const decisionStyle: Record<string, string> = {
  executed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  skipped: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  rejected: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function AutoPilot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: status, isLoading: statusLoading } = useGetAutoExecutionStatus({
    query: { queryKey: getGetAutoExecutionStatusQueryKey(), refetchInterval: 15000 },
  });
  const { data: log } = useGetAutoExecutionLog({
    query: { queryKey: getGetAutoExecutionLogQueryKey(), refetchInterval: 15000 },
  });
  const updateSettings = useUpdateSettings();
  const runCycle = useRunAutoExecutionCycle();

  const [guardrails, setGuardrails] = useState({
    autoMaxTradesPerDay: 5,
    autoMaxConcurrentPositions: 10,
    autoMinRavishScore: 68,
    autoMaxDailyLossPct: 5,
    autoQuantityPerTrade: 1,
  });

  useEffect(() => {
    if (settings) {
      setGuardrails({
        autoMaxTradesPerDay: settings.autoMaxTradesPerDay ?? 5,
        autoMaxConcurrentPositions: settings.autoMaxConcurrentPositions ?? 10,
        autoMinRavishScore: settings.autoMinRavishScore ?? 68,
        autoMaxDailyLossPct: settings.autoMaxDailyLossPct ?? 5,
        autoQuantityPerTrade: settings.autoQuantityPerTrade ?? 1,
      });
    }
  }, [settings]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAutoExecutionStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAutoExecutionLogQueryKey() });
  };

  const armed = status?.armed ?? false;
  const isFullAuto = status?.executionMode === "full_auto";

  const toggleSwitch = (next: boolean) => {
    updateSettings.mutate(
      { data: { autoExecuteEnabled: next } },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: next ? "Auto-Execute ARMED" : "Auto-Execute disarmed",
            variant: next ? "default" : "destructive",
          });
        },
        onError: () => toast({ title: "Failed to update switch", variant: "destructive" }),
      },
    );
  };

  const setMode = (full: boolean) => {
    updateSettings.mutate(
      { data: { executionMode: full ? "full_auto" : "semi_auto" } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: full ? "Switched to Full-Auto" : "Switched to Semi-Auto" });
        },
        onError: () => toast({ title: "Failed to change mode", variant: "destructive" }),
      },
    );
  };

  const saveGuardrails = () => {
    updateSettings.mutate(
      {
        data: {
          autoMaxTradesPerDay: Number(guardrails.autoMaxTradesPerDay),
          autoMaxConcurrentPositions: Number(guardrails.autoMaxConcurrentPositions),
          autoMinRavishScore: Number(guardrails.autoMinRavishScore),
          autoMaxDailyLossPct: Number(guardrails.autoMaxDailyLossPct),
          autoQuantityPerTrade: Number(guardrails.autoQuantityPerTrade),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Guardrails saved" });
        },
        onError: () => toast({ title: "Failed to save guardrails", variant: "destructive" }),
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
            title: "Cycle complete",
            description: `${res.executed} executed · ${res.skipped} skipped · ${res.rejected} rejected`,
          });
        }
      },
      onError: () => toast({ title: "Cycle failed", variant: "destructive" }),
    });
  };

  if (settingsLoading || statusLoading) {
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
          <Bot className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">AutoPilot</h1>
            <p className="text-sm text-muted-foreground">
              Unattended full-auto execution — every Phase 5 risk check runs on each trade.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            armed
              ? "border-red-500/40 bg-red-500/15 text-red-400 text-sm px-3 py-1"
              : "border-zinc-600 bg-zinc-800/40 text-zinc-400 text-sm px-3 py-1"
          }
        >
          {armed ? "● ARMED" : "○ DISARMED"}
        </Badge>
      </div>

      {/* Master controls */}
      <Card className={armed ? "bg-card border-red-500/30" : "bg-card border-border"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" /> Master Controls
          </CardTitle>
          <CardDescription>
            Both must be on for any trade to auto-submit. The switch is your kill switch — flip it off to halt
            instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4">
            <div>
              <div className="font-medium">Execution Mode: Full-Auto</div>
              <div className="text-xs text-muted-foreground">
                Manual & Semi-Auto never auto-submit. Currently: {label(status?.executionMode ?? null)}
              </div>
            </div>
            <Switch checked={isFullAuto} onCheckedChange={setMode} disabled={updateSettings.isPending} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4">
            <div>
              <div className="font-medium flex items-center gap-2">
                Auto-Execute Master Switch
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-xs text-muted-foreground">
                The kill switch. When off, nothing auto-submits even in Full-Auto.
              </div>
            </div>
            <Switch
              checked={status?.autoExecuteEnabled ?? false}
              onCheckedChange={toggleSwitch}
              disabled={updateSettings.isPending}
            />
          </div>

          {status?.blockReason && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{status.blockReason}</span>
            </div>
          )}

          <Button onClick={runNow} disabled={runCycle.isPending} variant="outline" className="gap-2">
            <Play className="h-4 w-4" />
            {runCycle.isPending ? "Running cycle…" : "Run cycle now"}
          </Button>
        </CardContent>
      </Card>

      {/* Today's stats */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Trades Today"
            value={`${status.today.tradesToday} / ${status.guardrails.maxTradesPerDay}`}
          />
          <StatCard
            label="Concurrent"
            value={`${status.today.concurrentPositions} / ${status.guardrails.maxConcurrentPositions}`}
          />
          <StatCard label="Slots Left" value={`${status.today.remainingCapacity}`} />
          <StatCard
            label="P&L vs Loss Limit"
            value={`${money(status.today.dailyRealizedPnl)} / ${money(-status.today.dailyLossLimit)}`}
            negative={status.today.dailyRealizedPnl < 0}
          />
        </div>
      )}

      {/* Guardrails */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Guardrails</CardTitle>
          <CardDescription>
            Hard bounds enforced on every cycle. The auto score floor is stricter than the manual execution floor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field
              label="Max Trades / Day"
              value={guardrails.autoMaxTradesPerDay}
              onChange={(v) => setGuardrails({ ...guardrails, autoMaxTradesPerDay: v })}
            />
            <Field
              label="Max Concurrent Positions"
              value={guardrails.autoMaxConcurrentPositions}
              onChange={(v) => setGuardrails({ ...guardrails, autoMaxConcurrentPositions: v })}
            />
            <Field
              label="Min Ravish Score"
              value={guardrails.autoMinRavishScore}
              onChange={(v) => setGuardrails({ ...guardrails, autoMinRavishScore: v })}
            />
            <Field
              label="Max Daily Loss (%)"
              value={guardrails.autoMaxDailyLossPct}
              step="0.5"
              onChange={(v) => setGuardrails({ ...guardrails, autoMaxDailyLossPct: v })}
            />
            <Field
              label="Quantity / Trade"
              value={guardrails.autoQuantityPerTrade}
              onChange={(v) => setGuardrails({ ...guardrails, autoQuantityPerTrade: v })}
            />
          </div>
          <Button onClick={saveGuardrails} disabled={updateSettings.isPending}>
            Save Guardrails
          </Button>
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Decision Log
          </CardTitle>
          <CardDescription>Every auto decision is recorded — executed, skipped, rejected, or blocked.</CardDescription>
        </CardHeader>
        <CardContent>
          {!log || log.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No auto-execution activity yet. Arm the engine or run a cycle to see decisions here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Decision</th>
                    <th className="py-2 pr-4 font-medium">Symbol</th>
                    <th className="py-2 pr-4 font-medium">Strategy</th>
                    <th className="py-2 pr-4 font-medium">Score</th>
                    <th className="py-2 pr-4 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={decisionStyle[row.decision] ?? ""}>
                          {row.decision}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono">{row.symbol ?? "—"}</td>
                      <td className="py-2 pr-4">{label(row.strategy)}</td>
                      <td className="py-2 pr-4 font-mono">
                        {row.ravishScore ? row.ravishScore.toFixed(1) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground max-w-md truncate">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold font-mono mt-1 ${negative ? "text-red-400" : "text-foreground"}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-background font-mono"
      />
    </div>
  );
}

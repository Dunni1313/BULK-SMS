// Phase 11 — Live Market Operations & Production Validation. The
// Operations Dashboard — "for administrators only." Gated client-side on
// the real session's role (the same field requireAdmin checks
// server-side, which is the actual enforcement boundary — this page's own
// check is a UX convenience, not the security control: every data-bearing
// request below still 403s server-side for a non-admin, confirmed by
// routes/ops.route.test.ts).
//
// Pure consolidation, per this phase's own "reuse everything already
// built" instruction: every section reads an already-existing hook —
// GET /monitoring/status (Phase 6, Sprint 74), GET /broker/health
// (Phase 6), GET /ops/market-data-validation (this phase, itself a
// consolidation of 3 more already-existing provider-status sources), and
// GET/POST /broker/reconciliation/reports (this phase). Zero new
// calculations happen in this component.
//
// "Queue status" is honestly mapped to the background-job scheduler's own
// tick health (there is no message queue anywhere in this codebase — only
// setInterval-based tickers) — disclosed explicitly in the section
// caption rather than implying a queue that doesn't exist.
import { useSession } from "@/lib/auth-client";
import {
  useGetMonitoringStatus,
  getGetMonitoringStatusQueryKey,
  useGetBrokerHealth,
  getGetBrokerHealthQueryKey,
  useGetMarketDataValidation,
  getGetMarketDataValidationQueryKey,
  useListReconciliationReports,
  getListReconciliationReportsQueryKey,
  useCreateReconciliationReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

function statusBadgeClass(status: string): string {
  if (status === "ok") return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (status === "degraded" || status === "error") return "bg-red-500/15 text-red-600 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

function boolBadgeClass(ok: boolean): string {
  return ok ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400";
}

function severityBadgeClass(severity: string): string {
  return severity === "critical" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
}

export default function OperationsDashboard() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: monitoring, isLoading: monitoringLoading } = useGetMonitoringStatus({
    query: { queryKey: getGetMonitoringStatusQueryKey(), enabled: isAdmin },
  });
  const { data: broker, isLoading: brokerLoading } = useGetBrokerHealth({
    query: { queryKey: getGetBrokerHealthQueryKey(), enabled: isAdmin },
  });
  const { data: validation, isLoading: validationLoading } = useGetMarketDataValidation({
    query: { queryKey: getGetMarketDataValidationQueryKey(), enabled: isAdmin },
  });
  const { data: reportsData, isLoading: reportsLoading } = useListReconciliationReports({
    query: { queryKey: getListReconciliationReportsQueryKey(), enabled: isAdmin },
  });
  const createReport = useCreateReconciliationReport({
    mutation: {
      onSuccess: () => {
        toast({ title: "Reconciliation snapshot saved" });
        queryClient.invalidateQueries({ queryKey: getListReconciliationReportsQueryKey() });
      },
      onError: () => toast({ title: "Failed to run reconciliation", variant: "destructive" }),
    },
  });

  if (!isAdmin) {
    return (
      <div className="space-y-4 max-w-3xl">
        <h1>Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-ops-admin-only">
          Administrators only. Sign in with an administrator account to view platform operations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1>Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live Market Operations & Production Validation — API health, broker health, background-job scheduler health,
          market data freshness, and reconciliation history.
        </p>
      </div>

      {monitoringLoading || brokerLoading || validationLoading || reportsLoading ? (
        <div className="space-y-4" data-testid="ops-loading">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  API Health
                  {monitoring && <Badge className={statusBadgeClass(monitoring.status)}>{monitoring.status}</Badge>}
                </CardTitle>
                <CardDescription>Database connectivity, request-error rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {monitoring && (
                  <>
                    <p>
                      Database:{" "}
                      <Badge className={boolBadgeClass(monitoring.database.connected)}>
                        {monitoring.database.connected ? "connected" : "unreachable"}
                      </Badge>{" "}
                      {monitoring.database.latencyMs != null && `(${monitoring.database.latencyMs.toFixed(0)}ms)`}
                    </p>
                    <p>Requests this window: {monitoring.requestMetrics.total}</p>
                    <p>
                      2xx {monitoring.requestMetrics.byStatusClass["2xx"]} · 4xx {monitoring.requestMetrics.byStatusClass["4xx"]} · 5xx{" "}
                      {monitoring.requestMetrics.byStatusClass["5xx"]}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Broker Health
                  {broker && <Badge className={boolBadgeClass(broker.connected)}>{broker.connected ? "connected" : "not connected"}</Badge>}
                </CardTitle>
                <CardDescription>Alpaca Paper Trading — last successful refresh</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {broker && (
                  <>
                    <p>{broker.reason}</p>
                    <p>
                      Last successful check:{" "}
                      {broker.lastSuccessfulCheckAt ? new Date(broker.lastSuccessfulCheckAt).toLocaleString() : "never"}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Guardrail blocks / auth failures (last hour, computed every 5 min)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {monitoring && (
                  <>
                    <p>Guardrail blocks: {monitoring.auditSignals.guardrailBlocksLastHour}</p>
                    <p>Auth failures: {monitoring.auditSignals.authFailuresLastHour}</p>
                    {monitoring.alerts.length === 0 ? (
                      <p className="text-muted-foreground" data-testid="text-alerts-empty">
                        No active alerts.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {monitoring.alerts.map((a) => (
                          <li key={a.category}>
                            <Badge className={severityBadgeClass(a.severity)}>{a.severity}</Badge> {a.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Background Job Scheduler ("Queue Status")</CardTitle>
              <CardDescription>
                This platform has no message queue — every background job below is a setInterval-based scheduler tick, honestly
                labeled as such, not a real queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monitoring && monitoring.jobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {monitoring.jobs.map((job) => (
                    <div key={job.job} className="rounded border p-3 text-sm space-y-1">
                      <p className="font-medium">{job.job}</p>
                      <Badge className={statusBadgeClass(job.lastStatus === "ok" ? "ok" : job.lastStatus === "error" ? "error" : "idle")}>
                        {job.lastStatus}
                      </Badge>
                      <p>Last run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "never"}</p>
                      <p>
                        Runs: {job.totalRuns} · Failures: {job.totalFailures} · Consecutive failures: {job.consecutiveFailures}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No job runs recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Market Data Validation ("Data Freshness")</CardTitle>
              <CardDescription>
                Market clock: {validation?.marketClock.currentTimeEt} ET —{" "}
                <Badge className={boolBadgeClass(!!validation?.marketClock.isOpen)}>
                  {validation?.marketClock.isOpen ? "open" : "closed"}
                </Badge>{" "}
                ({validation?.marketClock.source === "alpaca" ? "live Alpaca clock" : "static approximation"})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {validation && (
                <>
                  {[validation.optionsEngine, ...validation.investingEngine, validation.tradingEngine].map((s, i) => (
                    <div key={`${s.engine}-${s.source}-${i}`} className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{s.engine}</Badge>
                      <span className="font-medium">{s.source}</span>
                      <Badge className={boolBadgeClass(s.connected)}>{s.connected ? "connected" : "not connected"}</Badge>
                      {s.stale && <Badge className={severityBadgeClass("warning")}>stale</Badge>}
                      {s.missingData && <Badge className={severityBadgeClass("critical")}>missing data</Badge>}
                      <span className="text-muted-foreground">{s.message}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">{validation.conflictingProviderDetection.reason}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Broker Reconciliation — Recent Syncs</span>
                <Button size="sm" onClick={() => createReport.mutate()} disabled={createReport.isPending} data-testid="button-run-reconciliation">
                  Run Reconciliation Now
                </Button>
              </CardTitle>
              <CardDescription>Position/portfolio drift between local trade records and Alpaca Paper Trading</CardDescription>
            </CardHeader>
            <CardContent>
              {reportsData && reportsData.reports.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {reportsData.reports.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 flex-wrap border-b pb-2">
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                      <Badge className={boolBadgeClass(r.available)}>{r.available ? "available" : "unavailable"}</Badge>
                      {r.available && (
                        <Badge className={boolBadgeClass(r.fullyReconciled)}>
                          {r.fullyReconciled ? "fully reconciled" : `${r.issueCount} issue(s)`}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground" data-testid="text-reconciliation-reports-empty">
                  No reconciliation snapshots yet — click "Run Reconciliation Now" to save one.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetPortfolioHealth,
  useGetMarketBriefing,
  useGetPortfolioSummary,
  useGetPortfolioGreeks,
  useGetThetaIncome,
  useGetRiskStatus,
  useListTradeAdjustments,
  useGenerateDailyReport,
  useListDailyReports,
  useGetDailyReport,
  useDeleteDailyReport,
  useClearDailyReports,
  useRestoreDailyReports,
  getListDailyReportsQueryKey,
  type ScoreCard,
  type PositionThreat,
  type ReportOpportunity,
  type TradeToAvoid,
  type DailyReportSummary,
  type DailyReport,
  type TradeAdjustment,
  type MarketBriefingResponse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { streamCoach } from "@/lib/coach-stream";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  ShieldCheck,
  Activity,
  Gauge,
  BrainCircuit,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Ban,
  Sparkles,
  CalendarClock,
  Wallet,
  ChevronRight,
  Radar,
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  X,
  LineChart,
  MessageSquareText,
  Trash2,
} from "lucide-react";
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

// How many saved reports to pull for the history list + trend chart.
const REPORTS_LIMIT = 30;

// ─── Visual helpers ──────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399"; // emerald
  if (score >= 65) return "#818cf8"; // indigo
  if (score >= 50) return "#f59e0b"; // amber
  return "#f87171"; // red
}

type Threat = "green" | "yellow" | "red";

const THREAT_STYLE: Record<string, { dot: string; text: string; label: string; ring: string }> = {
  green: { dot: "bg-emerald-400", text: "text-emerald-400", label: "GREEN", ring: "border-emerald-500/40 bg-emerald-500/10" },
  yellow: { dot: "bg-amber-400", text: "text-amber-400", label: "YELLOW", ring: "border-amber-500/40 bg-amber-500/10" },
  red: { dot: "bg-red-400", text: "text-red-400", label: "RED", ring: "border-red-500/40 bg-red-500/10" },
};

const TIER_COLOR: Record<string, string> = {
  elite: "#f59e0b",
  high_conviction: "#818cf8",
  good: "#34d399",
  ignore: "#64748b",
};

// Mirror of the backend threatFromSeverity mapping (critical→red, warning→yellow, else green).
function severityToThreat(sev: string): Threat {
  if (sev === "critical") return "red";
  if (sev === "warning") return "yellow";
  return "green";
}

function Panel({
  title,
  icon: Icon,
  children,
  accent = "#818cf8",
  right,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
  accent?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden p-[1px]" style={{ background: `linear-gradient(135deg, ${accent}33, transparent 60%)` }}>
      <div className="rounded-xl bg-[hsl(220,20%,5%)] h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
          </div>
          {right}
        </div>
        <div className="p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

function GaugeCard({ card, label, icon: Icon }: { card: ScoreCard; label: string; icon: typeof Gauge }) {
  const color = scoreColor(card.score);
  const data = [{ value: card.score, fill: color }];
  return (
    <div className="rounded-xl overflow-hidden p-[1px]" style={{ background: `linear-gradient(135deg, ${color}44, transparent 60%)` }}>
      <div className="rounded-xl bg-[hsl(220,20%,5%)] p-5 h-full" style={{ boxShadow: `0 0 30px ${color}18 inset` }}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <p className="text-xs uppercase tracking-widest" style={{ color: `${color}cc` }}>{label}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "#1e293b" }} dataKey="value" cornerRadius={8} isAnimationActive={false} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-bold text-white">{card.score}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold" style={{ color }}>{card.label}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{card.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtMoney(n: number): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PortfolioAI() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: health, isLoading: healthLoading } = useGetPortfolioHealth();
  const { data: briefing, isLoading: briefingLoading, refetch: refetchBriefing } = useGetMarketBriefing();
  const { data: summary } = useGetPortfolioSummary();
  const { data: greeks } = useGetPortfolioGreeks();
  const { data: theta } = useGetThetaIncome();
  const { data: risk } = useGetRiskStatus();
  const { data: adjustments, isLoading: adjLoading } = useListTradeAdjustments();
  const { data: reports } = useListDailyReports(
    { limit: REPORTS_LIMIT },
    { query: { queryKey: getListDailyReportsQueryKey({ limit: REPORTS_LIMIT }) } },
  );

  // Report browsing: a selected history id wins over the freshly-generated report.
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const { data: fetchedReport, isFetching: reportFetching } = useGetDailyReport(selectedReportId ?? 0);

  // Compare mode: pick up to two saved reports and view them side by side.
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const { data: compareReportA, isFetching: compareAFetching } = useGetDailyReport(compareIds[0] ?? 0);
  const { data: compareReportB, isFetching: compareBFetching } = useGetDailyReport(compareIds[1] ?? 0);

  const toggleCompareMode = () => {
    setCompareMode((on) => !on);
    setCompareIds([]);
  };

  const toggleCompareId = (id: number) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 2) return [ids[1], id]; // drop the oldest pick (FIFO)
      return [...ids, id];
    });
  };
  const generate = useGenerateDailyReport({
    mutation: {
      onSuccess: (data) => {
        setSelectedReportId(null);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey({ limit: REPORTS_LIMIT }) });
        toast({ title: "Daily report generated", description: `Health ${data.health.health.score} · ${data.health.health.label}` });
      },
      onError: () => toast({ title: "Could not generate report", variant: "destructive" }),
    },
  });

  // Report deletion: a pending target opens the confirmation dialog.
  const [deleteTarget, setDeleteTarget] = useState<DailyReportSummary | null>(null);
  const deleteReport = useDeleteDailyReport({
    mutation: {
      onSuccess: (_data, vars) => {
        // Clear the detail view if the deleted report is the one on screen —
        // whether it was opened from history (selectedReportId) or freshly
        // generated (generate.data).
        if (selectedReportId === vars.id) setSelectedReportId(null);
        if (generate.data?.id === vars.id) generate.reset();
        setDeleteTarget(null);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey({ limit: REPORTS_LIMIT }) });
        toast({ title: "Report deleted" });
      },
      onError: () => toast({ title: "Could not delete report", variant: "destructive" }),
    },
  });

  // Restore: re-inserts reports captured from a just-completed "Clear all".
  const restoreReports = useRestoreDailyReports({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey({ limit: REPORTS_LIMIT }) });
        toast({ title: "Report history restored", description: `${data.restored} report${data.restored === 1 ? "" : "s"} recovered` });
      },
      onError: () => toast({ title: "Could not restore reports", variant: "destructive" }),
    },
  });

  // Clear-all: wipe the entire saved report history in one step.
  const [clearOpen, setClearOpen] = useState(false);
  const clearReports = useClearDailyReports({
    mutation: {
      onSuccess: (data) => {
        setSelectedReportId(null);
        generate.reset();
        setCompareMode(false);
        setCompareIds([]);
        setClearOpen(false);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey({ limit: REPORTS_LIMIT }) });
        // Snapshot the deleted rows so "Undo" can restore them for a few seconds.
        const removed = data.reports;
        const t = toast({
          title: "Report history cleared",
          description: `${data.deleted} report${data.deleted === 1 ? "" : "s"} removed`,
          action:
            removed.length > 0 ? (
              <ToastAction
                altText="Undo clearing report history"
                onClick={() => {
                  t.dismiss();
                  restoreReports.mutate({ data: { reports: removed } });
                }}
              >
                Undo
              </ToastAction>
            ) : undefined,
        });
        // Auto-dismiss the undo window after a few seconds.
        setTimeout(() => t.dismiss(), 8000);
      },
      onError: () => toast({ title: "Could not clear reports", variant: "destructive" }),
    },
  });

  const report = selectedReportId ? fetchedReport : generate.data;
  const opportunities = report?.opportunities ?? [];
  const avoid = report?.tradesToAvoid ?? [];

  // Live threats from the open-position adjustment engine (independent of report generation).
  const liveThreats = (adjustments ?? [])
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-indigo-400" /> Portfolio AI
            </h1>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] tracking-widest">
              SIMULATED
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Ravish AI cockpit — portfolio health, threat radar, market briefing &amp; the daily report. Advisory only; nothing here trades on its own.
          </p>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          {generate.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generate.isPending ? "Generating…" : "Generate Daily Report"}
        </Button>
      </div>

      {/* Live account metrics */}
      <Panel title="Account Snapshot" icon={Wallet} accent="#34d399">
        {!summary ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Metric label="Account Value" value={fmtMoney(summary.accountValue)} />
            <Metric label="Buying Power" value={fmtMoney(summary.buyingPower)} />
            <Metric
              label="Day P&L"
              value={fmtMoney(summary.dayPnl)}
              tone={summary.dayPnl >= 0 ? "pos" : "neg"}
            />
            <Metric
              label="Total P&L"
              value={fmtMoney(summary.totalPnl)}
              tone={summary.totalPnl >= 0 ? "pos" : "neg"}
            />
            <Metric label="Open Positions" value={String(summary.openPositions)} />
            <Metric
              label="Risk Used"
              value={risk ? `${risk.portfolioRiskUsedPct.toFixed(0)}%` : `${(summary.maxRiskUsed ?? 0).toFixed(0)}%`}
              tone={risk && !risk.withinLimits ? "neg" : undefined}
            />
          </div>
        )}
      </Panel>

      {/* Greeks + theta income strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Portfolio Greeks" icon={Activity} accent="#818cf8">
          {!greeks ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <Metric label="Net Δ" value={greeks.totalDelta.toFixed(2)} mono />
                <Metric label="Net Θ" value={greeks.totalTheta.toFixed(0)} mono />
                <Metric label="Net Vega" value={greeks.totalVega.toFixed(0)} mono />
                <Metric label="Net Γ" value={greeks.totalGamma.toFixed(2)} mono />
              </div>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-300">
                {greeks.exposureLabel ?? greeks.deltaStatus}
              </Badge>
            </div>
          )}
        </Panel>

        <Panel title="Theta Income" icon={TrendingUp} accent="#34d399">
          {!theta ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Daily" value={fmtMoney(theta.daily)} tone="pos" />
              <Metric label="Weekly" value={fmtMoney(theta.weekly)} tone="pos" />
              <Metric label="Monthly" value={fmtMoney(theta.monthly)} tone="pos" />
              <Metric label="Annualized" value={fmtMoney(theta.annualized)} tone="pos" />
            </div>
          )}
        </Panel>
      </div>

      {/* Score gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {healthLoading || !health ? (
          <>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </>
        ) : (
          <>
            <GaugeCard card={health.health} label="Portfolio Health" icon={ShieldCheck} />
            <GaugeCard card={health.exposure} label="Market Exposure" icon={Activity} />
            <GaugeCard card={health.riskConcentration} label="Risk Concentration" icon={Gauge} />
          </>
        )}
      </div>

      {/* Threat summary */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <ThreatPill label="Healthy" count={health.threatCounts.green} tone="green" />
          <ThreatPill label="Watch" count={health.threatCounts.yellow} tone="yellow" />
          <ThreatPill label="Critical" count={health.threatCounts.red} tone="red" />
          <MetricPill label="Net Δ" value={health.netDelta.toFixed(2)} />
          <MetricPill label="Net Θ / day" value={`$${health.netTheta.toFixed(0)}`} />
          <MetricPill label="Top name" value={health.largestSymbol ? `${health.largestSymbol} ${health.largestSymbolPct}%` : "—"} />
        </div>
      )}

      {/* Live position threat radar — always on, independent of report generation */}
      <Panel
        title="Position Threat Radar"
        icon={Radar}
        accent="#f59e0b"
        right={
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live · click a row for detail</span>
        }
      >
        {adjLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : liveThreats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open positions to monitor.</p>
        ) : (
          <div className="space-y-2">
            {liveThreats.map((a: TradeAdjustment) => {
              const threat = severityToThreat(a.severity);
              const s = THREAT_STYLE[threat];
              return (
                <button
                  key={a.tradeId}
                  onClick={() => navigate(`/ticket/adjust/${a.tradeId}`)}
                  className={`w-full text-left flex items-center justify-between rounded-lg border p-3 transition-colors hover:brightness-125 ${s.ring}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-white">{a.symbol}</span>
                        <span className="text-xs text-muted-foreground">{a.strategyLabel}</span>
                        <Badge variant="outline" className={`${s.text} border-current/30 text-[10px]`}>{s.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.rationale}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <Badge variant="outline" className={`${s.text} border-current/30`}>{a.actionLabel}</Badge>
                      <div className="text-xs mt-1">
                        <span className={a.currentPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtMoney(a.currentPnl)}</span>
                        <span className="text-muted-foreground"> · {a.daysToExpiry}d · POP {Math.round(a.currentPop * 100)}%</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Portfolio health trend across all saved reports */}
      <HealthTrendPanel reports={reports ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market briefing */}
        <div className="lg:col-span-2">
          <MarketBriefingCard briefing={briefing} loading={briefingLoading} refetchBriefing={refetchBriefing} />
        </div>

        {/* Report history */}
        <Panel
          title="Report History"
          icon={CalendarClock}
          accent="#34d399"
          right={
            reports && reports.length > 0 ? (
              <div className="flex items-center gap-2">
                {reports.length >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleCompareMode}
                    className={`h-7 px-2 text-[11px] ${
                      compareMode
                        ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {compareMode ? <X className="h-3.5 w-3.5 mr-1" /> : <GitCompare className="h-3.5 w-3.5 mr-1" />}
                    {compareMode ? "Cancel" : "Compare"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearOpen(true)}
                  className="h-7 px-2 text-[11px] border-border/60 text-muted-foreground hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear all
                </Button>
              </div>
            ) : null
          }
        >
          {!reports || reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet. Generate your first daily report.</p>
          ) : (
            <>
              {compareMode && (
                <p className="text-xs text-indigo-300/80 mb-2">
                  Pick two reports to compare ({compareIds.length}/2 selected).
                </p>
              )}
              <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {reports.map((r: DailyReportSummary) => {
                  const comparePos = compareIds.indexOf(r.id);
                  const active = compareMode ? comparePos !== -1 : selectedReportId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`group relative rounded-lg border transition-colors ${
                        active ? "border-indigo-500/60 bg-indigo-500/10" : "border-border/50 bg-black/20 hover:border-indigo-500/40"
                      }`}
                    >
                      <button
                        onClick={() => (compareMode ? toggleCompareId(r.id) : setSelectedReportId(r.id))}
                        className="w-full text-left p-3 pr-10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white flex items-center gap-2">
                            {compareMode && comparePos !== -1 && (
                              <Badge className="h-5 px-1.5 bg-indigo-600 text-white text-[10px] font-bold">
                                {comparePos === 0 ? "A" : "B"}
                              </Badge>
                            )}
                            {r.reportDate}
                          </span>
                          <span className="font-mono font-bold" style={{ color: scoreColor(r.healthScore) }}>{r.healthScore}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{r.healthLabel}</span>
                          <span>·</span>
                          <span>{r.openPositions} open</span>
                          {r.redCount > 0 && <span className="text-red-400">{r.redCount} red</span>}
                          {r.yellowCount > 0 && <span className="text-amber-400">{r.yellowCount} watch</span>}
                        </div>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        aria-label={`Delete report ${r.reportDate}`}
                        className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* Side-by-side report comparison */}
      {compareMode && (
        <ReportComparison
          a={compareReportA ?? null}
          b={compareReportB ?? null}
          loading={compareAFetching || compareBFetching}
          selectedCount={compareIds.length}
        />
      )}

      {/* Report detail: snapshot + opportunities + avoid */}
      {report ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {selectedReportId ? "Viewing saved report" : "Latest generated report"} · {report.date}
              {report.generatedAt ? ` · ${new Date(report.generatedAt).toLocaleString()}` : ""}
            </span>
            {reportFetching && selectedReportId ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Panel title="Report Position Snapshot" icon={Activity} accent="#f59e0b">
                {report.positions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open positions in this report.</p>
                ) : (
                  <div className="space-y-2">
                    {report.positions.map((p: PositionThreat) => {
                      const s = THREAT_STYLE[p.threatLevel] ?? THREAT_STYLE.green;
                      return (
                        <button
                          key={p.tradeId}
                          onClick={() => navigate(`/ticket/adjust/${p.tradeId}`)}
                          className={`w-full text-left flex items-center justify-between rounded-lg border p-3 transition-colors hover:brightness-125 ${s.ring}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-white">{p.symbol}</span>
                                <span className="text-xs text-muted-foreground">{p.strategyLabel}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{p.rationale}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className={`${s.text} border-current/30`}>{p.actionLabel}</Badge>
                            <div className="text-xs mt-1">
                              <span className={p.currentPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtMoney(p.currentPnl)}</span>
                              <span className="text-muted-foreground"> · {p.daysToExpiry}d · POP {Math.round(p.currentPop * 100)}%</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Top Opportunities" icon={TrendingUp} accent="#34d399">
                {opportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scanner results. Run the Scanner to populate.</p>
                ) : (
                  <div className="space-y-2">
                    {opportunities.map((o: ReportOpportunity, i: number) => (
                      <button
                        key={i}
                        onClick={() => navigate("/scanner")}
                        className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-black/20 p-2.5 hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-white">{o.symbol}</span>
                          <span className="text-xs text-muted-foreground">{o.strategy.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">POP {Math.round(o.pop * 100)}%</span>
                          <span className="font-mono font-bold" style={{ color: TIER_COLOR[o.ravishTier] ?? "#64748b" }}>{o.ravishScore}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Trades to Avoid" icon={Ban} accent="#f87171">
                {avoid.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No symbols flagged for event risk.</p>
                ) : (
                  <div className="space-y-2">
                    {avoid.map((t: TradeToAvoid) => (
                      <div key={t.symbol} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          <div>
                            <span className="font-mono font-semibold text-white">{t.symbol}</span>
                            <p className="text-xs text-muted-foreground">{t.reason}</p>
                          </div>
                        </div>
                        {t.earningsInDays != null && (
                          <span className="text-xs text-red-400 whitespace-nowrap">ER {t.earningsInDays}d</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-black/20 p-10 text-center">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Generate a daily report — or open one from the history — to see opportunities, trades to avoid and the report position snapshot.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground/70 border-t border-border/40 pt-4">
        {report?.disclaimer ??
          "Advisory only. This cockpit summarises simulated data and never executes or adjusts a trade on its own — every decision is yours."}
      </p>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && !deleteReport.isPending && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report {deleteTarget?.reportDate}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the saved daily report from your history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReport.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteReport.mutate({ id: deleteTarget.id });
              }}
              disabled={deleteReport.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReport.isPending ? "Deleting…" : "Delete report"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clearOpen}
        onOpenChange={(o) => !o && !clearReports.isPending && setClearOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all reports?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every saved daily report from your history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearReports.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearReports.mutate();
              }}
              disabled={clearReports.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearReports.isPending ? "Clearing…" : "Clear all reports"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const SEVERITY_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1, none: 0 };
function severityRank(sev: string): number {
  return SEVERITY_RANK[sev] ?? 0;
}

function ThreatPill({ label, count, tone }: { label: string; count: number; tone: Threat }) {
  const s = THREAT_STYLE[tone];
  return (
    <div className={`rounded-lg border p-3 ${s.ring}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`text-2xl font-mono font-bold mt-1 ${s.text}`}>{count}</p>
    </div>
  );
}

function Metric({ label, value, tone, mono }: { label: string; value: string; tone?: "pos" | "neg"; mono?: boolean }) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-white";
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${mono ? "font-mono" : ""} ${color} truncate`}>{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-mono font-bold mt-1 text-white truncate">{value}</p>
    </div>
  );
}

// ─── Health trend ────────────────────────────────────────────────────────────

type TrendWindow = "2w" | "1m" | "3m" | "all";

const TREND_WINDOWS: { value: TrendWindow; label: string; days: number | null }[] = [
  { value: "2w", label: "2W", days: 14 },
  { value: "1m", label: "1M", days: 30 },
  { value: "3m", label: "3M", days: 90 },
  { value: "all", label: "All", days: null },
];

function HealthTrendPanel({ reports }: { reports: DailyReportSummary[] }) {
  const [window, setWindow] = useState<TrendWindow>("1m");

  const windowDays = TREND_WINDOWS.find((w) => w.value === window)?.days ?? null;

  // Filter by reportDate before charting. reportDate is an ISO date string
  // (YYYY-MM-DD); compare against a cutoff relative to today.
  const cutoff =
    windowDays === null
      ? null
      : (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - windowDays);
          return d;
        })();

  const filtered =
    cutoff === null
      ? reports
      : reports.filter((r) => {
          const t = new Date(`${r.reportDate}T00:00:00`);
          return !Number.isNaN(t.getTime()) && t >= cutoff;
        });

  // The list arrives newest-first; reverse to chart oldest → newest so the line
  // reads left-to-right through time.
  const data = filtered
    .slice()
    .reverse()
    .map((r) => ({
      date: r.reportDate.slice(5),
      fullDate: r.reportDate,
      health: r.healthScore,
      red: r.redCount,
      yellow: r.yellowCount,
    }));

  const single = data.length === 1;

  return (
    <Panel
      title="Portfolio Health Trend"
      icon={LineChart}
      accent="#34d399"
      right={
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {data.length === 0
              ? reports.length === 0
                ? "No history yet"
                : "None in window"
              : `${data.length} report${data.length === 1 ? "" : "s"}`}
          </span>
          <ToggleGroup
            type="single"
            value={window}
            onValueChange={(v) => v && setWindow(v as TrendWindow)}
            className="bg-card border border-border rounded-md p-0.5"
          >
            {TREND_WINDOWS.map((w) => (
              <ToggleGroupItem
                key={w.value}
                value={w.value}
                className="text-[10px] font-mono px-2 h-6"
              >
                {w.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      }
    >
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {reports.length === 0
            ? "Generate daily reports over time to chart how portfolio health is trending."
            : "No reports fall within this window — widen the range or pick All."}
        </p>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="healthTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                yAxisId="score"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
              <Area
                yAxisId="score"
                type="monotone"
                dataKey="health"
                name="Health"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#healthTrendFill)"
                dot={single ? { r: 4, fill: "#34d399" } : false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="red"
                name="Critical"
                stroke="#f87171"
                strokeWidth={1.5}
                dot={single ? { r: 3, fill: "#f87171" } : false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="yellow"
                name="Watch"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={single ? { r: 3, fill: "#f59e0b" } : false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// ─── Report comparison ───────────────────────────────────────────────────────

type GoodDirection = "up" | "down" | "neutral";

function deltaTone(delta: number, good: GoodDirection): "pos" | "neg" | "flat" {
  if (delta === 0) return "flat";
  if (good === "neutral") return "flat";
  const improved = good === "up" ? delta > 0 : delta < 0;
  return improved ? "pos" : "neg";
}

function fmtDelta(delta: number, digits = 0): string {
  const v = digits > 0 ? delta.toFixed(digits) : String(Math.round(delta));
  return delta > 0 ? `+${v}` : v;
}

function DeltaStat({
  label,
  from,
  to,
  good,
  digits = 0,
}: {
  label: string;
  from: number;
  to: number;
  good: GoodDirection;
  digits?: number;
}) {
  const delta = to - from;
  const tone = deltaTone(delta, good);
  const toneClass = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-muted-foreground";
  const fmt = (n: number) => (digits > 0 ? n.toFixed(digits) : String(Math.round(n)));
  return (
    <div className="rounded-lg border border-border/50 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="font-mono text-sm text-muted-foreground">{fmt(from)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="font-mono text-base font-bold text-white">{fmt(to)}</span>
        <span className={`ml-auto font-mono text-sm font-semibold ${toneClass}`}>
          {delta === 0 ? "—" : fmtDelta(delta, digits)}
        </span>
      </div>
    </div>
  );
}

function DiffList({
  title,
  added,
  removed,
  accent,
}: {
  title: string;
  added: string[];
  removed: string[];
  accent: string;
}) {
  return (
    <Panel title={title} icon={GitCompare} accent={accent}>
      {added.length === 0 && removed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes between these reports.</p>
      ) : (
        <div className="space-y-3">
          {added.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1">
                <Plus className="h-3 w-3" /> New ({added.length})
              </p>
              <div className="space-y-1.5">
                {added.map((x, i) => (
                  <div key={`a-${i}`} className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-sm text-slate-200">
                    <Plus className="h-3 w-3 text-emerald-400 shrink-0" />
                    {x}
                  </div>
                ))}
              </div>
            </div>
          )}
          {removed.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-red-400 mb-1.5 flex items-center gap-1">
                <Minus className="h-3 w-3" /> Removed ({removed.length})
              </p>
              <div className="space-y-1.5">
                {removed.map((x, i) => (
                  <div key={`r-${i}`} className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-sm text-slate-400">
                    <Minus className="h-3 w-3 text-red-400 shrink-0" />
                    {x}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

type MarketBriefing = MarketBriefingResponse;

// AI Market Briefing card. The deterministic chips (regime/VIX/IV-rank/breadth/
// catalysts) come from GET /briefing; the prose is streamed word-by-word over
// SSE via /briefing/stream so it appears as it's written. The streamed prose is
// commentary only — routed through the coach narrate() path server-side so the
// COACH_DISCLAIMER invariant always holds and it degrades to a deterministic
// template (single chunk) when the LLM is unavailable.
function MarketBriefingCard({
  briefing,
  loading,
  refetchBriefing,
}: {
  briefing?: MarketBriefing;
  loading: boolean;
  refetchBriefing: () => void;
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"llm" | "template" | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Run the briefing stream. `refresh` busts the server-side cache so the user
  // gets a brand-new take instead of the previously cached prose.
  const runStream = useCallback((refresh: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setSource(null);
    setCached(null);
    setGeneratedAt(null);
    setStatus("streaming");

    // Refresh re-pulls the deterministic chips/catalysts too — not just the
    // narration prose — so the surrounding numbers stay in sync with the take.
    if (refresh) refetchBriefing();

    streamCoach(
      "/briefing/stream",
      { refresh },
      {
        onMeta: (data) => {
          const d = data as { source?: "llm" | "template" };
          if (d.source) setSource(d.source);
        },
        onDelta: (chunk) => setText((prev) => prev + chunk),
        onDone: (data) => {
          const d = data as {
            narration?: string;
            narrationSource?: "llm" | "template";
            cached?: boolean;
            generatedAt?: number | null;
          };
          if (typeof d.narration === "string") setText(d.narration);
          if (d.narrationSource) setSource(d.narrationSource);
          if (typeof d.cached === "boolean") setCached(d.cached);
          if (typeof d.generatedAt === "number") setGeneratedAt(d.generatedAt);
          setStatus("done");
        },
        onError: () => setStatus("error"),
      },
      controller.signal,
    ).catch((err) => {
      if (controller.signal.aborted) return;
      console.error("market briefing stream failed", err);
      setStatus("error");
    });
  }, [refetchBriefing]);

  useEffect(() => {
    runStream(false);
    return () => abortRef.current?.abort();
  }, [runStream]);

  const streaming = status === "streaming";

  return (
    <Panel
      title="AI Market Briefing"
      icon={BrainCircuit}
      accent="#818cf8"
      right={
        <div className="flex items-center gap-2">
          {source && !streaming ? (
            <Badge variant="outline" className="border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              {source === "llm" ? "AI" : "Template"}
            </Badge>
          ) : null}
          {source === "llm" && !streaming && cached !== null ? (
            <span
              className={`text-[10px] uppercase tracking-wider ${
                cached ? "text-amber-400/80" : "text-emerald-400/80"
              }`}
              title={generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : undefined}
            >
              {cached
                ? `Cached${generatedAt ? ` · ${timeAgo(generatedAt)}` : ""}`
                : "Freshly generated"}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => runStream(true)}
            disabled={streaming}
            title="Generate a fresh briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${streaming ? "animate-spin" : ""}`} />
            <span className="ml-1.5 text-xs">Refresh</span>
          </Button>
        </div>
      }
    >
      {loading || !briefing ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30">{briefing.briefing.regimeLabel}</Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">VIX ~{briefing.briefing.syntheticVix} · {briefing.briefing.vixLabel}</Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">IV Rank {briefing.briefing.avgIvRank}/100</Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">Breadth {briefing.briefing.breadth}%</Badge>
          </div>
          {status === "error" && !text ? (
            <p className="text-sm text-muted-foreground">
              Couldn't generate the briefing right now — the chips above and catalysts below tell the story.
            </p>
          ) : text ? (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {text}
              {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-indigo-300/70 align-middle" />}
            </p>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          )}
          {briefing.briefing.catalysts.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Catalysts (next 2 weeks)
              </p>
              <div className="space-y-1.5">
                {briefing.briefing.catalysts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">
                      {c.symbol ? <span className="font-mono text-indigo-300 mr-2">{c.symbol}</span> : null}
                      {c.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          c.impact === "high"
                            ? "border-red-500/40 text-red-400"
                            : "border-amber-500/40 text-amber-400"
                        }
                      >
                        {c.impact}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-14 text-right">{c.daysAway}d · {c.date.slice(5)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// AI-narrated plain-English summary of what changed between the two selected
// reports. The deltas in the grid below remain the deterministic source of
// truth; this prose is commentary only and is routed through the coach narrate()
// path server-side (so the COACH_DISCLAIMER invariant always holds and it
// degrades to a deterministic template when the LLM is unavailable).
// Human-friendly "how long ago" for the last-generated timestamp.
function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function ComparisonNarration({ fromId, toId }: { fromId?: number; toId?: number }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"llm" | "template" | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Run the comparison stream. `refresh` busts the server-side cached narration
  // (keyed per report pair) so the user gets a brand-new take after conditions shift.
  const runStream = useCallback((refresh: boolean) => {
    if (typeof fromId !== "number" || typeof toId !== "number" || fromId === toId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setSource(null);
    setCached(null);
    setGeneratedAt(null);
    setStatus("streaming");

    streamCoach(
      "/reports/compare-narration/stream",
      { fromId, toId, refresh },
      {
        onMeta: (data) => {
          const d = data as { source?: "llm" | "template" };
          if (d.source) setSource(d.source);
        },
        onDelta: (chunk) => setText((prev) => prev + chunk),
        onDone: (data) => {
          const d = data as {
            narration?: string;
            narrationSource?: "llm" | "template";
            cached?: boolean;
            generatedAt?: number | null;
          };
          if (typeof d.narration === "string") setText(d.narration);
          if (d.narrationSource) setSource(d.narrationSource);
          if (typeof d.cached === "boolean") setCached(d.cached);
          if (typeof d.generatedAt === "number") setGeneratedAt(d.generatedAt);
          setStatus("done");
        },
        onError: () => setStatus("error"),
      },
      controller.signal,
    ).catch((err) => {
      if (controller.signal.aborted) return;
      console.error("comparison narration stream failed", err);
      setStatus("error");
    });
  }, [fromId, toId]);

  useEffect(() => {
    runStream(false);
    return () => abortRef.current?.abort();
  }, [runStream]);

  const streaming = status === "streaming";
  const canRefresh = typeof fromId === "number" && typeof toId === "number" && fromId !== toId;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-transparent p-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquareText className="h-4 w-4 text-indigo-300" />
        <h3 className="text-sm font-semibold text-white">What changed, in plain English</h3>
        {source && !streaming ? (
          <Badge variant="outline" className="border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            {source === "llm" ? "AI" : "Template"}
          </Badge>
        ) : null}
        {source === "llm" && !streaming && cached !== null ? (
          <Badge
            variant="outline"
            className={
              cached
                ? "border-border/60 text-[10px] text-muted-foreground"
                : "border-emerald-500/40 text-[10px] text-emerald-300"
            }
            title={generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : undefined}
          >
            {cached
              ? `Cached${generatedAt ? ` · ${timeAgo(generatedAt)}` : ""}`
              : "Freshly generated"}
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => runStream(true)}
          disabled={streaming || !canRefresh}
          title="Generate a fresh summary"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${streaming ? "animate-spin" : ""}`} />
          <span className="ml-1.5 text-xs">Refresh</span>
        </Button>
      </div>
      {status === "error" && !text ? (
        <p className="text-sm text-muted-foreground">
          Couldn't generate a summary right now — the deltas below tell the full story.
        </p>
      ) : text ? (
        <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
          {text}
          {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-indigo-300/70 align-middle" />}
        </p>
      ) : streaming ? (
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Summarising the changes…</p>
      )}
    </div>
  );
}

function ReportComparison({
  a,
  b,
  loading,
  selectedCount,
}: {
  a: DailyReport | null;
  b: DailyReport | null;
  loading: boolean;
  selectedCount: number;
}) {
  if (!a || !b) {
    return (
      <div className="rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 p-8 text-center">
        <GitCompare className="h-7 w-7 text-indigo-400 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading reports…"
            : selectedCount < 2
            ? "Pick two reports from the history above to see how the portfolio shifted between them."
            : "Loading reports…"}
        </p>
      </div>
    );
  }

  // Order chronologically: the older report is the baseline ("from"), the newer
  // one is the target ("to"), so positive deltas read as "since the older day".
  const [from, to] =
    new Date(a.generatedAt).getTime() <= new Date(b.generatedAt).getTime() ? [a, b] : [b, a];

  // Positions diff keyed by tradeId; label by symbol + strategy for readability.
  const posLabel = (p: PositionThreat) => `${p.symbol} · ${p.strategyLabel}`;
  const fromPos = new Map(from.positions.map((p) => [p.tradeId, p]));
  const toPos = new Map(to.positions.map((p) => [p.tradeId, p]));
  const newPositions = to.positions.filter((p) => !fromPos.has(p.tradeId)).map(posLabel);
  const removedPositions = from.positions.filter((p) => !toPos.has(p.tradeId)).map(posLabel);

  // Trades-to-avoid diff keyed by symbol.
  const fromAvoid = new Set(from.tradesToAvoid.map((t) => t.symbol));
  const toAvoid = new Set(to.tradesToAvoid.map((t) => t.symbol));
  const newAvoid = to.tradesToAvoid.filter((t) => !fromAvoid.has(t.symbol)).map((t) => t.symbol);
  const removedAvoid = from.tradesToAvoid.filter((t) => !toAvoid.has(t.symbol)).map((t) => t.symbol);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-indigo-400" /> Report Comparison
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="border-border text-muted-foreground font-mono">{from.date}</Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
          <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 font-mono">{to.date}</Badge>
        </div>
      </div>

      <ComparisonNarration fromId={from.id} toId={to.id} />

      <Panel title="Key Deltas" icon={Activity} accent="#818cf8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <DeltaStat label="Health" from={from.health.health.score} to={to.health.health.score} good="up" />
          <DeltaStat label="Market Exposure" from={from.health.exposure.score} to={to.health.exposure.score} good="up" />
          <DeltaStat label="Risk Concentration" from={from.health.riskConcentration.score} to={to.health.riskConcentration.score} good="up" />
          <DeltaStat label="Open Positions" from={from.summary.openPositions} to={to.summary.openPositions} good="neutral" />
          <DeltaStat label="Critical (red)" from={from.health.threatCounts.red} to={to.health.threatCounts.red} good="down" />
          <DeltaStat label="Watch (yellow)" from={from.health.threatCounts.yellow} to={to.health.threatCounts.yellow} good="down" />
          <DeltaStat label="Healthy (green)" from={from.health.threatCounts.green} to={to.health.threatCounts.green} good="up" />
          <DeltaStat label="Trades to Avoid" from={from.tradesToAvoid.length} to={to.tradesToAvoid.length} good="down" />
          <DeltaStat label="Net Δ" from={from.health.netDelta} to={to.health.netDelta} good="neutral" digits={2} />
          <DeltaStat label="Net Θ / day" from={from.health.netTheta} to={to.health.netTheta} good="up" />
          <DeltaStat label="Unrealized P&L" from={from.summary.totalUnrealizedPnl} to={to.summary.totalUnrealizedPnl} good="up" />
          <DeltaStat label="Risk Used %" from={from.summary.portfolioRiskUsedPct} to={to.summary.portfolioRiskUsedPct} good="down" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DiffList title="Position Changes" added={newPositions} removed={removedPositions} accent="#f59e0b" />
        <DiffList title="Trades-to-Avoid Changes" added={newAvoid} removed={removedAvoid} accent="#f87171" />
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import {
  useGetValueUniverse,
  useGetValueHistory,
  useGetValueWatchlist,
  useAddValueWatchlist,
  useDeleteValueWatchlist,
  useGetSettings,
  getValueUniverse,
  getGetValueUniverseQueryKey,
  getGetValueWatchlistQueryKey,
  getGetValueHistoryQueryKey,
  ValueResearchReport,
  ValueResearchInputLevel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "@/hooks/use-toast";
import { streamCoach } from "@/lib/coach-stream";
import {
  Search,
  TrendingUp,
  ShieldCheck,
  Landmark,
  Scale,
  Gauge,
  AlertTriangle,
  Star,
  Trash2,
  History as HistoryIcon,
  BookText,
  Bot,
  Building2,
  RefreshCw,
} from "lucide-react";

type Level = ValueResearchInputLevel;

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

// Relative-time label for when live data was last fetched (e.g. "just now",
// "3 min ago"), falling back to an absolute timestamp for older data.
function fmtFetchedAt(iso: string): string {
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

// Live fundamentals older than the operator-configured threshold (hours) are
// considered stale: the UI actively nudges a refresh instead of just showing
// the timestamp. Simulated data has no freshness concept and is never flagged.
// Falls back to 24h when unset.
const DEFAULT_STALENESS_HOURS = 24;

function isStale(iso: string, stalenessHours: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > stalenessHours * 60 * 60 * 1000;
}

// Hard floor between automatic universe refreshes: even if live data somehow stays
// stale across a refresh, the auto-refresh watcher won't re-fetch more often than
// this, so it can never spam the provider's rate-limited API.
const AUTO_REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "LONG-TERM BUY":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
    case "BUY ONLY ON PULLBACK":
      return "bg-sky-500/15 text-sky-400 border-sky-500/40";
    case "HOLD":
      return "bg-slate-500/15 text-slate-300 border-slate-500/40";
    case "WATCHLIST":
      return "bg-amber-500/15 text-amber-400 border-amber-500/40";
    case "TRIM":
      return "bg-orange-500/15 text-orange-400 border-orange-500/40";
    case "AVOID":
      return "bg-rose-500/15 text-rose-400 border-rose-500/40";
    default:
      return "bg-secondary text-foreground border-border";
  }
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone =
    pct >= 75 ? "bg-emerald-500" : pct >= 55 ? "bg-sky-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FactorList({ factors }: { factors: { label: string; score: number; detail: string }[] }) {
  return (
    <div className="space-y-3">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-foreground/90 font-medium">{f.label}</span>
            <span className="font-mono text-muted-foreground">{Math.round(f.score)}</span>
          </div>
          <ScoreBar score={f.score} />
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{f.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportView({
  report,
  commentary,
  isStreaming,
  onRefresh,
  refreshing,
}: {
  report: ValueResearchReport;
  commentary: string;
  isStreaming: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const v = report.valuation;
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{report.symbol}</h2>
            <span className="text-sm text-muted-foreground">{report.name}</span>
            <Badge variant="outline" className="text-[10px] uppercase border-border">
              {report.kind}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {fmtUsd(report.price)} · as of {new Date(report.asOf).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={`text-xs font-semibold ${verdictColor(report.decision.verdict)}`}>
            {report.decision.verdict}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            Conviction {Math.round(report.decision.conviction)}/100
          </span>
        </div>
      </div>

      {/* SIMULATED / LIVE + data source + freshness + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {report.simulated ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
            Simulated
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-success/15 text-success border-success/30">
            Live
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground">Data source: {report.dataSource}</span>
        {!report.simulated && (
          <span className="text-[11px] text-muted-foreground">· Fetched {fmtFetchedAt(report.fetchedAt)}</span>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 ml-auto text-[11px] gap-1.5"
            onClick={onRefresh}
            disabled={refreshing || isStreaming}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      </div>

      {/* Live unavailable / rate-limit fallback banner */}
      {report.fallback && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-snug">{report.fallback.message}</p>
        </div>
      )}

      {/* Pillar cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Business Quality
              <Badge variant="outline" className="ml-auto text-[10px] border-border">
                {report.businessQuality.rating}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar score={report.businessQuality.score} />
            <p className="text-xs text-muted-foreground">{report.businessQuality.summary}</p>
            <FactorList factors={report.businessQuality.factors} />
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Economic Moat
              <Badge variant="outline" className="ml-auto text-[10px] border-border">
                {report.moat.rating}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar score={report.moat.score} />
            <p className="text-xs text-muted-foreground">{report.moat.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {report.moat.sources.map((s) => (
                <Badge key={s.source} variant="outline" className="text-[10px] border-border">
                  {s.source} · {Math.round(s.strength)}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Estimated durability: ~{report.moat.durabilityYears} yrs
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-400" /> Financial Strength
              <Badge variant="outline" className="ml-auto text-[10px] border-border">
                {report.financialStrength.rating}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar score={report.financialStrength.score} />
            <p className="text-xs text-muted-foreground">{report.financialStrength.summary}</p>
            <FactorList factors={report.financialStrength.metrics} />
            {report.financialStrength.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {report.financialStrength.flags.map((f) => (
                  <Badge key={f} variant="outline" className="text-[10px] border-rose-500/30 text-rose-400 bg-rose-500/10">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" /> Valuation &amp; Margin of Safety
              {v.available && v.rating && (
                <Badge variant="outline" className="ml-auto text-[10px] border-border">
                  {v.rating}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {v.available ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Price</div>
                    <div className="font-mono text-foreground">{fmtUsd(v.price)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Fair value (est.)</div>
                    <div className="font-mono text-foreground">
                      {v.fairValue != null ? fmtUsd(v.fairValue) : "—"}
                      {v.fairValueLow != null && v.fairValueHigh != null && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({fmtUsd(v.fairValueLow)}–{fmtUsd(v.fairValueHigh)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin of safety</div>
                    <div
                      className={`font-mono ${
                        (v.marginOfSafety ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {v.marginOfSafety != null ? `${(v.marginOfSafety * 100).toFixed(1)}%` : "—"}
                      {v.marginOfSafetyLabel && (
                        <span className="text-[10px] text-muted-foreground ml-1">({v.marginOfSafetyLabel})</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{v.summary}</p>
                {v.methods && v.methods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {v.methods.map((m) => (
                      <div key={m.method} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{m.method}</span>
                        <span className="font-mono text-foreground/90">{fmtUsd(m.fairValue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fair value unavailable
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{v.reason ?? v.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Decision + Stock vs Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-400" /> Value Investor Verdict
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="outline" className={`text-xs font-semibold ${verdictColor(report.decision.verdict)}`}>
              {report.decision.verdict}
            </Badge>
            <p className="text-xs text-muted-foreground">{report.decision.summary}</p>
            <ul className="space-y-1 pt-1">
              {report.decision.rationale.map((r, i) => (
                <li key={i} className="text-[11px] text-foreground/80 flex gap-2">
                  <span className="text-indigo-400">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" /> Stock vs. Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="outline" className="text-xs border-border">
              {report.stockVsOptions.verdict}
            </Badge>
            {report.stockVsOptions.ivRank != null && (
              <p className="text-[11px] text-muted-foreground">IV rank: {Math.round(report.stockVsOptions.ivRank)}</p>
            )}
            <p className="text-xs text-muted-foreground">{report.stockVsOptions.summary}</p>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <div className="rounded-md border border-border bg-background/50 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Stock case</div>
                <p className="text-[11px] text-foreground/80">{report.stockVsOptions.stockCase}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Options case</div>
                <p className="text-[11px] text-foreground/80">{report.stockVsOptions.optionsCase}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI thesis */}
      <Card className="bg-card/60 border-indigo-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" /> AI Research Thesis
            {isStreaming && <span className="text-[10px] text-muted-foreground">generating…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commentary ? (
            <div className="text-sm leading-relaxed">
              <Markdown className="text-sm inline">{commentary}</Markdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-indigo-400 animate-pulse" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 py-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0.4s" }} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key metrics + risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {report.keyMetrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between text-xs border-b border-border/40 pb-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-mono text-foreground/90">{m.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Risk Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.risks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No material risk flags detected.</p>
            ) : (
              report.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <Badge
                    variant="outline"
                    className={`text-[9px] shrink-0 ${
                      r.severity === "high"
                        ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                        : r.severity === "medium"
                          ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {r.severity}
                  </Badge>
                  <span className="text-foreground/80">{r.text}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Narrative sections */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookText className="w-4 h-4 text-indigo-400" /> Full Research Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.sections.map((s) => (
            <div key={s.id}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">{s.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="text-[11px] text-foreground/80 flex gap-2">
                      <span className="text-indigo-400">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/80 border-t border-border pt-3">{report.disclaimer}</p>
    </div>
  );
}

export default function StockResearch() {
  const { data: universe, isLoading: universeLoading } = useGetValueUniverse();
  const { data: watchlist } = useGetValueWatchlist();
  const { data: settings } = useGetSettings();
  const fundamentalsLive = settings?.fundamentalsConnected ?? false;
  const stalenessHours = settings?.fundamentalsStalenessHours ?? DEFAULT_STALENESS_HOURS;
  const { data: history } = useGetValueHistory();
  const addWatchlist = useAddValueWatchlist();
  const deleteWatchlist = useDeleteValueWatchlist();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>(ValueResearchInputLevel.beginner);
  const [report, setReport] = useState<ValueResearchReport | null>(null);
  const [commentary, setCommentary] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [universeRefreshing, setUniverseRefreshing] = useState(false);
  const [tab, setTab] = useState("research");
  const abortRef = useRef<AbortController | null>(null);
  const search = useSearch();

  // Auto-refresh bookkeeping: the fetchedAt batch we've already auto-refreshed
  // against (so the same stale data isn't re-fetched repeatedly) and the wall-clock
  // time of the last auto-refresh (a hard cooldown floor so we never spam the
  // provider even if staleness somehow persists across a refresh).
  const autoRefreshedForRef = useRef<string | null>(null);
  const lastAutoRefreshAtRef = useRef<number>(0);
  // Periodic re-render so a long-open page eventually re-evaluates staleness even
  // when no query data changes (staleness is purely a function of elapsed time).
  const [, setStaleTick] = useState(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runResearch = useCallback(
    (symbol: string, persist: boolean, forceRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSelected(symbol);
      setTab("research");
      if (!forceRefresh) setReport(null);
      setCommentary("");
      setIsStreaming(true);
      if (forceRefresh) setRefreshing(true);

      streamCoach(
        "/stock-analyst/value-research/stream",
        { symbol, persist, level, forceRefresh },
        {
          onMeta: (data) => {
            const d = data as { report?: ValueResearchReport };
            if (d.report) setReport(d.report);
          },
          onDelta: (text) => setCommentary((prev) => prev + text),
          onDone: (data) => {
            const d = data as { commentary?: string; historyId?: number };
            if (d.commentary) setCommentary(d.commentary);
            setIsStreaming(false);
            setRefreshing(false);
            if (persist) {
              queryClient.invalidateQueries({ queryKey: getGetValueHistoryQueryKey() });
            }
          },
          onError: (msg) => {
            setIsStreaming(false);
            setRefreshing(false);
            toast({ title: "Research failed", description: msg, variant: "destructive" });
          },
        },
        controller.signal,
      ).catch(() => {
        setIsStreaming(false);
        setRefreshing(false);
      });
    },
    [level, queryClient, toast],
  );

  // Force-refresh the coverage universe by bypassing the live fundamentals cache
  // (reuses the server's forceRefresh path). No-op for simulated data. `auto` is
  // set when the refresh was triggered automatically by the staleness watcher —
  // it uses a quieter toast and stays silent on failure (the stale badge already
  // signals the problem and a noisy auto-toast would be confusing).
  const refreshUniverse = useCallback(
    async (auto = false) => {
      setUniverseRefreshing(true);
      try {
        const data = await getValueUniverse({ forceRefresh: true });
        queryClient.setQueryData(getGetValueUniverseQueryKey(), data);
        toast({ title: auto ? "Live fundamentals auto-refreshed" : "Coverage universe refreshed" });
      } catch {
        if (!auto) toast({ title: "Refresh failed", variant: "destructive" });
      } finally {
        setUniverseRefreshing(false);
      }
    },
    [queryClient, toast],
  );

  // Auto-run research when arriving with a ?symbol= query param (e.g. the Stock
  // Scanner's "Research This Stock" deep-link). Runs once per symbol value.
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sym = params.get("symbol");
    if (sym && autoRanRef.current !== sym) {
      autoRanRef.current = sym;
      runResearch(sym, false);
    }
  }, [search, runResearch]);

  const handleAddWatchlist = (symbol: string) => {
    addWatchlist.mutate(
      { data: { symbol } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetValueWatchlistQueryKey() });
          toast({ title: `${symbol} added to watchlist` });
        },
        onError: () => toast({ title: "Failed to add to watchlist", variant: "destructive" }),
      },
    );
  };

  const handleRemoveWatchlist = (id: number, symbol: string) => {
    deleteWatchlist.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetValueWatchlistQueryKey() });
          toast({ title: `${symbol} removed from watchlist` });
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      },
    );
  };

  const watchedSymbols = new Set((watchlist ?? []).map((w) => w.symbol));

  // Most recent live fetch across the universe (live data only), for the
  // sidebar's "is this current?" freshness indicator.
  const liveUniverse = (universe ?? []).filter((u) => !u.simulated);
  const universeFetchedAt =
    liveUniverse.length > 0
      ? liveUniverse.reduce((latest, u) => (u.fetchedAt > latest ? u.fetchedAt : latest), liveUniverse[0].fetchedAt)
      : null;
  const universeStale = universeFetchedAt ? isStale(universeFetchedAt, stalenessHours) : false;
  const autoRefreshEnabled = settings?.fundamentalsAutoRefresh ?? true;

  // Keep re-evaluating staleness on a fixed cadence while auto-refresh is armed,
  // so a page left open eventually notices live data has aged past the threshold
  // (staleness depends only on elapsed time, not on any query refetch).
  useEffect(() => {
    if (!fundamentalsLive || !autoRefreshEnabled) return;
    const id = setInterval(() => setStaleTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [fundamentalsLive, autoRefreshEnabled]);

  // Auto-refresh watcher: when live fundamentals are connected, auto-refresh is on,
  // and the universe has crossed the staleness threshold, re-fetch it once per stale
  // batch. Guards prevent spamming the provider: we skip if a refresh is already in
  // flight, if we've already auto-refreshed this exact fetchedAt batch, or if the
  // hard cooldown hasn't elapsed. Simulated data never reaches here (no live rows →
  // universeFetchedAt is null → not stale).
  useEffect(() => {
    if (!fundamentalsLive || !autoRefreshEnabled) return;
    if (!universeStale || !universeFetchedAt) return;
    if (universeRefreshing) return;
    if (autoRefreshedForRef.current === universeFetchedAt) return;
    if (Date.now() - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) return;
    autoRefreshedForRef.current = universeFetchedAt;
    lastAutoRefreshAtRef.current = Date.now();
    void refreshUniverse(true);
  }, [
    fundamentalsLive,
    autoRefreshEnabled,
    universeStale,
    universeFetchedAt,
    universeRefreshing,
    refreshUniverse,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" /> Value Research
            {fundamentalsLive ? (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-success/15 text-success border-success/30">
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
                Simulated
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Long-term, business-first research in the spirit of value investing. Education &amp; advisory only —
            this tool never places trades and never claims to be any specific investor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Depth</span>
          <ToggleGroup
            type="single"
            value={level}
            onValueChange={(v) => v && setLevel(v as Level)}
            className="border border-border rounded-md bg-background"
          >
            <ToggleGroupItem value={ValueResearchInputLevel.beginner} className="h-8 px-3 text-xs data-[state=on]:bg-indigo-500/20 data-[state=on]:text-indigo-400">
              Beginner
            </ToggleGroupItem>
            <ToggleGroupItem value={ValueResearchInputLevel.advanced} className="h-8 px-3 text-xs data-[state=on]:bg-indigo-500/20 data-[state=on]:text-indigo-400">
              Advanced
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Universe sidebar */}
        <Card className="bg-card border-border h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" /> Coverage Universe
              </CardTitle>
              {fundamentalsLive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
                  onClick={() => refreshUniverse()}
                  disabled={universeRefreshing}
                  title="Refresh live fundamentals"
                  data-testid="refresh-universe"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${universeRefreshing ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>
            <CardDescription className="text-[11px]">
              Click a name to run research.
              {fundamentalsLive && universeFetchedAt && (
                universeStale ? (
                  <span
                    className="mt-0.5 flex items-center gap-1 font-medium text-amber-400"
                    data-testid="universe-stale"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Stale — refresh recommended (updated {fmtFetchedAt(universeFetchedAt)})
                  </span>
                ) : (
                  <span className="block mt-0.5 text-success/80">Live · updated {fmtFetchedAt(universeFetchedAt)}</span>
                )
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[520px] pr-2">
              {universeLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {(universe ?? []).map((u) => (
                    <button
                      key={u.symbol}
                      onClick={() => runResearch(u.symbol, true)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        selected === u.symbol
                          ? "border-indigo-500/40 bg-indigo-500/10"
                          : "border-border/60 bg-background/40 hover:border-indigo-500/30"
                      }`}
                      data-testid={`universe-${u.symbol}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{u.symbol}</span>
                        <Badge variant="outline" className={`text-[9px] ${verdictColor(u.decision)}`}>
                          {u.decision}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{u.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>{u.moatRating} moat</span>
                        <span>·</span>
                        <span>{u.valuationRating}</span>
                        {!u.simulated && (
                          <span
                            className={`ml-auto ${isStale(u.fetchedAt, stalenessHours) ? "text-amber-400" : "text-success/70"}`}
                            title={isStale(u.fetchedAt, stalenessHours) ? "Live data is stale — refresh recommended" : "Live data fetched"}
                          >
                            {fmtFetchedAt(u.fetchedAt)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main panel */}
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="research" className="text-xs">
                Research
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="text-xs">
                Watchlist {watchlist && watchlist.length > 0 ? `(${watchlist.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="mt-4">
              {!selected ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20 text-indigo-400" />
                    <p className="text-foreground/80 font-medium">Select a company to begin research.</p>
                    <p className="text-sm mt-1">
                      Every report is SIMULATED and deterministic — for learning, not live trading.
                    </p>
                  </CardContent>
                </Card>
              ) : !report ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={watchedSymbols.has(report.symbol) || addWatchlist.isPending}
                      onClick={() => handleAddWatchlist(report.symbol)}
                      className="h-8 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                    >
                      <Star className="w-3.5 h-3.5 mr-1.5" />
                      {watchedSymbols.has(report.symbol) ? "On watchlist" : "Add to watchlist"}
                    </Button>
                  </div>
                  <ReportView
                    report={report}
                    commentary={commentary}
                    isStreaming={isStreaming}
                    onRefresh={() => runResearch(report.symbol, false, true)}
                    refreshing={refreshing}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="watchlist" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="w-4 h-4 text-indigo-400" /> Value Watchlist
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Names you are tracking for a future margin of safety.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!watchlist || watchlist.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No names yet. Research a company and add it to your watchlist.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {watchlist.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => runResearch(w.symbol, false)}
                                className="text-sm font-semibold text-foreground hover:text-indigo-400"
                              >
                                {w.symbol}
                              </button>
                              <Badge variant="outline" className="text-[9px] border-border">
                                {w.category}
                              </Badge>
                              {w.currentDecision && (
                                <Badge variant="outline" className={`text-[9px] ${verdictColor(w.currentDecision)}`}>
                                  {w.currentDecision}
                                </Badge>
                              )}
                            </div>
                            {w.reason && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{w.reason}</p>
                            )}
                            {w.lastResearchedAt && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                Researched {fmtFetchedAt(w.lastResearchedAt)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            onClick={() => handleRemoveWatchlist(w.id, w.symbol)}
                            data-testid={`remove-watchlist-${w.symbol}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-indigo-400" /> Research History
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Saved snapshots of prior research runs (SIMULATED).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!history || history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No research saved yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left font-medium py-2 pr-3">Symbol</th>
                            <th className="text-left font-medium py-2 pr-3">Date</th>
                            <th className="text-left font-medium py-2 pr-3">Moat</th>
                            <th className="text-left font-medium py-2 pr-3">Valuation</th>
                            <th className="text-left font-medium py-2 pr-3">MoS</th>
                            <th className="text-left font-medium py-2">Decision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.id} className="border-b border-border/40">
                              <td className="py-2 pr-3">
                                <button
                                  onClick={() => runResearch(h.symbol, false)}
                                  className="font-semibold text-foreground hover:text-indigo-400"
                                >
                                  {h.symbol}
                                </button>
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground">
                                {new Date(h.analysisDate).toLocaleDateString()}
                              </td>
                              <td className="py-2 pr-3 text-foreground/80">{h.moatRating}</td>
                              <td className="py-2 pr-3 text-foreground/80">{h.valuationRating}</td>
                              <td className="py-2 pr-3 font-mono text-foreground/80">{h.marginOfSafety}</td>
                              <td className="py-2">
                                <Badge variant="outline" className={`text-[9px] ${verdictColor(h.valueInvestorDecision)}`}>
                                  {h.valueInvestorDecision}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

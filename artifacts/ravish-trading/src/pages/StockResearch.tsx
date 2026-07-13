import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import {
  useGetValueUniverse,
  useGetValueHistory,
  useGetValueWatchlist,
  useAddValueWatchlist,
  useDeleteValueWatchlist,
  useGetSettings,
  useGetFinancialStatements,
  getValueUniverse,
  getGetValueUniverseQueryKey,
  getGetValueWatchlistQueryKey,
  getGetValueHistoryQueryKey,
  getGetFinancialStatementsQueryKey,
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
  Calculator,
  LineChart as LineChartIcon,
  Briefcase,
  ListChecks,
  Compass,
  Users,
  Percent,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Level = ValueResearchInputLevel;

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

// Compact formatter for absolute statement figures (billions/millions), used by
// the Financial Statements tab (Phase 2, Sprint 19) — statement line items are
// far larger in magnitude than every other per-share/ratio figure in this file.
const fmtCompactUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

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

function RatioMetricRow({ metric }: { metric: { label: string; displayValue: string; available: boolean; reason?: string } }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{metric.label}</span>
      {metric.available ? (
        <span className="font-mono text-foreground/90">{metric.displayValue}</span>
      ) : (
        <span className="text-muted-foreground/60 italic" title={metric.reason}>
          unavailable
        </span>
      )}
    </div>
  );
}

// Reuses the same recharts LineChart pattern already established in
// Backtest.tsx for the equity curve — same styling, just a small sparkline
// over Fundamentals' own 6-year history array (no new data, pass-through).
function RatioTrendChart({ label, history }: { label: string; history: number[] }) {
  const data = history.map((value, i) => ({ year: i - (history.length - 1), value }));
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <div className="h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => (v === 0 ? "Now" : `${v}y`)} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={36} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--primary))" }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  const g = report.grahamValuation;
  const d = report.dcfValuation;
  const b = report.buffettValuation;
  const c = report.consolidatedMarginOfSafety;
  const iq = report.investmentQuality;
  const tn = report.tomNash;
  const ic = report.investmentCommittee;
  const fr = report.financialRatios;
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

      {/* Consolidated Margin of Safety — sits above the per-model valuation
          cards, giving an at-a-glance rollup before the detailed breakdowns. */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-400" /> Margin of Safety (Consolidated)
            <Badge variant="outline" className="ml-auto text-[10px] border-border capitalize">
              {c.agreement.replace(/-/g, " ")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Models available</div>
              <div className="font-mono text-foreground">
                {c.modelsAvailable} / {c.modelsConsidered}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Fair value range</div>
              <div className="font-mono text-foreground">
                {c.minFairValue != null && c.maxFairValue != null
                  ? `${fmtUsd(c.minFairValue)} – ${fmtUsd(c.maxFairValue)}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Average fair value</div>
              <div className="font-mono text-foreground">
                {c.averageFairValue != null ? fmtUsd(c.averageFairValue) : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Average margin of safety</div>
              <div
                className={`font-mono ${
                  (c.averageMarginOfSafety ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {c.averageMarginOfSafety != null ? `${(c.averageMarginOfSafety * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{c.summary}</p>
          {c.fairValues.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {c.fairValues.map((mv) => (
                <div key={mv.model} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{mv.model}</span>
                  <span className="font-mono text-foreground/90">{fmtUsd(mv.fairValue)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <ListChecks className="w-4 h-4 text-indigo-400" /> Investment Quality
              <Badge variant="outline" className="ml-auto text-[10px] border-border">
                {iq.confidenceLevel} confidence
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {iq.score != null && <ScoreBar score={iq.score} />}
            <p className="text-xs text-muted-foreground">{iq.summary}</p>
            <div className="space-y-3">
              {iq.metrics.map((m) => (
                <div key={m.metric}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground/90 font-medium">{m.metric}</span>
                    <span className="font-mono text-muted-foreground">
                      {m.availability === "available" ? Math.round(m.score ?? 0) : "N/A"}
                    </span>
                  </div>
                  {m.availability === "available" ? (
                    <>
                      <ScoreBar score={m.score ?? 0} />
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{m.detail}</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/70 italic leading-snug">{m.reason}</p>
                  )}
                </div>
              ))}
            </div>
            {iq.strengths.length > 0 && (
              <div className="pt-1">
                <p className="text-[11px] font-medium text-emerald-400 mb-1">Strengths</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  {iq.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {iq.weaknesses.length > 0 && (
              <div className="pt-1">
                <p className="text-[11px] font-medium text-rose-400 mb-1">Weaknesses</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  {iq.weaknesses.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
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
              <Percent className="w-4 h-4 text-indigo-400" /> Financial Ratios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{fr.summary}</p>
            <div>
              <p className="text-[11px] font-medium text-foreground/80 mb-1.5">Valuation</p>
              <div className="space-y-1">
                {fr.valuation.map((m) => (
                  <RatioMetricRow key={m.label} metric={m} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground/80 mb-1.5">Profitability</p>
              <div className="space-y-1">
                {fr.profitability.map((m) => (
                  <RatioMetricRow key={m.label} metric={m} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground/80 mb-1.5">Liquidity &amp; Leverage</p>
              <div className="space-y-1">
                {fr.liquidityAndLeverage.map((m) => (
                  <RatioMetricRow key={m.label} metric={m} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-1">
              {fr.trends.map((t) => (
                <RatioTrendChart key={t.label} label={t.label} history={t.history} />
              ))}
            </div>
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

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-400" /> Graham Valuation
              {g.available && g.rating && (
                <Badge variant="outline" className="ml-auto text-[10px] border-border">
                  {g.rating}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.available ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Price</div>
                    <div className="font-mono text-foreground">{fmtUsd(g.price)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Fair value (Graham)</div>
                    <div className="font-mono text-foreground">
                      {g.fairValue != null ? fmtUsd(g.fairValue) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin of safety</div>
                    <div
                      className={`font-mono ${
                        (g.marginOfSafety ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {g.marginOfSafety != null ? `${(g.marginOfSafety * 100).toFixed(1)}%` : "—"}
                      {g.marginOfSafetyLabel && (
                        <span className="text-[10px] text-muted-foreground ml-1">({g.marginOfSafetyLabel})</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{g.summary}</p>
                {g.methods && g.methods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {g.methods.map((m) => (
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
                  <AlertTriangle className="w-3.5 h-3.5" /> Graham fair value unavailable
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{g.reason ?? g.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-indigo-400" /> DCF Valuation
              {d.available && d.rating && (
                <Badge variant="outline" className="ml-auto text-[10px] border-border">
                  {d.rating}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.available ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Intrinsic value</div>
                    <div className="font-mono text-foreground">
                      {d.fairValue != null ? fmtUsd(d.fairValue) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin of safety</div>
                    <div
                      className={`font-mono ${
                        (d.marginOfSafety ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {d.marginOfSafety != null ? `${(d.marginOfSafety * 100).toFixed(1)}%` : "—"}
                      {d.marginOfSafetyLabel && (
                        <span className="text-[10px] text-muted-foreground ml-1">({d.marginOfSafetyLabel})</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Discount rate</div>
                    <div className="font-mono text-foreground">{(d.discountRate * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Terminal growth rate</div>
                    <div className="font-mono text-foreground">{(d.terminalGrowthRate * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{d.summary}</p>
                {d.methods && d.methods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {d.methods.map((m) => (
                      <div key={m.method} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{m.method}</span>
                        <span className="font-mono text-foreground/90">{fmtUsd(m.fairValue)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {d.confidenceExplanation && (
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                      {d.confidenceLabel} confidence
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{d.confidenceExplanation}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> DCF fair value unavailable
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{d.reason ?? d.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" /> Buffett Valuation
              {b.available && b.rating && (
                <Badge variant="outline" className="ml-auto text-[10px] border-border">
                  {b.rating}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {b.available ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Fair value (Buffett)</div>
                    <div className="font-mono text-foreground">
                      {b.fairValue != null ? fmtUsd(b.fairValue) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Required return</div>
                    <div className="font-mono text-foreground">{(b.requiredReturn * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margin of safety</div>
                    <div
                      className={`font-mono ${
                        (b.marginOfSafety ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {b.marginOfSafety != null ? `${(b.marginOfSafety * 100).toFixed(1)}%` : "—"}
                      {b.marginOfSafetyLabel && (
                        <span className="text-[10px] text-muted-foreground ml-1">({b.marginOfSafetyLabel})</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{b.summary}</p>
                {b.methods && b.methods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {b.methods.map((m) => (
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
                  <AlertTriangle className="w-3.5 h-3.5" /> Buffett fair value unavailable
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{b.reason ?? b.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tom Nash Analysis — a composition layer over the pillar cards above,
          not another single-model card, so it sits full-width between the
          pillar grid and the final Decision/Stock-vs-Options row. */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400" /> Tom Nash Analysis
            <Badge variant="outline" className="ml-auto text-[10px] border-border">
              {tn.verdict}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScoreBar score={tn.convictionScore} />
          <p className="text-xs text-muted-foreground">{tn.summary}</p>
          <FactorList
            factors={[tn.businessQuality, tn.growth, tn.capitalAllocation, tn.financialStrength, tn.valuation].map((p) => ({
              label: p.label,
              score: p.score ?? 0,
              detail: p.detail,
            }))}
          />
          <ul className="space-y-1 pt-1">
            {tn.rationale.map((r, i) => (
              <li key={i} className="text-[11px] text-foreground/80 flex gap-2">
                <span className="text-indigo-400">•</span>
                {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Investment Committee — orchestrates Graham/Buffett/Tom Nash's own
          verdicts into one consolidated recommendation; deterministic
          reasoning only this sprint, no LLM narration. */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> Investment Committee
            <Badge variant="outline" className="ml-auto text-[10px] border-border">
              {ic.consolidatedVerdict}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border capitalize">
              {ic.agreement.replace(/-/g, " ")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScoreBar score={ic.confidenceScore} />
          <p className="text-xs text-muted-foreground">{ic.summary}</p>
          <div className="space-y-1.5 pt-1">
            {ic.votes.map((vote) => (
              <div key={vote.analyst} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{vote.analyst}</span>
                <span className="font-mono text-foreground/90">
                  {vote.verdict} ({Math.round(vote.confidence)})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

  // Phase 2, Sprint 19 — fetched only when the Statements tab is actually opened
  // for a selected symbol, never as a side effect of loading the main report.
  const {
    data: statements,
    isLoading: statementsLoading,
    isError: statementsError,
  } = useGetFinancialStatements(report?.symbol ?? "", {
    query: {
      queryKey: getGetFinancialStatementsQueryKey(report?.symbol ?? ""),
      enabled: tab === "statements" && !!report?.symbol,
    },
  });
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
              <TabsTrigger value="statements" className="text-xs" disabled={!report}>
                Statements
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

            <TabsContent value="statements" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookText className="w-4 h-4 text-indigo-400" /> Financial Statements
                    {statements && (
                      <Badge variant="outline" className="ml-auto text-[10px] border-border">
                        {statements.dataSource}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    {report ? `Five-year annual statements for ${report.symbol}, fetched on demand.` : "Select a company to view its statements."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!report ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Select a company to begin research first.</p>
                  ) : statementsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : statementsError || !statements ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Financial statements are unavailable for {report.symbol}.
                    </p>
                  ) : (
                    <Tabs defaultValue="income">
                      <TabsList className="bg-secondary">
                        <TabsTrigger value="income" className="text-xs">Income Statement</TabsTrigger>
                        <TabsTrigger value="balance" className="text-xs">Balance Sheet</TabsTrigger>
                        <TabsTrigger value="cashflow" className="text-xs">Cash Flow</TabsTrigger>
                      </TabsList>

                      <TabsContent value="income" className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Year</th>
                              <th className="text-right font-medium py-2 pr-3">Revenue</th>
                              <th className="text-right font-medium py-2 pr-3">Cost of Revenue</th>
                              <th className="text-right font-medium py-2 pr-3">Gross Profit</th>
                              <th className="text-right font-medium py-2 pr-3">Operating Income</th>
                              <th className="text-right font-medium py-2">Net Income</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statements.incomeStatement.map((y) => (
                              <tr key={y.year} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{y.year}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.revenue)}</td>
                                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{fmtCompactUsd(y.costOfRevenue)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.grossProfit)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.operatingIncome)}</td>
                                <td className="py-2 text-right font-mono">{fmtCompactUsd(y.netIncome)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TabsContent>

                      <TabsContent value="balance" className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Year</th>
                              <th className="text-right font-medium py-2 pr-3">Total Assets</th>
                              <th className="text-right font-medium py-2 pr-3">Total Liabilities</th>
                              <th className="text-right font-medium py-2 pr-3">Total Equity</th>
                              <th className="text-right font-medium py-2 pr-3">Current Assets</th>
                              <th className="text-right font-medium py-2">Current Liabilities</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statements.balanceSheet.map((y) => (
                              <tr key={y.year} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{y.year}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.totalAssets)}</td>
                                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{fmtCompactUsd(y.totalLiabilities)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.totalEquity)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.currentAssets)}</td>
                                <td className="py-2 text-right font-mono">{fmtCompactUsd(y.currentLiabilities)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TabsContent>

                      <TabsContent value="cashflow" className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Year</th>
                              <th className="text-right font-medium py-2 pr-3">Operating CF</th>
                              <th className="text-right font-medium py-2 pr-3">Capex</th>
                              <th className="text-right font-medium py-2 pr-3">Free Cash Flow</th>
                              <th className="text-right font-medium py-2 pr-3">Investing CF</th>
                              <th className="text-right font-medium py-2">Financing CF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statements.cashFlow.map((y) => (
                              <tr key={y.year} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{y.year}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.operatingCashFlow)}</td>
                                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{fmtCompactUsd(y.capitalExpenditures)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.freeCashFlow)}</td>
                                <td className="py-2 pr-3 text-right font-mono">{fmtCompactUsd(y.investingCashFlow)}</td>
                                <td className="py-2 text-right font-mono">{fmtCompactUsd(y.financingCashFlow)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TabsContent>
                    </Tabs>
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

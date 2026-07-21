// Phase 38 — Institutional Performance & Attribution Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/performanceAttribution.ts). This page introduces no new
// signal, score, prediction, or trading logic of its own — it is
// analytical only. No AI predictions, no forecasts, no trade
// recommendations, no portfolio optimisation, no auto rebalancing, no auto
// execution, no alpha generation, no benchmark prediction.
//
// Every figure is a direct read from:
//   - GET /performance-attribution/dashboard — the Investing/Trading/
//     Options/Combined performance views (Performance Dashboard, Return
//     Attribution, Strategy Attribution, Sector Attribution, Asset
//     Attribution, Income Attribution, Risk-adjusted Performance,
//     Historical Performance Timeline, Capital Efficiency, Performance
//     Breakdown)
//   - GET /performance-attribution/coach     — the deterministic AI Coach
//   - GET /performance-attribution/learning  — Learning Centre integration
//   - GET /reporting/performance-summary,
//     GET /reporting/performance-attribution-report — Reporting Centre links

import { useState } from "react";
import { Link } from "wouter";
import { useGetPerformanceDashboard, useListPerformanceAttributionCoachTopics, useListPerformanceAttributionLearning } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, GraduationCap, FileBarChart2 } from "lucide-react";

type PerformanceView = "investing" | "trading" | "options" | "combined";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function PerformanceAttributionEngine() {
  const [tab, setTab] = useState<string>("dashboard");
  const [view, setView] = useState<PerformanceView>("combined");

  const dashboardQuery = useGetPerformanceDashboard();
  const coachQuery = useListPerformanceAttributionCoachTopics();
  const learningQuery = useListPerformanceAttributionLearning();

  const dashboard = dashboardQuery.data;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="performance-attribution-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <LineChart className="w-6 h-6 text-emerald-400" /> Institutional Performance & Attribution Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A deterministic Performance & Attribution Engine explaining portfolio and strategy performance already
          realized across Investing, Trading, and Options. Analytical only — no AI predictions, no forecasts, no
          trade recommendations, no portfolio optimisation, no auto rebalancing, no auto execution, no alpha
          generation, no benchmark prediction.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="performance-attribution-engine-labels">
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
            Cross-Engine Performance
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Display Only — No Recommendations
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-pae-dashboard">
            <LineChart className="w-4 h-4 mr-1" /> Performance Dashboard
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-pae-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-pae-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Performance Dashboard ──────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-pae-view-selector">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance View</CardTitle>
              <CardDescription className="text-xs">Investing, Trading, Options, or the Combined cross-engine view. Display only, never a forecast.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={view} onValueChange={(v) => setView(v as PerformanceView)}>
                <SelectTrigger className="w-56" data-testid="performance-view-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined" data-testid="performance-view-option-combined">
                    Combined (Cross-Engine)
                  </SelectItem>
                  <SelectItem value="investing" data-testid="performance-view-option-investing">
                    Investing
                  </SelectItem>
                  <SelectItem value="trading" data-testid="performance-view-option-trading">
                    Trading
                  </SelectItem>
                  <SelectItem value="options" data-testid="performance-view-option-options">
                    Options
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {dashboardQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : !dashboard ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="performance-dashboard-error">
              Unable to load the Performance & Attribution dashboard.
            </p>
          ) : (
            <>
              {view === "investing" && (
                <div className="space-y-4" data-testid="panel-pae-investing">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Investing — Return Attribution</CardTitle>
                      <CardDescription className="text-xs">
                        {dashboard.investing.holdingsCount} holding(s) across {dashboard.investing.portfolioCount} portfolio(s). Unrealized P&amp;L — holdings are continuously held, not round-tripped.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid="investing-total-unrealized-pnl">
                          {fmtUsd(dashboard.investing.totalUnrealizedPnl)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{fmtPct(dashboard.investing.totalUnrealizedPnlPct)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid="investing-capital-efficiency-detail">
                        Capital Efficiency: {dashboard.investing.capitalEfficiency.detail}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="investing-risk-adjusted-detail">
                        Risk-Adjusted Performance: {dashboard.investing.riskAdjusted.available ? `Sharpe ${dashboard.investing.riskAdjusted.sharpeRatio ?? "n/a"}` : (dashboard.investing.riskAdjusted.reason ?? "unavailable")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Sector Attribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.investing.sectorAttribution.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sector attribution available yet.</p>
                      ) : (
                        dashboard.investing.sectorAttribution.map((s) => (
                          <div key={s.key} className="flex justify-between text-xs" data-testid={`investing-sector-${s.key}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">{fmtUsd(s.pnl)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Performance Breakdown — Holdings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1" data-testid="investing-holdings-breakdown">
                      {dashboard.investing.holdings.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No holdings on record yet.</p>
                      ) : (
                        dashboard.investing.holdings.map((h) => (
                          <div key={h.symbol} className="flex justify-between text-xs" data-testid={`investing-holding-${h.symbol}`}>
                            <span>{h.symbol}</span>
                            <span className="text-muted-foreground">
                              {fmtUsd(h.unrealizedPnl)} ({fmtPct(h.unrealizedPnlPct)})
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "trading" && (
                <div className="space-y-4" data-testid="panel-pae-trading">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Trading — Return Attribution</CardTitle>
                      <CardDescription className="text-xs">
                        {dashboard.trading.totalPositions} position(s) ({dashboard.trading.openPositionsCount} open, {dashboard.trading.closedPositionsCount} closed). Realized P&amp;L.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid="trading-total-realized-pnl">
                          {fmtUsd(dashboard.trading.totalRealizedPnl)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Win rate {fmtPct(dashboard.trading.winRate)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Avg win {fmtUsd(dashboard.trading.averageWin)}, avg loss {fmtUsd(dashboard.trading.averageLoss)}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="trading-capital-efficiency-detail">
                        Capital Efficiency: {dashboard.trading.capitalEfficiency.detail}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="trading-risk-adjusted-detail">
                        Risk-Adjusted Performance: {dashboard.trading.riskAdjusted.available ? `Sharpe ${dashboard.trading.riskAdjusted.sharpeRatio ?? "n/a"}, Sortino ${dashboard.trading.riskAdjusted.sortinoRatio ?? "n/a"}` : (dashboard.trading.riskAdjusted.reason ?? "unavailable")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Attribution</CardTitle>
                      <CardDescription className="text-xs">Best-effort link to the Trading Journal's own setup type — unmatched positions bucket as Unclassified.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.trading.strategyAttribution.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No strategy attribution available yet.</p>
                      ) : (
                        dashboard.trading.strategyAttribution.map((s) => (
                          <div key={s.key} className="flex justify-between text-xs" data-testid={`trading-strategy-${s.key}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">{fmtUsd(s.pnl)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Performance Breakdown — Positions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1" data-testid="trading-positions-breakdown">
                      {dashboard.trading.positions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No positions on record yet.</p>
                      ) : (
                        dashboard.trading.positions.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs" data-testid={`trading-position-${p.id}`}>
                            <span>
                              {p.symbol} ({p.status})
                            </span>
                            <span className="text-muted-foreground">{p.realizedPnl != null ? fmtUsd(p.realizedPnl) : "open"}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "options" && (
                <div className="space-y-4" data-testid="panel-pae-options">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Options — Return Attribution</CardTitle>
                      <CardDescription className="text-xs">
                        {dashboard.options.openPositionsCount} open, {dashboard.options.closedPositionsCount} closed. Realized P&amp;L.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid="options-total-realized-pnl">
                          {fmtUsd(dashboard.options.totalRealizedPnl)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Win rate {fmtPct(dashboard.options.winRate)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Total realized premium (gross credit): {fmtUsd(dashboard.options.income.totalRealizedPremium)}</p>
                      <p className="text-xs text-muted-foreground" data-testid="options-capital-efficiency-detail">
                        Capital Efficiency: {dashboard.options.capitalEfficiency.detail}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="options-risk-adjusted-detail">
                        Risk-Adjusted Performance: {dashboard.options.riskAdjusted.available ? `Sharpe ${dashboard.options.riskAdjusted.sharpeRatio ?? "n/a"}, Sortino ${dashboard.options.riskAdjusted.sortinoRatio ?? "n/a"}` : (dashboard.options.riskAdjusted.reason ?? "unavailable")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Attribution / Income Attribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1" data-testid="options-strategy-attribution">
                        {dashboard.options.strategyAttribution.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No realized strategy attribution available yet.</p>
                        ) : (
                          dashboard.options.strategyAttribution.map((s) => (
                            <div key={s.key} className="flex justify-between text-xs" data-testid={`options-strategy-${s.key}`}>
                              <span>{s.label}</span>
                              <span className="text-muted-foreground">{fmtUsd(s.pnl)}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-1" data-testid="options-income-attribution">
                        {dashboard.options.incomeAttribution.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No open positions currently generating income.</p>
                        ) : (
                          dashboard.options.incomeAttribution.map((m) => (
                            <div key={m.strategy} className="flex justify-between text-xs" data-testid={`options-income-${m.strategy}`}>
                              <span>{m.strategyLabel ?? m.strategy}</span>
                              <span className="text-muted-foreground">
                                {m.positionCount} position(s), {fmtUsd(m.capitalAllocated)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Performance Breakdown — Trades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1" data-testid="options-trades-breakdown">
                      {dashboard.options.trades.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No trades on record yet.</p>
                      ) : (
                        dashboard.options.trades.map((t) => (
                          <div key={t.id} className="flex justify-between text-xs" data-testid={`options-trade-${t.id}`}>
                            <span>
                              {t.symbol} ({t.strategy})
                            </span>
                            <span className="text-muted-foreground">{t.currentPnl != null ? fmtUsd(t.currentPnl) : "open"}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "combined" && (
                <div className="space-y-4" data-testid="panel-pae-combined">
                  <Card className="bg-card border-border" data-testid="panel-pae-by-engine">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Return by Engine</CardTitle>
                      <CardDescription className="text-xs">Never blended into one figure — Investing's unrealized P&amp;L and Trading/Options' realized P&amp;L are genuinely different measures.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.byEngine.map((e) => (
                        <div key={e.engine} className="flex justify-between text-xs" data-testid={`combined-by-engine-${e.engine}`}>
                          <span>{e.label}</span>
                          <span className="text-muted-foreground">{fmtUsd(e.totalPnl)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-sector-attribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Sector Attribution</CardTitle>
                      <CardDescription className="text-xs">Investing only — reused directly from the Investing performance view.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.sectorAttribution.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sector attribution available yet.</p>
                      ) : (
                        dashboard.combined.sectorAttribution.map((s, i) => (
                          <div key={`${s.sector}-${i}`} className="flex justify-between text-xs" data-testid={`combined-sector-${i}`}>
                            <span>
                              [{s.engine}] {s.sector}
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(s.pnl)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-strategy-attribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Attribution</CardTitle>
                      <CardDescription className="text-xs">Trading + Options, never blended into one number across engines.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.strategyAttribution.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No strategy attribution available yet.</p>
                      ) : (
                        dashboard.combined.strategyAttribution.map((s, i) => (
                          <div key={`${s.engine}-${s.key}-${i}`} className="flex justify-between text-xs" data-testid={`combined-strategy-${s.engine}-${i}`}>
                            <span>
                              [{s.engine}] {s.label}
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(s.pnl)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-asset-attribution">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Asset Attribution</CardTitle>
                      <CardDescription className="text-xs">Across all 3 engines, sorted by magnitude of P&amp;L.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.assetAttribution.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No asset attribution available yet.</p>
                      ) : (
                        dashboard.combined.assetAttribution.slice(0, 20).map((a, i) => (
                          <div key={`${a.engine}-${a.symbol}-${i}`} className="flex justify-between text-xs" data-testid={`combined-asset-${a.engine}-${i}`}>
                            <span>
                              [{a.engine}] {a.symbol}
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(a.pnl)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-capital-efficiency">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Capital Efficiency</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.capitalEfficiency.map((c) => (
                        <div key={c.engine} className="flex justify-between text-xs" data-testid={`combined-capital-efficiency-${c.engine}`}>
                          <span>{c.label}</span>
                          <span className="text-muted-foreground">{fmtPct(c.returnPct)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-risk-adjusted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Risk-Adjusted Performance</CardTitle>
                      <CardDescription className="text-xs">Trade-return-based Sharpe/Sortino, never a time-series forecast. Investing has no realized-trade-return series.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.riskAdjusted.map((r) => (
                        <div key={r.engine} className="flex justify-between text-xs" data-testid={`combined-risk-adjusted-${r.engine}`}>
                          <span>{r.engine}</span>
                          <span className="text-muted-foreground">{r.available ? `Sharpe ${r.sharpeRatio ?? "n/a"}, Sortino ${r.sortinoRatio ?? "n/a"}` : "unavailable"}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-pae-timeline">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Historical Performance Timeline</CardTitle>
                      <CardDescription className="text-xs">Real monthly realized P&amp;L (Trading/Options) and saved Investing market-value snapshots. Never fabricated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.timeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="performance-timeline-empty">
                          No historical performance data points yet.
                        </p>
                      ) : (
                        dashboard.timeline.map((p, i) => (
                          <div key={`${p.monthEnd}-${i}`} className="flex justify-between text-xs" data-testid={`performance-timeline-${i}`}>
                            <span>{p.monthEnd}</span>
                            <span className="text-muted-foreground">{p.detail}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-pae-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">Deterministic explanations of performance metrics, attribution, capital efficiency, risk-adjusted returns, and portfolio interpretation — never a trade recommendation.</CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`coach-topic-${t.topic}`}>
                      <p className="text-sm font-semibold">{t.title}</p>
                      {t.explanation.map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground mt-1">
                          {p}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-pae-learning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Learning Centre — By Topic</CardTitle>
              <CardDescription className="text-xs">Existing Learning Centre content connected to each topic. No duplicated content.</CardDescription>
            </CardHeader>
            <CardContent>
              {learningQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3" data-testid="learning-by-topic">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.topic} data-testid={`learning-topic-${bundle.topic}`}>
                      <p className="text-xs font-semibold">{bundle.topic.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`learning-link-${l.pathKey}-${l.topicKey}`}>
                              {l.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reporting ───────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-pae-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance Reporting</CardTitle>
              <CardDescription className="text-xs">Performance Summary and Performance Attribution Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=performance-summary" className="text-xs text-primary hover:underline block" data-testid="link-report-performance-summary">
                Generate Performance Summary →
              </Link>
              <Link href="/reporting-centre?reportType=performance-attribution-report" className="text-xs text-primary hover:underline block" data-testid="link-report-performance-attribution-report">
                Generate Performance Attribution Report →
              </Link>
              <Link href="/reporting-centre" className="text-xs text-primary hover:underline block" data-testid="link-reporting-centre">
                Open the Institutional Reporting Centre →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

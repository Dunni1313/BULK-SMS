// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/riskExposureEngine.ts). This page introduces no new signal,
// score, prediction, or trading logic of its own — it is analytics and
// visibility only. No live execution, no auto hedging, no auto
// rebalancing, no trade/position recommendations, no AI predictions, no
// probability forecasting, no AI-based risk scoring, no automated alerts.
//
// Every figure is a direct read from:
//   - GET /risk-exposure/dashboard    — the Investing/Trading/Options/
//     Combined risk views (Risk Dashboard, Portfolio Exposure Summary,
//     Cross-Engine Exposure, Sector/Strategy Concentration, Asset
//     Allocation, Buying Power Overview, Capital Allocation, Greeks
//     Summary, Correlation Overview, Concentration Timeline)
//   - GET /risk-exposure/coach        — the deterministic AI Coach
//   - GET /risk-exposure/learning     — Learning Centre integration
//   - GET /reporting/risk-exposure-summary,
//     GET /reporting/portfolio-concentration-report — Reporting Centre links

import { useState } from "react";
import { Link } from "wouter";
import { useGetRiskExposureDashboard, useListRiskExposureCoachTopics, useListRiskExposureLearning } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, GraduationCap, FileBarChart2 } from "lucide-react";

type RiskView = "investing" | "trading" | "options" | "combined";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

export default function RiskExposureEngine() {
  const [tab, setTab] = useState<string>("dashboard");
  const [view, setView] = useState<RiskView>("combined");

  const dashboardQuery = useGetRiskExposureDashboard();
  const coachQuery = useListRiskExposureCoachTopics();
  const learningQuery = useListRiskExposureLearning();

  const dashboard = dashboardQuery.data;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="risk-exposure-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-emerald-400" /> Institutional Risk & Exposure Intelligence Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A deterministic cross-platform dashboard unifying Investing, Trading, and Options risk. Analytics and
          visibility only — no live execution, no auto hedging, no auto rebalancing, no trade or position
          recommendations, no AI predictions, no probability forecasting, no AI-based risk scoring, no automated
          alerts.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="risk-exposure-engine-labels">
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
            Cross-Engine Risk
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
          <TabsTrigger value="dashboard" data-testid="tab-ree-dashboard">
            <ShieldAlert className="w-4 h-4 mr-1" /> Risk Dashboard
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-ree-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-ree-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Risk Dashboard ─────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-ree-view-selector">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk View</CardTitle>
              <CardDescription className="text-xs">Investing, Trading, Options, or the Combined cross-engine view. No recommendations, no optimisation, display only.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={view} onValueChange={(v) => setView(v as RiskView)}>
                <SelectTrigger className="w-56" data-testid="risk-view-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined" data-testid="risk-view-option-combined">
                    Combined (Cross-Engine)
                  </SelectItem>
                  <SelectItem value="investing" data-testid="risk-view-option-investing">
                    Investing
                  </SelectItem>
                  <SelectItem value="trading" data-testid="risk-view-option-trading">
                    Trading
                  </SelectItem>
                  <SelectItem value="options" data-testid="risk-view-option-options">
                    Options
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {dashboardQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : !dashboard ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="risk-dashboard-error">
              Unable to load the Risk & Exposure dashboard.
            </p>
          ) : (
            <>
              {view === "investing" && (
                <Card className="bg-card border-border" data-testid="panel-ree-investing">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Investing — Portfolio Exposure Summary</CardTitle>
                    <CardDescription className="text-xs">
                      {dashboard.investing.portfolioCount} portfolio(s), {dashboard.investing.holdingsCount} holding(s). Reused from the Investing Risk Engine.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" data-testid="investing-risk-label">
                        {dashboard.investing.risk.overall.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{dashboard.investing.risk.overall.detail}</span>
                    </div>
                    <div className="space-y-1" data-testid="investing-allocation-by-symbol">
                      {dashboard.investing.allocationBySymbol.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No holdings on record yet.</p>
                      ) : (
                        dashboard.investing.allocationBySymbol.map((a) => (
                          <div key={a.symbol} className="flex justify-between text-xs" data-testid={`investing-symbol-${a.symbol}`}>
                            <span>{a.symbol}</span>
                            <span className="text-muted-foreground">
                              {fmtUsd(a.marketValue)} ({fmtPct(a.weightPct)})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {view === "trading" && (
                <Card className="bg-card border-border" data-testid="panel-ree-trading">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Trading — Portfolio Exposure Summary</CardTitle>
                    <CardDescription className="text-xs">
                      {dashboard.trading.openPositionsCount} open position(s), account value {fmtUsd(dashboard.trading.accountValue)}. Reused from the Trading Risk Management Engine.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" data-testid="trading-risk-label">
                        {dashboard.trading.risk.overall.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{dashboard.trading.risk.overall.detail}</span>
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid="trading-position-sizing-detail">
                      Position Sizing: {dashboard.trading.risk.positionSizing.detail}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid="trading-stop-discipline-detail">
                      Stop/Target Discipline: {dashboard.trading.risk.stopDiscipline.detail}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid="trading-portfolio-budget-detail">
                      Portfolio Risk Budget: {dashboard.trading.risk.portfolioBudget.detail}
                    </p>
                  </CardContent>
                </Card>
              )}

              {view === "options" && (
                <Card className="bg-card border-border" data-testid="panel-ree-options">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Options — Portfolio Exposure Summary</CardTitle>
                    <CardDescription className="text-xs">
                      {dashboard.options.dashboard.openPositionsCount} open position(s), portfolio value {fmtUsd(dashboard.options.dashboard.portfolioValue)}. Reused from the Portfolio Risk Dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" data-testid="options-risk-label">
                        {dashboard.options.dashboard.overallRiskRating.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Health score: {dashboard.options.dashboard.healthScore.toFixed(0)}/100</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Buying power: {fmtUsd(dashboard.options.dashboard.buyingPower)}</p>
                    <p className="text-xs text-muted-foreground" data-testid="options-greeks-summary">
                      Net Greeks — Δ {dashboard.options.dashboard.netGreeks.delta.toFixed(2)}, Γ {dashboard.options.dashboard.netGreeks.gamma.toFixed(4)}, Θ{" "}
                      {dashboard.options.dashboard.netGreeks.theta.toFixed(2)}, V {dashboard.options.dashboard.netGreeks.vega.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {view === "combined" && (
                <div className="space-y-4" data-testid="panel-ree-combined">
                  <Card className="bg-card border-border" data-testid="panel-ree-capital-allocation">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Capital Allocation</CardTitle>
                      <CardDescription className="text-xs">Real committed capital across all 3 engines, reused directly from each engine's own risk view.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.capitalAllocation.map((c) => (
                        <div key={c.engine} className="flex justify-between text-xs" data-testid={`capital-allocation-${c.engine}`}>
                          <span>{c.label}</span>
                          <span className="text-muted-foreground">{fmtUsd(c.value)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-buying-power">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Buying Power Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.buyingPowerOverview.map((b) => (
                        <div key={b.engine} className="flex justify-between text-xs" data-testid={`buying-power-${b.engine}`}>
                          <span>{b.label}</span>
                          <span className="text-muted-foreground">{fmtUsd(b.value)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-asset-allocation">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Asset Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2 text-xs" data-testid="asset-allocation-grid">
                      <div>
                        <p className="text-muted-foreground">Investing</p>
                        <p className="font-semibold">
                          {dashboard.combined.assetAllocation.investingHoldingsCount} holding(s), {dashboard.combined.assetAllocation.investingPortfolioCount} portfolio(s)
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Trading</p>
                        <p className="font-semibold">{dashboard.combined.assetAllocation.tradingOpenPositionsCount} open position(s)</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Options</p>
                        <p className="font-semibold">{dashboard.combined.assetAllocation.optionsOpenPositionsCount} open position(s)</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-sector-concentration">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Sector Concentration</CardTitle>
                      <CardDescription className="text-xs">Investing + Options, reused directly from each engine's own already-computed sector exposure.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.sectorConcentration.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sector data available yet.</p>
                      ) : (
                        dashboard.combined.sectorConcentration.map((s, i) => (
                          <div key={`${s.engine}-${s.sector}-${i}`} className="flex justify-between text-xs" data-testid={`sector-concentration-${s.engine}-${i}`}>
                            <span>
                              [{s.engine}] {s.sector}
                            </span>
                            <span className="text-muted-foreground">{fmtPct(s.weightPct)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-strategy-concentration">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Concentration</CardTitle>
                      <CardDescription className="text-xs">Options open risk by strategy, reused directly from the Portfolio Risk Dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.strategyConcentration.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No open options positions to break down by strategy.</p>
                      ) : (
                        dashboard.combined.strategyConcentration.map((s) => (
                          <div key={s.key} className="flex justify-between text-xs" data-testid={`strategy-concentration-${s.key}`}>
                            <span>{s.label ?? s.key}</span>
                            <span className="text-muted-foreground">
                              {s.positionCount} position(s) ({fmtPct(s.weightPct)})
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-greeks-summary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Greeks Summary</CardTitle>
                      <CardDescription className="text-xs">The Options Income Engine's own net portfolio Greeks, reused unmodified.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground" data-testid="combined-greeks-summary">
                      Δ {dashboard.combined.greeksSummary.delta.toFixed(2)}, Γ {dashboard.combined.greeksSummary.gamma.toFixed(4)}, Θ {dashboard.combined.greeksSummary.theta.toFixed(2)}, V{" "}
                      {dashboard.combined.greeksSummary.vega.toFixed(2)}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-correlation-overview">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Correlation Overview (Cross-Engine Exposure)</CardTitle>
                      <CardDescription className="text-xs">{dashboard.combined.correlationOverview.note}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.correlationOverview.overlaps.length === 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="correlation-overview-empty">
                          No symbol is currently held in more than one engine at once.
                        </p>
                      ) : (
                        dashboard.combined.correlationOverview.overlaps.map((o) => (
                          <div key={o.symbol} className="flex justify-between text-xs" data-testid={`correlation-overlap-${o.symbol}`}>
                            <span>{o.symbol}</span>
                            <span className="text-muted-foreground">{o.engines.join(", ")}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-ree-concentration-timeline">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Concentration Timeline</CardTitle>
                      <CardDescription className="text-xs">Real historical data points from saved Investing risk snapshots and the Options Exposure Timeline. Never fabricated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.concentrationTimeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No historical data points yet.</p>
                      ) : (
                        dashboard.combined.concentrationTimeline.map((p, i) => (
                          <div key={`${p.date}-${i}`} className="flex justify-between text-xs" data-testid={`concentration-timeline-${i}`}>
                            <span>{p.date}</span>
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
          <Card className="bg-card border-border" data-testid="panel-ree-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">Deterministic explanations of risk, exposure, diversification, concentration, position sizing, capital allocation, and Greeks — never a trade or hedging recommendation.</CardDescription>
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

          <Card className="bg-card border-border" data-testid="panel-ree-learning">
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
          <Card className="bg-card border-border" data-testid="panel-ree-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk & Exposure Reporting</CardTitle>
              <CardDescription className="text-xs">Risk & Exposure Summary and Portfolio Concentration Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=risk-exposure-summary" className="text-xs text-primary hover:underline block" data-testid="link-report-risk-exposure-summary">
                Generate Risk & Exposure Summary →
              </Link>
              <Link href="/reporting-centre?reportType=portfolio-concentration-report" className="text-xs text-primary hover:underline block" data-testid="link-report-portfolio-concentration-report">
                Generate Portfolio Concentration Report →
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

// AI Portfolio Analyst — Phase 8, Sprint 3.
//
// The executive portfolio briefing layer intelligenceEngine.ts's own
// header comment already named as a future consumer. ONE new GET
// /portfolio-analyst request (lib/portfolioAnalyst.ts, backend) is a
// pure composition over the Institutional Intelligence Engine, Portfolio
// Dashboard, Portfolio Event Risk, and Theta Income — zero new
// pricing/risk/scoring calculations. Net Liquidation/Daily P/L (the
// Options Income Engine's own real Paper Trading account figures) and
// Performance Summary (the pre-existing, entirely SIMULATED Performance
// Analytics engine — explicitly labeled below, never presented as real
// trade history) are each fetched independently via their own
// already-existing hooks, mirroring CommandCenter.tsx's own established
// multi-engine composition pattern rather than duplicating either
// route's logic in the new backend module.
//
// THIS IS NOT an LLM, a chatbot, predictive AI, financial advice, or a
// trade recommendation engine. Every sentence below is either a direct
// pass-through of an already-computed value or a deterministic,
// disclosed template gated by an already-computed threshold. Never
// submits, closes, or modifies anything.

import { useGetPortfolioAnalyst, useGetPortfolioSummary, useGetPerformanceAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function ratingBadgeClass(code: string): string {
  if (code === "healthy") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (code === "moderate_risk") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (code === "elevated_risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function trendBadgeClass(direction: string): string {
  if (direction === "improving") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (direction === "declining") return "bg-destructive/15 text-destructive border-destructive/30";
  if (direction === "stable") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function timelineStatusBadgeClass(status: string): string {
  if (status === "new") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function PortfolioAnalyst() {
  const { data: result, isLoading, isError } = useGetPortfolioAnalyst();
  const { data: summary } = useGetPortfolioSummary();
  const { data: performance } = useGetPerformanceAnalytics({ period: "all" });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">AI Portfolio Analyst</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-ai-portfolio-analyst">
            AI Portfolio Analyst
          </Badge>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-institutional-intelligence-analyst">
            Institutional Intelligence
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-deterministic-analysis-analyst">
            Deterministic Analysis
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-analyst">
            Paper Trading
          </Badge>
          <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-read-only-analyst">
            Read Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The executive portfolio briefing layer, transforming every existing analytic (Portfolio Health, Risk,
          Income, Performance, Greeks, Event Risk, Learning, and Timeline) into one institutional-quality
          summary. Not an LLM, a chatbot, predictive AI, financial advice, or a trade recommendation engine —
          every statement below references an existing, already-computed calculation.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="portfolio-analyst-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-portfolio-analyst-error">
              Failed to load the AI Portfolio Analyst result. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Executive Daily Briefing ───────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-executive-briefing">
            <CardHeader>
              <CardTitle>Executive Daily Briefing</CardTitle>
              <CardDescription>
                Concise, deterministic statements — every line references an existing metric, never a
                fabricated observation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold" data-testid="text-briefing-headline">{result.executiveBriefing.headline}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground" data-testid="list-briefing-bullets">
                {result.executiveBriefing.bullets.map((b, i) => (
                  <li key={i} data-testid={`briefing-bullet-${i}`}>
                    {b}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ─── Portfolio Snapshot ─────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-snapshot">
            <CardHeader>
              <CardTitle>Portfolio Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Health</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-lg" data-testid="text-snapshot-health-score">{result.snapshot.healthScore}/100</span>
                    <Badge className={ratingBadgeClass(result.snapshot.overallRiskRating.code)} data-testid="badge-snapshot-risk-rating">
                      {result.snapshot.overallRiskRating.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Buying Power</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-buying-power">{fmtUsd(result.snapshot.buyingPower)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Net Liquidation</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-net-liq">
                    {summary ? fmtUsd(summary.accountValue) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Open Positions</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-open-positions">{result.snapshot.openPositionsCount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Monthly Theta</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-monthly-theta">{fmtUsd(result.snapshot.monthlyTheta)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Daily P/L</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-daily-pl">
                    {summary ? fmtUsd(summary.dayPnl) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Exposure</div>
                  <div className="font-mono text-lg" data-testid="text-snapshot-total-exposure">
                    {fmtUsd(result.snapshot.totalRiskDollars)} <span className="text-xs text-muted-foreground">({fmtPct(result.snapshot.totalRiskPct)})</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── Health Summary ───────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-health-summary">
              <CardHeader>
                <CardTitle>Health Summary</CardTitle>
                <CardDescription>Reuses the Health Engine directly — never a second, competing score.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-lg" data-testid="text-health-summary-score">{result.healthSummary.overallHealthScore}/100</span>
                  <Badge className={trendBadgeClass(result.healthSummary.trend)} data-testid="badge-health-summary-trend">
                    {result.healthSummary.trend.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-health-summary-trend-detail">{result.healthSummary.trendDetail}</p>
                <p className="text-sm" data-testid="text-health-summary-body">{result.healthSummary.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Strengths</div>
                    <ul className="space-y-0.5 text-sm" data-testid="list-health-strengths">
                      {result.healthSummary.strengths.map((s) => (
                        <li key={s.code} className="flex items-center justify-between">
                          <span>{s.label}</span>
                          <span className="font-mono text-xs">{s.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Weaknesses</div>
                    <ul className="space-y-0.5 text-sm" data-testid="list-health-weaknesses">
                      {result.healthSummary.weaknesses.map((w) => (
                        <li key={w.code} className="flex items-center justify-between">
                          <span>{w.label}</span>
                          <span className="font-mono text-xs">{w.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Risk Summary ─────────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-risk-summary">
              <CardHeader>
                <CardTitle>Risk Summary</CardTitle>
                <CardDescription>Reuses Stress Testing, Event Risk, Concentration, and Position Sizing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid="badge-risk-highest">Highest Risk: {result.riskSummary.highestRisk}</Badge>
                  <Badge className={trendBadgeClass(result.riskSummary.riskTrend)} data-testid="badge-risk-trend">
                    Risk {result.riskSummary.riskTrend.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm" data-testid="text-risk-largest-exposure">Largest Exposure: {result.riskSummary.largestExposure}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-risk-diversification">
                  Diversification Score: {result.riskSummary.diversificationScore ?? "—"}
                </p>
                {result.riskSummary.worstStressScenario && (
                  <p className="text-xs text-muted-foreground" data-testid="text-risk-worst-stress">
                    Worst Stress Scenario: {result.riskSummary.worstStressScenario.label} ({fmtUsd(result.riskSummary.worstStressScenario.portfolioValueImpact)})
                  </p>
                )}
                {result.riskSummary.guidance.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground" data-testid="list-risk-guidance">
                    {result.riskSummary.guidance.map((g) => (
                      <li key={g.code}>{g.detail}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* ─── Income Summary ───────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-income-summary">
              <CardHeader>
                <CardTitle>Income Summary</CardTitle>
                <CardDescription>Reuses Theta Income directly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Monthly</div>
                    <div className="font-mono" data-testid="text-income-monthly">{fmtUsd(result.incomeSummary.monthlyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Weekly</div>
                    <div className="font-mono" data-testid="text-income-weekly">{fmtUsd(result.incomeSummary.weeklyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Daily</div>
                    <div className="font-mono" data-testid="text-income-daily">{fmtUsd(result.incomeSummary.dailyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Annualized</div>
                    <div className="font-mono" data-testid="text-income-annualized">{fmtUsd(result.incomeSummary.annualizedTheta)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={trendBadgeClass(result.incomeSummary.incomeHealth)} data-testid="badge-income-health">
                    Income {result.incomeSummary.incomeHealth.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-income-health-detail">{result.incomeSummary.incomeHealthDetail}</p>
              </CardContent>
            </Card>

            {/* ─── Performance Summary (SIMULATED) ─────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-performance-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Performance Summary
                  <Badge variant="outline" data-testid="badge-performance-simulated">SIMULATED</Badge>
                </CardTitle>
                <CardDescription>
                  Reuses the Performance Analytics engine — a deterministic, seeded population of sample
                  trades, not this account&apos;s own real Paper Trading history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performance ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Return</div>
                      <div className="font-mono" data-testid="text-performance-return">{fmtUsd(performance.totalReturn)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Max Drawdown</div>
                      <div className="font-mono" data-testid="text-performance-drawdown">{fmtPct(performance.maxDrawdown)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                      <div className="font-mono" data-testid="text-performance-win-rate">{fmtPct(performance.winRate * 100)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Expectancy</div>
                      <div className="font-mono" data-testid="text-performance-expectancy">{fmtUsd(performance.expectancy)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Average Winner</div>
                      <div className="font-mono" data-testid="text-performance-avg-winner">{fmtUsd(performance.avgWin)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Average Loser</div>
                      <div className="font-mono" data-testid="text-performance-avg-loser">{fmtUsd(performance.avgLoss)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Portfolio Growth</div>
                      <div className="font-mono" data-testid="text-performance-growth">{fmtPct(performance.returnOnCapital)}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-performance-unavailable">Performance data unavailable.</p>
                )}
              </CardContent>
            </Card>

            {/* ─── Greeks Summary ───────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-greeks-summary">
              <CardHeader>
                <CardTitle>Greeks Summary</CardTitle>
                <CardDescription>Reuses the Portfolio Dashboard&apos;s own net Greeks — never a second calculation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Delta</div>
                    <div className="font-mono" data-testid="text-greeks-delta">{result.greeksSummary.delta}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gamma</div>
                    <div className="font-mono" data-testid="text-greeks-gamma">{result.greeksSummary.gamma}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Theta</div>
                    <div className="font-mono" data-testid="text-greeks-theta">{result.greeksSummary.theta}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Vega</div>
                    <div className="font-mono" data-testid="text-greeks-vega">{result.greeksSummary.vega}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={trendBadgeClass(result.greeksSummary.deltaTrend)} data-testid="badge-greeks-delta-trend">
                    Delta {result.greeksSummary.deltaTrend.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-greeks-delta-trend-detail">{result.greeksSummary.deltaTrendDetail}</p>
                {result.greeksSummary.largestContributor && (
                  <p className="text-sm" data-testid="text-greeks-largest-contributor">
                    Largest Contributor: {result.greeksSummary.largestContributor.symbol} ({fmtPct(result.greeksSummary.largestContributor.deltaSharePct)})
                  </p>
                )}
                {result.greeksSummary.educationalLinks.length > 0 && (
                  <ul className="flex flex-wrap gap-2" data-testid="list-greeks-links">
                    {result.greeksSummary.educationalLinks.map((l) => (
                      <li key={l.label}>
                        {l.href && !l.comingSoon ? (
                          <a href={l.href}>
                            <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25 cursor-pointer">{l.label}</Badge>
                          </a>
                        ) : (
                          <Badge variant="outline">{l.label}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* ─── Event Summary ────────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-event-summary">
              <CardHeader>
                <CardTitle>Event Summary</CardTitle>
                <CardDescription>Reuses Event Risk and Expiration Clusters directly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Safe Positions</div>
                    <div className="font-mono" data-testid="text-event-safe-count">{result.eventSummary.safePositionsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">At-Risk Positions</div>
                    <div className="font-mono" data-testid="text-event-at-risk-count">{result.eventSummary.atRiskPositionsCount}</div>
                  </div>
                </div>
                {result.eventSummary.highestRiskEvent ? (
                  <p className="text-sm" data-testid="text-event-highest-risk">
                    Highest Risk: {result.eventSummary.highestRiskEvent.symbol} ({result.eventSummary.highestRiskEvent.riskLevel})
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-event-no-highest-risk">No elevated event risk detected.</p>
                )}
                <p className="text-xs text-muted-foreground" data-testid="text-event-upcoming-summary">
                  {result.eventSummary.upcomingEvents.positionsWithEvents} of {result.eventSummary.upcomingEvents.totalPositions} positions have upcoming events.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ─── Learning Summary ────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-learning-summary">
            <CardHeader>
              <CardTitle>Learning Summary</CardTitle>
              <CardDescription>Every section links to a related lesson, glossary term, and strategy — reusing the Learning Centre directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                {Object.entries(result.learningSummary).map(([section, link]) => (
                  <div key={section} data-testid={`learning-cross-link-${section}`}>
                    <div className="text-xs text-muted-foreground capitalize mb-1">{section}</div>
                    <div className="flex flex-col gap-1">
                      {link.lessonHref ? (
                        <a href={link.lessonHref}>
                          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25 cursor-pointer">{link.lessonTitle}</Badge>
                        </a>
                      ) : null}
                      {link.glossaryHref ? (
                        <a href={link.glossaryHref}>
                          <Badge variant="outline" className="hover:bg-muted cursor-pointer">{link.glossaryTerm}</Badge>
                        </a>
                      ) : null}
                      {link.strategyHref ? (
                        <a href={link.strategyHref}>
                          <Badge variant="outline" className="hover:bg-muted cursor-pointer">{link.strategyLabel}</Badge>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Portfolio Timeline ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-timeline">
            <CardHeader>
              <CardTitle>Portfolio Timeline</CardTitle>
              <CardDescription>
                {result.timeline.comparedTo
                  ? `Compared against the snapshot recorded on ${result.timeline.comparedTo}.`
                  : "No prior recorded snapshot exists yet — trend comparisons will appear after the next recorded day."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">New Issues</div>
                  {result.timeline.newIssues.length === 0 ? (
                    <p className="text-muted-foreground text-xs" data-testid="text-timeline-no-new">None</p>
                  ) : (
                    <ul className="space-y-1" data-testid="list-timeline-new">
                      {result.timeline.newIssues.map((e) => (
                        <li key={e.code} className="flex items-center gap-2">
                          <Badge className={timelineStatusBadgeClass(e.status)}>{e.status}</Badge>
                          <span>{e.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Resolved Issues</div>
                  {result.timeline.resolvedIssues.length === 0 ? (
                    <p className="text-muted-foreground text-xs" data-testid="text-timeline-no-resolved">None</p>
                  ) : (
                    <ul className="space-y-1" data-testid="list-timeline-resolved">
                      {result.timeline.resolvedIssues.map((e) => (
                        <li key={e.code} className="flex items-center gap-2">
                          <Badge className={timelineStatusBadgeClass(e.status)}>{e.status}</Badge>
                          <span>{e.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Persistent Issues</div>
                  {result.timeline.persistentIssues.length === 0 ? (
                    <p className="text-muted-foreground text-xs" data-testid="text-timeline-no-persistent">None</p>
                  ) : (
                    <ul className="space-y-1" data-testid="list-timeline-persistent">
                      {result.timeline.persistentIssues.map((e) => (
                        <li key={e.code} className="flex items-center gap-2">
                          <Badge className={timelineStatusBadgeClass(e.status)}>{e.status}</Badge>
                          <span>{e.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-xs text-muted-foreground mb-1">This Week</div>
                {result.timeline.thisWeek.trend === "insufficient_history" ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-this-week-insufficient">
                    Not enough recorded history yet ({result.timeline.thisWeek.daysRecorded} day(s) recorded).
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-this-week-summary">
                    <Badge className={trendBadgeClass(result.timeline.thisWeek.trend)}>{result.timeline.thisWeek.trend}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {result.timeline.thisWeek.healthScoreMin}–{result.timeline.thisWeek.healthScoreMax} over {result.timeline.thisWeek.daysRecorded} day(s)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Institutional Insights ──────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-institutional-insights">
            <CardHeader>
              <CardTitle>Institutional Insights</CardTitle>
              <CardDescription>Deterministic executive observations — never a trade recommendation, only an explanation.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.institutionalInsights.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-institutional-insights">No notable observations right now.</p>
              ) : (
                <ul className="space-y-2" data-testid="list-institutional-insights">
                  {result.institutionalInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" data-testid={`institutional-insight-${i}`}>
                      <Badge variant="outline" className="mt-0.5">{insight.category}</Badge>
                      <span>{insight.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

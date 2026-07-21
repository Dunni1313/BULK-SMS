// Phase 33 — Institutional Executive Intelligence & Reporting Hub.
//
// PURE PRESENTATION LAYER. This page introduces no new signal, score, or
// prediction — every figure it renders is a direct read of
// GET /executive/intelligence (lib/executiveIntelligence.ts's own
// already-computed ExecutiveIntelligenceHub), itself a pure composition
// over the Investing Engine's own analytics (lib/investingAnalytics.ts,
// this phase) and the Trading Engine's own analytics
// (lib/tradingAnalytics.ts, Phase 32, reused unmodified). No ICT, SMC,
// ASAD, Trader Bill, Tom Nash, or Dunni Framework logic; no automated
// entries/exits; no trading signals; no probability engine; no broker
// execution.
//
// Five tabs, matching the phase brief's own requested UI shape: Executive
// Overview, Executive Activity, Executive Reporting, Executive Learning,
// Executive Risk. Strategy/Portfolio/AI-Coach summaries are folded into the
// Overview tab as cards — the same "fold less-central categories into the
// nearest tab" pattern TradingAnalyticsDashboard.tsx already established
// (structure/liquidity engine usage folded into that page's own tabs
// rather than each getting a dedicated top-level tab).

import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useGetExecutiveIntelligenceHub } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  LayoutGrid,
  Clock,
  FileBarChart2,
  GraduationCap,
  ShieldAlert,
  LineChart,
  Building2,
  TrendingUp,
  Boxes,
  Briefcase,
  GraduationCap as CoachIcon,
  LayoutPanelLeft,
  Waves,
  GitBranch,
  AlertTriangle,
  Gauge,
  Scale,
  ShieldCheck,
  Eye,
  Workflow,
} from "lucide-react";

function KpiCard({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// A simple, disclosed intensity scale over an already-computed count —
// never a fabricated new metric, purely a visual mapping. Mirrors
// TradingAnalyticsDashboard.tsx's/PortfolioConcentration.tsx's own
// heatColor() pattern.
function heatColor(count: number, max: number): string {
  if (max <= 0) return "rgba(99, 102, 241, 0.12)";
  const alpha = Math.min(0.9, 0.15 + (count / max) * 0.75);
  return `rgba(99, 102, 241, ${alpha})`;
}

const VALID_TABS = ["overview", "activity", "reporting", "learning", "risk"];

export default function ExecutiveIntelligence() {
  const { data: hub, isLoading, isError } = useGetExecutiveIntelligenceHub();
  const [tab, setTab] = useState("overview");

  // Deep-link support: ?tab=overview|activity|reporting|learning|risk
  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoRanRef.current === search) return;
    const params = new URLSearchParams(search);
    const t = params.get("tab");
    if (!t || !VALID_TABS.includes(t)) return;
    autoRanRef.current = search;
    setTab(t);
  }, [search]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4" data-testid="executive-intelligence-loading">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !hub) {
    return (
      <div className="p-4 md:p-6" data-testid="executive-intelligence-error">
        <p className="text-sm text-destructive">Could not load the Executive Intelligence Hub. Please try again.</p>
      </div>
    );
  }

  const { overview, investing, trading, strategy, portfolio, risk, learning, coach, reporting, activity } = hub;

  const hasAnyData =
    overview.portfoliosCreated > 0 ||
    overview.tradesReviewed > 0 ||
    overview.reportsGenerated > 0 ||
    overview.totalCoachViews > 0 ||
    overview.learningTopicsTotal > 0;

  const maxByTypeCount = Math.max(...reporting.byType.map((t) => t.count), 0);
  const learningCompletionPct = learning.totalTopics > 0 ? Math.round((learning.completedTopics / learning.totalTopics) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="executive-intelligence-hub">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400" /> Executive Intelligence Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A single deterministic view unifying the Institutional Investing Engine and the Institutional Trading
          Engine — overview KPIs, cross-engine risk/learning/AI-coach rollups, a Reporting Centre tally, and a
          chronological Activity Timeline. Every figure is a direct read, count, tally, or simple aggregate of data
          you already generated — never a new signal, score, forecast, or AI prediction.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="executive-intelligence-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Cross-Engine
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            No Predictions
          </Badge>
        </div>
        {/* Phase 34 — Cross-Engine Orchestration & Unified Workspace. Pure
            navigation, no fetch — the Unified Workspace's own global search,
            recent items, and tasks are a distinct, deeper surface. */}
        <Link href="/cross-engine-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-cross-engine-workspace">
          <LayoutPanelLeft className="w-3 h-3" /> Open Cross-Engine Workspace →
        </Link>
        <Link href="/options-income-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-options-income-workspace">
          <Waves className="w-3 h-3" /> Open Options Income Workspace →
        </Link>
        <Link href="/options-lifecycle-manager" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-options-lifecycle-manager">
          <GitBranch className="w-3 h-3" /> Open Position Lifecycle Manager →
        </Link>
        <Link href="/risk-exposure-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-risk-exposure-engine">
          <ShieldAlert className="w-3 h-3" /> Open Risk & Exposure Engine →
        </Link>
        <Link href="/performance-attribution-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-performance-attribution-engine">
          <LineChart className="w-3 h-3" /> Open Performance & Attribution Engine →
        </Link>
        <Link href="/scenario-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-scenario-engine">
          <AlertTriangle className="w-3 h-3" /> Open Scenario & Stress Testing Engine →
        </Link>
        <Link href="/decision-support-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-decision-support-engine">
          <Gauge className="w-3 h-3" /> Open Decision Support Engine →
        </Link>
        <Link href="/rebalancing-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-rebalancing-engine">
          <Scale className="w-3 h-3" /> Open Rebalancing Engine →
        </Link>
        <Link href="/monitoring-compliance-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-monitoring-compliance-engine">
          <ShieldCheck className="w-3 h-3" /> Open Monitoring & Compliance Engine →
        </Link>
        <Link href="/watchlists-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-watchlists-engine">
          <Eye className="w-3 h-3" /> Open Watchlists & Opportunity Dashboard →
        </Link>
        <Link href="/portfolio-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-portfolio-workspace">
          <Workflow className="w-3 h-3" /> Open Institutional Portfolio Workspace →
        </Link>
      </div>

      {!hasAnyData && (
        <Card className="bg-card border-border" data-testid="executive-intelligence-empty">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">
              No activity recorded yet across either engine. Build a portfolio, register a strategy, save a research
              note, or open a report — this hub reflects only what you've already done.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-foreground/90" data-testid="executive-overview-summary">
        {overview.summary}
      </p>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-executive-overview">
            <LayoutGrid className="w-4 h-4 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-executive-activity">
            <Clock className="w-4 h-4 mr-1" /> Activity
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-executive-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-executive-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Learning
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-executive-risk">
            <ShieldAlert className="w-4 h-4 mr-1" /> Risk
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Portfolios" value={overview.portfoliosCreated} testId="kpi-portfolios" />
            <KpiCard label="Trades Reviewed" value={overview.tradesReviewed} testId="kpi-trades" />
            <KpiCard label="Committee Snapshots" value={overview.committeeSnapshotsSaved} testId="kpi-committee" />
            <KpiCard label="Strategies Registered" value={overview.strategiesRegistered} testId="kpi-strategies" />
            <KpiCard label="Reports Generated" value={overview.reportsGenerated} testId="kpi-reports" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card className="bg-card border-border" data-testid="panel-strategy-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-400" /> Strategy Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {strategy.checklistInstances > 0
                    ? `${strategy.checklistsComplete} of ${strategy.checklistInstances} checklist instance(s) complete (${strategy.overallChecklistCompletionPct}%).`
                    : "No checklist instances run yet."}
                </p>
                <Link href="/strategy-workbench" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-strategy-workbench">
                  Open Strategy Workbench →
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-border" data-testid="panel-portfolio-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-400" /> Portfolio Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {portfolio.portfolioCount > 0
                    ? `${portfolio.portfolioCount} portfolio(s), ${portfolio.totalHoldings} holding(s) across ${portfolio.distinctSymbolsHeld} distinct symbol(s).`
                    : "No portfolios created yet."}
                </p>
                <Link href="/stock-analyst/portfolio-construction" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-portfolio-construction">
                  Open Portfolio Construction →
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-border" data-testid="panel-ai-coach-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CoachIcon className="w-4 h-4 text-indigo-400" /> AI Coach Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {coach.totalCoachViews > 0
                    ? `${coach.totalCoachViews} view(s) total — ${coach.investingCoachViews} Investing, ${coach.tradingCoachViews} Trading.`
                    : "No AI Coach views recorded yet."}
                </p>
                <div className="flex gap-2">
                  <Link href="/institutional-ai-coach" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-investing-coach">
                    Investing Coach →
                  </Link>
                  <Link href="/trading-ai-coach" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-trading-coach">
                    Trading Coach →
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border" data-testid="panel-investing-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Investing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {investing.overview.watchlistItems} watchlist item(s), {investing.overview.researchNotesWritten} research note(s),{" "}
                  {investing.optimisation.reviewCount} optimisation review(s).
                </p>
                <Link href="/stock-analyst/executive-dashboard" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-investing-dashboard">
                  Open Investing Executive Dashboard →
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-border" data-testid="panel-trading-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Trading Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {trading.overview.plansCreated} trade plan(s), {trading.overview.journalEntries} journal entr(y/ies),{" "}
                  {trading.session.totalClassified} position(s) session-classified.
                </p>
                <Link href="/trading-analytics" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-trading-analytics">
                  Open Trading Analytics Dashboard →
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Activity ─────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-activity-timeline">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Activity Timeline</CardTitle>
              <CardDescription className="text-xs">
                A chronological merge of committee snapshots, risk snapshots, optimisation reviews, research notes,
                journal entries, saved reports, and notifications — newest first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="activity-timeline-empty">
                  No recent activity recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-xs border-b border-border/50 pb-2 last:border-0" data-testid={`activity-entry-${i}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {a.engine}
                          </Badge>
                          <span className="font-medium text-foreground/90 truncate">{a.label}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 mt-0.5">{a.detail}</p>
                        {a.linkPath && (
                          <Link href={a.linkPath} className="text-primary hover:underline inline-block mt-0.5">
                            View →
                          </Link>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">{new Date(a.occurredAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reporting ────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Reports" value={reporting.totalReports} testId="kpi-total-reports" />
            <KpiCard label="Report Categories" value={reporting.distinctReportTypesUsed} testId="kpi-report-categories" />
          </div>

          <Card className="bg-card border-border" data-testid="panel-reports-by-type">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Reports by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {reporting.byType.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="reports-by-type-empty">
                  No reports generated yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {reporting.byType.map((t) => (
                    <div key={t.reportType} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate text-foreground/90">{t.reportType}</span>
                      <div
                        className="h-4 rounded"
                        style={{ width: `${Math.max(8, (t.count / Math.max(1, maxByTypeCount)) * 160)}px`, backgroundColor: heatColor(t.count, maxByTypeCount) }}
                      />
                      <span className="text-muted-foreground">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-recent-reports">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reporting.recentReports.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="recent-reports-empty">
                  No saved reports yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {reporting.recentReports.map((r) => (
                    <li key={r.id} className="text-xs flex items-center justify-between gap-2">
                      <span className="truncate text-foreground/90">{r.title}</span>
                      <span className="text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/reporting-centre" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-reporting-centre">
                Open Reporting Centre →
              </Link>
              <Link
                href="/reporting-centre?reportType=executive-intelligence-summary"
                className="text-xs text-primary hover:underline inline-block ml-3"
                data-testid="link-generate-executive-intelligence-report"
              >
                Generate Executive Intelligence Report →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Learning ─────────────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Topics Completed" value={learning.completedTopics} testId="kpi-topics-completed" />
            <KpiCard label="Topics Remaining" value={learning.remainingTopics} testId="kpi-topics-remaining" />
            <KpiCard label="Total Topics" value={learning.totalTopics} testId="kpi-topics-total" />
            <KpiCard label="% Complete" value={`${learningCompletionPct}%`} testId="kpi-topics-pct" />
          </div>
          <Card className="bg-card border-border" data-testid="panel-weakest-paths">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weakest Paths (below 50% complete)</CardTitle>
              <CardDescription className="text-xs">
                An honest sort of your own already-computed progress across both engines' shared learning catalog —
                never a recommendation of what to study next.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {learning.weakestPaths.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="weakest-paths-empty">
                  No paths below 50% complete — or no learning progress recorded yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {learning.weakestPaths.map((p) => (
                    <li key={p.pathKey} className="text-xs flex items-center justify-between gap-2">
                      <span className="text-foreground/90">{p.title}</span>
                      <span className="text-muted-foreground">{p.percentComplete}%</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/learn" className="text-xs text-primary hover:underline inline-block mt-2" data-testid="link-open-learning-centre">
                Open Learning Centre →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Risk ─────────────────────────────────────────────────────── */}
        <TabsContent value="risk" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Investing Risk Snapshots" value={risk.investingRiskSnapshotsSaved} testId="kpi-investing-risk-snapshots" />
            <KpiCard
              label="Investing Most Recent Score"
              value={risk.investingMostRecentRiskScore !== null ? risk.investingMostRecentRiskScore : "—"}
              testId="kpi-investing-risk-score"
            />
            <KpiCard label="Trading Open Positions" value={risk.tradingOpenPositionsCount} testId="kpi-trading-open-positions" />
            <KpiCard label="Stop/Target Discipline" value={`${risk.tradingStopTargetDisciplinePct}%`} testId="kpi-trading-stop-target-discipline" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-border" data-testid="panel-investing-risk-link">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Investing Risk</CardTitle>
                <CardDescription className="text-xs">Saved point-in-time Portfolio Risk snapshots.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/portfolio-dashboard" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-portfolio-risk-dashboard">
                  Open Portfolio Risk Dashboard →
                </Link>
              </CardContent>
            </Card>
            <Card className="bg-card border-border" data-testid="panel-trading-risk-link">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Trading Risk</CardTitle>
                <CardDescription className="text-xs">Real, already-recorded Trade Plan parameters and open-position stop/target discipline.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/trading-analytics" className="text-xs text-primary hover:underline inline-block" data-testid="link-open-trading-risk">
                  Open Trading Analytics Dashboard →
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

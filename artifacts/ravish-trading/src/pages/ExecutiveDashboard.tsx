// Phase 23 — Executive Dashboard & Production Readiness. This is the one
// executive landing page for the Institutional Investing Engine the Phase
// 23 objective calls for — a consolidation surface, NOT a new feature.
//
// Zero new valuation models, zero new scores, zero new recommendations,
// zero new backend routes: every panel below is a direct read of an
// already-shipped, already-tested endpoint —
//   • Portfolio Health          → GET /reporting-centre/reports/portfolio-health/:portfolioId (Phase 22)
//   • Active Opportunities      → GET /reporting-centre/reports/opportunity-discovery (Phase 22)
//   • Monitoring Summary        → GET /reporting-centre/reports/monitoring-summary (Phase 22)
//   • Investment Committee      → GET /reporting-centre/reports/investment-committee/:symbol (Phase 22),
//     Activity                   for the most recently decided symbol (Phase 19's recent-decisions feed)
//   • AI Coach Progress         → GET /reporting-centre/reports/ai-coach-summary (Phase 22)
//   • Daily Executive Summary   → GET /reporting-centre/reports/executive-summary (Phase 22)
//   • Recent Reports            → GET /reporting-centre/reports (Phase 22, saved-report history)
//   • Watchlists                → GET /stock-analyst/value-watchlist (Phase 15)
//   • Saved Research            → GET /stock-analyst/research-notes (Phase 20)
//   • Recent Decisions          → GET /stock-analyst/decision/snapshots/recent (Phase 19)
//   • Research Terminal         → static navigation shortcuts, no fetch at all
//     shortcuts
//
// The 6 report-shaped panels (Portfolio Health/Active Opportunities/
// Monitoring Summary/Investment Committee Activity/AI Coach Progress/Daily
// Executive Summary) all render through one shared, page-local
// <ReportSummaryCard> — a condensed view of the same InstitutionalReport
// shape ReportingCentre.tsx already renders in full, never a re-derivation
// of any of its sections' content.

import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetPortfolios,
  useGetPortfolioHealthReport,
  getGetPortfolioHealthReportQueryKey,
  useGetOpportunityDiscoveryReport,
  useGetMonitoringSummaryReport,
  useGetInvestmentCommitteeReport,
  getGetInvestmentCommitteeReportQueryKey,
  useGetAiCoachLearningSummaryReport,
  useGetExecutiveSummaryReport,
  useListInstitutionalReports,
  useGetValueWatchlist,
  useGetAllResearchNotes,
  useGetRecentDecisionSnapshots,
  useGetExecutiveIntelligenceHub,
  type InstitutionalReport,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { recommendationBadgeClass } from "@/lib/investing-format";
import {
  LayoutList,
  Building2,
  Telescope,
  BellRing,
  Users,
  GraduationCap,
  Newspaper,
  FileBarChart2,
  Terminal,
  Bookmark,
  StickyNote,
  Gavel,
  GitCompare,
  Columns2,
  Boxes,
  BarChart3,
  Command,
  Grid3x3,
  Waves,
  GitBranch,
  ShieldAlert,
  LineChart,
  AlertTriangle,
  Gauge,
  Scale,
} from "lucide-react";

function ReportSummaryCard({
  icon: Icon,
  title,
  report,
  isLoading,
  isError,
  emptyMessage,
  viewHref,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  report: InstitutionalReport | undefined;
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  viewHref: string;
  testId: string;
}) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-400" /> {title}
        </CardTitle>
        {report?.subtitle && <CardDescription className="text-xs">{report.subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <p className="text-xs text-rose-400" data-testid={`${testId}-error`}>
            Couldn't load this panel. Try refreshing the page.
          </p>
        ) : !report || report.sections.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2" data-testid={`${testId}-empty`}>
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-2">
            {report.sections.slice(0, 2).map((s) => (
              <div key={s.id}>
                <p className="text-xs font-medium text-foreground/90">{s.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{s.body}</p>
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {s.bullets.slice(0, 3).map((b, i) => (
                      <li key={i} className="text-xs text-muted-foreground/90">• {b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <Link href={viewHref} className="text-xs text-primary hover:underline inline-block" data-testid={`${testId}-view-link`}>
          View full report →
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveDashboard() {
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const primaryPortfolioId = portfolios?.[0]?.id ?? null;

  const {
    data: portfolioHealthReport,
    isLoading: portfolioHealthLoading,
    isError: portfolioHealthError,
  } = useGetPortfolioHealthReport(primaryPortfolioId ?? 0, {
    query: { queryKey: getGetPortfolioHealthReportQueryKey(primaryPortfolioId ?? 0), enabled: primaryPortfolioId != null },
  });

  const {
    data: opportunitiesReport,
    isLoading: opportunitiesLoading,
    isError: opportunitiesError,
  } = useGetOpportunityDiscoveryReport();

  const {
    data: monitoringReport,
    isLoading: monitoringLoading,
    isError: monitoringError,
  } = useGetMonitoringSummaryReport();

  const {
    data: aiCoachReport,
    isLoading: aiCoachLoading,
    isError: aiCoachError,
  } = useGetAiCoachLearningSummaryReport();

  const {
    data: executiveSummaryReport,
    isLoading: executiveSummaryLoading,
    isError: executiveSummaryError,
  } = useGetExecutiveSummaryReport();

  const { data: recentDecisions, isLoading: recentDecisionsLoading, isError: recentDecisionsError } = useGetRecentDecisionSnapshots();
  const mostRecentSymbol = recentDecisions?.[0]?.symbol ?? null;

  const {
    data: committeeReport,
    isLoading: committeeLoading,
    isError: committeeError,
  } = useGetInvestmentCommitteeReport(mostRecentSymbol ?? "PLACEHOLDER", {
    query: { queryKey: getGetInvestmentCommitteeReportQueryKey(mostRecentSymbol ?? "PLACEHOLDER"), enabled: !!mostRecentSymbol },
  });

  const { data: savedReports, isLoading: savedReportsLoading, isError: savedReportsError } = useListInstitutionalReports();
  // Phase 33 — Institutional Executive Intelligence & Reporting Hub. A real
  // Cross-Engine Snapshot, not just an outbound link: a small set of KPIs
  // spanning both the Investing Engine and Trading Engine, pulled directly
  // from the same already-computed ExecutiveIntelligenceHub the new
  // /executive-intelligence page renders in full — zero new aggregation
  // logic here, purely a condensed read.
  const { data: hub, isLoading: hubLoading, isError: hubError } = useGetExecutiveIntelligenceHub();
  const { data: watchlist, isLoading: watchlistLoading, isError: watchlistError } = useGetValueWatchlist();
  const { data: researchNotes, isLoading: researchNotesLoading, isError: researchNotesError } = useGetAllResearchNotes();

  const recentReportsSorted = useMemo(
    () => [...(savedReports ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [savedReports],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutList className="w-6 h-6 text-indigo-400" /> Executive Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          One landing page across the Institutional Investing Engine — every panel below reuses an already-shipped
          report or feed, never a new score or recommendation.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="executive-dashboard-permanent-labels">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Institutional Investing Engine
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Deterministic
          </Badge>
        </div>
      </div>

      {/* Cross-Engine Snapshot (Phase 33) — real KPIs spanning both engines,
          plus a prominent link to the full Executive Intelligence Hub. */}
      <Card className="bg-card border-border" data-testid="panel-cross-engine-snapshot">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Command className="w-4 h-4 text-indigo-400" /> Cross-Engine Snapshot
          </CardTitle>
          <CardDescription className="text-xs">
            A unified read across the Institutional Investing Engine and the Institutional Trading Engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hubLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : hubError || !hub ? (
            <p className="text-xs text-rose-400" data-testid="panel-cross-engine-snapshot-error">
              Couldn't load the cross-engine snapshot. Try refreshing the page.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="cross-engine-snapshot-kpis">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Portfolios</p>
                <p className="text-lg font-semibold">{hub.overview.portfoliosCreated}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Trades Reviewed</p>
                <p className="text-lg font-semibold">{hub.overview.tradesReviewed}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Strategies</p>
                <p className="text-lg font-semibold">{hub.overview.strategiesRegistered}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Reports</p>
                <p className="text-lg font-semibold">{hub.overview.reportsGenerated}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">AI Coach Views</p>
                <p className="text-lg font-semibold">{hub.overview.totalCoachViews}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Learning Topics</p>
                <p className="text-lg font-semibold">
                  {hub.overview.learningTopicsCompleted}/{hub.overview.learningTopicsTotal}
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/executive-intelligence" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-executive-intelligence">
              <Command className="w-3 h-3" /> Open the Executive Intelligence Hub →
            </Link>
            <Link href="/cross-engine-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-cross-engine-workspace">
              <Grid3x3 className="w-3 h-3" /> Open the Cross-Engine Workspace →
            </Link>
            <Link href="/options-income-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-options-income-workspace">
              <Waves className="w-3 h-3" /> Open the Options Income Workspace →
            </Link>
            <Link href="/options-lifecycle-manager" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-options-lifecycle-manager">
              <GitBranch className="w-3 h-3" /> Open the Position Lifecycle Manager →
            </Link>
            <Link href="/risk-exposure-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-risk-exposure-engine">
              <ShieldAlert className="w-3 h-3" /> Open the Risk & Exposure Engine →
            </Link>
            <Link href="/performance-attribution-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-performance-attribution-engine">
              <LineChart className="w-3 h-3" /> Open the Performance & Attribution Engine →
            </Link>
            <Link href="/scenario-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-scenario-engine">
              <AlertTriangle className="w-3 h-3" /> Open the Scenario & Stress Testing Engine →
            </Link>
            <Link href="/decision-support-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-decision-support-engine">
              <Gauge className="w-3 h-3" /> Open the Decision Support Engine →
            </Link>
            <Link href="/rebalancing-engine" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5" data-testid="link-open-rebalancing-engine">
              <Scale className="w-3 h-3" /> Open the Rebalancing Engine →
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Daily Executive Summary — full width, top of page */}
      <ReportSummaryCard
        icon={Newspaper}
        title="Daily Executive Summary"
        report={executiveSummaryReport}
        isLoading={executiveSummaryLoading}
        isError={executiveSummaryError}
        emptyMessage="No executive summary available yet."
        viewHref="/reporting-centre?reportType=executive-summary"
        testId="panel-executive-summary"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ReportSummaryCard
          icon={Building2}
          title="Portfolio Health"
          report={portfolioHealthReport}
          isLoading={portfoliosLoading || portfolioHealthLoading}
          isError={portfolioHealthError}
          emptyMessage={
            primaryPortfolioId == null
              ? "No portfolios yet — build one in Portfolio Construction."
              : "No portfolio health data available yet."
          }
          viewHref={primaryPortfolioId != null ? `/reporting-centre?reportType=portfolio-health&portfolioId=${primaryPortfolioId}` : "/stock-analyst/portfolio-construction"}
          testId="panel-portfolio-health"
        />

        <ReportSummaryCard
          icon={Telescope}
          title="Active Opportunities"
          report={opportunitiesReport}
          isLoading={opportunitiesLoading}
          isError={opportunitiesError}
          emptyMessage="No opportunities scanned yet."
          viewHref="/reporting-centre?reportType=opportunity-discovery"
          testId="panel-opportunities"
        />

        <ReportSummaryCard
          icon={BellRing}
          title="Monitoring Summary"
          report={monitoringReport}
          isLoading={monitoringLoading}
          isError={monitoringError}
          emptyMessage="No monitoring alerts to summarize yet."
          viewHref="/reporting-centre?reportType=monitoring-summary"
          testId="panel-monitoring"
        />

        <ReportSummaryCard
          icon={Users}
          title="Investment Committee Activity"
          report={committeeReport}
          isLoading={recentDecisionsLoading || committeeLoading}
          isError={recentDecisionsError || committeeError}
          emptyMessage={
            mostRecentSymbol == null
              ? "No recent decisions yet — analyse a symbol in the Decision Engine."
              : "No committee activity available yet."
          }
          viewHref={mostRecentSymbol != null ? `/reporting-centre?reportType=investment-committee&symbol=${mostRecentSymbol}` : "/decision-engine"}
          testId="panel-committee-activity"
        />

        <ReportSummaryCard
          icon={GraduationCap}
          title="AI Coach Progress"
          report={aiCoachReport}
          isLoading={aiCoachLoading}
          isError={aiCoachError}
          emptyMessage="No AI Coach activity yet."
          viewHref="/reporting-centre?reportType=ai-coach-summary"
          testId="panel-ai-coach-progress"
        />

        {/* Recent Reports */}
        <Card className="bg-card border-border" data-testid="panel-recent-reports">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-indigo-400" /> Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedReportsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : savedReportsError ? (
              <p className="text-xs text-rose-400" data-testid="panel-recent-reports-error">
                Couldn't load saved reports. Try refreshing the page.
              </p>
            ) : recentReportsSorted.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2" data-testid="panel-recent-reports-empty">
                No saved reports yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {recentReportsSorted.map((r) => (
                  <li key={r.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="truncate text-foreground/90">{r.title}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/reporting-centre" className="text-xs text-primary hover:underline inline-block">
              Open Reporting Centre →
            </Link>
          </CardContent>
        </Card>

        {/* Watchlists */}
        <Card className="bg-card border-border" data-testid="panel-watchlists">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-indigo-400" /> Watchlists
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {watchlistLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : watchlistError ? (
              <p className="text-xs text-rose-400" data-testid="panel-watchlists-error">
                Couldn't load the watchlist. Try refreshing the page.
              </p>
            ) : !watchlist || watchlist.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2" data-testid="panel-watchlists-empty">
                Your watchlist is empty.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {watchlist.slice(0, 12).map((w) => (
                  <Badge key={w.id} variant="outline" className="text-[10px]">
                    {w.symbol}
                  </Badge>
                ))}
              </div>
            )}
            <Link href="/stock-analyst" className="text-xs text-primary hover:underline inline-block">
              Open Value Research →
            </Link>
          </CardContent>
        </Card>

        {/* Saved Research */}
        <Card className="bg-card border-border" data-testid="panel-saved-research">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-indigo-400" /> Saved Research
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {researchNotesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : researchNotesError ? (
              <p className="text-xs text-rose-400" data-testid="panel-saved-research-error">
                Couldn't load saved research notes. Try refreshing the page.
              </p>
            ) : !researchNotes || researchNotes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2" data-testid="panel-saved-research-empty">
                No research notes saved yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {researchNotes.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-xs">
                    <span className="font-medium text-foreground/90">{n.symbol}:</span>{" "}
                    <span className="text-muted-foreground line-clamp-1">{n.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/stock-analyst" className="text-xs text-primary hover:underline inline-block">
              Open Stock Research →
            </Link>
          </CardContent>
        </Card>

        {/* Recent Decisions */}
        <Card className="bg-card border-border" data-testid="panel-recent-decisions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gavel className="w-4 h-4 text-indigo-400" /> Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDecisionsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : recentDecisionsError ? (
              <p className="text-xs text-rose-400" data-testid="panel-recent-decisions-error">
                Couldn't load recent decisions. Try refreshing the page.
              </p>
            ) : !recentDecisions || recentDecisions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2" data-testid="panel-recent-decisions-empty">
                No decisions recorded yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {recentDecisions.slice(0, 5).map((d) => (
                  <li key={d.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="text-foreground/90">{d.symbol}</span>
                    <Badge variant="outline" className={`text-[9px] ${recommendationBadgeClass(d.recommendation)}`}>
                      {d.recommendation}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/stock-analyst/investment-committee" className="text-xs text-primary hover:underline inline-block">
              Open Investment Committee →
            </Link>
          </CardContent>
        </Card>

        {/* Research Terminal shortcuts — pure navigation, no fetch */}
        <Card className="bg-card border-border" data-testid="panel-research-terminal-shortcuts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" /> Research Terminal
            </CardTitle>
            <CardDescription className="text-xs">Jump straight into a terminal mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-col gap-1.5">
              <Link href="/research-terminal" className="text-xs text-primary hover:underline flex items-center gap-1.5" data-testid="shortcut-terminal-analyse">
                <Terminal className="w-3 h-3" /> Analyse a company
              </Link>
              <Link href="/research-terminal?mode=compare" className="text-xs text-primary hover:underline flex items-center gap-1.5" data-testid="shortcut-terminal-compare">
                <GitCompare className="w-3 h-3" /> Compare symbols
              </Link>
              <Link href="/research-terminal?mode=split" className="text-xs text-primary hover:underline flex items-center gap-1.5" data-testid="shortcut-terminal-split">
                <Columns2 className="w-3 h-3" /> Split-screen view
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Strategy Workbench shortcut — pure navigation, no fetch. Engine 2's
            own Institutional Strategy Workbench (Phase 31), reachable from
            this Engine-1 dashboard for cross-engine convenience only —
            never a duplicated feature. */}
        <Card className="bg-card border-border" data-testid="panel-strategy-workbench-shortcut">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-400" /> Strategy Workbench
            </CardTitle>
            <CardDescription className="text-xs">Browse, compare, and review your own registered trading strategies.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/strategy-workbench" className="text-xs text-primary hover:underline flex items-center gap-1.5" data-testid="shortcut-strategy-workbench">
              <Boxes className="w-3 h-3" /> Open the Strategy Workbench
            </Link>
          </CardContent>
        </Card>

        {/* Trading Analytics Dashboard shortcut — pure navigation, no
            fetch. Engine 2's own Institutional Trading Analytics Engine
            (Phase 32), reachable from this Engine-1 dashboard for
            cross-engine convenience only — never a duplicated feature. */}
        <Card className="bg-card border-border" data-testid="panel-trading-analytics-shortcut">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Trading Analytics
            </CardTitle>
            <CardDescription className="text-xs">Deterministic aggregation of your own Trading Engine usage — trades, strategies, journal, risk, learning, coach, sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/trading-analytics" className="text-xs text-primary hover:underline flex items-center gap-1.5" data-testid="shortcut-trading-analytics">
              <BarChart3 className="w-3 h-3" /> Open the Trading Analytics Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Phase 32 — Institutional Trading Analytics Engine.
//
// PURE PRESENTATION LAYER. This page introduces no new signal, score, or
// prediction — every figure it renders is a direct read of
// GET /trading/analytics (lib/tradingAnalytics.ts's own already-computed
// TradingAnalyticsDashboard), itself a pure aggregation over already-
// persisted Trading Engine data (trades, plans, journal entries,
// strategies, checklists, learning progress, coach usage). No ICT, SMC,
// ASAD, Trader Bill, Tom Nash, or Dunni Framework logic; no automated
// entries/exits; no trading signals; no broker execution.

import { Link } from "wouter";
import { useGetTradingAnalyticsDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { BarChart3, LayoutGrid, Layers, BookOpen, ShieldAlert, GraduationCap, MessageSquare, Clock, FileBarChart2, Grid3x3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#ec4899", "#14b8a6"];

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

// A simple, disclosed intensity scale over the already-computed session
// count — never a fabricated new metric, purely a visual mapping. Mirrors
// PortfolioConcentration.tsx's own heatColor() pattern.
function heatColor(count: number, max: number): string {
  if (max <= 0) return "rgba(99, 102, 241, 0.12)";
  const alpha = Math.min(0.9, 0.15 + (count / max) * 0.75);
  return `rgba(99, 102, 241, ${alpha})`;
}

export default function TradingAnalyticsDashboard() {
  const { data: dashboard, isLoading, isError } = useGetTradingAnalyticsDashboard();

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4" data-testid="trading-analytics-loading">
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

  if (isError || !dashboard) {
    return (
      <div className="p-4 md:p-6" data-testid="trading-analytics-error">
        <p className="text-sm text-destructive">Could not load Trading Analytics. Please try again.</p>
      </div>
    );
  }

  const { overview, strategyUsage, journal, risk, learning, coach, session, structure, liquidity, checklist } = dashboard;

  const hasAnyData =
    overview.tradesReviewed > 0 ||
    overview.plansCreated > 0 ||
    overview.journalEntries > 0 ||
    overview.strategiesRegistered > 0 ||
    overview.workspaceNotes > 0;

  const maxSessionCount = Math.max(...session.activity.map((a) => a.count), 0);
  const evidenceChartData = Object.keys(strategyUsage.requiredEvidenceByType).map((type) => ({
    type,
    required: strategyUsage.requiredEvidenceByType[type as keyof typeof strategyUsage.requiredEvidenceByType],
    attached: strategyUsage.evidenceLinksAttachedByType[type as keyof typeof strategyUsage.evidenceLinksAttachedByType],
  }));
  const checklistStatusData = [
    { name: "Complete", value: strategyUsage.checklistsComplete },
    { name: "In Progress", value: strategyUsage.checklistsInProgress },
  ];
  const moodChartData = Object.entries(journal.moodTally).map(([mood, count]) => ({ mood, count }));
  const setupTypeChartData = Object.entries(journal.setupTypeTally).map(([type, count]) => ({ type, count }));
  const rMultipleChartData = journal.rMultipleDistribution.map((b) => ({ label: b.label, count: b.count }));
  const riskRewardChartData = risk.riskRewardDistribution.map((b) => ({ label: b.label, count: b.count }));
  const stopTargetOnlyOne = Math.max(0, risk.openPositionsCount - risk.positionsWithBothStopAndTarget - risk.positionsWithNeitherStopNorTarget);
  const stopTargetChartData = [
    { name: "Both stop & target", value: risk.positionsWithBothStopAndTarget },
    { name: "One of the two", value: stopTargetOnlyOne },
    { name: "Neither", value: risk.positionsWithNeitherStopNorTarget },
  ];
  const learningCompletionData = [
    { name: "Completed", value: learning.completedTopics },
    { name: "Remaining", value: learning.remainingTopics },
  ];
  const coachChartData = coach.byType.map((r) => ({ coach: r.label, views: r.viewCount }));

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="trading-analytics-dashboard">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" /> Trading Analytics Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deterministic aggregation of your own already-persisted Trading Engine data — trades reviewed, strategy and
          checklist usage, journal, risk, learning progress, Trading AI Coach usage, and session activity. Never a new
          signal, score, or prediction — only a count, tally, or simple aggregate of data you already recorded.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="trading-analytics-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Analytics &amp; Reporting
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            No Predictions
          </Badge>
        </div>
        {/* Phase 34 — Cross-Engine Orchestration & Unified Workspace. Pure
            navigation, no fetch. */}
        <Link href="/cross-engine-workspace" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-cross-engine-workspace">
          <Grid3x3 className="w-3 h-3" /> Open Cross-Engine Workspace →
        </Link>
      </div>

      {!hasAnyData && (
        <Card className="bg-card border-border" data-testid="trading-analytics-empty">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">
              No Trading Engine activity recorded yet. As you review trades, create plans, journal entries, and
              registered strategies, this dashboard will reflect it — always honest zeros, never a fabricated figure.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="trading-analytics-overview-cards">
        <KpiCard label="Trades Reviewed" value={overview.tradesReviewed} testId="kpi-trades-reviewed" />
        <KpiCard label="Plans Created" value={overview.plansCreated} testId="kpi-plans-created" />
        <KpiCard label="Journal Entries" value={overview.journalEntries} testId="kpi-journal-entries" />
        <KpiCard label="Workspace Notes" value={overview.workspaceNotes} testId="kpi-workspace-notes" />
        <KpiCard label="Strategies Registered" value={overview.strategiesRegistered} testId="kpi-strategies-registered" />
        <KpiCard label="Checklist Instances" value={overview.checklistInstances} testId="kpi-checklist-instances" />
      </div>

      <Link
        href="/reporting-centre?reportType=trading-analytics-summary"
        className="text-xs text-primary hover:underline inline-flex items-center gap-1.5"
        data-testid="link-trading-analytics-report"
      >
        <FileBarChart2 className="w-3 h-3" /> View the full Trading Analytics Summary Report in the Reporting Centre
      </Link>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-analytics-overview">
            <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="strategy" data-testid="tab-strategy-analytics">
            <Layers className="w-3.5 h-3.5 mr-1" /> Strategy
          </TabsTrigger>
          <TabsTrigger value="journal" data-testid="tab-journal-analytics">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Journal
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk-analytics">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Risk
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning-analytics">
            <GraduationCap className="w-3.5 h-3.5 mr-1" /> Learning
          </TabsTrigger>
          <TabsTrigger value="coach" data-testid="tab-coach-analytics">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Coach
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-session-analytics">
            <Clock className="w-3.5 h-3.5 mr-1" /> Sessions
          </TabsTrigger>
        </TabsList>

        {/* ─── Analytics Overview ──────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Checklist Completion</CardTitle>
              <CardDescription>Reused directly from computeChecklistCompletion() — no second formula.</CardDescription>
            </CardHeader>
            <CardContent>
              {strategyUsage.checklistInstances === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-checklists">
                  No checklist instances have been run yet.
                </p>
              ) : (
                <div className="h-56" data-testid="chart-checklist-completion">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={checklistStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                        {checklistStatusData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Engine Usage — Structure &amp; Liquidity</CardTitle>
              <CardDescription>
                No structure/liquidity analysis is ever persisted — these figures count real Trading AI Coach usage and
                real strategy evidence citations, never a re-derivation of a structure/liquidity reading.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Structure Coach Views" value={structure.coachViewCount} testId="kpi-structure-coach-views" />
              <KpiCard label="Strategies Citing Structure" value={structure.strategiesRequiringAsEvidence} testId="kpi-structure-evidence" />
              <KpiCard label="Structure Evidence Links" value={structure.evidenceLinksAttached} testId="kpi-structure-links" />
              <KpiCard label="Liquidity Coach Views" value={liquidity.coachViewCount} testId="kpi-liquidity-coach-views" />
              <KpiCard label="Strategies Citing Liquidity" value={liquidity.strategiesRequiringAsEvidence} testId="kpi-liquidity-evidence" />
              <KpiCard label="Liquidity Evidence Links" value={liquidity.evidenceLinksAttached} testId="kpi-liquidity-links" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Strategy Analytics ──────────────────────────────────────── */}
        <TabsContent value="strategy" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Strategies Registered" value={strategyUsage.strategiesRegistered} testId="kpi-strategy-count" />
            <KpiCard label="Checklists Complete" value={strategyUsage.checklistsComplete} testId="kpi-checklists-complete" />
            <KpiCard label="Checklists In Progress" value={strategyUsage.checklistsInProgress} testId="kpi-checklists-in-progress" />
            <KpiCard label="Avg. Completion" value={`${strategyUsage.overallChecklistCompletionPct}%`} testId="kpi-avg-completion" />
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Evidence Usage by Source</CardTitle>
              <CardDescription>Declared-required vs. actually-attached evidence links, both real signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-evidence-usage">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evidenceChartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="required" name="Required by strategies" fill={CHART_COLORS[0]} />
                    <Bar dataKey="attached" name="Evidence links attached" fill={CHART_COLORS[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Checklist Instances by Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              {checklist.byStrategy.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-checklist-by-strategy">
                  No checklist instances have been run yet.
                </p>
              ) : (
                <Table data-testid="table-checklist-by-strategy">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Instances</TableHead>
                      <TableHead>Complete</TableHead>
                      <TableHead>Avg. % Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklist.byStrategy.map((row) => (
                      <TableRow key={row.strategyId} data-testid={`row-checklist-strategy-${row.strategyId}`}>
                        <TableCell>{row.strategyName}</TableCell>
                        <TableCell>{row.instanceCount}</TableCell>
                        <TableCell>{row.completeCount}</TableCell>
                        <TableCell>{row.averagePercentComplete}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Journal Analytics ───────────────────────────────────────── */}
        <TabsContent value="journal" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Journal Entries" value={journal.entryCount} testId="kpi-journal-entry-count" />
            <KpiCard label="Lesson Recorded" value={`${journal.lessonRecordedPct}%`} testId="kpi-lesson-recorded-pct" />
            <KpiCard label="R-Multiple Entries" value={journal.rMultipleEntriesCount} testId="kpi-rmultiple-count" />
            <KpiCard label="Avg. R-Multiple" value={journal.averageRMultiple ?? "—"} testId="kpi-avg-rmultiple" />
          </div>

          {journal.entryCount === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-journal-entries">
              No journal entries have been recorded yet.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">Mood &amp; Setup Type</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="h-56" data-testid="chart-journal-mood">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={moodChartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mood" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Entries" fill={CHART_COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56" data-testid="chart-journal-setup-type">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={setupTypeChartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Entries" fill={CHART_COLORS[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">R-Multiple Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56" data-testid="chart-rmultiple-distribution">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rMultipleChartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Entries" fill={CHART_COLORS[3]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Risk Analytics ──────────────────────────────────────────── */}
        <TabsContent value="risk" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Open Positions" value={risk.openPositionsCount} testId="kpi-open-positions" />
            <KpiCard label="Plans With Risk Params" value={risk.plansWithRiskParams} testId="kpi-plans-with-risk" />
            <KpiCard label="Stop/Target Discipline" value={`${risk.stopTargetDisciplinePct}%`} testId="kpi-stop-target-discipline" />
            <KpiCard label="Avg. Account Risk" value={risk.averageAccountRiskPct !== null ? `${risk.averageAccountRiskPct}%` : "—"} testId="kpi-avg-account-risk" />
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Stop / Target Discipline</CardTitle>
              <CardDescription>Real, already-recorded position fields — never a re-run of the live Risk Engine.</CardDescription>
            </CardHeader>
            <CardContent>
              {risk.openPositionsCount === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-open-positions">
                  No open positions to report risk analytics for.
                </p>
              ) : (
                <div className="h-56" data-testid="chart-stop-target-discipline">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stopTargetChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                        {stopTargetChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Risk/Reward Distribution</CardTitle>
              <CardDescription>Reads plan.riskRewardRatio — a value already computed at plan-creation time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56" data-testid="chart-riskreward-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskRewardChartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Plans" fill={CHART_COLORS[4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Learning Analytics ──────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Lessons Viewed" value={learning.lessonsViewed} testId="kpi-lessons-viewed" />
            <KpiCard label="Lessons Completed" value={learning.lessonsCompleted} testId="kpi-lessons-completed" />
            <KpiCard label="Glossary Viewed" value={learning.glossaryTermsViewed} testId="kpi-glossary-viewed" />
            <KpiCard label="Strategies Viewed" value={learning.strategiesViewed} testId="kpi-strategies-viewed" />
            <KpiCard label="Coaches Viewed" value={learning.coachesViewed} testId="kpi-coaches-viewed" />
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Learning Path Completion</CardTitle>
              <CardDescription>A pure reformatting of getLearningProgress()'s own already-computed summary.</CardDescription>
            </CardHeader>
            <CardContent>
              {learning.totalTopics === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-learning-progress">
                  No Learning Centre progress recorded yet.
                </p>
              ) : (
                <div className="h-56" data-testid="chart-learning-completion">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={learningCompletionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                        {learningCompletionData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Weakest Topics</CardTitle>
              <CardDescription>Paths below 50% completion, sorted lowest-first — never a prediction of what to study next.</CardDescription>
            </CardHeader>
            <CardContent>
              {learning.weakestPaths.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-weak-paths">
                  No weak topics to report — either nothing has been started, or every started path is at least half complete.
                </p>
              ) : (
                <Table data-testid="table-weakest-paths">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead>% Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learning.weakestPaths.map((p) => (
                      <TableRow key={p.pathKey} data-testid={`row-weak-path-${p.pathKey}`}>
                        <TableCell>{p.title}</TableCell>
                        <TableCell>{p.percentComplete}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Coach Analytics ─────────────────────────────────────────── */}
        <TabsContent value="coach" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Total Coach Views" value={coach.totalCoachViews} testId="kpi-total-coach-views" />
            <KpiCard label="Most Recent Coach" value={coach.mostRecentCoach ?? "—"} testId="kpi-most-recent-coach" />
            <KpiCard label="Most Recent Scope" value={coach.mostRecentScope ?? "—"} testId="kpi-most-recent-scope" />
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Coach Views by Type</CardTitle>
              <CardDescription>Parses the real, already-persisted learning_progress "coach" rows — never a new tracking mechanism.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-coach-views">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coachChartData} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="coach" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="views" name="Views" fill={CHART_COLORS[5]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Session Analytics ───────────────────────────────────────── */}
        <TabsContent value="sessions" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Session Activity</CardTitle>
              <CardDescription>
                Reuses activeSessionsAt() unmodified to classify real position entry timestamps — never a synthetic
                session. Asia combines Sydney + Tokyo; Overlap is any timestamp where more than one session was open.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.totalClassified === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-session-data">
                  No positions with a resolvable entry timestamp to classify by session.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="grid-session-heatmap">
                  {session.activity.map((a) => (
                    <div
                      key={a.label}
                      className="rounded-md px-4 py-3 text-sm font-medium text-white min-w-[120px] text-center"
                      style={{ backgroundColor: heatColor(a.count, maxSessionCount) }}
                      data-testid={`heatmap-cell-session-${a.label.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <div>{a.label}</div>
                      <div className="text-lg">{a.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Phase 40 — Institutional Decision Support & Executive Insights Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/decisionSupportEngine.ts). This page introduces no new signal,
// score, prediction, or trading logic of its own — it is interpretation
// only. No AI predictions, no trade recommendations, no buy/sell signals,
// no portfolio optimisation, no auto execution, no auto hedging, no auto
// rebalancing, no market forecasting, no machine learning, no generative
// investment advice.
//
// Every figure is a direct read from:
//   - GET /decision-support/dashboard — Executive Summary, Portfolio
//     Health Overview, Risk/Performance/Scenario/Capital Allocation/
//     Exposure/Diversification Summary, deterministic Executive Alerts,
//     Outstanding Issues, Key Metrics Dashboard, Executive Health scorecard
//   - GET /decision-support/coach     — the deterministic AI Coach
//   - GET /decision-support/learning  — Learning Centre integration
//   - GET /reporting/executive-decision-summary,
//     GET /reporting/institutional-health-report — Reporting Centre links

import { Link } from "wouter";
import { useGetDecisionSupportDashboard, getGetDecisionSupportDashboardQueryKey, useListDecisionSupportCoachTopics, useListDecisionSupportLearning } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, GraduationCap, FileBarChart2, Gauge, ListChecks } from "lucide-react";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function severityBadgeClass(severity: string): string {
  if (severity === "elevated") return "border-red-500/40 text-red-400";
  if (severity === "moderate") return "border-amber-500/40 text-amber-400";
  return "border-blue-500/40 text-blue-400";
}

export default function DecisionSupportEngine() {
  const dashboardQuery = useGetDecisionSupportDashboard({ query: { queryKey: getGetDecisionSupportDashboardQueryKey() } });
  const coachQuery = useListDecisionSupportCoachTopics();
  const learningQuery = useListDecisionSupportLearning();

  const dashboard = dashboardQuery.data;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="decision-support-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Gauge className="w-6 h-6 text-amber-400" /> Institutional Decision Support & Executive Insights Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A deterministic executive workspace consolidating Risk & Exposure, Performance & Attribution, Scenario &
          Stress Testing, and Portfolio Concentration into one Executive Summary, Portfolio Health Overview, and
          Executive Health scorecard. Interpretation only — no AI predictions, no trade recommendations, no buy/sell
          signals, no portfolio optimisation, no auto execution, no auto hedging, no auto rebalancing, no market
          forecasting, no machine learning, no generative investment advice.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="decision-support-labels">
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Executive Decision Support
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Interpretation Only — No Recommendations
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-dse-dashboard">
            <Gauge className="w-4 h-4 mr-1" /> Executive Dashboard
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-dse-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-dse-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Executive Dashboard ────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardQuery.isLoading ? (
            <Skeleton className="h-96" />
          ) : dashboardQuery.isError || !dashboard ? (
            <p className="text-xs text-destructive flex items-center gap-1" data-testid="decision-support-dashboard-error">
              <AlertTriangle className="w-3.5 h-3.5" /> Unable to load the Decision Support dashboard.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-dse-executive-summary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Executive Summary</CardTitle>
                  <CardDescription className="text-xs">{dashboard.executiveSummary.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div data-testid="es-investing">
                    <p className="text-xs text-muted-foreground">Investing</p>
                    <p className="text-sm">
                      {dashboard.executiveSummary.investingHoldingsCount} holding(s), {fmtUsd(dashboard.executiveSummary.investingMarketValue)}
                    </p>
                  </div>
                  <div data-testid="es-trading">
                    <p className="text-xs text-muted-foreground">Trading</p>
                    <p className="text-sm">
                      {dashboard.executiveSummary.tradingOpenPositionsCount} open, {fmtUsd(dashboard.executiveSummary.tradingAccountValue)}
                    </p>
                  </div>
                  <div data-testid="es-options">
                    <p className="text-xs text-muted-foreground">Options</p>
                    <p className="text-sm">
                      {dashboard.executiveSummary.optionsOpenPositionsCount} open, {fmtUsd(dashboard.executiveSummary.optionsPortfolioValue)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-dse-portfolio-health">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Portfolio Health Overview</CardTitle>
                  <CardDescription className="text-xs">Overall {dashboard.portfolioHealthOverview.overallScore ?? "n/a"}/100 — a renormalized average of each engine's own already-computed health score, never blended into a fabricated single figure.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(["investing", "trading", "options"] as const).map((eng) => {
                    const h = dashboard.portfolioHealthOverview[eng];
                    return (
                      <div key={eng} data-testid={`ph-${eng}`}>
                        <p className="text-xs text-muted-foreground capitalize">{eng}</p>
                        <p className="text-sm">{h.available ? `${h.score}/100 (${h.label})` : "unavailable"}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-dse-alerts">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Executive Alerts</CardTitle>
                  <CardDescription className="text-xs">Deterministic threshold-based observations — never a forecast, never a suggested action.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {dashboard.executiveAlerts.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="decision-support-alerts-empty">
                      No executive alerts — every monitored threshold is currently within range.
                    </p>
                  ) : (
                    dashboard.executiveAlerts.map((a, i) => (
                      <div key={`${a.code}-${i}`} className="flex items-center justify-between text-xs" data-testid={`alert-${i}`}>
                        <span>{a.label}</span>
                        <Badge variant="outline" className={`text-[10px] ${severityBadgeClass(a.severity)}`}>
                          {a.severity}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-dse-outstanding-issues">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Outstanding Issues</CardTitle>
                  <CardDescription className="text-xs">Already-flagged issues surfaced from the underlying engines — never a newly invented issue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dashboard.outstandingIssues.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="decision-support-issues-empty">
                      No outstanding issues on record.
                    </p>
                  ) : (
                    dashboard.outstandingIssues.map((iss, i) => (
                      <div key={`${iss.code}-${i}`} className="flex justify-between text-xs" data-testid={`issue-${i}`}>
                        <span>
                          [{iss.engine}] {iss.label}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-dse-key-metrics">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Key Metrics Dashboard</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {dashboard.keyMetrics.map((m) => (
                    <div key={m.code} data-testid={`metric-${m.code}`}>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      <p className="text-sm">{m.value != null ? (m.unit === "usd" ? fmtUsd(m.value) : m.unit === "pct" ? `${m.value}%` : m.value) : "n/a"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-dse-executive-health">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4" /> Executive Health Scorecard
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Composite {dashboard.executiveHealth.compositeScore ?? "n/a"}/100 — dimensions without a genuine, already-existing 0-100 scoring formula are shown as raw figures, honestly excluded from the composite.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboard.executiveHealth.dimensions.map((d) => (
                    <div key={d.code} data-testid={`health-dim-${d.code}`}>
                      <div className="flex justify-between text-xs">
                        <span>
                          {d.label}
                          {d.includedInComposite ? " •" : ""}
                        </span>
                        <span className="text-muted-foreground">{d.score != null ? `${d.score}/100` : "n/a"}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{d.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-dse-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">Deterministic explanations of executive dashboards, institutional decision support, portfolio interpretation, risk, performance, scenario analysis, diversification, and capital allocation — never a trade recommendation.</CardDescription>
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

          <Card className="bg-card border-border" data-testid="panel-dse-learning">
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
          <Card className="bg-card border-border" data-testid="panel-dse-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Decision Support Reporting</CardTitle>
              <CardDescription className="text-xs">Executive Decision Summary and Institutional Health Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=executive-decision-summary" className="text-xs text-primary hover:underline block" data-testid="link-report-executive-decision-summary">
                Generate Executive Decision Summary →
              </Link>
              <Link href="/reporting-centre?reportType=institutional-health-report" className="text-xs text-primary hover:underline block" data-testid="link-report-institutional-health-report">
                Generate Institutional Health Report →
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

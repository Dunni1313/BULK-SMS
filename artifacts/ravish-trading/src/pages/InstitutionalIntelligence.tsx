// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation).
//
// A single page surfacing every service the new Institutional
// Intelligence Engine exposes (Observation, Explanation, Health,
// Summary, Timeline, Learning) via ONE GET /intelligence request
// (lib/intelligenceEngine.ts, backend) — a pure composition layer over
// the already-existing Portfolio Dashboard and Theta Income engines, zero
// new pricing/provider calls. This is NOT an LLM integration, NOT a
// chatbot, and NOT a statistical prediction engine — every observation
// below is deterministic and fully traceable to an already-computed
// platform figure. Never submits, closes, or modifies anything, and
// never generates a trade recommendation.

import { useGetInstitutionalIntelligence } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function ratingBadgeClass(code: string): string {
  if (code === "healthy") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (code === "moderate_risk") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (code === "elevated_risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function severityBadgeClass(severity: string): string {
  if (severity === "elevated") return "bg-destructive/15 text-destructive border-destructive/30";
  if (severity === "watch") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (severity === "positive") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  return "bg-sky-500/15 text-sky-400 border-sky-500/30";
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

export default function InstitutionalIntelligence() {
  const { data: result, isLoading, isError } = useGetInstitutionalIntelligence();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Institutional Intelligence</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-institutional-intelligence">
            Institutional Intelligence
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-deterministic-analysis">
            Deterministic Analysis
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-intelligence">
            Paper Trading
          </Badge>
          <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-read-only-intelligence">
            Read Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A deterministic intelligence layer analysing the platform&apos;s own already-computed analytics —
          Portfolio Health, Theta Income, Concentration, Event Risk, and Broker status. Every observation
          below is fully traceable to an existing calculation. This is not an LLM integration, a chatbot, or
          a statistical prediction engine, and it never generates a trade recommendation.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="intelligence-loading">
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
            <p className="text-sm text-destructive" data-testid="text-intelligence-error">
              Failed to load the Institutional Intelligence result. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Executive Summary ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-executive-summary">
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold" data-testid="text-executive-headline">{result.executiveSummary.headline}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground" data-testid="list-executive-bullets">
                {result.executiveSummary.bullets.map((b, i) => (
                  <li key={i} data-testid={`executive-bullet-${i}`}>
                    {b}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ─── Health Overview ────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-health-overview">
            <CardHeader>
              <CardTitle>Health Overview</CardTitle>
              <CardDescription>
                Aggregates Portfolio Health, Concentration, Diversification, Event Risk, Greeks, Broker, and
                Position Quality — the exact same score the Portfolio Dashboard already computes, never a
                second, competing score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground">Overall Health Score</div>
                  <div className="font-mono text-2xl" data-testid="text-overall-health-score">
                    {result.health.overallHealthScore}/100
                  </div>
                </div>
                <Badge className={ratingBadgeClass(result.health.overallRiskRating.code)} data-testid="badge-overall-risk-rating">
                  {result.health.overallRiskRating.label}
                </Badge>
                <Badge className={trendBadgeClass(result.health.healthTrend)} data-testid="badge-health-trend">
                  {result.health.healthTrend.replace("_", " ")}
                </Badge>
                <Badge variant="outline" data-testid="badge-broker-health-label">
                  Broker: {result.health.brokerHealth.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-health-trend-detail">
                {result.health.healthTrendDetail}
              </p>
              <p className="text-sm" data-testid="text-health-summary">{result.health.healthSummary}</p>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Health Drivers (worst-first)</div>
                <ul className="space-y-1 text-sm" data-testid="list-health-drivers">
                  {result.health.healthDrivers.map((d) => (
                    <li key={d.code} className="flex items-center justify-between" data-testid={`driver-${d.code}`}>
                      <span>{d.label}</span>
                      <span className="font-mono">{d.score}/100</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ─── Highest Priority ───────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-highest-priority">
            <CardHeader>
              <CardTitle>Highest Priority</CardTitle>
              <CardDescription>Elevated-severity observations only — explanation, not advice.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.highestPriority.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-highest-priority">
                  No elevated-priority observations right now.
                </p>
              ) : (
                <ul className="space-y-3" data-testid="list-highest-priority">
                  {result.highestPriority.map((o) => (
                    <li key={o.code} data-testid={`highest-priority-${o.code}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={severityBadgeClass(o.severity)}>{o.title}</Badge>
                        <span className="text-xs text-muted-foreground">{o.sourceModule}</span>
                      </div>
                      <p className="text-sm mt-1">{o.explanation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── Latest Observations ────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-observations">
            <CardHeader>
              <CardTitle>Latest Observations</CardTitle>
              <CardDescription>
                Every observation discloses its severity, category, source module, confidence, and a
                learning link — never a fabricated probability, never a trade recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4" data-testid="list-observations">
                {result.observations.map((o) => (
                  <li key={o.code} className="border-b border-border pb-3 last:border-0 last:pb-0" data-testid={`observation-${o.code}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={severityBadgeClass(o.severity)}>{o.title}</Badge>
                      <Badge variant="outline">{o.category.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" data-testid={`observation-confidence-${o.code}`}>
                        {o.confidence} confidence
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{o.explanation}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.confidenceReason}</p>
                    {o.supportingMetrics.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {o.supportingMetrics.map((m, i) => (
                          <li key={i}>
                            {m.label}: <span className="font-mono">{m.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Source: {o.sourceModule}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ─── Portfolio / Income / Risk Insights ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-card border-border" data-testid="card-portfolio-insights">
              <CardHeader>
                <CardTitle className="text-base">Portfolio Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {result.portfolioInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-portfolio-insights">None right now.</p>
                ) : (
                  <ul className="space-y-1 text-sm" data-testid="list-portfolio-insights">
                    {result.portfolioInsights.map((o) => (
                      <li key={o.code}>{o.title}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card border-border" data-testid="card-income-insights">
              <CardHeader>
                <CardTitle className="text-base">Income Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {result.incomeInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-income-insights">None right now.</p>
                ) : (
                  <ul className="space-y-1 text-sm" data-testid="list-income-insights">
                    {result.incomeInsights.map((o) => (
                      <li key={o.code}>{o.title}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card border-border" data-testid="card-risk-insights">
              <CardHeader>
                <CardTitle className="text-base">Risk Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {result.riskInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-risk-insights">None right now.</p>
                ) : (
                  <ul className="space-y-1 text-sm" data-testid="list-risk-insights">
                    {result.riskInsights.map((o) => (
                      <li key={o.code}>{o.title}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Timeline ────────────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-timeline">
            <CardHeader>
              <CardTitle>Intelligence Timeline</CardTitle>
              <CardDescription>
                {result.timeline.comparedTo
                  ? `Compared against the snapshot recorded on ${result.timeline.comparedTo}.`
                  : "No prior recorded snapshot exists yet — trend comparisons will appear after the next recorded day."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Health Change</div>
                  {result.timeline.healthChange ? (
                    <div data-testid="text-timeline-health-change">
                      <Badge className={trendBadgeClass(result.timeline.healthChange.direction)}>
                        {result.timeline.healthChange.direction}
                      </Badge>
                      <div className="font-mono text-xs mt-1">{result.timeline.healthChange.detail}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground" data-testid="text-timeline-health-change-none">—</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Income Change</div>
                  {result.timeline.incomeChange ? (
                    <div data-testid="text-timeline-income-change">
                      <Badge className={trendBadgeClass(result.timeline.incomeChange.direction)}>
                        {result.timeline.incomeChange.direction}
                      </Badge>
                      <div className="font-mono text-xs mt-1">{result.timeline.incomeChange.detail}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground" data-testid="text-timeline-income-change-none">—</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Risk Rating Change</div>
                  {result.timeline.riskRatingChange ? (
                    <div className="font-mono text-xs" data-testid="text-timeline-risk-rating-change">
                      {result.timeline.riskRatingChange.from} → {result.timeline.riskRatingChange.to}
                    </div>
                  ) : (
                    <div className="text-muted-foreground" data-testid="text-timeline-risk-rating-change-none">—</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Observation Entries</div>
                {result.timeline.entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-timeline-entries">No timeline entries.</p>
                ) : (
                  <ul className="space-y-1" data-testid="list-timeline-entries">
                    {result.timeline.entries.map((e) => (
                      <li key={e.code} className="flex items-center gap-2 text-sm" data-testid={`timeline-entry-${e.code}`}>
                        <Badge className={timelineStatusBadgeClass(e.status)}>{e.status}</Badge>
                        <span>{e.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Learning Links ──────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-learning-links">
            <CardHeader>
              <CardTitle>Learning Links</CardTitle>
              <CardDescription>Every observation points to a real, existing page — never a fabricated resource.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2" data-testid="list-learning-links">
                {result.learningLinks.map((l) => (
                  <li key={l.label}>
                    {l.comingSoon || !l.href ? (
                      <Badge variant="outline" data-testid={`learning-link-coming-soon-${l.label}`}>
                        {l.label} (coming soon)
                      </Badge>
                    ) : (
                      <a href={l.href} data-testid={`learning-link-${l.label}`}>
                        <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25 cursor-pointer">
                          {l.label}
                        </Badge>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

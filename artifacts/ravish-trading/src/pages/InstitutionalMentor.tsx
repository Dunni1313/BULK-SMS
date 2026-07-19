// Institutional Mentor — Phase 8, Sprint 5.
//
// The final intelligence layer: teaches the user how a professional
// portfolio manager would evaluate THEIR OWN existing Paper Trading
// portfolio. ONE new GET /institutional-mentor request
// (lib/institutionalMentor.ts, backend) is a pure composition over the
// Portfolio Dashboard, Correlation & Concentration overlay, Portfolio
// Stress Test, and the AI Trade Journal — zero new pricing/risk/scoring
// calculations beyond a small number of disclosed, named threshold
// constants for the one genuinely new figure (Income Generation).
//
// THIS IS NOT an LLM, a chatbot, predictive AI, financial advice,
// portfolio optimisation, or a trade recommendation engine. Every
// statement below is either a direct pass-through of an already-computed
// value or a deterministic, disclosed template gated by an
// already-computed threshold. Never submits, closes, or modifies
// anything.

import { useGetInstitutionalMentor } from "@workspace/api-client-react";
import { Link } from "wouter";
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

function gradeBadgeClass(grade: string): string {
  if (grade === "Excellent") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (grade === "Good") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (grade === "Fair") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function trendBadgeClass(direction: string): string {
  if (direction === "improving") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (direction === "declining") return "bg-destructive/15 text-destructive border-destructive/30";
  if (direction === "stable") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function decisionStatusBadgeClass(status: string): string {
  if (status === "followed" || status === "improved") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "exceeded" || status === "declined") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

const SCORECARD_LABELS: Record<string, string> = {
  capital_allocation: "Capital Allocation",
  risk_management: "Risk Management",
  diversification: "Diversification",
  discipline: "Discipline",
  income_generation: "Income Generation",
  position_sizing: "Position Sizing",
  greeks_management: "Greeks Management",
  event_preparation: "Event Preparation",
  portfolio_health: "Portfolio Health",
};

export default function InstitutionalMentor() {
  const { data: result, isLoading, isError } = useGetInstitutionalMentor();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Institutional Mentor</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-institutional-mentor">
            Institutional Mentor
          </Badge>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-behaviour-analysis-mentor">
            Professional Portfolio Review
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-deterministic-analysis-mentor">
            Deterministic Analysis
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mentor">
            Paper Trading
          </Badge>
          <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-educational-only-mentor">
            Educational Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Teaches you how a professional portfolio manager would evaluate your own existing Paper Trading
          portfolio — a 9-category Scorecard, a Professional Review, a Decision Review, and narrative Capital
          Allocation, Risk, Income, and Behaviour reviews. Not an LLM, a chatbot, predictive AI, financial
          advice, portfolio optimisation, or a trade recommendation engine — every statement below references
          an existing, already-computed calculation.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="mentor-loading">
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
            <p className="text-sm text-destructive" data-testid="text-mentor-error">
              Failed to load the Institutional Mentor result. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Portfolio Scorecard ────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-scorecard">
            <CardHeader>
              <CardTitle>Portfolio Scorecard</CardTitle>
              <CardDescription>
                Every score is a direct projection of an already-computed figure — hover the source module in
                the &quot;why&quot; text to trace it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {result.scorecard.map((entry) => (
                  <div key={entry.category} className="border border-border rounded-md p-3" data-testid={`scorecard-${entry.category}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{SCORECARD_LABELS[entry.category] ?? entry.category}</span>
                      <Badge className={gradeBadgeClass(entry.grade)} data-testid={`scorecard-grade-${entry.category}`}>
                        {entry.grade}
                      </Badge>
                    </div>
                    <div className="font-mono text-lg mt-1" data-testid={`scorecard-score-${entry.category}`}>
                      {entry.score}/100
                    </div>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`scorecard-why-${entry.category}`}>
                      {entry.why}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{entry.sourceModule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Professional Review ────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-professional-review">
            <CardHeader>
              <CardTitle>Professional Review</CardTitle>
              <CardDescription>Deterministic observations in the institutional-PM voice — every statement is threshold-gated, never generated.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.professionalReview.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-professional-review">No notable observations right now.</p>
              ) : (
                <ul className="space-y-2" data-testid="list-professional-review">
                  {result.professionalReview.map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" data-testid={`professional-observation-${i}`}>
                      <Badge variant="outline" className="mt-0.5">{obs.category}</Badge>
                      <span>{obs.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── Decision Review ─────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-decision-review">
            <CardHeader>
              <CardTitle>Decision Review</CardTitle>
              <CardDescription>Explains completed decisions — never a recommendation. Every item is scored via a deterministic rule.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-decision-review">
                {result.decisionReview.map((item) => (
                  <li key={item.code} className="text-sm" data-testid={`decision-item-${item.code}`}>
                    <div className="flex items-center gap-2">
                      <Badge className={decisionStatusBadgeClass(item.status)}>{item.status}</Badge>
                      <span className="font-medium">{item.text}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── Capital Allocation Review ─────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-capital-allocation-review">
              <CardHeader>
                <CardTitle>Capital Allocation Review</CardTitle>
                <CardDescription>Capital efficiency, allocation balance, cash utilisation, position distribution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-lg" data-testid="text-capital-efficiency-score">{result.capitalAllocationReview.capitalEfficiencyScore}/100</span>
                  <Badge className={gradeBadgeClass(result.capitalAllocationReview.capitalEfficiencyGrade)}>{result.capitalAllocationReview.capitalEfficiencyGrade}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Cash Utilisation</div>
                    <div className="font-mono" data-testid="text-cash-utilization">{fmtPct(result.capitalAllocationReview.cashUtilizationPct)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Buying Power</div>
                    <div className="font-mono" data-testid="text-capital-buying-power">{fmtUsd(result.capitalAllocationReview.buyingPower)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Portfolio Value</div>
                    <div className="font-mono" data-testid="text-capital-portfolio-value">{fmtUsd(result.capitalAllocationReview.portfolioValue)}</div>
                  </div>
                </div>
                <p className="text-sm" data-testid="text-capital-allocation-summary">{result.capitalAllocationReview.summary}</p>
                {result.capitalAllocationReview.allocationByStrategy.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Allocation by Strategy</div>
                    <ul className="space-y-0.5 text-sm" data-testid="list-allocation-by-strategy">
                      {result.capitalAllocationReview.allocationByStrategy.map((b) => (
                        <li key={b.key} className="flex items-center justify-between">
                          <span>{b.label}</span>
                          <span className="font-mono text-xs">{fmtPct(b.weightPct)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Risk Review ────────────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-risk-review">
              <CardHeader>
                <CardTitle>Risk Review</CardTitle>
                <CardDescription>Reuses Stress Testing, Event Risk, Concentration, and Correlation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid="badge-risk-review-largest">Largest Risk: {result.riskReview.largestPortfolioRisk}</Badge>
                  <Badge className={trendBadgeClass(result.riskReview.riskTrend)} data-testid="badge-risk-review-trend">
                    Risk {result.riskReview.riskTrend.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm" data-testid="text-risk-review-contributor">Primary Contributor: {result.riskReview.primaryContributor}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-risk-review-trend-detail">{result.riskReview.riskTrendDetail}</p>
                {result.riskReview.worstStressScenario && (
                  <p className="text-xs text-muted-foreground" data-testid="text-risk-review-worst-stress">
                    Worst Stress Scenario: {result.riskReview.worstStressScenario.label} ({fmtUsd(result.riskReview.worstStressScenario.portfolioValueImpact)})
                  </p>
                )}
                <p className="text-sm" data-testid="text-risk-review-summary">{result.riskReview.summary}</p>
              </CardContent>
            </Card>

            {/* ─── Income Review ──────────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-income-review">
              <CardHeader>
                <CardTitle>Income Review</CardTitle>
                <CardDescription>Reuses Theta Income directly for Income Projection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Monthly</div>
                    <div className="font-mono" data-testid="text-income-review-monthly">{fmtUsd(result.incomeReview.monthlyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Weekly</div>
                    <div className="font-mono" data-testid="text-income-review-weekly">{fmtUsd(result.incomeReview.weeklyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Daily</div>
                    <div className="font-mono" data-testid="text-income-review-daily">{fmtUsd(result.incomeReview.dailyTheta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Annualized</div>
                    <div className="font-mono" data-testid="text-income-review-annualized">{fmtUsd(result.incomeReview.annualizedTheta)}</div>
                  </div>
                </div>
                <Badge className={trendBadgeClass(result.incomeReview.incomeTrend)} data-testid="badge-income-review-trend">
                  Income {result.incomeReview.incomeTrend.replace(/_/g, " ")}
                </Badge>
                <p className="text-xs text-muted-foreground" data-testid="text-income-review-trend-detail">{result.incomeReview.incomeTrendDetail}</p>
                <p className="text-sm" data-testid="text-income-review-summary">{result.incomeReview.summary}</p>
              </CardContent>
            </Card>

            {/* ─── Behaviour Review ───────────────────────────────────────── */}
            <Card className="bg-card border-border" data-testid="card-behaviour-review">
              <CardHeader>
                <CardTitle>Behaviour Review</CardTitle>
                <CardDescription>Reuses the AI Trade Journal directly — long-term behavioural improvements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-lg" data-testid="text-behaviour-discipline-score">{result.behaviourReview.disciplineScore}/100</span>
                  <Badge variant="outline" data-testid="badge-behaviour-closed-trades">{result.behaviourReview.totalClosedTrades} closed trades</Badge>
                  {result.behaviourReview.behaviorTrend && (
                    <Badge className={trendBadgeClass(result.behaviourReview.behaviorTrend.direction)} data-testid="badge-behaviour-trend">
                      {result.behaviourReview.behaviorTrend.direction}
                    </Badge>
                  )}
                </div>
                <p className="text-sm" data-testid="text-behaviour-review-summary">{result.behaviourReview.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Strengths</div>
                    {result.behaviourReview.strengths.length === 0 ? (
                      <p className="text-xs text-muted-foreground" data-testid="text-behaviour-no-strengths">None yet</p>
                    ) : (
                      <ul className="space-y-0.5 text-sm" data-testid="list-behaviour-strengths">
                        {result.behaviourReview.strengths.map((s) => (
                          <li key={s.code}>{s.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Areas to Improve</div>
                    {result.behaviourReview.areasToImprove.length === 0 ? (
                      <p className="text-xs text-muted-foreground" data-testid="text-behaviour-no-areas">None yet</p>
                    ) : (
                      <ul className="space-y-0.5 text-sm" data-testid="list-behaviour-areas">
                        {result.behaviourReview.areasToImprove.map((a) => (
                          <li key={a.code}>{a.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Watchlist Review (Phase 12) — a plain, ownership-scoped
              read of the user's own Engine 1 Value Watchlist; zero new
              scoring, since currentDecision/marginOfSafetyTarget are
              already-stored fields on the watchlist row itself. ───────── */}
          <Card className="bg-card border-border" data-testid="card-watchlist-review">
            <CardHeader>
              <CardTitle>Long-Term Investing Watchlist Review</CardTitle>
              <CardDescription>Reuses the Institutional Investing Engine's own Value Watchlist directly — no new scoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm" data-testid="text-watchlist-review-summary">{result.watchlistReview.summary}</p>
              {result.watchlistReview.itemCount === 0 ? (
                <Link href="/stock-analyst" className="text-xs font-medium text-primary hover:underline" data-testid="link-watchlist-review-research">
                  Research a company →
                </Link>
              ) : (
                <div className="space-y-1.5" data-testid="list-watchlist-review-items">
                  {result.watchlistReview.items.map((w) => (
                    <div key={w.symbol} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{w.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {w.currentDecision}
                      </Badge>
                    </div>
                  ))}
                  <Link href="/stock-analyst" className="text-xs font-medium text-primary hover:underline">
                    Open Value Research →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Portfolio Review (Phase 13) — a plain, ownership-scoped
              read of the user's own Engine 1 target-allocation portfolios;
              zero new scoring, since portfolio/holding counts are already
              cheap, already-stored counts. ────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-review">
            <CardHeader>
              <CardTitle>Institutional Portfolio Manager Review</CardTitle>
              <CardDescription>Reuses the Institutional Portfolio Manager's own portfolios directly — no new scoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm" data-testid="text-portfolio-review-summary">{result.portfolioReview.summary}</p>
              {result.portfolioReview.portfolioCount === 0 ? (
                <Link href="/stock-analyst/portfolio-construction" className="text-xs font-medium text-primary hover:underline" data-testid="link-portfolio-review-build">
                  Build a portfolio →
                </Link>
              ) : (
                <Link href="/stock-analyst/portfolio-construction" className="text-xs font-medium text-primary hover:underline" data-testid="link-portfolio-review-open">
                  Open Portfolio Manager →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* ─── Decision Engine Review (Phase 14) — a plain, ownership-
              scoped count of the user's own saved Decision Engine snapshots
              and notes; zero new scoring, never a call into
              lib/decisionEngine.ts's own on-demand per-symbol composition. */}
          <Card className="bg-card border-border" data-testid="card-decision-engine-review">
            <CardHeader>
              <CardTitle>Institutional Decision Engine Review</CardTitle>
              <CardDescription>Reuses the Institutional Decision Engine's own saved snapshots and notes directly — no new scoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm" data-testid="text-decision-engine-review-summary">{result.decisionEngineReview.summary}</p>
              {result.decisionEngineReview.snapshotCount === 0 && result.decisionEngineReview.noteCount === 0 ? (
                <Link href="/decision-engine" className="text-xs font-medium text-primary hover:underline" data-testid="link-decision-engine-review-analyze">
                  Analyze a symbol →
                </Link>
              ) : (
                <Link href="/decision-engine" className="text-xs font-medium text-primary hover:underline" data-testid="link-decision-engine-review-open">
                  Open Decision Engine →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* ─── Institutional Lessons ───────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-institutional-lessons">
            <CardHeader>
              <CardTitle>Institutional Lessons</CardTitle>
              <CardDescription>Every review links to a related Learning Centre lesson, Strategy Academy page, Glossary entry, and Explain Mode.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {Object.entries(result.learningSummary).map(([section, link]) => (
                  <div key={section} data-testid={`mentor-learning-cross-link-${section}`}>
                    <div className="text-xs text-muted-foreground capitalize mb-1">{section.replace(/([A-Z])/g, " $1")}</div>
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
                      {link.explainModeHref ? (
                        <a href={link.explainModeHref}>
                          <Badge variant="outline" className="hover:bg-muted cursor-pointer">Explain Mode</Badge>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

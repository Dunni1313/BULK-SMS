// AI Trade Journal — Phase 8, Sprint 4.
//
// A deterministic behavioural analysis and trade review system, backed
// by ONE new GET /trade-journal request (lib/tradeJournal.ts, backend) —
// a pure composition over the Institutional Intelligence Engine's own
// established modules, Position Sizing, Theta Income, the Greeks Engine,
// Event Risk, and the pre-existing Trading Journal (linked journal
// entries, reused, never duplicated) and Learning Progress. Zero new
// pricing/risk calculations beyond a small, disclosed set of trivial
// generalizations documented in lib/tradeJournal.ts's own header.
//
// THIS IS NOT a chatbot, an AI trading signal engine, financial advice,
// or portfolio management. Every score/pattern is deterministic and
// traceable to an existing calculation or a real, stored trade field.
// This page never submits, closes, or modifies anything, and never
// generates a trade recommendation — only education.

import { useGetAITradeJournal } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function severityBadgeClass(severity: string): string {
  if (severity === "positive") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (severity === "elevated") return "bg-destructive/15 text-destructive border-destructive/30";
  if (severity === "watch") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-sky-500/15 text-sky-400 border-sky-500/30";
}

function trendBadgeClass(direction: string): string {
  if (direction === "improving") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (direction === "declining") return "bg-destructive/15 text-destructive border-destructive/30";
  if (direction === "stable") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function timelineTypeBadgeClass(type: string): string {
  if (type === "trade_opened") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (type === "trade_closed") return "bg-muted text-muted-foreground border-border";
  if (type === "learning_completed") return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

export default function TradeJournal() {
  const { data: result, isLoading, isError } = useGetAITradeJournal();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">AI Trade Journal</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-ai-trade-journal">
            AI Trade Journal
          </Badge>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-behaviour-analysis">
            Behaviour Analysis
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-deterministic-review">
            Deterministic Review
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-journal">
            Paper Trading
          </Badge>
          <Badge className="bg-muted text-muted-foreground border-border" data-testid="badge-educational-only">
            Educational Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A deterministic behavioural analysis and trade review system, analysing every completed Paper
          Trading trade using this platform&apos;s own existing analytics. Not a chatbot, an AI trading signal
          engine, financial advice, or portfolio management — every score and pattern below is traceable to
          an existing calculation or a real, stored trade field, and every recommendation is educational
          only, never a trade recommendation.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="journal-loading">
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
            <p className="text-sm text-destructive" data-testid="text-journal-error">
              Failed to load the AI Trade Journal result. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Progress Dashboard summary ─────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-progress-dashboard">
            <CardHeader>
              <CardTitle>Progress Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Closed Trades</div>
                  <div className="font-mono text-lg" data-testid="text-total-closed-trades">{result.totalClosedTrades}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Discipline Score</div>
                  <div className="font-mono text-lg" data-testid="text-discipline-score">{result.disciplineScore}/100</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sizing Respected</div>
                  <div className="font-mono text-lg" data-testid="text-sizing-respected-rate">{fmtPct(result.decisionQualitySummary.sizingRespectedRatePct)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Rule-Based Exits</div>
                  <div className="font-mono text-lg" data-testid="text-rule-based-exit-rate">{fmtPct(result.decisionQualitySummary.ruleBasedExitRatePct)}</div>
                </div>
              </div>
              {result.behaviorTrend && (
                <div className="mt-4 flex items-center gap-2" data-testid="behavior-trend">
                  <Badge className={trendBadgeClass(result.behaviorTrend.direction)}>Discipline {result.behaviorTrend.direction}</Badge>
                  <span className="text-xs text-muted-foreground">{result.behaviorTrend.detail}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Behaviour Trends: Strengths / Areas to Improve ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border" data-testid="card-strengths">
              <CardHeader>
                <CardTitle className="text-base">Strengths</CardTitle>
                <CardDescription>Repeatable positive patterns, each referencing actual historical trade data.</CardDescription>
              </CardHeader>
              <CardContent>
                {result.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-strengths">
                    Not enough closed-trade history yet to identify a repeatable strength.
                  </p>
                ) : (
                  <ul className="space-y-2" data-testid="list-strengths">
                    {result.strengths.map((p) => (
                      <li key={p.code} data-testid={`strength-${p.code}`}>
                        <div className="flex items-center gap-2">
                          <Badge className={severityBadgeClass(p.severity)}>{p.label}</Badge>
                          <span className="text-xs text-muted-foreground">{p.tradeCount} trade(s)</span>
                        </div>
                        <p className="text-sm mt-1">{p.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border" data-testid="card-areas-to-improve">
              <CardHeader>
                <CardTitle className="text-base">Areas to Improve</CardTitle>
                <CardDescription>Every pattern references actual historical trade data — never a fabricated observation.</CardDescription>
              </CardHeader>
              <CardContent>
                {result.areasToImprove.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-areas-to-improve">
                    No concerning patterns detected yet.
                  </p>
                ) : (
                  <ul className="space-y-2" data-testid="list-areas-to-improve">
                    {result.areasToImprove.map((p) => (
                      <li key={p.code} data-testid={`area-${p.code}`}>
                        <div className="flex items-center gap-2">
                          <Badge className={severityBadgeClass(p.severity)}>{p.label}</Badge>
                          <span className="text-xs text-muted-foreground">{p.tradeCount} trade(s)</span>
                        </div>
                        <p className="text-sm mt-1">{p.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Learning Recommendations ───────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-learning-recommendations">
            <CardHeader>
              <CardTitle>Learning Recommendations</CardTitle>
              <CardDescription>Education only — never a trade recommendation.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.learningRecommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-learning-recommendations">
                  No specific learning recommendations right now.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="list-learning-recommendations">
                  {result.learningRecommendations.map((link, i) => (
                    <div key={i} className="flex flex-col gap-1" data-testid={`learning-recommendation-${i}`}>
                      {link.lessonHref && (
                        <a href={link.lessonHref}>
                          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25 cursor-pointer">{link.lessonTitle}</Badge>
                        </a>
                      )}
                      {link.glossaryHref && (
                        <a href={link.glossaryHref}>
                          <Badge variant="outline" className="hover:bg-muted cursor-pointer">{link.glossaryTerm}</Badge>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Recent Trades / Trade Reviews ──────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-recent-trades">
            <CardHeader>
              <CardTitle>Recent Trades &amp; Trade Reviews</CardTitle>
              <CardDescription>Supporting analytics only — never a trade recommendation.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.recentTrades.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-trades">
                  No closed trades yet — reviews appear here once a Paper Trading position closes.
                </p>
              ) : (
                <ul className="space-y-4" data-testid="list-recent-trades">
                  {result.recentTrades.map((r) => (
                    <li key={r.tradeId} className="border-b border-border pb-3 last:border-0 last:pb-0" data-testid={`trade-review-${r.tradeId}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.symbol}</span>
                        <span className="text-xs text-muted-foreground">{r.strategy.replace(/_/g, " ")}</span>
                        <span className="font-mono text-sm" data-testid={`trade-review-pnl-${r.tradeId}`}>
                          {fmtUsd(r.realizedPnl)}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.holdingPeriodDays.toFixed(1)}d held</span>
                        <span className="text-xs text-muted-foreground">{r.positionSizeContracts} contract(s)</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1" data-testid={`trade-review-tags-${r.tradeId}`}>
                        {r.decisionQuality.map((tag) => (
                          <Badge key={tag.code} className={severityBadgeClass(tag.severity)} title={tag.detail}>
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                      {r.linkedJournalEntry && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`trade-review-journal-${r.tradeId}`}>
                          Journal: {r.linkedJournalEntry.title}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── Journal Timeline ────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-journal-timeline">
            <CardHeader>
              <CardTitle>Journal Timeline</CardTitle>
              <CardDescription>Trade opened, trade closed, learning completed, and behaviour changes — chronological, real timestamps only.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-timeline">No timeline events yet.</p>
              ) : (
                <ul className="space-y-1" data-testid="list-timeline">
                  {result.timeline.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm" data-testid={`timeline-event-${i}`}>
                      <Badge className={timelineTypeBadgeClass(e.type)}>{e.type.replace(/_/g, " ")}</Badge>
                      <span>{e.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(e.timestamp).toLocaleDateString()}</span>
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

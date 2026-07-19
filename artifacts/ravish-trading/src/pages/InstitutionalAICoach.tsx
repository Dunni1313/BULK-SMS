// Phase 21 — Institutional AI Coach & Education Platform.
//
// PURE ORCHESTRATION AND EDUCATIONAL LAYER. This page introduces no new
// valuation model, no new scoring system, and no new investment
// recommendation — every figure and sentence quoted here is a direct read of
// GET /stock-analyst/coach/:coach/:symbol (lib/investingCoach.ts, Phase 21),
// itself a pure composition over already-shipped Phase 2/14/17/19 engines.
// The Guided Learning Mode section below reuses the existing
// LearningPath/LearningTopic content system (lib/learningPaths.ts) and the
// existing Learning Progress tracker (lib/learningProgress.ts) — no new
// content system, no new persistence table.

import { useEffect, useRef, useState } from "react";
import { useSearch, Link } from "wouter";
import {
  useGetLearningPathByKey,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
} from "@workspace/api-client-react";
import { useCoachExplanation, type CoachType } from "@/hooks/use-coach-explanation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Search, CheckCircle2, Circle } from "lucide-react";
import { COACH_TYPES, COACH_TYPE_LABELS } from "@/components/coach/CoachDrawer";

export default function InstitutionalAICoach() {
  const [symbolInput, setSymbolInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachType>("investment");

  // Deep-link support: ?symbol=&coach= (mirrors DecisionEngine.tsx's own
  // established ?symbol= precedent).
  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sym = params.get("symbol");
    const c = params.get("coach") as CoachType | null;
    if (sym && autoRanRef.current !== sym) {
      autoRanRef.current = sym;
      setSymbolInput(sym);
      setSymbol(sym.toUpperCase());
      if (c && COACH_TYPES.includes(c)) setCoach(c);
    }
  }, [search]);

  const { data: explanation, isLoading, isError } = useCoachExplanation(coach, symbol ?? "", null);
  const { data: guidedPath } = useGetLearningPathByKey("institutional-investing");
  const { data: progress } = useGetLearningProgress({ query: { queryKey: getGetLearningProgressQueryKey() } });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
  };

  const institutionalInvestingCompletion = progress?.pathCompletion.find((p) => p.pathKey === "institutional-investing");
  const completedLessonKeys = new Set(progress?.completedLessonKeys ?? []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" /> Institutional AI Coach
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Explains and teaches using the platform's own existing, already-computed research, decision, portfolio,
          valuation, risk, monitoring, and committee outputs — never a new valuation model, scoring system, or
          investment recommendation.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="coach-page-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400" data-testid="badge-coach-page-institutional-ai-coach">
            Institutional AI Coach
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-coach-page-educational">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-coach-page-deterministic">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-coach-page-evidence-based">
            Evidence Based
          </Badge>
        </div>
        <Link href="/reporting-centre?reportType=ai-coach-summary" className="text-xs text-primary hover:underline" data-testid="link-generate-report">
          Generate Report →
        </Link>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center">
            <Input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="Symbol, e.g. AAPL"
              className="max-w-[180px]"
              data-testid="input-coach-symbol"
            />
            <Button type="submit" size="sm" className="gap-1.5" data-testid="button-coach-search">
              <Search className="w-3.5 h-3.5" /> Analyse
            </Button>
          </form>
          <Tabs value={coach} onValueChange={(v) => setCoach(v as CoachType)}>
            <TabsList className="flex-wrap h-auto">
              {COACH_TYPES.map((c) => (
                <TabsTrigger key={c} value={c} data-testid={`tab-coach-${c}`}>
                  {COACH_TYPE_LABELS[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {!symbol && (
        <p className="text-sm text-muted-foreground" data-testid="text-coach-no-symbol">
          Search a symbol above to see the {COACH_TYPE_LABELS[coach]}'s explanation.
        </p>
      )}

      {symbol && isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {symbol && !isLoading && isError && (
        <p className="text-sm text-destructive" data-testid="text-coach-page-error">
          Could not load an explanation for {symbol}.
        </p>
      )}

      {symbol && !isLoading && !isError && explanation && (
        <>
          {/* Learning Panel */}
          <Card className="bg-card border-border" data-testid="card-coach-learning-panel">
            <CardHeader>
              <CardTitle className="text-base">Learning Panel — {explanation.coachLabel}</CardTitle>
              <CardDescription data-testid="text-coach-page-headline">{explanation.headline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Why this exists</h4>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-coach-page-why">
                  {explanation.whyThisExists}
                </p>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How to interpret the numbers</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {explanation.howToInterpret.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Common mistakes investors make</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {explanation.commonMistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How institutional investors think about this</h4>
                <p className="text-muted-foreground leading-relaxed">{explanation.institutionalPerspective}</p>
              </section>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed border-t pt-2">{explanation.disclaimer}</p>
            </CardContent>
          </Card>

          {/* Evidence Explorer */}
          <Card className="bg-card border-border" data-testid="card-coach-evidence-explorer">
            <CardHeader>
              <CardTitle className="text-base">Evidence Explorer</CardTitle>
              <CardDescription>Which existing metrics produced this reading, and which evidence supports it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Metrics used</h4>
                <ul className="space-y-1" data-testid="list-coach-metrics-used">
                  {explanation.metricsUsed.map((m, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{m.label}:</span> {m.detail}{" "}
                      <span className="text-[10px] text-muted-foreground/70">({m.source})</span>
                    </li>
                  ))}
                  {explanation.metricsUsed.length === 0 && (
                    <li className="text-muted-foreground/70 italic">No metrics available for this reading.</li>
                  )}
                </ul>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Supporting evidence</h4>
                <ul className="space-y-1" data-testid="list-coach-supporting-evidence">
                  {explanation.supportingEvidence.map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{e.label}:</span> {e.detail}
                    </li>
                  ))}
                  {explanation.supportingEvidence.length === 0 && (
                    <li className="text-muted-foreground/70 italic">No evidence recorded for this reading.</li>
                  )}
                </ul>
              </section>
              {explanation.risksReducingConfidence.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Risks that reduced confidence</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {explanation.risksReducingConfidence.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </section>
              )}
              {explanation.strengthsIncreasingConfidence.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Strengths that increased confidence</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {explanation.strengthsIncreasingConfidence.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Calculation sources</h4>
                <div className="flex flex-wrap gap-1.5">
                  {explanation.calculationSources.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>
              {explanation.relatedGlossaryKeys.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Related glossary terms</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {explanation.relatedGlossaryKeys.map((k) => (
                      <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-coach-page-glossary-${k}`}>
                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-indigo-500/40">
                          {k}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Guided Learning Mode */}
      <Card className="bg-card border-border" data-testid="card-coach-guided-learning">
        <CardHeader>
          <CardTitle className="text-base">Guided Learning Mode</CardTitle>
          <CardDescription>
            Structured walkthroughs for Business Quality, Financial Strength, the Decision Engine, Portfolio
            Optimisation, the Research Terminal, the Investment Committee, Monitoring, Margin of Safety, and
            Opportunity Discovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!guidedPath && <Skeleton className="h-24 w-full" />}
          {guidedPath && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="list-coach-guided-learning-topics">
              {guidedPath.topics.map((t) => {
                const done = completedLessonKeys.has(t.key);
                return (
                  <li key={t.key}>
                    <Link
                      href={`/learn/paths/institutional-investing/${t.key}`}
                      className="flex items-start gap-2 p-2 rounded border border-border hover:border-indigo-500/40 text-sm"
                      data-testid={`link-coach-guided-topic-${t.key}`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className="font-medium text-foreground block">{t.title}</span>
                        <span className="text-muted-foreground text-xs">{t.summary}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Progress Tracker */}
      <Card className="bg-card border-border" data-testid="card-coach-progress-tracker">
        <CardHeader>
          <CardTitle className="text-base">Progress Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!progress && <Skeleton className="h-16 w-full" />}
          {progress && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Coach explanations viewed:</span>
                <span className="font-medium text-foreground" data-testid="text-coach-progress-coaches-viewed">
                  {progress.coachesViewed}
                </span>
              </div>
              {institutionalInvestingCompletion && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Institutional Investing Engine path</span>
                    <span data-testid="text-coach-progress-path-percent">
                      {institutionalInvestingCompletion.topicsCompleted}/{institutionalInvestingCompletion.topicsTotal} (
                      {institutionalInvestingCompletion.percentComplete}%)
                    </span>
                  </div>
                  <Progress value={institutionalInvestingCompletion.percentComplete} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

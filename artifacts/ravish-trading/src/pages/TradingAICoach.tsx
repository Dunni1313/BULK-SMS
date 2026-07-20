// Phase 29 — Institutional Trading AI Coach.
//
// PURE ORCHESTRATION AND EDUCATIONAL LAYER. This page introduces no new
// trading signal, price prediction, or buy/sell recommendation — every
// figure and sentence quoted here is a direct read of
// GET /trading/coach/{coach}/{symbol}, GET /trading/coach/{coach}, or
// POST /trading/coach/scenario (lib/tradingCoach.ts, Phase 29), itself a
// pure composition over already-shipped Engine 2 modules (Market Structure,
// Multi-Timeframe, Liquidity, Session, Risk Management, Trade Plans,
// Trading Journal, Scenario Comparison). The Guided Learning Mode section
// below reuses the existing LearningPath/LearningTopic content system
// (lib/learningPaths.ts's own "trading-engine" path) and the existing
// Learning Progress tracker (lib/learningProgress.ts) — no new content
// system, no new persistence table. Mirrors Phase 21's own
// InstitutionalAICoach.tsx (Engine 1) structure directly.

import { useEffect, useRef, useState } from "react";
import { useSearch, Link } from "wouter";
import {
  useGetLearningPathByKey,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  useExplainTradingScenario,
  type TradingCoachExplanation,
} from "@workspace/api-client-react";
import { useTradingCoachExplanation, isAccountScopedTradingCoach, type TradingCoachType } from "@/hooks/use-trading-coach-explanation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Search, CheckCircle2, Circle } from "lucide-react";
import { TRADING_COACH_TYPES, TRADING_COACH_TYPE_LABELS } from "@/components/coach/TradingCoachDrawer";

const ALL_TABS: (TradingCoachType | "scenario")[] = [...TRADING_COACH_TYPES, "scenario"];
const TAB_LABELS: Record<(typeof ALL_TABS)[number], string> = { ...TRADING_COACH_TYPE_LABELS, scenario: "Scenario Coach" };

interface ScenarioRow {
  name: string;
  direction: "long" | "short";
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
}

function emptyScenarioRow(name: string): ScenarioRow {
  return { name, direction: "long", entryPrice: "", stopPrice: "", targetPrice: "" };
}

function ExplanationPanels({ explanation }: { explanation: TradingCoachExplanation }) {
  return (
    <>
      <Card className="bg-card border-border" data-testid="card-trading-coach-learning-panel">
        <CardHeader>
          <CardTitle className="text-base">Learning Panel — {explanation.coachLabel}</CardTitle>
          <CardDescription data-testid="text-trading-coach-page-headline">{explanation.headline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Why this exists</h4>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-trading-coach-page-why">
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
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Common mistakes traders make</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {explanation.commonMistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">How institutional desks think about this</h4>
            <p className="text-muted-foreground leading-relaxed">{explanation.institutionalPerspective}</p>
          </section>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed border-t pt-2">{explanation.disclaimer}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border" data-testid="card-trading-coach-evidence-explorer">
        <CardHeader>
          <CardTitle className="text-base">Evidence Explorer</CardTitle>
          <CardDescription>Which existing metrics produced this reading, and which evidence supports it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Metrics used</h4>
            <ul className="space-y-1" data-testid="list-trading-coach-metrics-used">
              {explanation.metricsUsed.map((m, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{m.label}:</span> {m.detail}{" "}
                  <span className="text-[10px] text-muted-foreground/70">({m.source})</span>
                </li>
              ))}
              {explanation.metricsUsed.length === 0 && <li className="text-muted-foreground/70 italic">No metrics available for this reading.</li>}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Supporting evidence</h4>
            <ul className="space-y-1" data-testid="list-trading-coach-supporting-evidence">
              {explanation.supportingEvidence.map((e, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{e.label}:</span> {e.detail}
                </li>
              ))}
              {explanation.supportingEvidence.length === 0 && <li className="text-muted-foreground/70 italic">No evidence recorded for this reading.</li>}
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
                  <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-trading-coach-page-glossary-${k}`}>
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
  );
}

export default function TradingAICoach() {
  const [symbolInput, setSymbolInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [coach, setCoach] = useState<(typeof ALL_TABS)[number]>("structure");
  const [scenarioRows, setScenarioRows] = useState<ScenarioRow[]>([emptyScenarioRow("Scenario A"), emptyScenarioRow("Scenario B")]);

  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sym = params.get("symbol");
    const c = params.get("coach") as (typeof ALL_TABS)[number] | null;
    if (sym && autoRanRef.current !== sym) {
      autoRanRef.current = sym;
      setSymbolInput(sym);
      setSymbol(sym.toUpperCase());
      if (c && ALL_TABS.includes(c)) setCoach(c);
    }
  }, [search]);

  const symbolScopedCoach = coach === "scenario" ? "structure" : coach;
  const { data: explanation, isLoading, isError } = useTradingCoachExplanation(symbolScopedCoach, symbol ?? "");
  const scenarioMutation = useExplainTradingScenario();

  const { data: guidedPath } = useGetLearningPathByKey("trading-engine");
  const { data: progress } = useGetLearningProgress({ query: { queryKey: getGetLearningProgressQueryKey() } });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
  };

  const tradingEngineCompletion = progress?.pathCompletion.find((p) => p.pathKey === "trading-engine");
  const completedLessonKeys = new Set(progress?.completedLessonKeys ?? []);

  const runScenarioComparison = () => {
    const scenarios = scenarioRows
      .filter((r) => r.name.trim() && r.entryPrice && r.stopPrice && r.targetPrice)
      .map((r) => ({
        name: r.name.trim(),
        direction: r.direction,
        accountRiskPct: 1,
        entryPrice: Number(r.entryPrice),
        stopPrice: Number(r.stopPrice),
        targetPrice: Number(r.targetPrice),
      }));
    if (scenarios.length < 2) return;
    scenarioMutation.mutate({ data: { symbol: symbol ?? undefined, scenarios } });
  };

  const showAccountWide = coach !== "scenario" && isAccountScopedTradingCoach(symbolScopedCoach);
  const showSymbolPanels = coach !== "scenario" && !showAccountWide && !!symbol;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" /> Institutional Trading AI Coach
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Explains and teaches using the platform's own existing, already-computed Structure, Liquidity, Session, Risk, Trade Plan, Journal, and
          Scenario Comparison outputs — never a new trading signal, price prediction, or buy/sell recommendation.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="trading-coach-page-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400" data-testid="badge-trading-coach-page-institutional-ai-coach">
            Institutional Trading AI Coach
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-trading-coach-page-educational">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-trading-coach-page-deterministic">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-trading-coach-page-evidence-based">
            Evidence Based
          </Badge>
        </div>
        <Link href="/reporting-centre?reportType=ai-coach-summary" className="text-xs text-primary hover:underline" data-testid="link-trading-coach-generate-report">
          Generate Report →
        </Link>
        <Link href="/strategy-framework" className="text-xs text-primary hover:underline block" data-testid="link-trading-coach-open-strategy-framework">
          Register or review your own Strategy Framework →
        </Link>
        <Link href="/strategy-workbench" className="text-xs text-primary hover:underline block" data-testid="link-trading-coach-open-strategy-workbench">
          Open the Institutional Strategy Workbench →
        </Link>
        <Link href="/trading-analytics" className="text-xs text-primary hover:underline block" data-testid="link-trading-coach-open-trading-analytics">
          Open the Trading Analytics Dashboard →
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
              data-testid="input-trading-coach-symbol"
            />
            <Button type="submit" size="sm" className="gap-1.5" data-testid="button-trading-coach-search">
              <Search className="w-3.5 h-3.5" /> Analyse
            </Button>
          </form>
          <Tabs value={coach} onValueChange={(v) => setCoach(v as (typeof ALL_TABS)[number])}>
            <TabsList className="flex-wrap h-auto">
              {ALL_TABS.map((c) => (
                <TabsTrigger key={c} value={c} data-testid={`tab-trading-coach-${c}`}>
                  {TAB_LABELS[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {coach === "scenario" && (
        <Card className="bg-card border-border" data-testid="card-trading-scenario-coach">
          <CardHeader>
            <CardTitle className="text-base">Scenario Coach</CardTitle>
            <CardDescription>Enter at least 2 candidate entry/stop/target combinations — never persisted, never a recommendation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarioRows.map((row, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center" data-testid={`row-trading-coach-scenario-${i}`}>
                <Input
                  value={row.name}
                  onChange={(e) => setScenarioRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                  placeholder="Name"
                  data-testid={`input-trading-coach-scenario-name-${i}`}
                />
                <Input
                  type="number"
                  value={row.entryPrice}
                  onChange={(e) => setScenarioRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, entryPrice: e.target.value } : r)))}
                  placeholder="Entry"
                  data-testid={`input-trading-coach-scenario-entry-${i}`}
                />
                <Input
                  type="number"
                  value={row.stopPrice}
                  onChange={(e) => setScenarioRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, stopPrice: e.target.value } : r)))}
                  placeholder="Stop"
                  data-testid={`input-trading-coach-scenario-stop-${i}`}
                />
                <Input
                  type="number"
                  value={row.targetPrice}
                  onChange={(e) => setScenarioRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, targetPrice: e.target.value } : r)))}
                  placeholder="Target"
                  data-testid={`input-trading-coach-scenario-target-${i}`}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setScenarioRows((rows) => (rows.length < 5 ? [...rows, emptyScenarioRow(`Scenario ${String.fromCharCode(65 + rows.length)}`)] : rows))}
                data-testid="button-trading-coach-add-scenario"
              >
                Add scenario
              </Button>
              <Button type="button" size="sm" onClick={runScenarioComparison} data-testid="button-trading-coach-explain-scenarios">
                Explain scenarios
              </Button>
            </div>
            {scenarioMutation.isPending && <Skeleton className="h-16 w-full" />}
            {scenarioMutation.isError && (
              <p className="text-sm text-destructive" data-testid="text-trading-coach-scenario-error">
                Could not explain these scenarios.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {coach === "scenario" && scenarioMutation.data && <ExplanationPanels explanation={scenarioMutation.data} />}

      {coach !== "scenario" && !showAccountWide && !symbol && (
        <p className="text-sm text-muted-foreground" data-testid="text-trading-coach-no-symbol">
          Search a symbol above to see the {TAB_LABELS[coach]}'s explanation.
        </p>
      )}

      {(showAccountWide || showSymbolPanels) && isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {(showAccountWide || showSymbolPanels) && !isLoading && isError && (
        <p className="text-sm text-destructive" data-testid="text-trading-coach-page-error">
          Could not load an explanation.
        </p>
      )}

      {(showAccountWide || showSymbolPanels) && !isLoading && !isError && explanation && <ExplanationPanels explanation={explanation} />}

      {/* Guided Learning Mode */}
      <Card className="bg-card border-border" data-testid="card-trading-coach-guided-learning">
        <CardHeader>
          <CardTitle className="text-base">Guided Learning Mode</CardTitle>
          <CardDescription>
            Structured walkthroughs for Market Structure, Liquidity, Sessions, Risk Management, Trade Planning & Scenario Comparison, the Trading
            Journal, Psychology & Discipline, and the Trading AI Coach itself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!guidedPath && <Skeleton className="h-24 w-full" />}
          {guidedPath && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="list-trading-coach-guided-learning-topics">
              {guidedPath.topics.map((t) => {
                const done = completedLessonKeys.has(t.key);
                return (
                  <li key={t.key}>
                    <Link
                      href={`/learn/paths/trading-engine/${t.key}`}
                      className="flex items-start gap-2 p-2 rounded border border-border hover:border-indigo-500/40 text-sm"
                      data-testid={`link-trading-coach-guided-topic-${t.key}`}
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
      <Card className="bg-card border-border" data-testid="card-trading-coach-progress-tracker">
        <CardHeader>
          <CardTitle className="text-base">Progress Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!progress && <Skeleton className="h-16 w-full" />}
          {progress && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Coach explanations viewed (all engines):</span>
                <span className="font-medium text-foreground" data-testid="text-trading-coach-progress-coaches-viewed">
                  {progress.coachesViewed}
                </span>
              </div>
              {tradingEngineCompletion && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Institutional Trading Engine path</span>
                    <span data-testid="text-trading-coach-progress-path-percent">
                      {tradingEngineCompletion.topicsCompleted}/{tradingEngineCompletion.topicsTotal} ({tradingEngineCompletion.percentComplete}%)
                    </span>
                  </div>
                  <Progress value={tradingEngineCompletion.percentComplete} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

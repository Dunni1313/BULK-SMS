// AI Teacher & Learning Centre sprint — the unified Learning Centre hub.
//
// This is the "AI Teacher" module the Institutional Intelligence Engine
// (Phase 8, Sprint 1) disclosed as a coming-soon placeholder — it now
// exists, and lib/intelligenceLearning.ts's own catalog points here.
//
// Paper Trading only. Educational only. Read-only except Learning
// Progress (view/complete), the only user-state mutation this sprint
// introduces. No LLM. No trade recommendations. Every simulation is
// clearly labeled Educational Simulation / Not Market Data / No Trade
// Recommendation.

import { useState } from "react";
import { Link, useSearch } from "wouter";
import {
  useGetLearningPaths,
  useGetStrategyAcademy,
  useGetPortfolioLesson,
  useGetLearningProgress,
  useRunLearningSimulation,
  LearningSimulationInputType,
  LearningSimulationInputStrategy,
  type LearningSimulationResult,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  GraduationCap,
  BookOpen,
  Library,
  FlaskConical,
  Wallet,
  BarChart3,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

function SimulationChart({ result }: { result: LearningSimulationResult }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px]">Educational Simulation</Badge>
        <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[9px]">Not Market Data</Badge>
        <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[9px]">No Trade Recommendation</Badge>
      </div>
      <p className="text-sm font-medium text-foreground">{result.label}</p>
      <div className="h-56" data-testid="chart-simulation">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.points} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={10} label={{ value: result.xLabel, position: "insideBottom", offset: -3, fontSize: 10 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} label={{ value: result.yLabel, angle: -90, position: "insideLeft", fontSize: 10 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-simulation-summary">
        {result.summary}
      </p>
    </div>
  );
}

function SimulationsTab() {
  const [type, setType] = useState<LearningSimulationInputType>(LearningSimulationInputType.delta);
  const [strike, setStrike] = useState("100");
  const [iv, setIv] = useState("30");
  const [dte, setDte] = useState("30");
  const [price, setPrice] = useState("100");
  const [strategy, setStrategy] = useState<LearningSimulationInputStrategy>(LearningSimulationInputStrategy.covered_call);
  const [weights, setWeights] = useState("40,30,20,10");
  const runSimulation = useRunLearningSimulation();

  const run = () => {
    const base = { type };
    if (type === LearningSimulationInputType.delta || type === LearningSimulationInputType.theta) {
      runSimulation.mutate({ data: { ...base, strike: Number(strike), iv: Number(iv) / 100, dte: Number(dte) } });
    } else if (type === LearningSimulationInputType.expected_move) {
      runSimulation.mutate({ data: { ...base, price: Number(price), iv: Number(iv) / 100 } });
    } else if (type === LearningSimulationInputType.payoff) {
      runSimulation.mutate({
        data: {
          ...base,
          strategy,
          stockCostBasis: Number(price),
          callStrike: Number(strike),
          callPremium: 2,
          putStrike: Number(strike),
          putPremium: 2,
          netCredit: 1.5,
        },
      });
    } else {
      runSimulation.mutate({
        data: { ...base, weights: weights.split(",").map((w) => Number(w.trim())).filter((n) => !Number.isNaN(n)) },
      });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Deterministic simulations of Delta, Theta, Expected Move, strategy payoff diagrams, and portfolio
        concentration. Position Sizing is intentionally not re-simulated here with fabricated numbers — use the
        real <Link href="/position-sizing" className="text-indigo-400 hover:underline">Position Sizing &amp; Portfolio Impact Calculator</Link> against your actual portfolio instead.
      </p>
      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Simulation</label>
              <Select value={type} onValueChange={(v) => setType(v as LearningSimulationInputType)}>
                <SelectTrigger className="h-9 w-48 bg-background text-xs" data-testid="select-simulation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LearningSimulationInputType.delta}>Delta</SelectItem>
                  <SelectItem value={LearningSimulationInputType.theta}>Theta</SelectItem>
                  <SelectItem value={LearningSimulationInputType.expected_move}>Expected Move</SelectItem>
                  <SelectItem value={LearningSimulationInputType.payoff}>Payoff Diagram</SelectItem>
                  <SelectItem value={LearningSimulationInputType.concentration}>Concentration (HHI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(type === LearningSimulationInputType.delta || type === LearningSimulationInputType.theta || type === LearningSimulationInputType.payoff) && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Strike</label>
                <Input value={strike} onChange={(e) => setStrike(e.target.value)} className="h-9 w-24 bg-background text-xs" data-testid="input-simulation-strike" />
              </div>
            )}
            {(type === LearningSimulationInputType.delta || type === LearningSimulationInputType.theta || type === LearningSimulationInputType.expected_move) && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">IV %</label>
                <Input value={iv} onChange={(e) => setIv(e.target.value)} className="h-9 w-20 bg-background text-xs" data-testid="input-simulation-iv" />
              </div>
            )}
            {type === LearningSimulationInputType.delta && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">DTE</label>
                <Input value={dte} onChange={(e) => setDte(e.target.value)} className="h-9 w-20 bg-background text-xs" data-testid="input-simulation-dte" />
              </div>
            )}
            {(type === LearningSimulationInputType.expected_move || type === LearningSimulationInputType.payoff) && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-24 bg-background text-xs" data-testid="input-simulation-price" />
              </div>
            )}
            {type === LearningSimulationInputType.payoff && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Strategy</label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as LearningSimulationInputStrategy)}>
                  <SelectTrigger className="h-9 w-44 bg-background text-xs" data-testid="select-simulation-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LearningSimulationInputStrategy.covered_call}>Covered Call</SelectItem>
                    <SelectItem value={LearningSimulationInputStrategy.cash_secured_put}>Cash Secured Put</SelectItem>
                    <SelectItem value={LearningSimulationInputStrategy.iron_condor}>Iron Condor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {type === LearningSimulationInputType.concentration && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hypothetical Weights (comma-separated)</label>
                <Input value={weights} onChange={(e) => setWeights(e.target.value)} className="h-9 w-56 bg-background text-xs" data-testid="input-simulation-weights" />
              </div>
            )}
            <Button onClick={run} disabled={runSimulation.isPending} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-sm" data-testid="button-run-simulation">
              {runSimulation.isPending ? "Running…" : "Run Simulation"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {runSimulation.isPending && <Skeleton className="h-56 w-full" />}
      {runSimulation.isError && (
        <p className="text-sm text-destructive" data-testid="text-simulation-error">
          Failed to run the simulation. Check your inputs and try again.
        </p>
      )}
      {runSimulation.data && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <SimulationChart result={runSimulation.data} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PortfolioLessonTab() {
  const { data, isLoading, isError } = useGetPortfolioLesson();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your real, current Paper Trading portfolio, explained. Never a trade recommendation — every figure below
        is your own already-computed data, with a plain-English explanation, its source calculation, and why it
        matters.
      </p>
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive" data-testid="text-portfolio-lesson-error">
          Failed to load your portfolio lesson.
        </p>
      )}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="grid-portfolio-lesson">
          {data.items.map((item) => (
            <Card key={item.code} className="bg-card border-border" data-testid={`portfolio-lesson-${item.code}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  {item.label}
                  {item.reusedObservation && (
                    <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
                      Live Observation
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="text-sm font-mono text-foreground">{item.currentValue}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.plainEnglish}</p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  <span className="font-semibold">Why it matters: </span>
                  {item.whyItMatters}
                </p>
                {item.relatedLessonHref && (
                  <Link href={item.relatedLessonHref} className="block text-xs text-indigo-400 hover:underline">
                    Read the related lesson →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressTab() {
  const { data, isLoading } = useGetLearningProgress();
  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Lessons Viewed</div>
            <div className="text-xl font-mono" data-testid="text-lessons-viewed">{data.lessonsViewed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Lessons Completed</div>
            <div className="text-xl font-mono" data-testid="text-lessons-completed">{data.lessonsCompleted}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Glossary Terms Viewed</div>
            <div className="text-xl font-mono" data-testid="text-glossary-viewed">{data.glossaryTermsViewed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Strategies Viewed</div>
            <div className="text-xl font-mono" data-testid="text-strategies-viewed">{data.strategiesViewed}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Learning Path Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.pathCompletion.map((p) => (
            <div key={p.pathKey} data-testid={`progress-path-${p.pathKey}`}>
              <div className="flex items-center justify-between text-xs">
                <span>{p.title}</span>
                <span className="font-mono">
                  {p.topicsCompleted}/{p.topicsTotal}
                </span>
              </div>
              <Progress value={p.percentComplete} className="h-1.5 mt-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Phase 32 — Institutional Trading Analytics Engine integration.
          Mirrors lib/tradingAnalytics.ts's own buildLearningAnalytics()
          weakestPaths derivation exactly (paths below 50% completion,
          sorted lowest-first) — computed here client-side from the same
          already-fetched pathCompletion data, no new fetch, never a
          predicted recommendation of what to study next. */}
      {(() => {
        const weakestPaths = [...data.pathCompletion]
          .filter((p) => p.topicsTotal > 0 && p.percentComplete < 50)
          .sort((a, b) => a.percentComplete - b.percentComplete);
        if (weakestPaths.length === 0) return null;
        return (
          <Card className="bg-card border-border" data-testid="card-weakest-topics">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weakest Topics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weakestPaths.map((p) => (
                <div key={p.pathKey} className="flex items-center justify-between text-xs" data-testid={`weak-topic-${p.pathKey}`}>
                  <span>{p.title}</span>
                  <span className="font-mono">{p.percentComplete}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Greeks Quiz", q: data.greeksQuiz },
          { label: "Value Investing Quiz", q: data.valueQuiz },
        ].map(({ label, q }) => (
          <Card key={label} className="bg-card border-border" data-testid={`quiz-progress-${label}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Attempts</div>
                <div className="font-mono">{q.totalAttempts}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Average</div>
                <div className="font-mono">{q.averagePercent}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Streak</div>
                <div className="font-mono">{q.streak} days</div>
              </div>
              <div>
                <div className="text-muted-foreground">Improvement</div>
                <div className="font-mono">{q.improvement >= 0 ? "+" : ""}{q.improvement}%</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.recentHistory.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Learning History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5" data-testid="list-learning-history">
              {data.recentHistory.map((h, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="capitalize">
                    {h.itemType}: {h.itemKey}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {h.completedAt ? "Completed" : "Viewed"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OverviewTab() {
  const { data: paths, isLoading: pathsLoading } = useGetLearningPaths();
  const { data: strategies } = useGetStrategyAcademy();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/learn/paths" data-testid="link-overview-paths">
          <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold">{(paths ?? []).length} Learning Paths</div>
                <div className="text-xs text-muted-foreground">Foundations through Institutional Thinking</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/learn/strategy-academy" data-testid="link-overview-strategy-academy">
          <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-indigo-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold">{(strategies ?? []).length} Strategy Academy Entries</div>
                <div className="text-xs text-muted-foreground">Construction, Greeks, and common mistakes</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/learn/glossary" data-testid="link-overview-glossary">
          <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 flex items-center gap-3">
              <Library className="w-6 h-6 text-indigo-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Glossary</div>
                <div className="text-xs text-muted-foreground">Searchable, cross-linked definitions</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Learning Paths</h2>
        {pathsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(paths ?? []).map((p) => (
              <Link key={p.key} href={`/learn/paths/${p.key}`} data-testid={`link-overview-path-${p.key}`}>
                <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{p.title}</CardTitle>
                    <CardDescription className="text-[11px] line-clamp-2">{p.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Continue Learning</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/learn/delta" data-testid="link-overview-delta-masterclass">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Delta Masterclass</CardContent>
            </Card>
          </Link>
          <Link href="/learn/greeks" data-testid="link-overview-greeks-tutor">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Greeks Tutor</CardContent>
            </Card>
          </Link>
          <Link href="/lessons" data-testid="link-overview-trade-lessons">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Trade Lessons</CardContent>
            </Card>
          </Link>
          <Link href="/learn/quiz" data-testid="link-overview-quiz">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Trading Quiz</CardContent>
            </Card>
          </Link>
          <Link href="/stock-analyst/value-investing-school" data-testid="link-overview-value-school">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Value Investing School</CardContent>
            </Card>
          </Link>
          <Link href="/institutional-intelligence" data-testid="link-overview-institutional-intelligence">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional Intelligence</CardContent>
            </Card>
          </Link>
          <Link href="/institutional-ai-coach" data-testid="link-overview-institutional-ai-coach">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional AI Coach</CardContent>
            </Card>
          </Link>
          <Link href="/reporting-centre" data-testid="link-overview-reporting-centre">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional Reporting Centre</CardContent>
            </Card>
          </Link>
          <Link href="/market-structure-workbench" data-testid="link-overview-market-structure-workbench">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Market Structure Workbench</CardContent>
            </Card>
          </Link>
          <Link href="/liquidity-workbench" data-testid="link-overview-liquidity-workbench">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Liquidity &amp; Session Workbench</CardContent>
            </Card>
          </Link>
          <Link href="/trade-planning-studio" data-testid="link-overview-trade-planning-studio">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Trade Planning &amp; Risk Studio</CardContent>
            </Card>
          </Link>
          <Link href="/trading-ai-coach" data-testid="link-overview-trading-ai-coach">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional Trading AI Coach</CardContent>
            </Card>
          </Link>
          <Link href="/strategy-framework" data-testid="link-overview-strategy-framework">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional Strategy Framework</CardContent>
            </Card>
          </Link>
          <Link href="/strategy-workbench" data-testid="link-overview-strategy-workbench">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Institutional Strategy Workbench</CardContent>
            </Card>
          </Link>
          <Link href="/trading-analytics" data-testid="link-overview-trading-analytics">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Trading Analytics Dashboard</CardContent>
            </Card>
          </Link>
          <Link href="/executive-intelligence?tab=learning" data-testid="link-overview-executive-intelligence">
            <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-sm font-medium">Executive Intelligence — Learning</CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

const VALID_TABS = ["overview", "simulations", "portfolio", "progress"] as const;
type LearningCentreTab = (typeof VALID_TABS)[number];

export default function LearningCentre() {
  // Supports a ?tab= deep link (e.g. from the Institutional Intelligence
  // Engine's own learning links, which point here for "Portfolio,
  // Explained" and Progress) without adding any routing complexity.
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const initialTab: LearningCentreTab = (VALID_TABS as readonly string[]).includes(requestedTab ?? "")
    ? (requestedTab as LearningCentreTab)
    : "overview";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" /> AI Teacher &amp; Learning Centre
          </h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-educational-only">
            Educational Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Every explanation, lesson, quiz, and simulation on this platform in one place — deterministic,
          version-controlled content, never LLM-generated, never a trade recommendation.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="bg-card border border-border flex-wrap h-auto">
          <TabsTrigger value="overview" className="text-xs">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="simulations" className="text-xs">
            <FlaskConical className="w-3.5 h-3.5 mr-1" /> Simulations
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="text-xs">
            <Wallet className="w-3.5 h-3.5 mr-1" /> My Portfolio, Explained
          </TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Progress
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="simulations" className="mt-4">
          <SimulationsTab />
        </TabsContent>
        <TabsContent value="portfolio" className="mt-4">
          <PortfolioLessonTab />
        </TabsContent>
        <TabsContent value="progress" className="mt-4">
          <ProgressTab />
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
        <ShieldAlert className="w-3 h-3" /> Educational content only. Never a trade recommendation. No broker
        writes, no order execution, no portfolio mutation — the only user-state change this Learning Centre makes
        is your own learning progress.
      </p>
    </div>
  );
}

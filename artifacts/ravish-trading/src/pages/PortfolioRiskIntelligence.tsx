// v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
//
// NOT a new portfolio page. NOT a new dashboard. This is the intelligence
// layer sitting above Research/Notebook/Strategies/Trade Plans/Decision
// Workflow/Execution Lifecycle/Trade Journal/Performance/Portfolio/Command
// Centre — it composes the already-existing Portfolio Dashboard
// (Options Income), Portfolio Risk (Investing), Trading Risk (Trading),
// Decision Workflow, Execution Lifecycle, and Learning Centre into one
// transparent Health Score, a Risk Intelligence report, a What-If tool,
// and an AI Portfolio Coach — never a re-implementation of any of those
// pages' own detail views. Every card here links out to the real,
// already-built page for management actions, the same "link out, don't
// duplicate" pattern InstitutionalDashboard.tsx already established.

import { useState } from "react";
import { Link } from "wouter";
import { usePortfolioRiskIntelligence } from "@/lib/usePortfolioRiskIntelligence";
import { computeWhatIfAnalysis, type WhatIfResult } from "@/lib/portfolioRiskIntelligence";
import type { CoachId } from "@/lib/ai-coach/capabilityRegistry";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { ShieldCheck, GaugeCircle, Activity, FlaskConical, Bot, GraduationCap, AlertTriangle } from "lucide-react";

function factorScoreClass(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-amber-400";
  return "text-destructive";
}

function healthLabelBadgeClass(label: string): string {
  if (label === "Excellent" || label === "Strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (label === "Moderate") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (label === "Elevated Risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

// ─── Portfolio Health Score ──────────────────────────────────────────────

function PortfolioHealthCard({ result }: { result: ReturnType<typeof usePortfolioRiskIntelligence> }) {
  const { health } = result;
  if (!health) return null;
  return (
    <Card className="bg-card border-border" data-testid="portfolio-health-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GaugeCircle className="h-4 w-4" /> Portfolio Health Score
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold" data-testid="health-score-value">{health.overall}</span>
            <Badge className={healthLabelBadgeClass(health.label)} data-testid="health-score-label">{health.label}</Badge>
            <Badge variant="outline" className="text-[10px]" data-testid="health-confidence-level">{health.confidenceLevel} confidence</Badge>
          </div>
        </div>
        <CardDescription>
          Transparent — every factor below is sourced from an already-existing engine, never a black box. Guidance only, never an instruction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="health-factor-list">
          {health.factors.map((f) => (
            <li key={f.code} className="p-2 rounded-md border border-border" data-testid={`health-factor-${f.code}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{f.label}</span>
                <span className={`text-sm font-mono ${factorScoreClass(f.score)}`} data-testid={`health-factor-score-${f.code}`}>
                  {f.score !== null ? `${f.score}%` : "N/A"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.detail}</p>
              {f.sourceModule && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Source: {f.sourceModule}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Risk Intelligence ────────────────────────────────────────────────────

function RiskIntelligenceCard({ result }: { result: ReturnType<typeof usePortfolioRiskIntelligence> }) {
  const { risk } = result;
  if (!risk) return null;
  return (
    <Card className="bg-card border-border" data-testid="risk-intelligence-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Risk Intelligence
        </CardTitle>
        <CardDescription>Institutional risk monitoring, reused from each engine's own already-computed figures.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" data-testid="risk-signal-list">
          {risk.signals.map((s) => (
            <li key={s.code} className="flex items-start justify-between gap-2 text-sm" data-testid={`risk-signal-${s.code}`}>
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
              <Badge variant="outline" className={s.available ? "" : "text-muted-foreground"} data-testid={`risk-signal-headline-${s.code}`}>
                {s.headline}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── What-If Analysis ─────────────────────────────────────────────────────

function WhatIfAnalysisCard({ result }: { result: ReturnType<typeof usePortfolioRiskIntelligence> }) {
  const { input, risk } = result;
  const readyPlans = result.input?.lifecycleRecords.filter((r) => r.currentStage === "ready-to-execute") ?? [];
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [riskDollars, setRiskDollars] = useState("");
  const [symbol, setSymbol] = useState("");
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);

  const selectedPlan = readyPlans.find((r) => r.tradePlan.id === selectedPlanId) ?? null;

  function run() {
    if (!selectedPlan || !input) return;
    const parsedRisk = Number(riskDollars);
    if (!Number.isFinite(parsedRisk) || parsedRisk <= 0) return;
    const currentTotalRiskDollars = (input.tradingRisk?.portfolioBudget.totalRiskDollars ?? 0) + (input.optionsIncome?.totalRiskDollars ?? 0);
    const accountValue = selectedPlan.tradePlan.coachId === "trading" ? input.tradingRisk?.accountValue ?? null : input.optionsIncome?.portfolioValue ?? null;
    const worstDrawdownPct =
      input.optionsIncome && input.optionsIncome.stressTestSummary.length > 0
        ? Math.abs([...input.optionsIncome.stressTestSummary].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0].portfolioValueImpact / (input.optionsIncome.portfolioValue || 1)) * 100
        : null;
    setWhatIf(
      computeWhatIfAnalysis(
        { tradePlanId: selectedPlan.tradePlan.id, tradePlanTitle: selectedPlan.tradePlan.title, coachId: selectedPlan.tradePlan.coachId as CoachId, hypotheticalRiskDollars: parsedRisk, hypotheticalSymbol: symbol || (selectedPlan.tradePlan.plannedAsset ?? "") },
        { totalRiskDollars: currentTotalRiskDollars, accountValue, worstDrawdownPct },
      ),
    );
  }

  return (
    <Card className="bg-card border-border" data-testid="what-if-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> What-If Analysis
        </CardTitle>
        <CardDescription>Evaluate a planned trade's portfolio impact before executing it. Analysis only — never an order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {readyPlans.length === 0 ? (
          <p className="text-muted-foreground" data-testid="what-if-none-ready">No trade plans are currently Ready to Execute.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {readyPlans.map((r) => (
                <Button key={r.tradePlan.id} size="sm" variant={selectedPlanId === r.tradePlan.id ? "default" : "outline"} onClick={() => setSelectedPlanId(r.tradePlan.id)} data-testid={`what-if-select-${r.tradePlan.id}`}>
                  {r.tradePlan.title}
                </Button>
              ))}
            </div>
            {selectedPlan && (
              <div className="space-y-2">
                <Input placeholder="Hypothetical risk in dollars" value={riskDollars} onChange={(e) => setRiskDollars(e.target.value)} data-testid="what-if-risk-input" />
                <Input placeholder="Symbol (optional)" value={symbol} onChange={(e) => setSymbol(e.target.value)} data-testid="what-if-symbol-input" />
                <Button size="sm" onClick={run} data-testid="what-if-run">Run What-If Analysis</Button>
              </div>
            )}
            {whatIf && (
              <div className="border-t border-border pt-2 space-y-1" data-testid="what-if-result">
                <p data-testid="what-if-current-vs-hypothetical">
                  Total open risk: {whatIf.currentTotalRiskDollars !== null ? `$${whatIf.currentTotalRiskDollars.toLocaleString()}` : "N/A"} →{" "}
                  {whatIf.hypotheticalTotalRiskDollars !== null ? `$${whatIf.hypotheticalTotalRiskDollars.toLocaleString()}` : "N/A"}
                  {whatIf.currentTotalRiskPct !== null && whatIf.hypotheticalTotalRiskPct !== null ? ` (${whatIf.currentTotalRiskPct}% → ${whatIf.hypotheticalTotalRiskPct}%)` : ""}
                </p>
                {whatIf.capBreached !== null && (
                  <p className={whatIf.capBreached ? "text-destructive flex items-center gap-1" : "text-emerald-400 flex items-center gap-1"} data-testid="what-if-cap-status">
                    {whatIf.capBreached && <AlertTriangle className="h-3.5 w-3.5" />}
                    {whatIf.capBreached ? `Would breach ${whatIf.capLabel}` : `Stays within ${whatIf.capLabel}`}
                  </p>
                )}
                {whatIf.approxWorstCaseDrawdownPct !== null && (
                  <p data-testid="what-if-drawdown">Approximate worst-case drawdown: {whatIf.approxWorstCaseDrawdownPct}%</p>
                )}
                <ul className="text-xs text-muted-foreground list-disc list-inside" data-testid="what-if-notes">
                  {whatIf.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {risk && risk.signals.find((s) => s.code === "pending_trade_impact") && (
          <p className="text-xs text-muted-foreground" data-testid="what-if-pending-impact-note">
            {risk.signals.find((s) => s.code === "pending_trade_impact")!.detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AI Portfolio Coach ───────────────────────────────────────────────────

function AiPortfolioCoachCard({ result }: { result: ReturnType<typeof usePortfolioRiskIntelligence> }) {
  const { coachNarrative } = result;
  if (!coachNarrative) return null;
  return (
    <Card className="bg-card border-border" data-testid="ai-portfolio-coach-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Portfolio Coach
        </CardTitle>
        <CardDescription>Educates rather than instructs — never a buy/sell/rebalance instruction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="coach-health-explanation">{coachNarrative.healthExplanation}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Strongest Positions/Factors</p>
            {coachNarrative.strongestFactors.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="coach-strongest-none">None yet.</p>
            ) : (
              <ul className="list-disc list-inside text-xs text-emerald-400" data-testid="coach-strongest-list">
                {coachNarrative.strongestFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Weakest Positions/Factors</p>
            {coachNarrative.weakestFactors.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="coach-weakest-none">None.</p>
            ) : (
              <ul className="list-disc list-inside text-xs text-amber-400" data-testid="coach-weakest-list">
                {coachNarrative.weakestFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Largest Risks</p>
          <ul className="list-disc list-inside text-xs" data-testid="coach-largest-risks">
            {coachNarrative.largestRisks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Institutional Best Practice</p>
          <p data-testid="coach-best-practice">{coachNarrative.institutionalBestPractice}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Suggested Areas for Further Research</p>
          <ul className="list-disc list-inside text-xs" data-testid="coach-suggested-research">
            {coachNarrative.suggestedResearch.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <AskCoachLauncher label="Ask the AI Portfolio Coach" suggestedQuestion="What are the biggest risks in my portfolio right now, and what should I research first?" />
      </CardContent>
    </Card>
  );
}

// ─── Learning integration ────────────────────────────────────────────────

function PortfolioLearningCard({ result }: { result: ReturnType<typeof usePortfolioRiskIntelligence> }) {
  const { weakestFactor, recommendedLesson } = result;
  return (
    <Card className="bg-card border-border" data-testid="portfolio-learning-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> Continuous Learning
        </CardTitle>
        <CardDescription>Reused from the Learning Centre — diversification, position sizing, correlation, risk budgeting, and more.</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendedLesson ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm">Weakest factor: {weakestFactor?.label} — recommended: {recommendedLesson.label}</p>
            <ModuleLearnTrigger moduleLabel={`Portfolio & Risk Intelligence — ${weakestFactor?.label ?? ""}`} pathKey={recommendedLesson.pathKey} topicKey={recommendedLesson.topicKey} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="portfolio-learning-none">No specific lesson recommended right now.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function PortfolioRiskIntelligence() {
  const result = usePortfolioRiskIntelligence();

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-portfolio-risk-intelligence">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-400" /> Portfolio &amp; Risk Intelligence
          </h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-portfolio-risk-intelligence">
            Institutional Intelligence Layer
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Continuously evaluates your entire portfolio, planned trades, and overall risk — composed from the Options Income,
          Investing, and Trading Engines' own already-existing calculations, never a re-implementation. Guidance only, never an
          instruction to buy, sell, or rebalance.{" "}
          <Link href="/portfolio-dashboard" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-portfolio-dashboard">
            See the full Options Income Portfolio Dashboard.
          </Link>{" "}
          <Link href="/execution-lifecycle" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-execution-lifecycle">
            See the Execution &amp; Lifecycle Manager.
          </Link>
        </p>
      </div>

      {result.loading ? (
        <div className="space-y-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : result.isError ? (
        <p className="text-sm text-rose-400" data-testid="portfolio-risk-intelligence-error">
          Couldn't load Portfolio &amp; Risk Intelligence right now. Try refreshing the page.
        </p>
      ) : (
        <div className="space-y-4">
          <PortfolioHealthCard result={result} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RiskIntelligenceCard result={result} />
            <WhatIfAnalysisCard result={result} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AiPortfolioCoachCard result={result} />
            <PortfolioLearningCard result={result} />
          </div>
        </div>
      )}
    </div>
  );
}

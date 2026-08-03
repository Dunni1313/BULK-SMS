// v1.5.0, Sprint 13 — Institutional Decision Engine.
//
// NOT another dashboard — the intelligence layer connecting every existing
// module into one institutional decision process. A "Decision" here IS an
// existing Trade Plan (Sprint 10), reused as-is; see lib/decisionWorkflow.ts's
// own header comment for the full reuse rationale (zero new database
// tables, zero duplicated storage).
//
// Distinct, deliberately-not-merged page from the pre-existing
// DecisionEngine.tsx (/decision-engine): that page is a single-symbol
// deterministic Buy/Accumulate/Hold/Reduce/Sell/Avoid verdict engine (Phase
// 14); this page is a cross-module WORKFLOW tracker over one Trade Plan.
// Both are kept, cross-linked below, never renamed or merged — the
// pre-existing Decision Engine's own scoring is instead reused directly as
// one Evidence Panel reference card (investing decisions only, since that
// engine is symbol-based, not asset-class-agnostic).
//
// Reused, never duplicated, in this one page:
//   - tradePlansApi.ts/strategiesApi.ts (Sprints 9-10) — the plan/strategy
//     data itself and their own completeness engines.
//   - lib/decisionWorkflow.ts / lib/useDecisionWorkflow.ts — pure
//     composition over the above, this sprint's only new logic.
//   - useGetInstitutionalDecision() (Phase 14) — the pre-existing Decision
//     Engine's own verdict, shown as one Evidence Panel reference card.
//   - AskCoachLauncher (Sprint L1) — the platform's real AI Coach panel,
//     for the AI Decision Coach section's actual Q&A.
//   - ModuleLearnTrigger/ModuleLearnDrawer (Sprint 11) — Learning Centre
//     integration, opened with the one real recommended lesson for this
//     decision's weakest stage.
//   - reviewTradePlan/generateTradePlanRiskHighlights/etc. (Sprint 10) —
//     the trade plan's own existing AI narration actions, reused directly
//     rather than a second, duplicate AI system.

import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useDecisionWorkflow, useActiveDecisionSummary } from "@/lib/useDecisionWorkflow";
import { buildDecisionCoachNarrative, buildDecisionTrace, type DecisionStage, type DecisionTraceIcon } from "@/lib/decisionWorkflow";
import { listTradePlans, type TradePlan } from "@/lib/ai-coach/tradePlansApi";
import {
  reviewTradePlan,
  summarizeTradePlan,
  generateTradePlanRiskHighlights,
  type TradePlanNarration,
} from "@/lib/ai-coach/tradePlansApi";
import type { CoachId } from "@/lib/ai-coach/capabilityRegistry";
import {
  useGetInstitutionalDecision,
  getGetInstitutionalDecisionQueryKey,
  useListJournalEntries,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { Milestone, Gavel, Bot, GraduationCap, ShieldAlert, BookOpen, Briefcase, CheckCircle2, AlertTriangle, Circle, Eye } from "lucide-react";
import { AiTradingCoachPanel } from "@/components/coach/AiTradingCoachPanel";
import { PageShell } from "@/components/layout/PageShell";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

function statusBadgeClass(status: DecisionStage["status"]): string {
  if (status === "complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "partial") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "missing") return "bg-destructive/15 text-destructive border-destructive/30";
  return "border-border text-muted-foreground";
}

function scoreLabelBadgeClass(label: string): string {
  if (label === "Well-Prepared") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (label === "Developing") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (label === "Early Stage") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

// ─── Trade Plan picker — lists real trade plans across all 3 coachIds
// (the same plain-fetch functions useWorkflowSnapshot.ts already calls,
// Sprint 12), never a second, duplicate storage of "what decisions exist."

function useTradePlanChoices(): { loading: boolean; plans: TradePlan[] } {
  const [state, setState] = useState<{ loading: boolean; plans: TradePlan[] }>({ loading: true, plans: [] });
  useEffect(() => {
    let cancelled = false;
    Promise.all(COACH_IDS.map((c) => listTradePlans(c).catch((): TradePlan[] => [])))
      .then((byCoach) => {
        if (cancelled) return;
        const plans = byCoach.flat().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setState({ loading: false, plans });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, plans: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function TradePlanPicker({ onSelect }: { onSelect: (id: number) => void }) {
  const { loading, plans } = useTradePlanChoices();

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (plans.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-muted-foreground" data-testid="decision-workflow-no-plans">
            No trade plans yet. A Decision in this workflow is an existing Trade Plan — create one first.
          </p>
          <Link href="/assistant" className="text-sm font-medium text-primary hover:underline" data-testid="decision-workflow-create-plan-link">
            Open the AI Assistant to create a Trade Plan →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border" data-testid="decision-workflow-picker">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Choose a Decision</CardTitle>
        <CardDescription>Every trade plan below is a real, existing plan from the AI Assistant — nothing here is duplicated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className="w-full text-left p-3 rounded-md border border-border hover:border-primary/50 transition-colors"
            data-testid={`decision-workflow-plan-${p.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{p.title}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {p.coachId} {p.plannedAsset ? `· ${p.plannedAsset}` : ""}
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Stage stepper ───────────────────────────────────────────────────

function StageStepper({ stages }: { stages: DecisionStage[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2" data-testid="decision-workflow-stages">
      {stages.map((stage, i) => {
        const content = (
          <Card
            className={`h-full bg-card border-border ${stage.href ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}`}
            data-testid={`decision-stage-${stage.id}`}
          >
            <CardContent className="pt-4 pb-3 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{i + 1}. {stage.label}</span>
                <Badge className={statusBadgeClass(stage.status)} data-testid={`decision-stage-status-${stage.id}`}>
                  {stage.status === "not-applicable" ? "N/A" : stage.status}
                </Badge>
              </div>
              {stage.confidence !== null && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${stage.confidence}%` }} />
                </div>
              )}
              <p className="text-xs text-muted-foreground leading-snug" data-testid={`decision-stage-action-${stage.id}`}>
                {stage.recommendedAction}
              </p>
              {stage.missingInfo.length > 0 && (
                <ul className="text-[10px] text-muted-foreground list-disc list-inside" data-testid={`decision-stage-missing-${stage.id}`}>
                  {stage.missingInfo.slice(0, 3).map((m, mi) => (
                    <li key={mi}>{m}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
        return stage.href ? (
          <Link key={stage.id} href={stage.href}>{content}</Link>
        ) : (
          <div key={stage.id}>{content}</div>
        );
      })}
    </div>
  );
}

// ─── Evidence Panel ─────────────────────────────────────────────────

function EvidencePanel({
  workflow,
}: {
  workflow: ReturnType<typeof useDecisionWorkflow>;
}) {
  const { tradePlan, strategy } = workflow;
  const { data: journalEntries } = useListJournalEntries();
  const relevantJournal = (journalEntries ?? []).filter(
    (j) => tradePlan?.executedTradeRef !== null && String(j.tradeId) === tradePlan?.executedTradeRef,
  );

  const isInvesting = tradePlan?.coachId === "investing";
  const investingSymbol = isInvesting && tradePlan?.plannedAsset ? tradePlan.plannedAsset : "";
  const { data: investingDecision } = useGetInstitutionalDecision(investingSymbol, {
    query: { queryKey: getGetInstitutionalDecisionQueryKey(investingSymbol), enabled: isInvesting && !!tradePlan?.plannedAsset },
  });

  return (
    <Card className="bg-card border-border" data-testid="decision-evidence-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Evidence Panel
        </CardTitle>
        <CardDescription>Aggregated from existing modules — nothing duplicated or stored twice.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Research / Notebook Summary</p>
          <p data-testid="evidence-research-summary">
            {tradePlan?.sections.filter((s) => s.kind === "research_reference" || s.kind === "notebook_reference").length ?? 0} reference(s) linked in the Trade Plan.
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Strategy Summary</p>
          {strategy ? (
            <p data-testid="evidence-strategy-summary">
              {strategy.title} ({strategy.status})
            </p>
          ) : (
            <p className="text-muted-foreground" data-testid="evidence-strategy-summary-none">No strategy linked.</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Trade Plan Summary</p>
          <p data-testid="evidence-trade-plan-summary">
            {tradePlan?.checklistProgress.completedRequiredItems ?? 0}/{tradePlan?.checklistProgress.requiredItems ?? 0} required checklist items complete.
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Relevant Journal History</p>
          {relevantJournal.length === 0 ? (
            <p className="text-muted-foreground" data-testid="evidence-journal-none">No journal entries reference this decision yet.</p>
          ) : (
            <p data-testid="evidence-journal-count">{relevantJournal.length} journal entr{relevantJournal.length === 1 ? "y" : "ies"} found.</p>
          )}
        </div>
        {isInvesting && investingDecision && (
          <div data-testid="evidence-investing-decision">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Gavel className="h-3 w-3" /> Institutional Decision Engine (existing)</p>
            <p>{investingDecision.recommendation}</p>
            <Link href={`/decision-engine?symbol=${tradePlan?.plannedAsset}`} className="text-xs text-primary hover:underline">
              Open full Decision Engine verdict →
            </Link>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Portfolio Exposure</p>
          <p data-testid="evidence-portfolio-note">See the Portfolio Impact stage above, sourced from your real positions/watchlist.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Decision Trace — explainability panel ─────────────────────────────
// The Decision Engine should never become a black box: every factor that
// fed the Decision Score above is listed here explicitly, referencing the
// real existing module that supplied it — never a duplicate computation.

const TRACE_ICONS: Record<DecisionTraceIcon, { Icon: typeof CheckCircle2; className: string }> = {
  check: { Icon: CheckCircle2, className: "text-emerald-400" },
  warning: { Icon: AlertTriangle, className: "text-amber-400" },
  unavailable: { Icon: Circle, className: "text-muted-foreground" },
};

function DecisionTracePanel({ workflow }: { workflow: ReturnType<typeof useDecisionWorkflow> }) {
  const trace = buildDecisionTrace(workflow.stages);
  return (
    <Card className="bg-card border-border" data-testid="decision-trace-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" /> Decision Trace
        </CardTitle>
        <CardDescription>
          Every factor behind the Decision Score above, explained — which module supplied it, its real status, and
          any assumption it rests on. Nothing here is "magic AI."
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {trace.map((entry) => {
            const { Icon, className } = TRACE_ICONS[entry.icon];
            return (
              <li key={entry.id} className="flex items-start gap-2 text-sm" data-testid={`decision-trace-${entry.id}`}>
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${className}`} />
                <div>
                  <p>
                    <span className="font-medium">{entry.label}</span>{" "}
                    <span className="text-muted-foreground" data-testid={`decision-trace-status-${entry.id}`}>
                      {entry.statusLabel}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`decision-trace-source-${entry.id}`}>
                    Source: {entry.sourceModule}
                  </p>
                  {entry.assumption && (
                    <p className="text-xs text-muted-foreground italic" data-testid={`decision-trace-assumption-${entry.id}`}>
                      {entry.assumption}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── AI Decision Coach ───────────────────────────────────────────────

function AiDecisionCoach({ workflow }: { workflow: ReturnType<typeof useDecisionWorkflow> }) {
  const { stages, score, weakestStage, tradePlan } = workflow;
  const narrative = buildDecisionCoachNarrative(stages, score, weakestStage);
  const [narration, setNarration] = useState<TradePlanNarration | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function run(action: string, fn: (id: number) => Promise<TradePlanNarration>) {
    if (!tradePlan) return;
    setLoadingAction(action);
    try {
      const result = await fn(tradePlan.id);
      setNarration(result);
    } catch {
      setNarration({ text: "Unable to generate this right now.", source: "error" });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Card className="bg-card border-border" data-testid="decision-ai-coach">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Decision Coach
        </CardTitle>
        <CardDescription>Education and disciplined decision-making — never a buy/sell instruction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="coach-score-explanation">{narrative.scoreExplanation}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Contributed Positively</p>
            {narrative.positiveFactors.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="coach-positive-factors-none">None yet.</p>
            ) : (
              <ul className="list-disc list-inside text-xs text-emerald-400" data-testid="coach-positive-factors-list">
                {narrative.positiveFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reduced Confidence</p>
            {narrative.negativeFactors.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="coach-negative-factors-none">None.</p>
            ) : (
              <ul className="list-disc list-inside text-xs text-amber-400" data-testid="coach-negative-factors-list">
                {narrative.negativeFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Missing Evidence</p>
          {narrative.missingEvidence.length === 0 ? (
            <p className="text-muted-foreground" data-testid="coach-missing-evidence-none">Nothing missing.</p>
          ) : (
            <ul className="list-disc list-inside text-xs" data-testid="coach-missing-evidence-list">
              {narrative.missingEvidence.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Assumptions to Test</p>
          <ul className="list-disc list-inside text-xs" data-testid="coach-assumptions-list">
            {narrative.assumptionsToTest.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Risks Deserving Attention</p>
          <ul className="list-disc list-inside text-xs" data-testid="coach-risks-list">
            {narrative.risksToReview.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">What a Professional Would Review Next</p>
          <p data-testid="coach-next-review">{narrative.nextReview}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={!tradePlan || loadingAction !== null} onClick={() => run("review", reviewTradePlan)} data-testid="coach-action-review">
            {loadingAction === "review" ? "Reviewing…" : "AI Review of Trade Plan"}
          </Button>
          <Button size="sm" variant="outline" disabled={!tradePlan || loadingAction !== null} onClick={() => run("summarize", summarizeTradePlan)} data-testid="coach-action-summarize">
            {loadingAction === "summarize" ? "Summarizing…" : "Summarize Trade Plan"}
          </Button>
          <Button size="sm" variant="outline" disabled={!tradePlan || loadingAction !== null} onClick={() => run("risk-highlights", generateTradePlanRiskHighlights)} data-testid="coach-action-risk-highlights">
            {loadingAction === "risk-highlights" ? "Generating…" : "Risk Highlights"}
          </Button>
        </div>

        {narration && (
          <p className="text-sm border-t border-border pt-2" data-testid="coach-narration-result">{narration.text}</p>
        )}

        <AskCoachLauncher label="Ask the AI Decision Coach" suggestedQuestion="What should I review before treating this decision as ready?" />
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function DecisionWorkflow() {
  const search = useSearch();
  const [tradePlanId, setTradePlanId] = useState<number | null>(null);
  const autoRanRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const planId = params.get("planId");
    if (planId && !autoRanRef.current && Number.isInteger(Number(planId))) {
      autoRanRef.current = true;
      setTradePlanId(Number(planId));
    }
  }, [search]);

  const workflow = useDecisionWorkflow(tradePlanId);
  const activeSummary = useActiveDecisionSummary();

  const weakest = workflow.weakestStage;
  const { learning } = workflow;

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-decision-workflow">
      <AiTradingCoachPanel />
      <PageShell
        icon={Milestone}
        title="Decision Workflow"
        journeyStage="decision"
        learnEntryId="decision-workflow"
        whyItMatters="Use this once research is done and you're weighing a real trade — it turns your Trade Plan, Strategy, Journal, and Portfolio context into one structured, evidence-driven read, never a buy/sell instruction on its own."
        badges={
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-decision-workflow">
            Institutional Decision Engine
          </Badge>
        }
        description={
          <>
            Transforms research into a structured, evidence-driven decision — orchestrating your existing Trade Plan,
            Strategy, Journal, and Portfolio, never replacing them. Guidance only, never a buy/sell instruction.{" "}
            <Link href="/decision-engine" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-decision-engine">
              Looking for a single-symbol Buy/Hold/Sell verdict? See the Decision Engine.
            </Link>{" "}
            <Link href="/execution-lifecycle" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-execution-lifecycle">
              Once this decision is ready, track it through execution in the Execution &amp; Lifecycle Manager.
            </Link>
          </>
        }
      />

      {!activeSummary.loading && activeSummary.tradePlan && tradePlanId === null && (
        <Card className="bg-card border-border" data-testid="decision-workflow-active-suggestion">
          <CardContent className="pt-4 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm">
              Most recently updated decision in progress: <span className="font-medium">{activeSummary.tradePlan.title}</span>
              {activeSummary.score && ` — ${activeSummary.score.overall}/100`}
            </p>
            <Button size="sm" onClick={() => setTradePlanId(activeSummary.tradePlan!.id)} data-testid="decision-workflow-resume-active">
              Resume
            </Button>
          </CardContent>
        </Card>
      )}

      {tradePlanId === null ? (
        <TradePlanPicker onSelect={setTradePlanId} />
      ) : workflow.loading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : workflow.error || !workflow.tradePlan ? (
        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm text-destructive" data-testid="decision-workflow-error">{workflow.error ?? "This decision could not be loaded."}</p>
            <Button size="sm" variant="outline" onClick={() => setTradePlanId(null)}>Choose another decision</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-card border-border" data-testid="decision-score-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{workflow.tradePlan.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold" data-testid="decision-score-value">{workflow.score.overall}</span>
                  <Badge className={scoreLabelBadgeClass(workflow.score.label)} data-testid="decision-score-label">{workflow.score.label}</Badge>
                </div>
              </div>
              <CardDescription>
                Guidance, not a recommendation — combines existing readiness signals (research, evidence, thesis,
                risk, strategy, trade plan quality). Never a buy/sell instruction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="ghost" onClick={() => setTradePlanId(null)} data-testid="decision-workflow-change-plan">
                Choose a different decision
              </Button>
            </CardContent>
          </Card>

          <DecisionTracePanel workflow={workflow} />

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Decision Workflow</h2>
            <StageStepper stages={workflow.stages} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EvidencePanel workflow={workflow} />
            <AiDecisionCoach workflow={workflow} />
          </div>

          <Card className="bg-card border-border" data-testid="decision-learning-integration">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Continuous Learning
              </CardTitle>
              <CardDescription>Recommended lesson for this decision's weakest area, from the existing Learning Centre.</CardDescription>
            </CardHeader>
            <CardContent>
              {learning.recommendedTopicKey && learning.recommendedPathKey ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm">
                    Weakest stage: {weakest?.label} — {learning.engagedWithRecommendedLesson ? "lesson already viewed" : `recommended: ${learning.recommendedLabel}`}
                  </p>
                  <ModuleLearnTrigger
                    moduleLabel={`Decision Workflow — ${weakest?.label ?? ""}`}
                    pathKey={learning.recommendedPathKey}
                    topicKey={learning.recommendedTopicKey}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="decision-learning-none">
                  No specific lesson recommended right now — every scored stage is complete.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

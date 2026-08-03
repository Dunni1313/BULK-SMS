// v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager.
//
// The orchestration layer between Decision Workflow (Sprint 13) and
// everything that happens once a user executes manually at their own
// external broker. The platform does NOT execute trades and never will —
// there is no order-routing feature anywhere in this codebase; this page
// only tracks the lifecycle of a Trade Plan (Sprint 10) before and after
// that manual execution, generating a professional execution package and
// surfacing an 11-stage institutional pipeline.
//
// Reused, never duplicated, in this one page:
//   - tradePlansApi.ts/strategiesApi.ts (Sprints 9-10) — the plan/strategy
//     data and its own completeness engine.
//   - lib/decisionWorkflow.ts (Sprint 13) — the readiness stages/score that
//     drive every pre-execution pipeline stage.
//   - lib/tradeLifecycle.ts / lib/useTradeLifecycle.ts — this sprint's own
//     pure composition over both of the above plus real trades/trading
//     positions/journal data.
//   - AskCoachLauncher (Sprint L1) — the platform's real AI Coach panel,
//     for the AI Trade Manager's actual free-form Q&A.
//   - ModuleLearnTrigger/ModuleLearnDrawer (Sprint 11) — Learning Centre
//     integration.
//   - updateTradePlan (Sprint 10) — the trade plan's own existing PATCH
//     endpoint, reused directly for "mark executed" and "archive," never a
//     new mutation surface.

import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useTradeLifecycle, useTradeLifecyclePipeline } from "@/lib/useTradeLifecycle";
import {
  PIPELINE_STAGES,
  STAGE_GUIDANCE,
  buildExecutionPackage,
  recommendedLifecycleLesson,
  type PipelineStageId,
  type TradeLifecycleRecord,
} from "@/lib/tradeLifecycle";
import { updateTradePlan } from "@/lib/ai-coach/tradePlansApi";
import type { CoachId } from "@/lib/ai-coach/capabilityRegistry";
import { useKnowledgeGraph } from "@/lib/useKnowledgeGraph";
import { relatedEntities } from "@/lib/knowledgeGraph";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { AiTradingCoachPanel } from "@/components/coach/AiTradingCoachPanel";
import {
  Route,
  Milestone,
  Bot,
  GraduationCap,
  ShieldAlert,
  Archive,
  PlayCircle,
  ClipboardList,
  Clock,
  TrendingUp,
  BookOpen,
  KanbanSquare,
  Network,
} from "lucide-react";

const fmtUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function stageBadgeClass(stage: PipelineStageId): string {
  if (stage === "reviewed" || stage === "archived") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (stage === "open-position" || stage === "managing") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (stage === "closed" || stage === "journal-pending") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (stage === "ready-to-execute" || stage === "decision-ready") return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
  return "border-border text-muted-foreground";
}

// ─── Pipeline board ──────────────────────────────────────────────────────

function PipelineBoard({
  loading,
  records,
  onSelect,
}: {
  loading: boolean;
  records: TradeLifecycleRecord[];
  onSelect: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2" data-testid="lifecycle-pipeline-board">
      {PIPELINE_STAGES.map((stage) => {
        const columnRecords = records.filter((r) => r.currentStage === stage.id);
        return (
          <Card key={stage.id} className="bg-card border-border" data-testid={`pipeline-column-${stage.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-1">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{stage.label}</CardTitle>
                <Badge variant="outline" className="text-[10px]" data-testid={`pipeline-column-count-${stage.id}`}>
                  {columnRecords.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-3">
              {columnRecords.length === 0 ? (
                <p className="text-[11px] text-muted-foreground" data-testid={`pipeline-column-empty-${stage.id}`}>
                  Nothing here.
                </p>
              ) : (
                columnRecords.map((r) => (
                  <button
                    key={r.tradePlan.id}
                    type="button"
                    onClick={() => onSelect(r.tradePlan.id)}
                    className="w-full text-left p-2 rounded-md border border-border hover:border-primary/50 transition-colors"
                    data-testid={`pipeline-card-${r.tradePlan.id}`}
                  >
                    <p className="text-xs font-medium truncate">{r.tradePlan.title}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {r.tradePlan.coachId} {r.tradePlan.plannedAsset ? `· ${r.tradePlan.plannedAsset}` : ""}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Lifecycle summary card ──────────────────────────────────────────────

function LifecycleSummaryCard({ record }: { record: TradeLifecycleRecord }) {
  const stageMeta = PIPELINE_STAGES.find((s) => s.id === record.currentStage)!;
  return (
    <Card className="bg-card border-border" data-testid="lifecycle-summary-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{record.tradePlan.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={stageBadgeClass(record.currentStage)} data-testid="lifecycle-current-stage">
              {stageMeta.label}
            </Badge>
            {record.outcome === "cancelled" && (
              <Badge variant="outline" className="text-muted-foreground" data-testid="lifecycle-cancelled-badge">
                Cancelled
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>{stageMeta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" data-testid="lifecycle-completion-bar">
          <div className="h-full bg-primary" style={{ width: `${record.completionPct}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Previous Stage</p>
            <p data-testid="lifecycle-previous-stage">{record.previousStage ? PIPELINE_STAGES.find((s) => s.id === record.previousStage)?.label : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Next Stage</p>
            <p data-testid="lifecycle-next-stage">{record.nextStage ? PIPELINE_STAGES.find((s) => s.id === record.nextStage)?.label : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Open Risk</p>
            <p data-testid="lifecycle-open-risk">{record.openRisk !== null ? fmtUsd(record.openRisk) : "Not available"}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time in Trade</p>
            <p data-testid="lifecycle-time-in-trade">{record.timeInTradeDays !== null ? `${record.timeInTradeDays} day${record.timeInTradeDays === 1 ? "" : "s"}` : "Not yet executed"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Outstanding Tasks</p>
          {record.outstandingTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="lifecycle-outstanding-tasks-none">Nothing outstanding for this stage.</p>
          ) : (
            <ul className="list-disc list-inside text-xs" data-testid="lifecycle-outstanding-tasks-list">
              {record.outstandingTasks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Execution package ───────────────────────────────────────────────────

function ReadyToExecutePanel({ workflow }: { workflow: ReturnType<typeof useTradeLifecycle> }) {
  const { tradePlan, decisionScore, strategy, record, reload } = workflow;
  const [markExecutedOpen, setMarkExecutedOpen] = useState(false);
  const [executedTradeRef, setExecutedTradeRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  if (!tradePlan || !record) return null;
  const pkg = buildExecutionPackage(tradePlan, decisionScore, strategy);

  async function markExecuted() {
    if (!tradePlan) return;
    setSubmitting(true);
    setMarkError(null);
    try {
      await updateTradePlan(tradePlan.id, {
        status: "executed",
        executedTradeRef: executedTradeRef.trim() || null,
        changeSummary: "Marked executed via Execution & Lifecycle Manager",
      });
      setMarkExecutedOpen(false);
      setExecutedTradeRef("");
      reload();
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : "Failed to mark this trade plan executed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="bg-card border-border" data-testid="execution-package-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Execution Package
        </CardTitle>
        <CardDescription>
          A professional summary of this fully-prepared plan. Execute manually at your own external broker, then record it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Instrument</dt><dd data-testid="package-instrument">{pkg.instrument ?? "Not specified"}</dd></div>
          <div><dt className="text-muted-foreground">Direction</dt><dd className="capitalize" data-testid="package-direction">{pkg.direction ?? "Not specified"}</dd></div>
          <div><dt className="text-muted-foreground">Entry</dt><dd data-testid="package-entry">{pkg.entry ?? "Not specified"}</dd></div>
          <div><dt className="text-muted-foreground">Stop</dt><dd data-testid="package-stop">{pkg.stop ?? "Not specified"}</dd></div>
          <div>
            <dt className="text-muted-foreground">Targets</dt>
            <dd data-testid="package-targets">{pkg.targets.length > 0 ? pkg.targets.join(" · ") : "Not specified"}</dd>
          </div>
          <div><dt className="text-muted-foreground">Position Size</dt><dd data-testid="package-position-size">{pkg.positionSize ?? "Not specified"}</dd></div>
          <div><dt className="text-muted-foreground">Risk</dt><dd data-testid="package-risk">{pkg.risk ?? "Not specified"}</dd></div>
          <div><dt className="text-muted-foreground">Decision Score</dt><dd data-testid="package-decision-score">{pkg.decisionScore}/100 ({pkg.decisionScoreLabel})</dd></div>
          <div><dt className="text-muted-foreground">Strategy</dt><dd data-testid="package-strategy">{pkg.strategyTitle ?? "Not linked"}</dd></div>
        </dl>
        {pkg.notes && (
          <div>
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-xs" data-testid="package-notes">{pkg.notes}</p>
          </div>
        )}

        {!markExecutedOpen ? (
          <Button size="sm" onClick={() => setMarkExecutedOpen(true)} data-testid="button-open-mark-executed">
            <PlayCircle className="h-3.5 w-3.5 mr-1" /> I've Executed This Trade
          </Button>
        ) : (
          <div className="space-y-2 pt-2 border-t border-border" data-testid="mark-executed-form">
            <p className="text-xs text-muted-foreground">
              Optionally link the real trade/position id this plan became (from Trades or Trading Positions). Leave blank if you'd rather link it later.
            </p>
            <Input
              placeholder="Executed trade/position id (optional)"
              value={executedTradeRef}
              onChange={(e) => setExecutedTradeRef(e.target.value)}
              data-testid="input-executed-trade-ref"
            />
            {markError && <p className="text-xs text-destructive" data-testid="mark-executed-error">{markError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={markExecuted} disabled={submitting} data-testid="button-confirm-mark-executed">
                {submitting ? "Recording…" : "Confirm Executed"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMarkExecutedOpen(false)} data-testid="button-cancel-mark-executed">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Position management ─────────────────────────────────────────────────

function PositionManagementCard({ record }: { record: TradeLifecycleRecord }) {
  const { linkedExecution, journalStatus, performanceStatus } = record;
  return (
    <Card className="bg-card border-border" data-testid="position-management-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Position Management
        </CardTitle>
        <CardDescription>Sourced from your real trades, trading positions, and Trade Journal — nothing fabricated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Execution Detail</p>
          {!linkedExecution ? (
            <p className="text-muted-foreground" data-testid="position-not-executed">Not yet executed.</p>
          ) : linkedExecution.detailUnavailable ? (
            <p className="text-muted-foreground" data-testid="position-detail-unavailable">
              Marked executed — live position detail unavailable for this instrument type.
            </p>
          ) : (
            <p data-testid="position-detail">
              {linkedExecution.symbol} — {linkedExecution.status}
              {linkedExecution.quantity !== null ? ` · ${linkedExecution.quantity} unit(s)` : ""}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="h-3 w-3" /> Journal Status</p>
          <p data-testid="position-journal-status">{journalStatus.label}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Performance Status</p>
          {performanceStatus.state === "not-yet-applicable" && <p className="text-muted-foreground" data-testid="position-performance-na">Not yet applicable.</p>}
          {performanceStatus.state === "open" && (
            <p data-testid="position-performance-open">
              {performanceStatus.unrealizedPnl !== null ? `Unrealized P&L: ${fmtUsd(performanceStatus.unrealizedPnl)}` : "Unrealized P&L not available for this instrument."}
            </p>
          )}
          {performanceStatus.state === "closed" && (
            <p data-testid="position-performance-closed">
              {performanceStatus.realizedPnl !== null ? `Realized P&L: ${fmtUsd(performanceStatus.realizedPnl)}` : "Realized P&L not available."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Trade Manager ────────────────────────────────────────────────────

function AiTradeManager({ record }: { record: TradeLifecycleRecord }) {
  const guidance = STAGE_GUIDANCE[record.currentStage];
  return (
    <Card className="bg-card border-border" data-testid="ai-trade-manager-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Trade Manager
        </CardTitle>
        <CardDescription>Institutional practice guidance for this stage — never a buy/sell instruction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">What Should Happen Now</p>
          <p data-testid="guidance-what-now">{guidance.whatNow}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Why</p>
          <p data-testid="guidance-why">{guidance.why}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Institutional Best Practice</p>
          <p data-testid="guidance-best-practice">{guidance.bestPractice}</p>
        </div>
        {guidance.commonMistakes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Common Mistakes</p>
            <ul className="list-disc list-inside text-xs" data-testid="guidance-common-mistakes">
              {guidance.commonMistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {guidance.checklist.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Checklist Before Progressing</p>
            <ul className="list-disc list-inside text-xs" data-testid="guidance-checklist">
              {guidance.checklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <AskCoachLauncher label="Ask the AI Trade Manager" suggestedQuestion={`What should happen now for this ${record.tradePlan.coachId} trade, and why?`} />
      </CardContent>
    </Card>
  );
}

// ─── Learning integration ────────────────────────────────────────────────

function LifecycleLearningCard({ record, weakestDecisionStageId }: { record: TradeLifecycleRecord; weakestDecisionStageId: string | null }) {
  const rec = recommendedLifecycleLesson(record.tradePlan.coachId, record.currentStage, weakestDecisionStageId as never);
  return (
    <Card className="bg-card border-border" data-testid="lifecycle-learning-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> Continuous Learning
        </CardTitle>
        <CardDescription>A real, existing lesson for this lifecycle stage — nothing fabricated.</CardDescription>
      </CardHeader>
      <CardContent>
        {rec ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" data-testid="lifecycle-learning-recommended">Recommended: {rec.label}</p>
            <ModuleLearnTrigger moduleLabel={`Execution Lifecycle — ${record.currentStage}`} pathKey={rec.pathKey} topicKey={rec.topicKey} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="lifecycle-learning-none">No specific lesson recommended for this stage right now.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Trade plan picker (mirrors DecisionWorkflow.tsx's own picker) ──────

function TradePlanPicker({
  loading,
  records,
  onSelect,
}: {
  loading: boolean;
  records: TradeLifecycleRecord[];
  onSelect: (id: number) => void;
}) {
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
  if (records.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-muted-foreground" data-testid="lifecycle-no-plans">
            No trade plans yet — the pipeline starts with a Trade Plan.
          </p>
          <Link href="/assistant" className="text-sm font-medium text-primary hover:underline">
            Open the AI Assistant to create a Trade Plan →
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground" data-testid="lifecycle-select-prompt">
          Select any trade from the pipeline above to see its full lifecycle detail.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph. Reuses
// useKnowledgeGraph()/relatedEntities() directly — the same graph engine
// backing /knowledge-graph and the Command Centre's own Knowledge
// Insights card. A bounded first surface (Command Centre + this page); a
// future sprint can extend the same pattern to more pages.
function RelatedKnowledgeCard({ tradePlanId }: { tradePlanId: number }) {
  const { graph, loading } = useKnowledgeGraph();
  if (loading) return <Skeleton className="h-24 w-full" />;
  const related = relatedEntities(graph, `trade-plan:${tradePlanId}`);
  return (
    <Card className="bg-card border-border" data-testid="card-related-knowledge">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" /> Related Knowledge
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/knowledge-graph" className="underline">
            Knowledge &amp; Intelligence Graph
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {related.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="related-knowledge-empty">
            Nothing else in your platform is connected to this trade plan yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="related-knowledge-list">
            {related.map((r) => (
              <li key={r.node.id} className="text-sm">
                <span className="text-muted-foreground text-xs uppercase">{r.node.type.replace("-", " ")}:</span> {r.node.label}
                <span className="text-[10px] text-muted-foreground ml-1">({r.relation})</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExecutionLifecycleManager() {
  const search = useSearch();
  const [tradePlanId, setTradePlanId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const planId = params.get("planId");
    if (planId && Number.isInteger(Number(planId))) setTradePlanId(Number(planId));
  }, [search]);

  const pipeline = useTradeLifecyclePipeline();
  const workflow = useTradeLifecycle(tradePlanId);

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-execution-lifecycle-manager">
      <AiTradingCoachPanel />
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Route className="h-6 w-6 text-indigo-400" /> Execution & Lifecycle Manager
          </h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-lifecycle-manager">
            Institutional Workflow
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manages the complete lifecycle of every trade before and after execution — this platform never places, closes, or
          modifies a real order. Execution stays with your own external broker.{" "}
          <Link href="/decision-workflow" className="text-indigo-400 underline-offset-2 hover:underline" data-testid="link-to-decision-workflow">
            Looking for one decision's readiness? See the Decision Workflow.
          </Link>
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <KanbanSquare className="h-5 w-5" /> Pipeline
        </h2>
        <PipelineBoard loading={pipeline.loading} records={pipeline.records} onSelect={setTradePlanId} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Milestone className="h-5 w-5" /> Selected Trade
        </h2>
        {tradePlanId === null ? (
          <TradePlanPicker loading={pipeline.loading} records={pipeline.records} onSelect={setTradePlanId} />
        ) : workflow.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : workflow.error || !workflow.record ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm text-destructive" data-testid="lifecycle-error">{workflow.error ?? "This trade could not be loaded."}</p>
              <Button size="sm" variant="outline" onClick={() => setTradePlanId(null)}>Choose another trade</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="ghost" onClick={() => setTradePlanId(null)} data-testid="button-change-selected-trade">
                Choose a different trade
              </Button>
            </div>
            <div className="space-y-4">
              <LifecycleSummaryCard record={workflow.record} />

              {workflow.record.currentStage === "ready-to-execute" && <ReadyToExecutePanel workflow={workflow} />}

              {workflow.record.linkedExecution && <PositionManagementCard record={workflow.record} />}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AiTradeManager record={workflow.record} />
                <LifecycleLearningCard record={workflow.record} weakestDecisionStageId={workflow.weakestDecisionStage?.id ?? null} />
              </div>

              <RelatedKnowledgeCard tradePlanId={workflow.record.tradePlan.id} />

              <Card className="bg-card border-border" data-testid="lifecycle-archive-card">
                <CardContent className="pt-6 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    {workflow.record.blockedReasons.archive ?? "Ready to move this trade plan out of the active pipeline."}
                  </p>
                  <ArchiveButton record={workflow.record} onDone={workflow.reload} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ArchiveButton({ record, onDone }: { record: TradeLifecycleRecord; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  async function archive() {
    setSubmitting(true);
    try {
      await updateTradePlan(record.tradePlan.id, { status: "archived", changeSummary: "Archived via Execution & Lifecycle Manager" });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Button size="sm" variant="outline" disabled={!record.canArchive || submitting} onClick={archive} data-testid="button-archive-trade-plan">
      <Archive className="h-3.5 w-3.5 mr-1" /> {submitting ? "Archiving…" : "Archive"}
    </Button>
  );
}

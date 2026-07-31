// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
//
// NOT another Learning Centre. NOT another Workflow Engine. NOT another
// Knowledge Graph. This page lets a user step through one of 12
// documented Playbooks (lib/playbooks.ts), each stage of which links out
// to an already-existing module — Playbooks orchestrate, they never
// duplicate functionality. Every completion reading is either a real,
// already-computed platform signal ("auto") or an honestly-labeled,
// self-certified acknowledgement ("manual") — see lib/playbookProgress.ts.

import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { usePlaybooks } from "@/lib/usePlaybooks";
import {
  buildPlaybookCoachNarrative,
  type PlaybookStageProgress,
  type PlaybookProgress,
} from "@/lib/playbookProgress";
import { PLAYBOOK_CATEGORY_LABELS, type Playbook, type PlaybookCategory } from "@/lib/playbooks";
import { relatedEntities, relatedEntitiesWithinTwoHops, discoverPatterns, type KnowledgeGraph } from "@/lib/knowledgeGraph";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import {
  BookMarked,
  ClipboardList,
  CheckCircle2,
  Circle,
  PauseCircle,
  Clock,
  Bot,
  Network,
  Search,
} from "lucide-react";

const CATEGORY_ORDER: PlaybookCategory[] = ["research-and-strategy", "trade-lifecycle", "portfolio-and-risk", "cadence-review"];

function stageStatusBadgeClass(status: PlaybookStageProgress["status"]): string {
  if (status === "complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "blocked") return "bg-destructive/15 text-destructive border-destructive/30";
  if (status === "in-progress") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function stageStatusIcon(status: PlaybookStageProgress["status"]) {
  if (status === "complete") return CheckCircle2;
  if (status === "blocked") return PauseCircle;
  if (status === "in-progress") return Clock;
  return Circle;
}

function stageStatusLabel(status: PlaybookStageProgress["status"]): string {
  if (status === "in-progress") return "In Progress";
  if (status === "not-started") return "Not Started";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function overallStatusBadgeClass(status: PlaybookProgress["overallStatus"]): string {
  if (status === "complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "in-progress") return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
  return "bg-muted text-muted-foreground border-border";
}

// ─── Playbook picker ────────────────────────────────────────────────────

function PlaybookPicker({
  progresses,
  selectedId,
  onSelect,
}: {
  progresses: PlaybookProgress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4" data-testid="playbook-picker">
      {CATEGORY_ORDER.map((cat) => {
        const inCategory = progresses.filter((p) => p.playbook.category === cat);
        if (inCategory.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{PLAYBOOK_CATEGORY_LABELS[cat]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {inCategory.map((p) => (
                <Card
                  key={p.playbook.id}
                  onClick={() => onSelect(p.playbook.id)}
                  className={`bg-card border-border cursor-pointer transition-colors hover:border-primary/40 ${selectedId === p.playbook.id ? "border-primary/60" : ""}`}
                  data-testid={`playbook-card-${p.playbook.id}`}
                >
                  <CardContent className="pt-4 pb-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium">{p.playbook.name}</span>
                      <Badge className={overallStatusBadgeClass(p.overallStatus)} data-testid={`playbook-status-${p.playbook.id}`}>
                        {p.overallStatus === "in-progress" ? "In Progress" : p.overallStatus === "complete" ? "Complete" : "Not Started"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{p.playbook.purpose}</p>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${p.progressPct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground" data-testid={`playbook-progress-${p.playbook.id}`}>
                      {p.completedCount}/{p.totalCount} stages complete
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Playbook overview card ─────────────────────────────────────────────

function PlaybookOverviewCard({ playbook }: { playbook: Playbook }) {
  return (
    <Card className="bg-card border-border" data-testid="playbook-overview">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookMarked className="h-4 w-4" /> {playbook.name}
        </CardTitle>
        <CardDescription>{playbook.purpose}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Objective</p>
          <p>{playbook.objective}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Prerequisites</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {playbook.prerequisites.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Required Inputs</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {playbook.requiredInputs.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Expected Outputs</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {playbook.expectedOutputs.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Validation Rules</p>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {playbook.validationRules.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Common Mistakes</p>
          <ul className="text-xs list-disc list-inside space-y-0.5 text-amber-400">
            {playbook.commonMistakes.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Institutional Notes</p>
          <ul className="text-xs list-disc list-inside space-y-0.5">
            {playbook.institutionalNotes.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        {playbook.relatedLearning.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Related Learning</p>
            <div className="flex flex-wrap gap-1.5">
              {playbook.relatedLearning.map((l) => (
                <ModuleLearnTrigger key={`${l.pathKey}:${l.topicKey}`} moduleLabel={l.label} pathKey={l.pathKey} topicKey={l.topicKey} size="xs" />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Trade Plan binder ───────────────────────────────────────────────────

function TradePlanBinder({
  options,
  boundId,
  onBind,
}: {
  options: { id: number; title: string; coachId: string }[];
  boundId: number | null;
  onBind: (id: number | null) => void;
}) {
  if (options.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-muted-foreground" data-testid="playbook-no-trade-plans">
            No trade plans exist yet to apply this playbook to. Create one via the AI Assistant first.
          </p>
          <Link href="/assistant" className="text-xs font-medium text-primary hover:underline">
            Open the AI Assistant →
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card border-border" data-testid="playbook-trade-plan-binder">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Apply to a Trade Plan</CardTitle>
        <CardDescription>Every trade plan below is a real, existing plan — nothing here is duplicated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onBind(boundId === o.id ? null : o.id)}
            className={`w-full text-left p-2.5 rounded-md border transition-colors ${boundId === o.id ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"}`}
            data-testid={`playbook-trade-plan-option-${o.id}`}
          >
            <span className="text-sm">{o.title}</span>
            <span className="text-xs text-muted-foreground ml-2">{o.coachId}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Stage list ──────────────────────────────────────────────────────────

function StageCard({
  progress,
  playbookId,
  selected,
  onSelect,
  onAcknowledge,
  onUnacknowledge,
}: {
  progress: PlaybookStageProgress;
  playbookId: string;
  selected: boolean;
  onSelect: () => void;
  onAcknowledge: () => void;
  onUnacknowledge: () => void;
}) {
  const { stage, status, detail } = progress;
  const StatusIcon = stageStatusIcon(status);
  return (
    <Card
      className={`bg-card border-border cursor-pointer transition-colors ${selected ? "border-primary/60" : "hover:border-primary/30"}`}
      onClick={onSelect}
      data-testid={`playbook-stage-${stage.id}`}
    >
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{stage.title}</p>
          <Badge className={stageStatusBadgeClass(status)} data-testid={`playbook-stage-status-${stage.id}`}>
            <StatusIcon className="h-3 w-3 mr-1" /> {stageStatusLabel(status)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{stage.purpose}</p>
        <p className="text-xs">
          <span className="text-muted-foreground">Why it matters: </span>
          {stage.whyItMatters}
        </p>
        <ul className="text-xs list-disc list-inside space-y-0.5">
          {stage.requiredActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
        <p className="text-xs" data-testid={`playbook-stage-detail-${stage.id}`}>
          {detail}
        </p>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Link href={stage.moduleHref} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`playbook-stage-module-link-${stage.id}`}>
              {stage.moduleLabel}
            </Button>
          </Link>
          {stage.signalType === "manual" && (
            <Button
              size="sm"
              variant={status === "complete" ? "outline" : "secondary"}
              className="h-7 text-xs"
              data-testid={`playbook-stage-acknowledge-${stage.id}`}
              onClick={(e) => {
                e.stopPropagation();
                status === "complete" ? onUnacknowledge() : onAcknowledge();
              }}
            >
              {status === "complete" ? "Undo" : "Mark Done"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Playbook Coach ───────────────────────────────────────────────────

function AiPlaybookCoachCard({ playbook, selectedStage }: { playbook: Playbook; selectedStage: PlaybookStageProgress | null }) {
  const narrative = useMemo(() => buildPlaybookCoachNarrative(playbook, selectedStage), [playbook, selectedStage]);
  return (
    <Card className="bg-card border-border" data-testid="playbook-ai-coach">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Playbook Coach
        </CardTitle>
        <CardDescription>Reuses the platform's existing deterministic coach narrative pattern — never invents a process step.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-0.5">Why This Stage Exists</p>
          <p data-testid="playbook-coach-why-exists">{narrative.whyThisStageExists}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Professional Expectations</p>
          <p data-testid="playbook-coach-expectations">{narrative.professionalExpectations}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Typical Institutional Process</p>
          <p data-testid="playbook-coach-institutional-process">{narrative.typicalInstitutionalProcess}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Common Errors</p>
          <ul className="list-disc list-inside space-y-0.5" data-testid="playbook-coach-common-errors">
            {narrative.commonErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">When to Stop and Reassess</p>
          <p data-testid="playbook-coach-stop-reassess">{narrative.whenToStopAndReassess}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Related Historical Examples</p>
          <p data-testid="playbook-coach-historical-examples">{narrative.relatedHistoricalExamples}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Related Knowledge (reuses the Knowledge Graph, Sprint 17) ───────────

function RelatedKnowledgeCard({
  playbook,
  boundTradePlanId,
  graph,
  journalEntries,
  portfolioRisk,
}: {
  playbook: Playbook;
  boundTradePlanId: number | null;
  graph: KnowledgeGraph;
  journalEntries: import("@workspace/api-client-react").JournalEntry[];
  portfolioRisk: import("@/lib/portfolioRiskIntelligence").RiskIntelligenceReport | null;
}) {
  const boundNodeId = boundTradePlanId !== null ? `trade-plan:${boundTradePlanId}` : null;

  const research = boundNodeId ? relatedEntitiesWithinTwoHops(graph, boundNodeId, "notebook") : [];
  const strategies = boundNodeId ? relatedEntities(graph, boundNodeId).filter((r) => r.node.type === "strategy") : [];
  const journals = boundNodeId ? relatedEntities(graph, boundNodeId).filter((r) => r.node.type === "journal-entry") : [];

  const patterns = useMemo(() => discoverPatterns(graph, journalEntries, portfolioRisk), [graph, journalEntries, portfolioRisk]);
  const mistakes = patterns.filter((p) => p.kind === "recurring-lesson-keyword");
  const successExamples = patterns.filter((p) => p.kind !== "recurring-lesson-keyword");
  const lessonsLearned = journalEntries.filter((j) => j.lessonLearned && j.lessonLearned.trim() !== "").slice(0, 3);

  return (
    <Card className="bg-card border-border" data-testid="playbook-related-knowledge">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" /> Related Knowledge
        </CardTitle>
        <CardDescription>
          Reused directly from the{" "}
          <Link href="/knowledge-graph" className="underline">
            Knowledge &amp; Intelligence Graph
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {boundNodeId ? (
          <>
            <div>
              <p className="text-muted-foreground mb-0.5">Relevant Research</p>
              {research.length === 0 ? (
                <p data-testid="playbook-knowledge-no-research">No connected research found.</p>
              ) : (
                <ul className="list-disc list-inside" data-testid="playbook-knowledge-research">
                  {research.map((r) => (
                    <li key={r.node.id}>{r.node.label}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Related Strategy</p>
              {strategies.length === 0 ? (
                <p data-testid="playbook-knowledge-no-strategy">No linked strategy.</p>
              ) : (
                <ul className="list-disc list-inside" data-testid="playbook-knowledge-strategy">
                  {strategies.map((r) => (
                    <li key={r.node.id}>{r.node.label}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Previous Journals</p>
              {journals.length === 0 ? (
                <p data-testid="playbook-knowledge-no-journals">No linked journal entry yet.</p>
              ) : (
                <ul className="list-disc list-inside" data-testid="playbook-knowledge-journals">
                  {journals.map((r) => (
                    <li key={r.node.id}>{r.node.label}</li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground" data-testid="playbook-knowledge-not-bound">
            {playbook.entityBinding === "trade-plan" ? "Bind this playbook to a Trade Plan above to see its connected research, strategy, and journals." : playbook.relatedKnowledge}
          </p>
        )}
        <div>
          <p className="text-muted-foreground mb-0.5">Recurring Mistakes</p>
          {mistakes.length === 0 ? (
            <p data-testid="playbook-knowledge-no-mistakes">None detected yet.</p>
          ) : (
            <ul className="list-disc list-inside" data-testid="playbook-knowledge-mistakes">
              {mistakes.map((p, i) => (
                <li key={i}>{p.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Successful Examples</p>
          {successExamples.length === 0 ? (
            <p data-testid="playbook-knowledge-no-successes">Nothing to report yet.</p>
          ) : (
            <ul className="list-disc list-inside" data-testid="playbook-knowledge-successes">
              {successExamples.map((p, i) => (
                <li key={i}>{p.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Lessons Learned</p>
          {lessonsLearned.length === 0 ? (
            <p data-testid="playbook-knowledge-no-lessons">None recorded yet.</p>
          ) : (
            <ul className="list-disc list-inside" data-testid="playbook-knowledge-lessons">
              {lessonsLearned.map((l) => (
                <li key={l.id}>{l.title}: {l.lessonLearned}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function InstitutionalPlaybooks() {
  const playbooks = usePlaybooks();
  const search = useSearch();
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Deep-link support (e.g. from the Command Palette's own "Playbooks"
  // search group, or a Related Workflows link) — ?playbookId=trade-planning
  // pre-selects a real playbook by its own stable id, matching this
  // codebase's established ?planId= precedent (Decision Workflow).
  useEffect(() => {
    const params = new URLSearchParams(search);
    const playbookId = params.get("playbookId");
    if (playbookId && playbooks.progresses.some((p) => p.playbook.id === playbookId)) {
      setSelectedPlaybookId(playbookId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, playbooks.progresses.length]);

  const selectedProgress = playbooks.progresses.find((p) => p.playbook.id === selectedPlaybookId) ?? null;

  const selectedStageProgress: PlaybookStageProgress | null = useMemo(() => {
    if (!selectedProgress) return null;
    if (selectedStageId) {
      const found = selectedProgress.stages.find((s) => s.stage.id === selectedStageId);
      if (found) return found;
    }
    return selectedProgress.recommendedNextStage ?? selectedProgress.stages[0] ?? null;
  }, [selectedProgress, selectedStageId]);

  if (playbooks.loading) {
    return (
      <div className="space-y-4 max-w-6xl" data-testid="page-institutional-playbooks">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl" data-testid="page-institutional-playbooks">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Institutional Playbooks &amp; Operating Procedures</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
            <ClipboardList className="h-3 w-3 mr-1" /> Playbooks Engine
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          12 documented operating procedures, each stage linking to an already-existing module. Playbooks orchestrate
          — they never duplicate functionality, and every completion reading is either a real platform signal or an
          honestly self-certified acknowledgement.
        </p>
      </div>

      <PlaybookPicker
        progresses={playbooks.progresses}
        selectedId={selectedPlaybookId}
        onSelect={(id) => {
          setSelectedPlaybookId(id);
          setSelectedStageId(null);
        }}
      />

      {selectedProgress ? (
        <div className="space-y-4">
          <PlaybookOverviewCard playbook={selectedProgress.playbook} />

          {selectedProgress.playbook.entityBinding === "trade-plan" && (
            <TradePlanBinder options={playbooks.tradePlanOptions} boundId={playbooks.boundTradePlanId} onBind={playbooks.setBoundTradePlanId} />
          )}

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Stages</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="playbook-stage-list">
              {selectedProgress.stages.map((sp) => (
                <StageCard
                  key={sp.stage.id}
                  progress={sp}
                  playbookId={selectedProgress.playbook.id}
                  selected={selectedStageProgress?.stage.id === sp.stage.id}
                  onSelect={() => setSelectedStageId(sp.stage.id)}
                  onAcknowledge={() => playbooks.acknowledge(selectedProgress.playbook.id, sp.stage.id)}
                  onUnacknowledge={() => playbooks.unacknowledge(selectedProgress.playbook.id, sp.stage.id)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AiPlaybookCoachCard playbook={selectedProgress.playbook} selectedStage={selectedStageProgress} />
            <RelatedKnowledgeCard
              playbook={selectedProgress.playbook}
              boundTradePlanId={selectedProgress.playbook.entityBinding === "trade-plan" ? playbooks.boundTradePlanId : null}
              graph={playbooks.graph}
              journalEntries={playbooks.journalEntries}
              portfolioRisk={playbooks.portfolioRisk}
            />
          </div>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="playbook-none-selected">
              <Search className="h-4 w-4" /> Pick a playbook above to see its stages, progress, and AI Playbook Coach guidance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

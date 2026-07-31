// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
//
// NOT another analytics dashboard. NOT another trade journal. NOT another
// performance report. This page evaluates the QUALITY and CONSISTENCY of
// completed decisions' own process — never their outcome. Every review
// field traces to real, already-computed platform evidence (Decision
// Engine stages, Trade Lifecycle status, Playbook adherence, Journal
// entries) — see lib/decisionReview.ts's own header comment for the full
// reuse map.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useDecisionQualityEngine } from "@/lib/useDecisionQualityEngine";
import { buildDecisionReviewCoachNarrative, type DecisionReview, type DecisionReviewField, type ReviewFieldStatus } from "@/lib/decisionReview";
import type { DecisionQualityTrend, RecurringPlaybookDeviation, TrendDirection } from "@/lib/decisionReviewTrends";
import { relatedEntities, relatedEntitiesWithinTwoHops, discoverPatterns } from "@/lib/knowledgeGraph";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Bot, Network, TrendingUp, TrendingDown, Minus, HelpCircle, CheckCircle2, AlertTriangle, Circle } from "lucide-react";

function fieldStatusBadgeClass(status: ReviewFieldStatus): string {
  if (status === "strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "adequate") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (status === "weak") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function fieldStatusIcon(status: ReviewFieldStatus) {
  if (status === "strong") return CheckCircle2;
  if (status === "weak") return AlertTriangle;
  if (status === "not-applicable") return Circle;
  return Circle;
}

function processQualityBadgeClass(label: string): string {
  if (label === "Excellent Process") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (label === "Solid Process") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (label === "Developing Process") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function trendIcon(direction: TrendDirection) {
  if (direction === "improving") return TrendingUp;
  if (direction === "declining") return TrendingDown;
  if (direction === "stable") return Minus;
  return HelpCircle;
}

function trendBadgeClass(direction: TrendDirection): string {
  if (direction === "improving") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (direction === "declining") return "bg-destructive/15 text-destructive border-destructive/30";
  if (direction === "stable") return "border-border text-muted-foreground";
  return "bg-muted text-muted-foreground border-border";
}

// ─── Decision picker ────────────────────────────────────────────────────

function DecisionPicker({ reviews, selectedId, onSelect }: { reviews: DecisionReview[]; selectedId: number | null; onSelect: (id: number) => void }) {
  if (reviews.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-muted-foreground" data-testid="decision-quality-no-reviews">
            No completed decisions to review yet — a decision becomes reviewable once its Trade Plan has been executed.
          </p>
          <Link href="/execution-lifecycle" className="text-xs font-medium text-primary hover:underline">
            Open Execution &amp; Lifecycle Manager →
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="decision-quality-picker">
      {[...reviews].reverse().map((r) => (
        <Card
          key={r.tradePlanId}
          onClick={() => onSelect(r.tradePlanId)}
          className={`bg-card border-border cursor-pointer transition-colors hover:border-primary/40 ${selectedId === r.tradePlanId ? "border-primary/60" : ""}`}
          data-testid={`decision-quality-card-${r.tradePlanId}`}
        >
          <CardContent className="pt-4 pb-3 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-sm font-medium">{r.tradePlanTitle}</span>
              <Badge className={processQualityBadgeClass(r.processQuality.label)} data-testid={`decision-quality-score-${r.tradePlanId}`}>
                {r.processQuality.score}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.symbol ?? r.coachId} · {r.processQuality.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Field grid ──────────────────────────────────────────────────────────

function FieldCard({ field }: { field: DecisionReviewField }) {
  const Icon = fieldStatusIcon(field.status);
  return (
    <Card className="bg-card border-border" data-testid={`decision-quality-field-${field.id}`}>
      <CardContent className="pt-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{field.label}</p>
          <Badge className={fieldStatusBadgeClass(field.status)} data-testid={`decision-quality-field-status-${field.id}`}>
            <Icon className="h-3 w-3 mr-1" /> {field.status === "not-applicable" ? "N/A" : field.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`decision-quality-field-evidence-${field.id}`}>
          {field.evidenceSummary}
        </p>
        {field.evidenceHref && (
          <Link href={field.evidenceHref} className="text-xs font-medium text-primary hover:underline inline-block">
            View evidence →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Playbook adherence ──────────────────────────────────────────────────

function PlaybookAdherenceCard({ review }: { review: DecisionReview }) {
  return (
    <Card className="bg-card border-border" data-testid="decision-quality-playbook-adherence">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" /> Playbook Adherence
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/playbooks" className="underline">
            Playbooks &amp; Operating Procedures
          </Link>
          . Playbooks are never modified here — only read.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {review.playbookAdherence.map((p) => (
          <div key={p.playbookId}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.playbookName}</span>
              <span className="text-muted-foreground">
                {p.completedStages}/{p.totalStages} stages complete
              </span>
            </div>
            {p.incompleteStageTitles.length === 0 ? (
              <p className="text-emerald-400 mt-0.5" data-testid={`decision-quality-playbook-complete-${p.playbookId}`}>
                Fully followed — no skipped or incomplete stages.
              </p>
            ) : (
              <ul className="list-disc list-inside text-amber-400 mt-0.5" data-testid={`decision-quality-playbook-incomplete-${p.playbookId}`}>
                {p.incompleteStageTitles.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── AI Decision Review Coach ────────────────────────────────────────────

function AiDecisionReviewCoachCard({ review, recurringDeviations }: { review: DecisionReview; recurringDeviations: RecurringPlaybookDeviation[] }) {
  const relevantDeviation = recurringDeviations.find((d) => d.tradePlanIds.includes(review.tradePlanId));
  const recurringSummary = relevantDeviation
    ? `"${relevantDeviation.stageTitle}" (${relevantDeviation.playbookName}) has been incomplete across ${relevantDeviation.occurrenceCount} reviewed decisions, including this one.`
    : null;
  const narrative = useMemo(() => buildDecisionReviewCoachNarrative(review, recurringSummary), [review, recurringSummary]);

  return (
    <Card className="bg-card border-border" data-testid="decision-quality-ai-coach">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Decision Review Coach
        </CardTitle>
        <CardDescription>Coaches, never judges — process only, never the P&amp;L outcome.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <p className="text-muted-foreground mb-0.5">Strong Parts of the Process</p>
          <ul className="list-disc list-inside space-y-0.5" data-testid="decision-quality-coach-strong">
            {narrative.strongParts.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Weak Parts of the Process</p>
          <ul className="list-disc list-inside space-y-0.5" data-testid="decision-quality-coach-weak">
            {narrative.weakParts.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Missed Opportunities</p>
          <ul className="list-disc list-inside space-y-0.5" data-testid="decision-quality-coach-missed">
            {narrative.missedOpportunities.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Institutional Best Practice</p>
          <p data-testid="decision-quality-coach-best-practice">{narrative.institutionalBestPractice}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Recurring Patterns</p>
          <p data-testid="decision-quality-coach-recurring">{narrative.recurringPatterns}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Recommended Learning</p>
          <p data-testid="decision-quality-coach-learning">{narrative.recommendedLearning}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Related Knowledge (reuses the Knowledge Graph, Sprint 17) ───────────

function RelatedKnowledgeCard({ review, graph, journalEntries, portfolioRisk }: { review: DecisionReview; graph: ReturnType<typeof useDecisionQualityEngine>["graph"]; journalEntries: import("@workspace/api-client-react").JournalEntry[]; portfolioRisk: null }) {
  const nodeId = `trade-plan:${review.tradePlanId}`;
  const research = relatedEntitiesWithinTwoHops(graph, nodeId, "notebook");
  const strategies = relatedEntities(graph, nodeId).filter((r) => r.node.type === "strategy");
  const journals = relatedEntities(graph, nodeId).filter((r) => r.node.type === "journal-entry");
  const portfolioReviews = relatedEntities(graph, nodeId).filter((r) => r.node.type === "portfolio-review");
  const patterns = useMemo(() => discoverPatterns(graph, journalEntries, portfolioRisk), [graph, journalEntries, portfolioRisk]);

  return (
    <Card className="bg-card border-border" data-testid="decision-quality-related-knowledge">
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
        <div>
          <p className="text-muted-foreground mb-0.5">Related Research</p>
          {research.length === 0 ? <p data-testid="decision-quality-knowledge-no-research">No connected research found.</p> : <ul className="list-disc list-inside">{research.map((r) => <li key={r.node.id}>{r.node.label}</li>)}</ul>}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Related Strategies</p>
          {strategies.length === 0 ? <p data-testid="decision-quality-knowledge-no-strategy">No linked strategy.</p> : <ul className="list-disc list-inside">{strategies.map((r) => <li key={r.node.id}>{r.node.label}</li>)}</ul>}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Related Journals</p>
          {journals.length === 0 ? <p data-testid="decision-quality-knowledge-no-journals">No linked journal entry.</p> : <ul className="list-disc list-inside">{journals.map((r) => <li key={r.node.id}>{r.node.label}</li>)}</ul>}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Portfolio Reviews</p>
          {portfolioReviews.length === 0 ? <p data-testid="decision-quality-knowledge-no-portfolio-review">Not referenced in a current portfolio review.</p> : <ul className="list-disc list-inside">{portfolioReviews.map((r) => <li key={r.node.id}>{r.node.label}</li>)}</ul>}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Recurring Patterns (Platform-Wide)</p>
          {patterns.length === 0 ? <p data-testid="decision-quality-knowledge-no-patterns">None detected yet.</p> : <ul className="list-disc list-inside">{patterns.map((p, i) => <li key={i}>{p.title}</li>)}</ul>}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Learning Completed</p>
          <p data-testid="decision-quality-knowledge-learning">{review.learningEngaged ? "The recommended lesson for this decision's weakest area was engaged with." : "The recommended lesson for this decision's weakest area has not been engaged with yet."}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Trend Analysis ──────────────────────────────────────────────────────

function TrendCard({ trend }: { trend: DecisionQualityTrend }) {
  const Icon = trendIcon(trend.direction);
  return (
    <Card className="bg-card border-border" data-testid={`decision-quality-trend-${trend.id}`}>
      <CardContent className="pt-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{trend.label}</p>
          <Badge className={trendBadgeClass(trend.direction)} data-testid={`decision-quality-trend-direction-${trend.id}`}>
            <Icon className="h-3 w-3 mr-1" /> {trend.direction === "insufficient-data" ? "Not enough data" : trend.direction}
          </Badge>
        </div>
        {trend.earlierAverage !== null && trend.laterAverage !== null ? (
          <p className="text-xs text-muted-foreground">
            {trend.earlierAverage}/100 (earlier) → {trend.laterAverage}/100 (later), across {trend.evidence.length} reviewed decisions.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Needs at least 4 reviewed decisions to compare — has {trend.evidence.length} so far.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendAnalysisSection({ trends, recurringDeviations }: { trends: DecisionQualityTrend[]; recurringDeviations: RecurringPlaybookDeviation[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Trend Analysis</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2" data-testid="decision-quality-trends">
        {trends.map((t) => (
          <TrendCard key={t.id} trend={t} />
        ))}
      </div>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recurring Playbook Deviations</CardTitle>
          <CardDescription>The same playbook stage left incomplete across 2 or more reviewed decisions — never inflated from a single occurrence.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          {recurringDeviations.length === 0 ? (
            <p data-testid="decision-quality-no-recurring-deviations">No recurring deviation detected yet.</p>
          ) : (
            <ul className="list-disc list-inside space-y-0.5" data-testid="decision-quality-recurring-deviations">
              {recurringDeviations.map((d, i) => (
                <li key={i}>
                  {d.playbookName}: "{d.stageTitle}" — incomplete in {d.occurrenceCount} decisions.
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function DecisionQualityReview() {
  const engine = useDecisionQualityEngine();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedReview = engine.reviews.find((r) => r.tradePlanId === selectedId) ?? null;

  if (engine.loading) {
    return (
      <div className="space-y-4 max-w-6xl" data-testid="page-decision-quality-review">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl" data-testid="page-decision-quality-review">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Decision Quality &amp; Review</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
            <ClipboardCheck className="h-3 w-3 mr-1" /> Decision Quality Engine
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluates the quality of completed decisions' own process — never their outcome. {engine.pendingReviewCount} decision
          {engine.pendingReviewCount === 1 ? "" : "s"} executed but not yet fully reviewed.
        </p>
      </div>

      <DecisionPicker reviews={engine.reviews} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedReview ? (
        <div className="space-y-4">
          <Card className="bg-card border-border" data-testid="decision-quality-detail-header">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{selectedReview.tradePlanTitle}</CardTitle>
                <Badge className={processQualityBadgeClass(selectedReview.processQuality.label)}>
                  {selectedReview.processQuality.score}/100 — {selectedReview.processQuality.label}
                </Badge>
              </div>
              <CardDescription>
                Portfolio impact shown for context only — never scored as part of process quality:{" "}
                {selectedReview.fields.find((f) => f.id === "portfolio-impact")!.evidenceSummary}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2" data-testid="decision-quality-field-list">
            {selectedReview.fields.map((f) => (
              <FieldCard key={f.id} field={f} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PlaybookAdherenceCard review={selectedReview} />
            <AiDecisionReviewCoachCard review={selectedReview} recurringDeviations={engine.recurringDeviations} />
          </div>

          <RelatedKnowledgeCard review={selectedReview} graph={engine.graph} journalEntries={engine.journalEntries} portfolioRisk={null} />
        </div>
      ) : (
        engine.reviews.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground" data-testid="decision-quality-none-selected">
                Pick a reviewed decision above to see its process-quality breakdown, playbook adherence, and AI Decision Review Coach guidance.
              </p>
            </CardContent>
          </Card>
        )
      )}

      <TrendAnalysisSection trends={engine.trends} recurringDeviations={engine.recurringDeviations} />
    </div>
  );
}

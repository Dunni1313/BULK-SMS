// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
//
// NOT another database, notebook, or vector-search system — a pure,
// client-side composition/presentation layer over lib/knowledgeGraph.ts
// (the reusable graph engine) and lib/useKnowledgeGraph.ts (the hook that
// feeds it real, already-fetched data from Notebooks/Strategies/Trade
// Plans/Journal/Portfolio Risk Intelligence). This page introduces zero
// new business logic of its own — every section below just renders
// already-computed graph/pattern/timeline/coach-answer objects.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useKnowledgeGraph } from "@/lib/useKnowledgeGraph";
import { useListJournalEntries } from "@workspace/api-client-react";
import { usePortfolioRiskIntelligence } from "@/lib/usePortfolioRiskIntelligence";
import { useTradeLifecyclePipeline } from "@/lib/useTradeLifecycle";
import { PIPELINE_STAGES } from "@/lib/tradeLifecycle";
import {
  relatedEntities,
  relatedEntitiesWithinTwoHops,
  searchKnowledgeGraph,
  discoverPatterns,
  buildInvestmentTimeline,
  answerKnowledgeQuestion,
  KNOWLEDGE_QUESTIONS,
  type KnowledgeQuestionId,
  type KnowledgeNode,
} from "@/lib/knowledgeGraph";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Search, Sparkles, GitBranch, MessageCircleQuestion } from "lucide-react";

function typeBadgeClass(type: KnowledgeNode["type"]): string {
  switch (type) {
    case "notebook":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "strategy":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
    case "trade-plan":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "journal-entry":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "company":
      return "bg-violet-500/15 text-violet-400 border-violet-500/30";
    case "theme":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function EntityNode({ node, onSelect }: { node: KnowledgeNode; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="w-full text-left rounded-md border border-border p-2 hover:border-primary/50 transition-colors"
      data-testid={`knowledge-node-${node.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{node.label}</span>
        <Badge variant="outline" className={`text-[10px] ${typeBadgeClass(node.type)}`}>
          {node.type}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{node.detail}</p>
    </button>
  );
}

// Notebook/Strategy/Trade-Plan/Journal connections are frequently mediated
// by a shared tag (a company or theme node in between, see
// knowledgeGraph.ts's own header comment) — a direct 1-hop relatedEntities()
// read would only ever surface the intermediary company/theme node itself,
// never the OTHER real entity that shares it. This combines both: every
// direct edge, plus every real entity 2 hops away via a shared tag.
const REAL_ENTITY_TYPES: KnowledgeNode["type"][] = ["notebook", "strategy", "trade-plan", "journal-entry"];

function EntityDetailPanel({ nodeId, graph, onSelect }: { nodeId: string; graph: ReturnType<typeof useKnowledgeGraph>["graph"]; onSelect: (id: string) => void }) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const related = useMemo(() => {
    const direct = relatedEntities(graph, nodeId);
    const seen = new Set(direct.map((r) => r.node.id));
    const twoHop = REAL_ENTITY_TYPES.filter((t) => t !== node?.type).flatMap((t) =>
      relatedEntitiesWithinTwoHops(graph, nodeId, t).filter((r) => !seen.has(r.node.id) && r.node.id !== nodeId),
    );
    return [...direct, ...twoHop];
  }, [graph, nodeId, node?.type]);

  if (!node) {
    return <p className="text-sm text-muted-foreground" data-testid="knowledge-detail-not-found">This entity could not be found — it may have been removed.</p>;
  }

  const grouped = related.reduce<Record<string, typeof related>>((acc, r) => {
    (acc[r.node.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3" data-testid="knowledge-detail-panel">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{node.label}</h3>
          <Badge variant="outline" className={`text-[10px] ${typeBadgeClass(node.type)}`}>
            {node.type}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{node.detail}</p>
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {node.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {node.href && (
          <Link href={node.href} className="text-xs text-primary hover:underline mt-2 inline-block" data-testid="knowledge-detail-open-link">
            Open →
          </Link>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="knowledge-detail-no-connections">
          Nothing else in your platform is connected to this yet.
        </p>
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Related {type.replace("-", " ")}</p>
            <ul className="space-y-1" data-testid={`knowledge-related-${type}`}>
              {items.map((r) => (
                <li key={r.node.id}>
                  <button type="button" className="text-sm text-left hover:underline" onClick={() => onSelect(r.node.id)}>
                    {r.node.label}
                  </button>
                  <span className="text-[10px] text-muted-foreground ml-2">({r.relation} — {r.evidence})</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function TimelinePanel() {
  const pipeline = useTradeLifecyclePipeline();
  const { data: journalEntries } = useListJournalEntries();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const record = pipeline.records.find((r) => r.tradePlan.id === selectedPlanId) ?? null;
  const linkedJournal = useMemo(() => {
    if (!record) return null;
    const entry = (journalEntries ?? []).find((j) => j.id === record.journalStatus.journalEntryId);
    return entry ? { lessonLearned: entry.lessonLearned ?? null } : null;
  }, [record, journalEntries]);

  const timeline = useMemo(() => (record ? buildInvestmentTimeline(record, PIPELINE_STAGES, linkedJournal) : []), [record, linkedJournal]);

  if (pipeline.loading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      {pipeline.records.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="knowledge-timeline-empty">
          No trade plans yet — the Intelligence Timeline becomes the historical memory of every investment once you create one.
        </p>
      ) : (
        <Select value={selectedPlanId?.toString() ?? ""} onValueChange={(v) => setSelectedPlanId(Number(v))}>
          <SelectTrigger data-testid="knowledge-timeline-select">
            <SelectValue placeholder="Choose an investment to view its timeline" />
          </SelectTrigger>
          <SelectContent>
            {pipeline.records.map((r) => (
              <SelectItem key={r.tradePlan.id} value={r.tradePlan.id.toString()}>
                {r.tradePlan.title} {r.tradePlan.plannedAsset ? `(${r.tradePlan.plannedAsset})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {record && (
        <ol className="space-y-2 border-l border-border pl-4" data-testid="knowledge-timeline-list">
          {timeline.map((event) => (
            <li key={event.stageId} className={event.reached ? "" : "opacity-40"} data-testid={`knowledge-timeline-event-${event.stageId}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${event.isCurrent ? "text-primary" : ""}`}>{event.label}</span>
                {event.isCurrent && (
                  <Badge variant="outline" className="text-[10px]">
                    Current
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{event.description}</p>
              <p className="text-[10px] text-muted-foreground/70">
                {event.date ? new Date(event.date).toLocaleDateString() : "Not yet reached"} — {event.sourceModule}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PatternsPanel({
  graph,
  loading,
  riskReport,
}: {
  graph: ReturnType<typeof useKnowledgeGraph>["graph"];
  loading: boolean;
  riskReport: ReturnType<typeof usePortfolioRiskIntelligence>["risk"];
}) {
  const { data: journalEntries } = useListJournalEntries();
  const patterns = useMemo(() => discoverPatterns(graph, journalEntries ?? [], riskReport), [graph, journalEntries, riskReport]);

  if (loading) return <Skeleton className="h-24 w-full" />;

  if (patterns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="knowledge-patterns-empty">
        No pattern meets the evidence bar yet (at least 2 corroborating data points) — nothing is fabricated here.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="knowledge-patterns-list">
      {patterns.map((p, i) => (
        <div key={i} className="rounded-md border border-border p-3" data-testid={`knowledge-pattern-${p.kind}-${i}`}>
          <p className="text-sm font-semibold">{p.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
          <ul className="mt-2 space-y-0.5">
            {p.evidence.map((e, j) => (
              <li key={j} className="text-[11px] text-muted-foreground/80">
                • {e}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function KnowledgeCoachPanel({
  graph,
  loading,
  riskReport,
}: {
  graph: ReturnType<typeof useKnowledgeGraph>["graph"];
  loading: boolean;
  riskReport: ReturnType<typeof usePortfolioRiskIntelligence>["risk"];
}) {
  const { data: journalEntries } = useListJournalEntries();
  const [questionId, setQuestionId] = useState<KnowledgeQuestionId | null>(null);
  const [strategyId, setStrategyId] = useState<string>("");

  const strategies = graph.nodes.filter((n) => n.type === "strategy");
  const answer = questionId
    ? answerKnowledgeQuestion(questionId, graph, journalEntries ?? [], riskReport, strategyId || undefined)
    : null;
  const activeQuestion = KNOWLEDGE_QUESTIONS.find((q) => q.id === questionId);

  if (loading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {KNOWLEDGE_QUESTIONS.map((q) => (
          <Button
            key={q.id}
            type="button"
            size="sm"
            variant={questionId === q.id ? "default" : "outline"}
            className="text-[11px] h-7"
            onClick={() => setQuestionId(q.id)}
            data-testid={`knowledge-coach-question-${q.id}`}
          >
            {q.label}
          </Button>
        ))}
      </div>

      {activeQuestion?.needsStrategy && strategies.length > 0 && (
        <Select value={strategyId} onValueChange={setStrategyId}>
          <SelectTrigger data-testid="knowledge-coach-strategy-select">
            <SelectValue placeholder="Choose a strategy" />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {answer && (
        <div className="rounded-md border border-border p-3" data-testid="knowledge-coach-answer">
          <p className="text-sm font-medium">{answer.question}</p>
          <p className="text-sm text-muted-foreground mt-1">{answer.answer}</p>
          {answer.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {answer.citations.map((c, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {c.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeIntelligenceGraph() {
  // Called once here and passed down as props to PatternsPanel/
  // KnowledgeCoachPanel — every panel on this page shares the SAME graph
  // computation rather than each independently re-fetching Notebooks/
  // Strategies/Trade Plans/Portfolio Risk Intelligence a second and third
  // time.
  const { graph, loading } = useKnowledgeGraph();
  const intelligence = usePortfolioRiskIntelligence();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchResults = useMemo(() => searchKnowledgeGraph(graph, query), [graph, query]);
  const displayNodes = query.trim() ? searchResults.map((r) => r.node) : graph.nodes.slice(0, 30);

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-knowledge-intelligence-graph">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-indigo-400" /> Knowledge &amp; Intelligence Graph
          </h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-knowledge-graph">
            Institutional Memory
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Not a new database. Not another notebook. Not vector search. This connects Research, Strategies, Trade Plans,
          Journal entries, Companies, and Themes you already have into one explainable graph — every connection cites
          its own evidence, and nothing here is fabricated.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Search &amp; Explore
          </CardTitle>
          <CardDescription>Extends the same transparent, substring-match search this platform's Command Palette already uses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search research, strategies, trade plans, journal, companies, themes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="knowledge-search-input"
          />
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="knowledge-search-results">
                {displayNodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="knowledge-search-empty">
                    No matches. Nothing is fabricated — this graph only shows entities you've already created.
                  </p>
                ) : (
                  displayNodes.map((n) => <EntityNode key={n.id} node={n} onSelect={setSelectedId} />)
                )}
              </div>
              <div>
                {selectedId ? (
                  <EntityDetailPanel nodeId={selectedId} graph={graph} onSelect={setSelectedId} />
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="knowledge-detail-placeholder">
                    Select an entity to see everything it's connected to.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Intelligence Timeline
            </CardTitle>
            <CardDescription>Research → Decision → Execution → Management → Journal → Performance → Lessons Learned, for one investment at a time.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimelinePanel />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Pattern Discovery
            </CardTitle>
            <CardDescription>Transparent, evidence-based. Never fabricated — a pattern only appears with 2+ corroborating facts.</CardDescription>
          </CardHeader>
          <CardContent>
            <PatternsPanel graph={graph} loading={loading} riskReport={intelligence.risk} />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4" /> AI Knowledge Coach
          </CardTitle>
          <CardDescription>Reuses this platform's AI Coach pattern — explains relationships across modules, always citing where each answer came from.</CardDescription>
        </CardHeader>
        <CardContent>
          <KnowledgeCoachPanel graph={graph} loading={loading} riskReport={intelligence.risk} />
        </CardContent>
      </Card>
    </div>
  );
}

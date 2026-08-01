// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built and
// named "Opportunity Pipeline" — see src/lib/opportunityPipeline.ts's own
// header comment for the disclosed naming-collision reasoning against the
// pre-existing Phase 15 Opportunity Discovery scanner, pages/OpportunityDiscovery.tsx).
//
// NOT another scanner. NOT another watchlist. NOT another Research module.
// The disciplined front door to the platform — discovering, capturing, and
// prioritising opportunities gathered from every existing engine, tracked
// through a 7-stage pipeline into the existing Research workflow.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useOpportunityPipeline } from "@/lib/useOpportunityPipeline";
import { buildOpportunityCoachNarrative, type DiscoveredOpportunity, type OpportunityCategory } from "@/lib/opportunityPipeline";
import type { OpportunityPipelineItem, OpportunityPipelineStage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Compass, Bot, Inbox, ListChecks, Archive, Flame } from "lucide-react";

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  watchlist_event: "Watchlist Event",
  economic_release: "Economic Release",
  earnings: "Earnings",
  corporate_action: "Corporate Action",
  portfolio_gap: "Portfolio Gap",
  sector_development: "Sector Development",
  macro_change: "Macro Change",
  knowledge_graph_relationship: "Knowledge Graph Relationship",
  previously_researched: "Previously Researched",
  research_update_needed: "Research Update Needed",
};

const PIPELINE_STAGES: OpportunityPipelineStage[] = [
  "discovered",
  "screening",
  "research-candidate",
  "research-in-progress",
  "research-complete",
  "strategy-candidate",
  "archived",
];

function priorityBadgeClass(priority: string): string {
  if (priority === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (priority === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "border-border text-muted-foreground";
}

function stageBadgeClass(stage: string): string {
  if (stage === "archived") return "border-border text-muted-foreground";
  if (stage === "strategy-candidate" || stage === "research-complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  return "border-sky-500/40 text-sky-400";
}

// ─── A discovered (not-yet-captured) opportunity ─────────────────────────

function DiscoveredCard({ opportunity, heldSymbols, onCapture }: { opportunity: DiscoveredOpportunity; heldSymbols: ReadonlySet<string>; onCapture: () => void }) {
  const [showCoach, setShowCoach] = useState(false);
  const narrative = useMemo(() => buildOpportunityCoachNarrative(opportunity, heldSymbols), [opportunity, heldSymbols]);

  return (
    <Card className="bg-card border-border" data-testid={`opportunity-discovered-${opportunity.id}`}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{opportunity.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[opportunity.category]} · {opportunity.origin}
            </p>
          </div>
          <Badge className={priorityBadgeClass(opportunity.priority)}>{opportunity.priority}</Badge>
        </div>
        {opportunity.evidence.length > 0 && (
          <ul className="list-disc list-inside text-xs text-muted-foreground" data-testid={`opportunity-evidence-${opportunity.id}`}>
            {opportunity.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={onCapture} data-testid={`opportunity-capture-${opportunity.id}`}>
            Capture into Pipeline
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCoach((s) => !s)}>
            <Bot className="h-3 w-3" /> AI Discovery Coach
          </Button>
        </div>
        {showCoach && (
          <div className="bg-muted/30 rounded p-3 space-y-1.5" data-testid={`opportunity-coach-${opportunity.id}`}>
            <p className="text-xs text-muted-foreground">{narrative.whySurfaced}</p>
            <p className="text-xs text-muted-foreground">{narrative.evidence}</p>
            <p className="text-xs text-muted-foreground">{narrative.affectedHoldings}</p>
            <p className="text-xs text-muted-foreground">{narrative.additionalResearchNeeded}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── A captured pipeline item ─────────────────────────────────────────────

function CapturedCard({
  item,
  onAdvance,
  onArchive,
  onRemove,
}: {
  item: OpportunityPipelineItem;
  onAdvance: (stage: OpportunityPipelineStage) => void;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const currentIndex = PIPELINE_STAGES.indexOf(item.stage);
  const nextStage = currentIndex >= 0 && currentIndex < PIPELINE_STAGES.length - 2 ? PIPELINE_STAGES[currentIndex + 1] : null;

  return (
    <Card className="bg-card border-border" data-testid={`opportunity-captured-${item.id}`}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[item.category as OpportunityCategory] ?? item.category} · {item.origin}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Badge className={stageBadgeClass(item.stage)}>{item.stageLabel}</Badge>
            <Badge className={priorityBadgeClass(item.priority)}>{item.priority}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`opportunity-next-action-${item.id}`}>
          Next: {item.nextRecommendedAction}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {nextStage && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onAdvance(nextStage)} data-testid={`opportunity-advance-${item.id}`}>
              Move to {nextStage.replace(/-/g, " ")}
            </Button>
          )}
          {item.stage === "research-candidate" && item.relatedAssets.length > 0 && (
            <Link href={`/stock-analyst?symbol=${item.relatedAssets[0]}`} className="text-xs font-medium text-primary hover:underline">
              Open Research Workspace →
            </Link>
          )}
          {item.stage !== "archived" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onArchive} data-testid={`opportunity-archive-${item.id}`}>
              <Archive className="h-3 w-3" /> Archive
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onRemove} data-testid={`opportunity-remove-${item.id}`}>
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function OpportunityPipeline() {
  const pipeline = useOpportunityPipeline();
  const [tab, setTab] = useState<"discovered" | "captured">("discovered");

  const capturedIds = useMemo(() => new Set(pipeline.captured.map((c) => c.title)), [pipeline.captured]);
  const uncaptured = pipeline.discovered.filter((o) => !capturedIds.has(o.title));
  const active = pipeline.captured.filter((c) => c.stage !== "archived");
  const archived = pipeline.captured.filter((c) => c.stage === "archived");

  if (pipeline.loading) {
    return (
      <div className="space-y-4 max-w-6xl" data-testid="page-opportunity-pipeline">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl" data-testid="page-opportunity-pipeline">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Opportunity Pipeline</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
            <Compass className="h-3 w-3 mr-1" /> Institutional Opportunity Discovery Engine
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The disciplined front door to the platform — every institutional workflow should begin with discovering,
          capturing, and prioritising opportunities. Never a trading signal, never a buy/sell recommendation, never a
          market prediction.
        </p>
      </div>

      <div className="flex items-center gap-2" data-testid="opportunity-tabs">
        <Button variant={tab === "discovered" ? "secondary" : "outline"} size="sm" onClick={() => setTab("discovered")} data-testid="opportunity-tab-discovered">
          <Inbox className="h-3.5 w-3.5 mr-1" /> Discovered ({uncaptured.length})
        </Button>
        <Button variant={tab === "captured" ? "secondary" : "outline"} size="sm" onClick={() => setTab("captured")} data-testid="opportunity-tab-captured">
          <ListChecks className="h-3.5 w-3.5 mr-1" /> My Pipeline ({active.length} active, {archived.length} archived)
        </Button>
      </div>

      {tab === "discovered" ? (
        uncaptured.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground" data-testid="opportunity-no-discovered">
                No new opportunities discovered right now. Opportunities are gathered from Market Intelligence,
                Watchlists, Portfolio &amp; Risk Intelligence, and the Knowledge Graph.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="opportunity-discovered-list">
            {uncaptured.map((o) => (
              <DiscoveredCard
                key={o.id}
                opportunity={o}
                heldSymbols={pipeline.heldSymbols}
                onCapture={() =>
                  pipeline.capture({
                    title: o.title,
                    category: o.category,
                    origin: o.origin,
                    evidence: o.evidence,
                    relatedAssets: o.relatedAssets,
                    relatedSectors: o.relatedSectors,
                    priority: o.priority,
                  })
                }
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> Active
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="opportunity-no-captured">
                Nothing captured into your pipeline yet.
              </p>
            ) : (
              <div className="space-y-2" data-testid="opportunity-captured-list">
                {active.map((item) => (
                  <CapturedCard
                    key={item.id}
                    item={item}
                    onAdvance={(stage) => pipeline.update(item.id, { stage })}
                    onArchive={() => pipeline.update(item.id, { stage: "archived" })}
                    onRemove={() => pipeline.remove(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {archived.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                <Archive className="h-3.5 w-3.5" /> Archived
              </h2>
              <div className="space-y-2" data-testid="opportunity-archived-list">
                {archived.map((item) => (
                  <CapturedCard
                    key={item.id}
                    item={item}
                    onAdvance={(stage) => pipeline.update(item.id, { stage })}
                    onArchive={() => pipeline.update(item.id, { stage: "archived" })}
                    onRemove={() => pipeline.remove(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

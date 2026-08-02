// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine.
//
// NOT another scanner. NOT another watchlist. NOT another Research module.
// This is the disciplined front door to the platform: capturing signals
// that already exist elsewhere (Market Intelligence, Watchlists, Portfolio
// & Risk Intelligence, Knowledge Graph, Research Notes) into one reusable
// Opportunity object, tracked through a 7-stage pipeline into the existing
// Research workflow.
//
// DISCLOSED NAMING-COLLISION DECISION (see
// docs/v1.5.0-Sprint-21-Opportunity-Discovery-Engine.md §1 for the full
// reuse audit): this codebase already has a Phase 15 "Institutional
// Opportunity Discovery Engine" — a stock-universe scanner/ranking system
// (lib/opportunityDiscovery.ts, routes/opportunityDiscovery.ts,
// pages/OpportunityDiscovery.tsx, route /opportunity-discovery) — exactly
// the kind of "stock screener" this sprint's own spec lists as STRICTLY
// OUT OF SCOPE. To avoid confusing the two, every file/route/schema this
// sprint adds is named "Opportunity Pipeline," never "Opportunity
// Discovery" — the two systems are deliberately never merged, mirroring
// this codebase's own established "disclosed naming proximity, kept
// distinct" precedent (e.g. the Trading AI Coach vs. AI Trade Coach
// disclosure, or performanceAnalytics.ts vs. performanceAttribution.ts).
//
// This module holds ONLY the pure, deterministic, zero-persistence pieces:
// the pipeline stage vocabulary, a deterministic "next recommended action"
// per stage, and the opportunity-category vocabulary. All persistence
// (capturing/listing/updating a user's own pipeline items) lives directly
// in routes/opportunityPipeline.ts, matching this codebase's own
// established pattern for simple per-user CRUD tables (e.g.
// routes/tradingJournal.ts, routes/watchlists.ts). The actual DISCOVERY
// composition — reading Market Intelligence/Watchlists/Portfolio & Risk
// Intelligence/Knowledge Graph/Research Notes and turning them into
// candidate opportunities — is deliberately a FRONTEND concern (mirroring
// lib/marketIntelligence.ts's own backend/frontend split, Sprint 20):
// every one of those signal sources is already exposed to the frontend via
// an existing generated hook or plain-fetch API, so composing them there
// avoids a second, duplicate server-side read of the same data, and keeps
// this module's own footprint to exactly what's genuinely new — the
// pipeline itself.

export const PIPELINE_STAGES = [
  "discovered",
  "screening",
  "research-candidate",
  "research-in-progress",
  "research-complete",
  "strategy-candidate",
  "archived",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const OPPORTUNITY_CATEGORIES = [
  "watchlist_event",
  "economic_release",
  "earnings",
  "corporate_action",
  "portfolio_gap",
  "sector_development",
  "macro_change",
  "knowledge_graph_relationship",
  "previously_researched",
  "research_update_needed",
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const OPPORTUNITY_PRIORITIES = ["low", "medium", "high"] as const;
export type OpportunityPriority = (typeof OPPORTUNITY_PRIORITIES)[number];

const STAGE_LABELS: Record<PipelineStage, string> = {
  discovered: "Discovered",
  screening: "Screening",
  "research-candidate": "Research Candidate",
  "research-in-progress": "Research In Progress",
  "research-complete": "Research Complete",
  "strategy-candidate": "Strategy Candidate",
  archived: "Archived",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as PipelineStage] ?? stage;
}

// A deterministic, per-stage recommended next step — computed fresh on
// every read, never persisted (so it can never go stale relative to the
// item's own current stage). Never a trading signal, never a buy/sell
// instruction — every recommendation names an existing platform workflow
// step only.
export function nextRecommendedActionFor(stage: string): string {
  switch (stage as PipelineStage) {
    case "discovered":
      return "Review the evidence and decide whether this is worth screening further.";
    case "screening":
      return "Check the affected assets/sectors against your existing Watchlists and Portfolio & Risk Intelligence signals before committing research time.";
    case "research-candidate":
      return "Promote to Research In Progress and open (or continue) a Research Workspace notebook for the affected asset(s).";
    case "research-in-progress":
      return "Continue building out the research notebook; mark Research Complete once your thesis is documented.";
    case "research-complete":
      return "Decide whether this research supports a Strategy Candidate, or archive it if it no longer applies.";
    case "strategy-candidate":
      return "Review in the Strategy Framework/Workbench — this pipeline never recommends a specific strategy.";
    case "archived":
      return "No further action — this opportunity has been archived.";
    default:
      return "Review this opportunity's current stage.";
  }
}

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isOpportunityCategory(value: string): value is OpportunityCategory {
  return (OPPORTUNITY_CATEGORIES as readonly string[]).includes(value);
}

export function isOpportunityPriority(value: string): value is OpportunityPriority {
  return (OPPORTUNITY_PRIORITIES as readonly string[]).includes(value);
}

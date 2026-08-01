// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
//
// NOT another database. NOT another notebook. NOT vector search / RAG /
// semantic embeddings. This module is a pure, in-memory COMPOSITION layer
// that reads data every prior sprint already fetches and computes — it
// introduces zero new persisted storage and zero new detection formulas
// beyond one honest, evidence-based tag-matching heuristic (see below).
//
// REUSE MAP (see docs/v1.5.0-Sprint-17-Knowledge-Intelligence-Graph.md for
// the full audit): Trade Plans/Strategies/Notebooks (Sprints 8-10),
// Decision readiness + pipeline stage (Sprints 13-14, via
// useTradeLifecyclePipeline()'s already-computed TradeLifecycleRecord[]),
// Journal entries (existing trades/journal), Portfolio health + risk
// signals (Sprint 15's RiskIntelligenceReport, computed elsewhere and
// passed in here unchanged), and Learning progress (existing). Nothing in
// this file re-fetches or re-derives any of that — it only links already-
// computed records together and reads off their own already-computed
// fields.
//
// RELATIONSHIP MODEL — two kinds of edge, both disclosed honestly:
//   1. STRUCTURAL (strong): a real foreign key already in this codebase's
//      data model — TradePlan.strategyId, a LinkedExecution's own symbol,
//      a JournalEntry's own tradeId (via the SAME executedTradeRef match
//      tradeLifecycle.ts already performs). These edges are certain.
//   2. TAG-BASED (heuristic, always labelled "shared tag: X" as its own
//      evidence): two entities that carry the exact same tag string are
//      linked. This is the ONE new heuristic this sprint introduces, and
//      it is deliberately simple and auditable — never a fabricated or
//      scored "similarity," just "these two things share this exact
//      label." A tag shaped like a ticker (1-5 uppercase letters) becomes
//      a `company` node; every other tag becomes a `theme` node — both
//      are DERIVED entities, existing only as a graph-side grouping of
//      already-tagged real entities, never independently stored.
//
// Trade Plan `sections` (which carry the strongest possible research-
// reference link, kind `notebook_reference`) are deliberately NOT re-
// fetched here — useTradeLifecyclePipeline()'s own already-computed
// records don't expose them (to avoid a second N+1 detail fetch on top of
// the one that hook already performs), so Notebook<->Trade-Plan linkage
// this sprint relies on the shared-tag heuristic above instead. A future
// sprint could extend that hook's own return shape to surface each plan's
// reference sections for a strictly stronger signal — see
// docs/v1.5.0-Sprint-17-Knowledge-Intelligence-Graph.md's "Future AI
// opportunities" section.

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { RiskIntelligenceReport, PortfolioHealthScore } from "./portfolioRiskIntelligence";
import type { JournalEntry } from "@workspace/api-client-react";

// ─── Node / edge model ───────────────────────────────────────────────────

export type KnowledgeEntityType =
  | "notebook"
  | "strategy"
  | "trade-plan"
  | "journal-entry"
  | "company"
  | "theme"
  | "portfolio-review";

export interface KnowledgeNode {
  type: KnowledgeEntityType;
  /** Stable, globally-unique id: `${type}:${rawId}`. */
  id: string;
  rawId: string | number;
  label: string;
  coachId: CoachId | null;
  symbol: string | null;
  tags: string[];
  href: string | null;
  /** One honest, human-readable status line — never a fabricated score. */
  detail: string;
  createdAt: string | null;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  /** Human-readable relationship phrase, e.g. "used on", "referenced in". */
  relation: string;
  /** Where this edge came from — always shown so a user can verify it. */
  evidence: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  generatedAt: string;
}

// A ticker-shaped tag (1-5 uppercase letters) becomes a `company` node;
// every other tag becomes a `theme` node. Pure string-shape heuristic —
// never a real symbol lookup, never fabricated company data.
const TICKER_TAG_RE = /^[A-Z]{1,5}$/;

function nodeId(type: KnowledgeEntityType, rawId: string | number): string {
  return `${type}:${rawId}`;
}

function addNode(nodes: Map<string, KnowledgeNode>, node: KnowledgeNode) {
  nodes.set(node.id, node);
}

function addEdge(edges: KnowledgeEdge[], seen: Set<string>, edge: KnowledgeEdge) {
  const key = `${edge.from}|${edge.to}|${edge.relation}`;
  const reverseKey = `${edge.to}|${edge.from}|${edge.relation}`;
  if (seen.has(key) || seen.has(reverseKey)) return;
  seen.add(key);
  edges.push(edge);
}

function classifyTag(tag: string): { type: "company" | "theme"; symbol: string | null } {
  const trimmed = tag.trim();
  if (TICKER_TAG_RE.test(trimmed)) return { type: "company", symbol: trimmed };
  return { type: "theme", symbol: null };
}

function ensureTagNode(nodes: Map<string, KnowledgeNode>, tag: string): KnowledgeNode {
  const trimmed = tag.trim();
  const { type, symbol } = classifyTag(trimmed);
  const id = nodeId(type, trimmed);
  const existing = nodes.get(id);
  if (existing) return existing;
  const node: KnowledgeNode = {
    type,
    id,
    rawId: trimmed,
    label: trimmed,
    coachId: null,
    symbol,
    tags: [],
    href: type === "company" ? `/stock-analyst?symbol=${trimmed}` : null,
    detail: type === "company" ? `Every entity tagged ${trimmed}.` : `Every entity tagged "${trimmed}".`,
    createdAt: null,
  };
  addNode(nodes, node);
  return node;
}

/** Links every pair of entities that share a tag to that tag's derived
 * company/theme node — the graph's one heuristic edge kind. */
function linkSharedTags(nodes: Map<string, KnowledgeNode>, edges: KnowledgeEdge[], seen: Set<string>, entityIds: string[]) {
  for (const id of entityIds) {
    const entity = nodes.get(id);
    if (!entity) continue;
    for (const tag of entity.tags) {
      if (!tag.trim()) continue;
      const tagNode = ensureTagNode(nodes, tag);
      addEdge(edges, seen, {
        from: entity.id,
        to: tagNode.id,
        relation: tagNode.type === "company" ? "relates to" : "shares theme",
        evidence: `shared tag: ${tag.trim()}`,
      });
    }
  }
}

// ─── Graph builder ────────────────────────────────────────────────────────

export interface KnowledgeGraphInput {
  notebooks: AiNotebook[];
  strategies: AiStrategy[];
  lifecycleRecords: TradeLifecycleRecord[];
  journalEntries: JournalEntry[];
  portfolioHealth: PortfolioHealthScore | null;
  riskReport: RiskIntelligenceReport | null;
}

function tradePlanHref(coachId: CoachId | null, id: number): string {
  return `/execution-lifecycle-manager?planId=${id}`;
}

function notebookHref(): string {
  return "/institutional-ai-coach";
}

function strategyLabelForCoach(coachId: CoachId): string {
  return coachId === "options" ? "Options" : coachId === "trading" ? "Trading" : "Investing";
}

export function buildKnowledgeGraph(input: KnowledgeGraphInput): KnowledgeGraph {
  const { notebooks, strategies, lifecycleRecords, journalEntries, portfolioHealth, riskReport } = input;
  const nodes = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];
  const seen = new Set<string>();

  // Notebooks (Research)
  for (const nb of notebooks) {
    addNode(nodes, {
      type: "notebook",
      id: nodeId("notebook", nb.id),
      rawId: nb.id,
      label: nb.title,
      coachId: nb.coachId,
      symbol: null,
      tags: nb.tags,
      href: notebookHref(),
      detail: `${strategyLabelForCoach(nb.coachId)} research notebook${nb.archived ? " (archived)" : ""}.`,
      createdAt: nb.createdAt,
    });
  }

  // Strategies
  const strategyById = new Map<number, AiStrategy>();
  for (const s of strategies) {
    strategyById.set(s.id, s);
    addNode(nodes, {
      type: "strategy",
      id: nodeId("strategy", s.id),
      rawId: s.id,
      label: s.title,
      coachId: s.coachId,
      symbol: null,
      tags: s.tags,
      href: notebookHref(),
      detail: `${strategyLabelForCoach(s.coachId)} strategy — ${s.status}.`,
      createdAt: s.createdAt,
    });
  }

  // Trade plans (from already-computed lifecycle records — structural
  // links to strategy via strategyId and to execution/journal via the
  // record's own already-resolved linkedExecution/journalStatus).
  for (const rec of lifecycleRecords) {
    const plan = rec.tradePlan;
    const symbol = plan.plannedAsset ?? rec.linkedExecution?.symbol ?? null;
    const perf =
      rec.performanceStatus.state === "closed"
        ? `Closed${rec.performanceStatus.realizedPnl != null ? `, realized P&L ${rec.performanceStatus.realizedPnl >= 0 ? "+" : ""}${rec.performanceStatus.realizedPnl.toFixed(2)}` : ""}.`
        : rec.performanceStatus.state === "open"
          ? "Open position."
          : "Not yet executed.";
    addNode(nodes, {
      type: "trade-plan",
      id: nodeId("trade-plan", plan.id),
      rawId: plan.id,
      label: plan.title,
      coachId: plan.coachId,
      symbol,
      tags: plan.tags,
      href: tradePlanHref(plan.coachId, plan.id),
      detail: `Stage: ${rec.currentStage}. ${perf}`,
      createdAt: plan.createdAt,
    });

    if (plan.strategyId != null && strategyById.has(plan.strategyId)) {
      addEdge(edges, seen, {
        from: nodeId("trade-plan", plan.id),
        to: nodeId("strategy", plan.strategyId),
        relation: "uses strategy",
        evidence: `trade plan strategyId ${plan.strategyId}`,
      });
    }

    if (symbol) {
      const companyNode = ensureTagNode(nodes, symbol);
      addEdge(edges, seen, {
        from: nodeId("trade-plan", plan.id),
        to: companyNode.id,
        relation: "planned asset",
        evidence: `plannedAsset: ${symbol}`,
      });
    }

    if (rec.journalStatus.journalEntryId != null) {
      addEdge(edges, seen, {
        from: nodeId("trade-plan", plan.id),
        to: nodeId("journal-entry", rec.journalStatus.journalEntryId),
        relation: "journaled as",
        evidence: "executedTradeRef matched to journal entry's tradeId",
      });
    }
  }

  // Journal entries
  for (const j of journalEntries) {
    addNode(nodes, {
      type: "journal-entry",
      id: nodeId("journal-entry", j.id),
      rawId: j.id,
      label: j.title,
      coachId: null,
      symbol: null,
      tags: j.tags ?? [],
      href: "/journal",
      detail: j.lessonLearned ? `Lesson recorded: ${j.lessonLearned}` : "No lesson learned recorded yet.",
      createdAt: j.createdAt,
    });
  }

  // Portfolio review (one synthetic node summarizing the current, already-
  // computed health/risk read — never a new score, only a surfaced one).
  // computePortfolioHealthScore() (Sprint 15) is never actually null — it
  // honestly returns 0/"Poor" when nothing is available at all — so, per
  // the exact same fix already applied to Sprint 16's own portfolio-risk
  // automation, a real signal (confidenceLevel above "Low") is required
  // before this node is created at all, never a fabricated "review" for a
  // brand-new user with nothing recorded anywhere.
  if (portfolioHealth && portfolioHealth.confidenceLevel !== "Low") {
    const recentClosed = lifecycleRecords
      .filter((r) => r.performanceStatus.state === "closed")
      .sort((a, b) => (b.tradePlan.executedAt ?? "").localeCompare(a.tradePlan.executedAt ?? ""))
      .slice(0, 5);
    const reviewId = nodeId("portfolio-review", "current");
    addNode(nodes, {
      type: "portfolio-review",
      id: reviewId,
      rawId: "current",
      label: "Current Portfolio Review",
      coachId: null,
      symbol: null,
      tags: [],
      href: "/portfolio-risk-intelligence",
      detail: `${portfolioHealth.label} (${portfolioHealth.overall}/100).${riskReport ? ` ${riskReport.signals.filter((s) => s.available).length} risk signal(s).` : ""}`,
      createdAt: null,
    });
    for (const rec of recentClosed) {
      addEdge(edges, seen, {
        from: reviewId,
        to: nodeId("trade-plan", rec.tradePlan.id),
        relation: "references",
        evidence: "one of the 5 most recently closed trades",
      });
    }
  }

  // Shared-tag heuristic links — the one new inference this sprint adds.
  const taggableIds = [
    ...notebooks.map((n) => nodeId("notebook", n.id)),
    ...strategies.map((s) => nodeId("strategy", s.id)),
    ...lifecycleRecords.map((r) => nodeId("trade-plan", r.tradePlan.id)),
    ...journalEntries.map((j) => nodeId("journal-entry", j.id)),
  ];
  linkSharedTags(nodes, edges, seen, taggableIds);

  return { nodes: Array.from(nodes.values()), edges, generatedAt: new Date().toISOString() };
}

// ─── Traversal ────────────────────────────────────────────────────────────

export interface RelatedEntity {
  node: KnowledgeNode;
  relation: string;
  evidence: string;
  direction: "outgoing" | "incoming";
}

/** Every entity directly connected to `id`, one hop, both directions. */
export function relatedEntities(graph: KnowledgeGraph, id: string): RelatedEntity[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: RelatedEntity[] = [];
  for (const e of graph.edges) {
    if (e.from === id) {
      const node = byId.get(e.to);
      if (node) out.push({ node, relation: e.relation, evidence: e.evidence, direction: "outgoing" });
    } else if (e.to === id) {
      const node = byId.get(e.from);
      if (node) out.push({ node, relation: e.relation, evidence: e.evidence, direction: "incoming" });
    }
  }
  return out;
}

/** Related entities of one specific type only — the building block for
 * "Related Research" / "Related Trades" / "Related Strategies" cards. */
export function relatedEntitiesOfType(graph: KnowledgeGraph, id: string, type: KnowledgeEntityType): RelatedEntity[] {
  return relatedEntities(graph, id).filter((r) => r.node.type === type);
}

/** Nodes reachable within 2 hops of `id` (used for e.g. "strategies used
 * via a shared research notebook" — a notebook links to a company/theme,
 * which links onward to trade plans that also carry that tag). */
export function relatedEntitiesWithinTwoHops(graph: KnowledgeGraph, id: string, type: KnowledgeEntityType): RelatedEntity[] {
  const direct = relatedEntities(graph, id);
  const results = new Map<string, RelatedEntity>();
  for (const r of direct) {
    if (r.node.type === type) results.set(r.node.id, r);
  }
  for (const r of direct) {
    for (const r2 of relatedEntities(graph, r.node.id)) {
      if (r2.node.id === id) continue;
      if (r2.node.type === type && !results.has(r2.node.id)) {
        results.set(r2.node.id, { node: r2.node, relation: r2.relation, evidence: `via ${r.node.label} (${r.evidence})`, direction: r2.direction });
      }
    }
  }
  return Array.from(results.values());
}

export interface RelatedResearchStrategiesLessons {
  research: RelatedEntity[];
  strategies: RelatedEntity[];
  lessons: RelatedEntity[];
}

// v1.5.0, Sprint 21 — extracted from lib/marketIntelligence.ts's own
// enrichMarketIntelligenceItem() (Sprint 20), which had been hand-rolling
// this exact "walk the company:{SYMBOL} node for research/strategies/
// journal entries, deduplicated" logic instead of reusing the pre-existing
// relatedEntitiesOfType()/relatedEntitiesWithinTwoHops() helpers above —
// the same "extract on the second real consumer" precedent this
// codebase's own backend already follows (classifyMarginOfSafety(),
// historyConsistencyScore(), etc.), now the second consumer being the new
// Opportunity Pipeline (lib/opportunityPipeline.ts). Returns an honestly
// empty result (never a fabricated placeholder) when the symbol has no
// company node in the graph at all.
export function relatedResearchStrategiesLessons(graph: KnowledgeGraph, symbol: string): RelatedResearchStrategiesLessons {
  const companyId = `company:${symbol.toUpperCase()}`;
  if (!graph.nodes.some((n) => n.id === companyId)) {
    return { research: [], strategies: [], lessons: [] };
  }
  return {
    research: relatedEntitiesWithinTwoHops(graph, companyId, "notebook"),
    strategies: relatedEntitiesOfType(graph, companyId, "strategy"),
    lessons: relatedEntitiesOfType(graph, companyId, "journal-entry"),
  };
}

export function nodeById(graph: KnowledgeGraph, id: string): KnowledgeNode | null {
  return graph.nodes.find((n) => n.id === id) ?? null;
}

/** The count of distinct entities connected to each node — the "frequently
 * connected entities" signal for the Command Centre panel. Never a
 * fabricated importance score, purely a count of real edges. */
export function nodesByConnectionCount(graph: KnowledgeGraph, type?: KnowledgeEntityType): { node: KnowledgeNode; connections: number }[] {
  const counts = new Map<string, number>();
  for (const e of graph.edges) {
    counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
    counts.set(e.to, (counts.get(e.to) ?? 0) + 1);
  }
  return graph.nodes
    .filter((n) => !type || n.type === type)
    .map((node) => ({ node, connections: counts.get(node.id) ?? 0 }))
    .filter((r) => r.connections > 0)
    .sort((a, b) => b.connections - a.connections);
}

// ─── Search ────────────────────────────────────────────────────────────

export interface KnowledgeSearchResult {
  node: KnowledgeNode;
  matchedOn: "label" | "tag" | "symbol";
}

/** Simple, transparent substring search across labels/tags/symbols —
 * never a ranked/fuzzy/semantic match, exactly the kind of search the
 * Command Palette (Phase 10) already performs. */
export function searchKnowledgeGraph(graph: KnowledgeGraph, query: string, types?: KnowledgeEntityType[]): KnowledgeSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: KnowledgeSearchResult[] = [];
  for (const node of graph.nodes) {
    if (types && !types.includes(node.type)) continue;
    if (node.label.toLowerCase().includes(q)) {
      results.push({ node, matchedOn: "label" });
      continue;
    }
    if (node.symbol && node.symbol.toLowerCase().includes(q)) {
      results.push({ node, matchedOn: "symbol" });
      continue;
    }
    if (node.tags.some((t) => t.toLowerCase().includes(q))) {
      results.push({ node, matchedOn: "tag" });
    }
  }
  return results;
}

// ─── Investment timeline ─────────────────────────────────────────────────
//
// Reuses tradeLifecycle.ts's own PIPELINE_STAGES ordering directly — this
// is a presentation of the SAME stage data every Execution & Lifecycle
// Manager screen already computes, never a second stage model.

export interface TimelineEvent {
  stageId: string;
  label: string;
  description: string;
  date: string | null;
  reached: boolean;
  isCurrent: boolean;
  sourceModule: string;
}

export function buildInvestmentTimeline(
  record: TradeLifecycleRecord,
  stages: { id: string; label: string; description: string }[],
  journalEntry: { lessonLearned: string | null } | null,
): TimelineEvent[] {
  const currentIndex = stages.findIndex((s) => s.id === record.currentStage);
  return stages.map((s, i) => {
    const reached = currentIndex >= 0 && i <= currentIndex;
    let date: string | null = null;
    let sourceModule = "Trade Plan";
    if (s.id === "ideas" || s.id === "research" || s.id === "planning") {
      date = record.tradePlan.createdAt;
      sourceModule = "Trade Planner (Sprint 10)";
    } else if (s.id === "decision-ready" || s.id === "ready-to-execute") {
      date = record.tradePlan.updatedAt;
      sourceModule = "Decision Workflow (Sprint 13)";
    } else if (s.id === "open-position" || s.id === "managing") {
      date = record.linkedExecution?.openedAt ?? record.tradePlan.executedAt;
      sourceModule = "Execution & Lifecycle Manager (Sprint 14)";
    } else if (s.id === "closed") {
      date = record.linkedExecution?.closedAt ?? null;
      sourceModule = "Execution & Lifecycle Manager (Sprint 14)";
    } else if (s.id === "journal-pending" || s.id === "reviewed") {
      date = reached ? (record.linkedExecution?.closedAt ?? null) : null;
      sourceModule = "Trade Journal";
    } else {
      sourceModule = "Trade Planner";
    }
    return {
      stageId: s.id,
      label: s.label,
      description: s.id === "reviewed" && reached && journalEntry?.lessonLearned ? journalEntry.lessonLearned : s.description,
      date,
      reached,
      isCurrent: s.id === record.currentStage,
      sourceModule,
    };
  });
}

// ─── Pattern discovery — transparent, evidence-based, never fabricated ───
//
// Every pattern below requires at least 2 corroborating pieces of real
// evidence before it is reported at all; a category with 0 or 1 match is
// simply absent from the result, never reported as "no issues found"
// (which would itself be a claim this module can't honestly make from a
// small sample).

export type KnowledgePatternKind =
  | "recurring-lesson-keyword"
  | "winning-strategy-cluster"
  | "portfolio-risk-signal"
  | "frequently-referenced-company"
  | "research-linked-to-wins";

export interface KnowledgePattern {
  kind: KnowledgePatternKind;
  title: string;
  description: string;
  evidence: string[];
  relatedNodeIds: string[];
}

const MISTAKE_KEYWORDS: Record<string, string[]> = {
  "stop-loss discipline": ["stop loss", "stop-loss", "didn't cut", "held too long", "no stop"],
  "position sizing": ["sizing", "oversized", "too large", "position size", "overleveraged"],
  "trading psychology": ["fomo", "revenge trade", "impatient", "panicked", "emotional"],
  "entry timing": ["chased", "late entry", "jumped in", "too early"],
};

const MIN_PATTERN_OCCURRENCES = 2;

function textOf(entry: JournalEntry): string {
  return `${entry.content ?? ""} ${entry.lessonLearned ?? ""}`.toLowerCase();
}

export function discoverPatterns(graph: KnowledgeGraph, journalEntries: JournalEntry[], riskReport: RiskIntelligenceReport | null): KnowledgePattern[] {
  const patterns: KnowledgePattern[] = [];

  // Recurring lesson keywords — evidence-based, quoted.
  for (const [category, keywords] of Object.entries(MISTAKE_KEYWORDS)) {
    const matches = journalEntries.filter((e) => keywords.some((k) => textOf(e).includes(k)));
    if (matches.length >= MIN_PATTERN_OCCURRENCES) {
      patterns.push({
        kind: "recurring-lesson-keyword",
        title: `Recurring theme: ${category}`,
        description: `${matches.length} journal entries mention ${category}-related language.`,
        evidence: matches.slice(0, 5).map((m) => `"${m.title}" — ${(m.lessonLearned || m.content || "").slice(0, 120)}`),
        relatedNodeIds: matches.map((m) => nodeId("journal-entry", m.id)),
      });
    }
  }

  // Winning strategy clusters.
  const winsByStrategy = new Map<string, { count: number; ids: string[] }>();
  const tradePlanToStrategy = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.relation === "uses strategy") tradePlanToStrategy.set(e.from, e.to);
  }
  for (const n of graph.nodes) {
    if (n.type !== "trade-plan") continue;
    if (!n.detail.includes("realized P&L +")) continue;
    const stratId = tradePlanToStrategy.get(n.id);
    if (!stratId) continue;
    const entry = winsByStrategy.get(stratId) ?? { count: 0, ids: [] };
    entry.count += 1;
    entry.ids.push(n.id);
    winsByStrategy.set(stratId, entry);
  }
  for (const [stratId, entry] of winsByStrategy) {
    if (entry.count < MIN_PATTERN_OCCURRENCES) continue;
    const stratNode = graph.nodes.find((n) => n.id === stratId);
    if (!stratNode) continue;
    patterns.push({
      kind: "winning-strategy-cluster",
      title: `Winning cluster: ${stratNode.label}`,
      description: `${entry.count} closed, profitable trade plans used the "${stratNode.label}" strategy.`,
      evidence: entry.ids.map((id) => graph.nodes.find((n) => n.id === id)?.label ?? id),
      relatedNodeIds: [stratId, ...entry.ids],
    });
  }

  // Portfolio risk signals — a direct surfacing of Sprint 15's own already-
  // computed signals, zero new logic. Only genuinely available signals are
  // counted or quoted — never an "unavailable" placeholder signal. Further
  // narrowed to the SAME 4 codes buildPortfolioCoachNarrative() (Sprint
  // 15, portfolioRiskIntelligence.ts) already treats as its own "biggest
  // risks" set — several other signal codes (e.g. pending_trade_impact)
  // are always `available: true` by that module's own design even when
  // honestly reporting "none pending," which would otherwise surface as a
  // fabricated-looking "risk" for a portfolio with nothing in it at all.
  const RISK_PATTERN_CODES = new Set(["portfolio_concentration", "single_position_risk", "open_trade_risk", "total_portfolio_risk"]);
  const availableRiskSignals = riskReport ? riskReport.signals.filter((s) => s.available && RISK_PATTERN_CODES.has(s.code)) : [];
  if (availableRiskSignals.length > 0) {
    patterns.push({
      kind: "portfolio-risk-signal",
      title: "Recurring portfolio risk signals",
      description: `${availableRiskSignals.length} active risk signal(s) from the Portfolio & Risk Intelligence engine.`,
      evidence: availableRiskSignals.map((s) => `${s.label}: ${s.headline}`),
      relatedNodeIds: [],
    });
  }

  // Frequently referenced companies.
  const companyConnections = nodesByConnectionCount(graph, "company").filter((r) => r.connections >= MIN_PATTERN_OCCURRENCES);
  if (companyConnections.length > 0) {
    patterns.push({
      kind: "frequently-referenced-company",
      title: "Frequently referenced companies",
      description: `${companyConnections.length} company/companies appear across multiple research, strategy, or trade-plan entries.`,
      evidence: companyConnections.slice(0, 8).map((r) => `${r.node.label} — ${r.connections} connection(s)`),
      relatedNodeIds: companyConnections.map((r) => r.node.id),
    });
  }

  // Research linked to winning outcomes.
  const notebookIds = graph.nodes.filter((n) => n.type === "notebook").map((n) => n.id);
  const researchWins: { notebook: KnowledgeNode; wins: string[] }[] = [];
  for (const nbId of notebookIds) {
    const twoHopPlans = relatedEntitiesWithinTwoHops(graph, nbId, "trade-plan");
    const wins = twoHopPlans.filter((r) => r.node.detail.includes("realized P&L +")).map((r) => r.node.label);
    if (wins.length >= MIN_PATTERN_OCCURRENCES) {
      researchWins.push({ notebook: graph.nodes.find((n) => n.id === nbId)!, wins });
    }
  }
  for (const rw of researchWins) {
    patterns.push({
      kind: "research-linked-to-wins",
      title: `Effective research: ${rw.notebook.label}`,
      description: `${rw.wins.length} profitable trade plans are connected to this notebook (via shared tags).`,
      evidence: rw.wins,
      relatedNodeIds: [rw.notebook.id],
    });
  }

  return patterns;
}

// ─── AI Knowledge Coach — deterministic, cross-module, always cites source
// (per the platform's own established "reuse the AI Coach" narrative
// pattern, not a new LLM call). Every answer names exactly which module
// each fact came from. ─────────────────────────────────────────────────

export type KnowledgeQuestionId =
  | "trades-using-strategy"
  | "research-behind-best-trades"
  | "recurring-mistakes"
  | "lessons-for-drawdown";

export interface KnowledgeQuestionAnswer {
  question: string;
  answer: string;
  citations: { label: string; href: string | null }[];
}

export const KNOWLEDGE_QUESTIONS: { id: KnowledgeQuestionId; label: string; needsStrategy: boolean }[] = [
  { id: "trades-using-strategy", label: "Show me every trade that used this strategy.", needsStrategy: true },
  { id: "research-behind-best-trades", label: "What research supported my best-performing trades?", needsStrategy: false },
  { id: "recurring-mistakes", label: "Which mistakes appear repeatedly?", needsStrategy: false },
  { id: "lessons-for-drawdown", label: "Which lessons could reduce my drawdown?", needsStrategy: false },
];

export function answerKnowledgeQuestion(
  id: KnowledgeQuestionId,
  graph: KnowledgeGraph,
  journalEntries: JournalEntry[],
  riskReport: RiskIntelligenceReport | null,
  strategyId?: string,
): KnowledgeQuestionAnswer {
  if (id === "trades-using-strategy") {
    if (!strategyId) {
      return { question: "Show me every trade that used this strategy.", answer: "Pick a strategy first.", citations: [] };
    }
    const strat = nodeById(graph, strategyId);
    const plans = relatedEntitiesOfType(graph, strategyId, "trade-plan");
    if (!strat || plans.length === 0) {
      return {
        question: `Show me every trade that used "${strat?.label ?? "this strategy"}".`,
        answer: `No trade plans reference "${strat?.label ?? "this strategy"}" yet (Trade Planner, Sprint 10).`,
        citations: [],
      };
    }
    return {
      question: `Show me every trade that used "${strat.label}".`,
      answer: `${plans.length} trade plan(s) used "${strat.label}": ${plans.map((p) => `${p.node.label} (${p.node.detail})`).join("; ")}. Source: Trade Plan strategyId links (Trade Planner, Sprint 10) plus the Execution & Lifecycle Manager's own already-computed stage per plan (Sprint 14).`,
      citations: plans.map((p) => ({ label: p.node.label, href: p.node.href })),
    };
  }

  if (id === "research-behind-best-trades") {
    const winners = graph.nodes
      .filter((n) => n.type === "trade-plan" && n.detail.includes("realized P&L +"))
      .slice(0, 5);
    if (winners.length === 0) {
      return { question: "What research supported my best-performing trades?", answer: "No closed, profitable trade plans yet (Execution & Lifecycle Manager, Sprint 14).", citations: [] };
    }
    const lines = winners.map((w) => {
      const research = relatedEntitiesWithinTwoHops(graph, w.id, "notebook");
      return research.length > 0
        ? `${w.label} — linked research: ${research.map((r) => r.node.label).join(", ")}`
        : `${w.label} — no linked research notebook found (no shared tag).`;
    });
    return {
      question: "What research supported my best-performing trades?",
      answer: `Looking at your most recent profitable, closed trade plans: ${lines.join("; ")}. Source: Execution & Lifecycle Manager's own realized P&L (Sprint 14), linked to Research Notebooks (Sprint 8) via shared tags.`,
      citations: winners.map((w) => ({ label: w.label, href: w.href })),
    };
  }

  if (id === "recurring-mistakes") {
    const patterns = discoverPatterns(graph, journalEntries, riskReport).filter((p) => p.kind === "recurring-lesson-keyword");
    if (patterns.length === 0) {
      return { question: "Which mistakes appear repeatedly?", answer: "No recurring theme was found in your Trade Journal entries yet — this needs at least 2 entries mentioning the same category.", citations: [] };
    }
    return {
      question: "Which mistakes appear repeatedly?",
      answer: `${patterns.map((p) => p.description).join(" ")} Source: Trade Journal entries, keyword-matched (never scored or ranked).`,
      citations: patterns.flatMap((p) => p.relatedNodeIds.map((id) => ({ label: graph.nodes.find((n) => n.id === id)?.label ?? id, href: "/journal" }))),
    };
  }

  // lessons-for-drawdown
  const lossLessons = journalEntries.filter((e) => (e.realizedPnl != null && e.realizedPnl < 0 && e.lessonLearned && e.lessonLearned.trim() !== ""));
  if (lossLessons.length === 0) {
    return {
      question: "Which lessons could reduce my drawdown?",
      answer: "No journal entries with both a recorded loss and a lesson learned exist yet — nothing to honestly report.",
      citations: [],
    };
  }
  return {
    question: "Which lessons could reduce my drawdown?",
    answer: `This platform has no equity time-series to prove a lesson already reduced drawdown — so here are the lessons you captured specifically from your losing trades, to apply going forward: ${lossLessons
      .slice(0, 5)
      .map((l) => `"${l.title}": ${l.lessonLearned}`)
      .join(" | ")}. Source: Trade Journal, entries with realizedPnl < 0.`,
    citations: lossLessons.slice(0, 5).map((l) => ({ label: l.title, href: "/journal" })),
  };
}

// ─── Command Centre insights ──────────────────────────────────────────────

export interface KnowledgeInsights {
  recentDiscoveries: KnowledgePattern[];
  frequentlyConnected: { node: KnowledgeNode; connections: number }[];
  repeatedMistakes: KnowledgePattern[];
  strongestLearningImprovements: string[];
  emergingThemes: { node: KnowledgeNode; connections: number }[];
}

const RECENT_WINDOW_DAYS = 30;

function isRecent(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function buildKnowledgeInsights(
  graph: KnowledgeGraph,
  journalEntries: JournalEntry[],
  riskReport: RiskIntelligenceReport | null,
): KnowledgeInsights {
  const allPatterns = discoverPatterns(graph, journalEntries, riskReport);
  const repeatedMistakes = allPatterns.filter((p) => p.kind === "recurring-lesson-keyword");
  const recentDiscoveries = allPatterns.filter((p) => p.kind !== "recurring-lesson-keyword").slice(0, 3);

  const frequentlyConnected = nodesByConnectionCount(graph).slice(0, 5);

  const strongestLearningImprovements = journalEntries
    .filter((e) => e.lessonLearned && e.lessonLearned.trim() !== "" && e.realizedPnl != null && e.realizedPnl >= 0)
    .slice(0, 3)
    .map((e) => `"${e.title}" — ${e.lessonLearned}`);

  const themeConnections = nodesByConnectionCount(graph, "theme");
  const recentEntityIds = new Set(
    graph.nodes.filter((n) => isRecent(n.createdAt)).map((n) => n.id),
  );
  const emergingThemes = themeConnections
    .filter((t) => graph.edges.some((e) => (e.to === t.node.id || e.from === t.node.id) && (recentEntityIds.has(e.from) || recentEntityIds.has(e.to))))
    .slice(0, 5);

  return { recentDiscoveries, frequentlyConnected, repeatedMistakes, strongestLearningImprovements, emergingThemes };
}

// Phase 34 — Cross-Engine Orchestration & Unified Workspace.
//
// ORCHESTRATION AND INTEGRATION PHASE. Zero new trading mathematics, zero
// new scoring, zero automated entries/exits, zero trading signals, zero
// forecasting, zero AI predictions, zero probability engines, zero broker
// execution. Nothing here implements or evaluates ICT/SMC/ASAD/Trader
// Bill/Tom Nash/the Dunni Framework. Every function below is a pure,
// deterministic search, sort, or aggregation over data ALREADY PERSISTED
// by an earlier phase — nothing here computes a new figure that didn't
// already exist somewhere in this codebase.
//
// Three genuinely new (but zero-new-calculation) capabilities this phase
// adds, all built directly on top of Phase 33's already-shipped
// lib/executiveIntelligence.ts (imported, never duplicated):
//
//   1. Global Search — a deterministic, case-insensitive substring search
//      over 9 already-persisted entity categories (Portfolios, Holdings,
//      Research Notes, Committee Snapshots, Trade Plans, Trading Journal,
//      Strategies, Reports, Learning Topics). No semantic search, no AI
//      search, no relevance scoring beyond "does the query substring
//      appear in this row's own text fields."
//
//   2. Cross-Engine Recent Items — the single most-recently-created row
//      per entity category (a plain max-by-date), for a fast "jump back
//      into where you left off" per category — distinct from the
//      interleaved chronological Activity Timeline below.
//
//   3. Cross-Engine Tasks — a small, honestly-bounded list of already-
//      computed/already-flagged "needs attention" counts (unread
//      notifications, open positions missing a stop/target, portfolios
//      with zero holdings, in-progress strategy checklists). Every count
//      is either a trivial read of an existing status column or a direct
//      pass-through of a field an earlier phase's own analytics module
//      already computed (e.g. TradingAnalyticsDashboard's own
//      strategyUsage.checklistsInProgress). Never a new prediction.
//
// Recent Activity itself is NOT reimplemented — buildWorkspaceActivityTimeline()
// below extends Phase 33's own buildActivityTimeline() output (called
// with a large cap to get every entry, never re-derived) with three
// additional entry types (trade-plan-created, strategy-registered,
// learning-topic-completed) that Phase 33's own ActivityTimelineInput
// didn't carry, then merges and re-sorts. lib/executiveIntelligence.ts
// itself is not modified at all this phase.

import {
  buildActivityTimeline,
  type ActivityTimelineInput,
  type ExecutiveActivityEntry,
  type ExecutiveActivityEntryType,
  type ExecutiveActivityEngine,
} from "./executiveIntelligence.js";

// ─── Workspace Activity Timeline (extends Phase 33's own timeline) ─────────

export type WorkspaceActivityEntryType =
  | ExecutiveActivityEntryType
  | "trade-plan-created"
  | "strategy-registered"
  | "learning-topic-completed";

export interface WorkspaceActivityEntry {
  type: WorkspaceActivityEntryType;
  engine: ExecutiveActivityEngine;
  label: string;
  detail: string;
  occurredAt: string;
  symbol: string | null;
  linkPath: string | null;
}

export interface WorkspaceActivityExtraInput {
  tradePlans: { symbol: string; direction: string; createdAt: Date | string }[];
  strategies: { name: string; category: string; createdAt: Date | string }[];
  learningCompletions: { title: string; completedAt: Date | string }[];
}

const WORKSPACE_ACTIVITY_LIMIT = 50;
// Large enough that Phase 33's own default 50-entry cap on
// buildActivityTimeline() never truncates before this file gets a chance
// to merge in the 3 new entry types and re-cap itself. Never changes
// buildActivityTimeline()'s own default behavior for its own existing
// caller (routes/executiveIntelligence.ts) — only this file's own call
// site passes a different limit.
const EFFECTIVELY_UNCAPPED = 100_000;

export function buildWorkspaceActivityTimeline(
  baseInput: ActivityTimelineInput,
  extra: WorkspaceActivityExtraInput,
  limit: number = WORKSPACE_ACTIVITY_LIMIT,
): WorkspaceActivityEntry[] {
  const base: ExecutiveActivityEntry[] = buildActivityTimeline(baseInput, EFFECTIVELY_UNCAPPED);
  const entries: WorkspaceActivityEntry[] = [...base];

  for (const p of extra.tradePlans) {
    entries.push({
      type: "trade-plan-created",
      engine: "trading",
      label: "Trade Plan Created",
      detail: `${p.symbol} (${p.direction})`,
      occurredAt: new Date(p.createdAt).toISOString(),
      symbol: p.symbol,
      linkPath: `/trade-planning-studio?symbol=${encodeURIComponent(p.symbol)}`,
    });
  }

  for (const s of extra.strategies) {
    entries.push({
      type: "strategy-registered",
      engine: "trading",
      label: "Strategy Registered",
      detail: `${s.name} (${s.category})`,
      occurredAt: new Date(s.createdAt).toISOString(),
      symbol: null,
      linkPath: "/strategy-framework",
    });
  }

  for (const l of extra.learningCompletions) {
    entries.push({
      type: "learning-topic-completed",
      engine: "platform",
      label: "Learning Topic Completed",
      detail: l.title,
      occurredAt: new Date(l.completedAt).toISOString(),
      symbol: null,
      linkPath: "/learn",
    });
  }

  return entries
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit);
}

// ─── Global Search ──────────────────────────────────────────────────────────

export type WorkspaceSearchCategory =
  | "portfolio"
  | "holding"
  | "research-note"
  | "committee-snapshot"
  | "trade-plan"
  | "trading-journal"
  | "strategy"
  | "report"
  | "learning-topic";

export interface WorkspaceSearchResult {
  category: WorkspaceSearchCategory;
  id: string;
  label: string;
  detail: string;
  occurredAt: string | null; // null only for static learning-topic catalog entries, which have no persisted timestamp
  linkPath: string;
}

export interface WorkspaceSearchEntities {
  portfolios: { id: number; name: string; createdAt: Date | string }[];
  holdings: { id: number; portfolioId: number; symbol: string; createdAt: Date | string }[];
  researchNotes: { id: number; symbol: string; note: string; createdAt: Date | string }[];
  committeeSnapshots: { id: number; symbol: string; recommendation: string; createdAt: Date | string }[];
  tradePlans: { id: number; symbol: string; direction: string; status: string; createdAt: Date | string }[];
  tradingJournal: { id: number; title: string; content: string; createdAt: Date | string }[];
  strategies: { id: number; name: string; description: string; category: string; createdAt: Date | string }[];
  reports: { id: number; reportType: string; title: string; createdAt: Date | string }[];
  learningTopics: { pathKey: string; topicKey: string; title: string }[];
}

const SEARCH_RESULTS_PER_CATEGORY = 10;

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return fields.some((f) => !!f && f.toLowerCase().includes(q));
}

// Deterministic, case-insensitive substring search only — never a
// semantic/AI search, never a relevance score beyond "the query substring
// literally appears in this row's own text." Returns [] for an empty
// query (this is a search, not a browse-everything dump).
export function buildGlobalSearchResults(query: string, entities: WorkspaceSearchEntities): WorkspaceSearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: WorkspaceSearchResult[] = [];

  for (const p of entities.portfolios.filter((p) => matches(q, p.name)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "portfolio",
      id: String(p.id),
      label: p.name,
      detail: "Investing Portfolio",
      occurredAt: new Date(p.createdAt).toISOString(),
      linkPath: `/stock-analyst/portfolio-construction?portfolioId=${p.id}`,
    });
  }

  for (const h of entities.holdings.filter((h) => matches(q, h.symbol)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "holding",
      id: String(h.id),
      label: h.symbol,
      detail: `Holding in portfolio #${h.portfolioId}`,
      occurredAt: new Date(h.createdAt).toISOString(),
      linkPath: `/stock-analyst/portfolio-construction?portfolioId=${h.portfolioId}`,
    });
  }

  for (const n of entities.researchNotes.filter((n) => matches(q, n.symbol, n.note)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "research-note",
      id: String(n.id),
      label: `${n.symbol} — Research Note`,
      detail: n.note.length > 140 ? `${n.note.slice(0, 140)}…` : n.note,
      occurredAt: new Date(n.createdAt).toISOString(),
      linkPath: `/research-terminal?symbol=${encodeURIComponent(n.symbol)}`,
    });
  }

  for (const c of entities.committeeSnapshots.filter((c) => matches(q, c.symbol, c.recommendation)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "committee-snapshot",
      id: String(c.id),
      label: `${c.symbol} — ${c.recommendation}`,
      detail: "Investment Committee Snapshot",
      occurredAt: new Date(c.createdAt).toISOString(),
      linkPath: `/investment-committee-workbench?symbol=${encodeURIComponent(c.symbol)}`,
    });
  }

  for (const p of entities.tradePlans.filter((p) => matches(q, p.symbol, p.direction, p.status)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "trade-plan",
      id: String(p.id),
      label: `${p.symbol} — ${p.direction}`,
      detail: `Trade Plan (${p.status})`,
      occurredAt: new Date(p.createdAt).toISOString(),
      linkPath: `/trade-planning-studio?symbol=${encodeURIComponent(p.symbol)}`,
    });
  }

  for (const j of entities.tradingJournal.filter((j) => matches(q, j.title, j.content)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "trading-journal",
      id: String(j.id),
      label: j.title,
      detail: "Trading Journal Entry",
      occurredAt: new Date(j.createdAt).toISOString(),
      linkPath: "/trading-journal",
    });
  }

  for (const s of entities.strategies.filter((s) => matches(q, s.name, s.description, s.category)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "strategy",
      id: String(s.id),
      label: s.name,
      detail: `Strategy (${s.category})`,
      occurredAt: new Date(s.createdAt).toISOString(),
      linkPath: "/strategy-framework",
    });
  }

  for (const r of entities.reports.filter((r) => matches(q, r.title, r.reportType)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "report",
      id: String(r.id),
      label: r.title,
      detail: `Report (${r.reportType})`,
      occurredAt: new Date(r.createdAt).toISOString(),
      linkPath: "/reporting-centre",
    });
  }

  for (const t of entities.learningTopics.filter((t) => matches(q, t.title)).slice(0, SEARCH_RESULTS_PER_CATEGORY)) {
    results.push({
      category: "learning-topic",
      id: `${t.pathKey}:${t.topicKey}`,
      label: t.title,
      detail: "Learning Topic",
      occurredAt: null,
      linkPath: `/learn/paths/${t.pathKey}`,
    });
  }

  return results;
}

// ─── Cross-Engine Recent Items ──────────────────────────────────────────────
// The single most-recently-created row per category — a plain max-by-date,
// distinct from the interleaved Activity Timeline above. Learning Topics
// are deliberately excluded (the catalog is static content with no
// persisted creation timestamp, so there is no honest "most recent" one).

export interface WorkspaceRecentItem {
  category: WorkspaceSearchCategory;
  label: string;
  detail: string;
  occurredAt: string;
  linkPath: string;
}

function mostRecent<T>(rows: T[], dateOf: (r: T) => Date | string): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime())[0];
}

export function buildCrossEngineRecentItems(entities: WorkspaceSearchEntities): WorkspaceRecentItem[] {
  const items: WorkspaceRecentItem[] = [];

  const p = mostRecent(entities.portfolios, (r) => r.createdAt);
  if (p) {
    items.push({
      category: "portfolio",
      label: p.name,
      detail: "Most recent portfolio",
      occurredAt: new Date(p.createdAt).toISOString(),
      linkPath: `/stock-analyst/portfolio-construction?portfolioId=${p.id}`,
    });
  }

  const h = mostRecent(entities.holdings, (r) => r.createdAt);
  if (h) {
    items.push({
      category: "holding",
      label: h.symbol,
      detail: "Most recent holding",
      occurredAt: new Date(h.createdAt).toISOString(),
      linkPath: `/stock-analyst/portfolio-construction?portfolioId=${h.portfolioId}`,
    });
  }

  const n = mostRecent(entities.researchNotes, (r) => r.createdAt);
  if (n) {
    items.push({
      category: "research-note",
      label: n.symbol,
      detail: "Most recent research note",
      occurredAt: new Date(n.createdAt).toISOString(),
      linkPath: `/research-terminal?symbol=${encodeURIComponent(n.symbol)}`,
    });
  }

  const c = mostRecent(entities.committeeSnapshots, (r) => r.createdAt);
  if (c) {
    items.push({
      category: "committee-snapshot",
      label: c.symbol,
      detail: `Most recent committee decision: ${c.recommendation}`,
      occurredAt: new Date(c.createdAt).toISOString(),
      linkPath: `/investment-committee-workbench?symbol=${encodeURIComponent(c.symbol)}`,
    });
  }

  const pl = mostRecent(entities.tradePlans, (r) => r.createdAt);
  if (pl) {
    items.push({
      category: "trade-plan",
      label: pl.symbol,
      detail: `Most recent trade plan (${pl.status})`,
      occurredAt: new Date(pl.createdAt).toISOString(),
      linkPath: `/trade-planning-studio?symbol=${encodeURIComponent(pl.symbol)}`,
    });
  }

  const j = mostRecent(entities.tradingJournal, (r) => r.createdAt);
  if (j) {
    items.push({
      category: "trading-journal",
      label: j.title,
      detail: "Most recent journal entry",
      occurredAt: new Date(j.createdAt).toISOString(),
      linkPath: "/trading-journal",
    });
  }

  const s = mostRecent(entities.strategies, (r) => r.createdAt);
  if (s) {
    items.push({
      category: "strategy",
      label: s.name,
      detail: "Most recently registered strategy",
      occurredAt: new Date(s.createdAt).toISOString(),
      linkPath: "/strategy-framework",
    });
  }

  const r = mostRecent(entities.reports, (r) => r.createdAt);
  if (r) {
    items.push({
      category: "report",
      label: r.title,
      detail: "Most recently generated report",
      occurredAt: new Date(r.createdAt).toISOString(),
      linkPath: "/reporting-centre",
    });
  }

  return items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

// ─── Cross-Engine Tasks ──────────────────────────────────────────────────────
// A small, honestly-bounded "needs attention" list. Every count is either a
// trivial read of an existing status column (unread notifications, missing
// stop/target, zero-holding portfolios) or a direct pass-through of a field
// an earlier phase's own analytics module already computed
// (strategyChecklistsInProgress = TradingAnalyticsDashboard's own
// strategyUsage.checklistsInProgress, Phase 32, unmodified). Never a new
// prediction, never a new derived score — a task only appears when its
// count is genuinely greater than zero.

export type WorkspaceTaskCode =
  | "unread-notifications"
  | "positions-missing-stop-or-target"
  | "portfolios-without-holdings"
  | "strategy-checklists-in-progress";

export interface WorkspaceTask {
  code: WorkspaceTaskCode;
  label: string;
  count: number;
  linkPath: string;
}

export interface WorkspaceTasksInput {
  unreadNotificationsCount: number;
  positionsMissingStopOrTargetCount: number;
  portfoliosWithoutHoldingsCount: number;
  strategyChecklistsInProgress: number;
}

export function buildCrossEngineTasks(input: WorkspaceTasksInput): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];

  if (input.unreadNotificationsCount > 0) {
    tasks.push({
      code: "unread-notifications",
      label: "Unread notification(s)",
      count: input.unreadNotificationsCount,
      linkPath: "/notifications",
    });
  }
  if (input.positionsMissingStopOrTargetCount > 0) {
    tasks.push({
      code: "positions-missing-stop-or-target",
      label: "Open position(s) missing a stop or target",
      count: input.positionsMissingStopOrTargetCount,
      linkPath: "/trade-workspace",
    });
  }
  if (input.portfoliosWithoutHoldingsCount > 0) {
    tasks.push({
      code: "portfolios-without-holdings",
      label: "Portfolio(s) with no holdings yet",
      count: input.portfoliosWithoutHoldingsCount,
      linkPath: "/stock-analyst/portfolio-construction",
    });
  }
  if (input.strategyChecklistsInProgress > 0) {
    tasks.push({
      code: "strategy-checklists-in-progress",
      label: "Strategy checklist(s) in progress",
      count: input.strategyChecklistsInProgress,
      linkPath: "/strategy-workbench",
    });
  }

  return tasks;
}

// ─── Full Workspace Composition ─────────────────────────────────────────────

export interface CrossEngineWorkspaceHub {
  recentActivity: WorkspaceActivityEntry[];
  recentItems: WorkspaceRecentItem[];
  tasks: WorkspaceTask[];
  generatedAt: string;
}

export function buildCrossEngineWorkspaceHub(input: {
  activityInput: ActivityTimelineInput;
  activityExtra: WorkspaceActivityExtraInput;
  searchEntities: WorkspaceSearchEntities;
  tasksInput: WorkspaceTasksInput;
}): CrossEngineWorkspaceHub {
  return {
    recentActivity: buildWorkspaceActivityTimeline(input.activityInput, input.activityExtra),
    recentItems: buildCrossEngineRecentItems(input.searchEntities),
    tasks: buildCrossEngineTasks(input.tasksInput),
    generatedAt: new Date().toISOString(),
  };
}

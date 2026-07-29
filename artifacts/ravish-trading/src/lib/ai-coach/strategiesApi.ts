// v1.5.0 Sprint 9 — AI Strategy Builder. Plain-fetch client for the new
// GET/POST/PATCH/DELETE /ai-strategies[...] routes
// (artifacts/api-server/src/routes/aiStrategies.ts), mirroring
// notebooksApi.ts's own established plain-fetch pattern (Sprint 8) for the
// same reason: a small, additive, self-contained CRUD surface, not worth a
// full OpenAPI/orval regeneration.
//
// Every AI-narration endpoint returns its own differently-named field
// server-side (summary/improvements/executiveSummary/comparison/
// learningNotes/riskHighlights) — this client layer normalizes all of them
// to a single { text, source } shape (StrategyNarration) so callers never
// have to remember which field name goes with which action, mirroring
// notebooksApi.ts's own NotebookNarration normalization precedent.

import type { CoachId } from "./capabilityRegistry";

const API_PREFIX = "/api";

export type StrategySectionKind =
  | "market_context"
  | "setup"
  | "checklist"
  | "entry"
  | "stop"
  | "targets"
  | "risk"
  | "position_size"
  | "trade_management"
  | "exit_rules"
  | "invalidation"
  | "common_mistakes"
  | "psychology_notes"
  | "ai_notes"
  | "attachment"
  | "research_link"
  | "notebook_reference";

export const QUALITATIVE_SECTION_KINDS: StrategySectionKind[] = [
  "market_context",
  "setup",
  "checklist",
  "entry",
  "stop",
  "targets",
  "risk",
  "position_size",
  "trade_management",
  "exit_rules",
  "invalidation",
  "common_mistakes",
  "psychology_notes",
  "ai_notes",
];

export const REFERENCE_SECTION_KINDS: StrategySectionKind[] = ["attachment", "research_link", "notebook_reference"];

export const SECTION_LABELS: Record<StrategySectionKind, string> = {
  market_context: "Market Context",
  setup: "Setup",
  checklist: "Checklist",
  entry: "Entry",
  stop: "Stop",
  targets: "Targets",
  risk: "Risk",
  position_size: "Position Size",
  trade_management: "Trade Management",
  exit_rules: "Exit Rules",
  invalidation: "Invalidation",
  common_mistakes: "Common Mistakes",
  psychology_notes: "Psychology Notes",
  ai_notes: "AI Notes",
  attachment: "Attachments",
  research_link: "Research Links",
  notebook_reference: "Notebook References",
};

export type StrategyStatus = "draft" | "active" | "retired";

export const STRATEGY_STATUSES: StrategyStatus[] = ["draft", "active", "retired"];

export interface AiStrategy {
  id: number;
  coachId: CoachId;
  workspaceId: number | null;
  title: string;
  description: string | null;
  strategyType: string;
  assetClass: string | null;
  folder: string | null;
  status: StrategyStatus;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiStrategySection {
  id: number;
  strategyId: number;
  kind: StrategySectionKind;
  content: string | null;
  notebook: { id: number; title: string } | null;
  conversation: { id: number; title: string } | null;
  file: { id: number; fileName: string; fileUrl: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiStrategyVersionSummary {
  id: number;
  strategyId: number;
  version: number;
  changeSummary: string | null;
  authorUserId: string;
  createdAt: string;
}

export interface AiStrategyVersionDetail extends AiStrategyVersionSummary {
  snapshot: unknown;
}

export interface AiStrategyDetail extends AiStrategy {
  sections: AiStrategySection[];
  versions: AiStrategyVersionSummary[];
}

export interface StrategyTemplateSummary {
  id: string;
  label: string;
  suggestedCoachId: CoachId;
  suggestedAssetClass: string;
  description: string;
}

export interface StrategyComparison {
  strategyA: AiStrategy & { sections: AiStrategySection[] };
  strategyB: AiStrategy & { sections: AiStrategySection[] };
}

export interface StrategyNarration {
  text: string;
  source: string;
}

export interface StrategyChecklistResult {
  available: boolean;
  items: string[];
}

export interface MissingSectionsResult {
  missing: StrategySectionKind[];
  present: StrategySectionKind[];
  completenessPct: number;
}

export interface SimilarStrategyResult {
  strategy: AiStrategy;
  score: number;
  matchedOn: string[];
}

export class AiStrategiesApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiStrategiesApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

async function voidOrThrow(res: Response, fallbackMessage: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiStrategiesApiError(body.error ?? fallbackMessage);
  }
}

// ─── Templates ──────────────────────────────────────────────────────────

export async function listStrategyTemplates(): Promise<StrategyTemplateSummary[]> {
  const res = await fetch(`${API_PREFIX}/ai-strategy-templates`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load strategy templates");
}

// ─── Strategies ─────────────────────────────────────────────────────────

export interface ListStrategiesOptions {
  workspaceId?: number;
  folder?: string;
  strategyType?: string;
  assetClass?: string;
  status?: StrategyStatus;
  search?: string;
  sort?: "title" | "created" | "updated";
  includeArchived?: boolean;
}

export async function listStrategies(coachId: CoachId, options?: ListStrategiesOptions): Promise<AiStrategy[]> {
  const params = new URLSearchParams({ coachId });
  if (options?.workspaceId != null) params.set("workspaceId", String(options.workspaceId));
  if (options?.folder) params.set("folder", options.folder);
  if (options?.strategyType) params.set("strategyType", options.strategyType);
  if (options?.assetClass) params.set("assetClass", options.assetClass);
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.includeArchived) params.set("includeArchived", "true");
  const res = await fetch(`${API_PREFIX}/ai-strategies?${params.toString()}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load strategies");
}

export interface CreateStrategyInput {
  title: string;
  description?: string;
  strategyType?: string;
  assetClass?: string;
  folder?: string;
  tags?: string[];
  workspaceId?: number | null;
  templateId?: string;
  changeSummary?: string;
}

export async function createStrategy(coachId: CoachId, input: CreateStrategyInput): Promise<AiStrategy> {
  const res = await fetch(`${API_PREFIX}/ai-strategies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coachId, ...input }),
  });
  return parseOrThrow(res, "Failed to create strategy");
}

export async function getStrategy(id: number): Promise<AiStrategyDetail> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${id}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load strategy");
}

export interface UpdateStrategyInput {
  title?: string;
  description?: string;
  strategyType?: string;
  assetClass?: string;
  folder?: string;
  status?: StrategyStatus;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  workspaceId?: number | null;
  changeSummary?: string;
}

export async function updateStrategy(id: number, input: UpdateStrategyInput): Promise<AiStrategy> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update strategy");
}

export async function deleteStrategy(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${id}`, { method: "DELETE" });
  await voidOrThrow(res, "Failed to delete strategy");
}

// ─── Deterministic analysis (no LLM call) ───────────────────────────────

export async function getMissingSections(strategyId: number): Promise<MissingSectionsResult> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/missing-sections`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to detect missing sections");
}

export async function getSimilarStrategies(strategyId: number): Promise<SimilarStrategyResult[]> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/similar`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to find similar strategies");
}

// ─── Sections ───────────────────────────────────────────────────────────

export async function listStrategySections(strategyId: number): Promise<AiStrategySection[]> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/sections`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load sections");
}

export interface UpsertSectionInput {
  kind: StrategySectionKind;
  content?: string;
  refNotebookId?: number;
  refConversationId?: number;
  refFileId?: number;
  changeSummary?: string;
}

/** Creates a new reference section (attachment/research_link/
 * notebook_reference) OR upserts the singleton row for a qualitative
 * kind — the server decides which, based on `kind`. */
export async function upsertStrategySection(strategyId: number, input: UpsertSectionInput): Promise<AiStrategySection> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/sections`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to save section");
}

export async function deleteStrategySection(strategyId: number, sectionId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/sections/${sectionId}`, { method: "DELETE" });
  await voidOrThrow(res, "Failed to delete section");
}

// ─── Versions ───────────────────────────────────────────────────────────

export async function listStrategyVersions(strategyId: number): Promise<AiStrategyVersionSummary[]> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/versions`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load version history");
}

export async function getStrategyVersion(strategyId: number, version: number): Promise<AiStrategyVersionDetail> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/versions/${version}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load version");
}

export async function restoreStrategyVersion(strategyId: number, version: number): Promise<AiStrategy> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/versions/${version}/restore`, { method: "POST" });
  return parseOrThrow(res, "Failed to restore version");
}

// ─── Compare ────────────────────────────────────────────────────────────

export async function compareStrategies(strategyIdA: number, strategyIdB: number): Promise<StrategyComparison> {
  const params = new URLSearchParams({ a: String(strategyIdA), b: String(strategyIdB) });
  const res = await fetch(`${API_PREFIX}/ai-strategies/compare?${params.toString()}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to compare strategies");
}

export async function compareStrategiesWithAi(strategyIdA: number, strategyIdB: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/compare/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ strategyIdA, strategyIdB }),
  });
  const body = await parseOrThrow<{ comparison: string; source: string }>(res, "Failed to generate comparison");
  return { text: body.comparison, source: body.source };
}

// ─── AI features — every call is explicit and user-triggered; none of
// these auto-save their own output into the strategy. ───────────────────

export async function summarizeStrategy(strategyId: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/summarize`, { method: "POST" });
  const body = await parseOrThrow<{ summary: string; source: string }>(res, "Failed to summarise strategy");
  return { text: body.summary, source: body.source };
}

export async function suggestStrategyImprovements(strategyId: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/suggest-improvements`, { method: "POST" });
  const body = await parseOrThrow<{ improvements: string; source: string }>(res, "Failed to suggest improvements");
  return { text: body.improvements, source: body.source };
}

export async function generateStrategyExecutiveSummary(strategyId: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/executive-summary`, { method: "POST" });
  const body = await parseOrThrow<{ executiveSummary: string; source: string }>(res, "Failed to generate executive summary");
  return { text: body.executiveSummary, source: body.source };
}

export async function generateStrategyLearningNotes(strategyId: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/learning-notes`, { method: "POST" });
  const body = await parseOrThrow<{ learningNotes: string; source: string }>(res, "Failed to generate learning notes");
  return { text: body.learningNotes, source: body.source };
}

export async function generateStrategyRiskHighlights(strategyId: number): Promise<StrategyNarration> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/risk-highlights`, { method: "POST" });
  const body = await parseOrThrow<{ riskHighlights: string; source: string }>(res, "Failed to generate risk highlights");
  return { text: body.riskHighlights, source: body.source };
}

export async function generateStrategySetupChecklist(strategyId: number): Promise<StrategyChecklistResult> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/setup-checklist`, { method: "POST" });
  const body = await parseOrThrow<{ available: boolean; checklist: string[] }>(res, "Failed to generate setup checklist");
  return { available: body.available, items: body.checklist };
}

export async function generateStrategyTradePrepChecklist(strategyId: number): Promise<StrategyChecklistResult> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/trade-prep-checklist`, { method: "POST" });
  const body = await parseOrThrow<{ available: boolean; checklist: string[] }>(res, "Failed to generate trade prep checklist");
  return { available: body.available, items: body.checklist };
}

export async function generateStrategyReviewQuestions(strategyId: number): Promise<StrategyChecklistResult> {
  const res = await fetch(`${API_PREFIX}/ai-strategies/${strategyId}/ai/review-questions`, { method: "POST" });
  const body = await parseOrThrow<{ available: boolean; questions: string[] }>(res, "Failed to generate review questions");
  return { available: body.available, items: body.questions };
}

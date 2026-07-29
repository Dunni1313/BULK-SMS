// v1.5.0 Sprint 10 — Institutional Trade Planner. Plain-fetch client for
// the new GET/POST/PATCH/DELETE /trade-plans[...] routes
// (artifacts/api-server/src/routes/tradePlans.ts), mirroring
// strategiesApi.ts's own established plain-fetch pattern (Sprint 9) for
// the same reason: a small, additive, self-contained CRUD surface, not
// worth a full OpenAPI/orval regeneration.
//
// Every AI-narration endpoint returns its own differently-named field
// server-side (review/summary/riskHighlights/riskRewardReview/
// executiveSummary/preparationNotes/comparison) — this client layer
// normalizes all of them to a single { text, source } shape
// (TradePlanNarration) so callers never have to remember which field
// name goes with which action, mirroring strategiesApi.ts's own
// StrategyNarration normalization precedent.

import type { CoachId } from "./capabilityRegistry";

const API_PREFIX = "/api";

export type TradePlanSectionKind =
  | "market_context"
  | "trade_thesis"
  | "bias"
  | "catalysts"
  | "entry_zone"
  | "confirmation_rules"
  | "invalidation"
  | "stop_loss"
  | "target_1"
  | "target_2"
  | "target_3"
  | "risk_reward"
  | "maximum_risk"
  | "position_size_notes"
  | "trade_management"
  | "exit_plan"
  | "psychology_checklist"
  | "personal_notes"
  | "attachment"
  | "research_reference"
  | "notebook_reference";

export const QUALITATIVE_TRADE_PLAN_SECTION_KINDS: TradePlanSectionKind[] = [
  "market_context",
  "trade_thesis",
  "bias",
  "catalysts",
  "entry_zone",
  "confirmation_rules",
  "invalidation",
  "stop_loss",
  "target_1",
  "target_2",
  "target_3",
  "risk_reward",
  "maximum_risk",
  "position_size_notes",
  "trade_management",
  "exit_plan",
  "psychology_checklist",
  "personal_notes",
];

export const REFERENCE_TRADE_PLAN_SECTION_KINDS: TradePlanSectionKind[] = ["attachment", "research_reference", "notebook_reference"];

export const TRADE_PLAN_SECTION_LABELS: Record<TradePlanSectionKind, string> = {
  market_context: "Market Context",
  trade_thesis: "Trade Thesis",
  bias: "Bias",
  catalysts: "Catalysts",
  entry_zone: "Entry Zone",
  confirmation_rules: "Confirmation Rules",
  invalidation: "Invalidation",
  stop_loss: "Stop Loss",
  target_1: "Target 1",
  target_2: "Target 2",
  target_3: "Target 3",
  risk_reward: "Risk / Reward",
  maximum_risk: "Maximum Risk",
  position_size_notes: "Position Size Notes",
  trade_management: "Trade Management",
  exit_plan: "Exit Plan",
  psychology_checklist: "Psychology Checklist",
  personal_notes: "Personal Notes",
  attachment: "Attachments",
  research_reference: "Research References",
  notebook_reference: "Notebook References",
};

export type TradePlanStatus = "draft" | "ready" | "watching" | "executed" | "cancelled" | "archived";

export const TRADE_PLAN_STATUSES: TradePlanStatus[] = ["draft", "ready", "watching", "executed", "cancelled", "archived"];

export type TradePlanDirection = "long" | "short";

export const TRADE_PLAN_DIRECTIONS: TradePlanDirection[] = ["long", "short"];

export interface TradePlan {
  id: number;
  coachId: CoachId;
  workspaceId: number | null;
  strategyId: number | null;
  title: string;
  plannedAsset: string | null;
  assetClass: string | null;
  direction: TradePlanDirection | null;
  status: TradePlanStatus;
  pinned: boolean;
  tags: string[];
  currentVersion: number;
  executedTradeRef: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradePlanSection {
  id: number;
  tradePlanId: number;
  kind: TradePlanSectionKind;
  content: string | null;
  notebook: { id: number; title: string } | null;
  conversation: { id: number; title: string } | null;
  file: { id: number; fileName: string; fileUrl: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradePlanVersionSummary {
  id: number;
  tradePlanId: number;
  version: number;
  changeSummary: string | null;
  authorUserId: string;
  createdAt: string;
}

export interface TradePlanVersionDetail extends TradePlanVersionSummary {
  snapshot: unknown;
}

export interface TradePlanChecklistItem {
  id: number;
  tradePlanId: number;
  label: string;
  required: boolean;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistProgress {
  totalItems: number;
  completedItems: number;
  requiredItems: number;
  completedRequiredItems: number;
  progressPct: number;
  readyForEntry: boolean;
}

export interface TradePlanDetail extends TradePlan {
  sections: TradePlanSection[];
  versions: TradePlanVersionSummary[];
  checklistItems: TradePlanChecklistItem[];
  checklistProgress: ChecklistProgress;
}

export interface ChecklistTemplateItem {
  label: string;
  required: boolean;
}

export interface TradePlanChecklistTemplate {
  id: string;
  label: string;
  coachId: CoachId;
  description: string;
  items: ChecklistTemplateItem[];
}

export interface TradePlanComparison {
  planA: TradePlan & { sections: TradePlanSection[] };
  planB: TradePlan & { sections: TradePlanSection[] };
}

export interface TradePlanNarration {
  text: string;
  source: string;
}

export interface TradePlanChecklistResult {
  available: boolean;
  items: string[];
}

export interface MissingTradePlanInfoResult {
  missing: TradePlanSectionKind[];
  present: TradePlanSectionKind[];
  completenessPct: number;
}

export interface SimilarTradePlanResult {
  plan: TradePlan;
  score: number;
  matchedOn: string[];
}

export class TradePlansApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new TradePlansApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

async function voidOrThrow(res: Response, fallbackMessage: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new TradePlansApiError(body.error ?? fallbackMessage);
  }
}

// ─── Checklist templates ────────────────────────────────────────────────

export async function listTradePlanChecklistTemplates(coachId?: CoachId): Promise<TradePlanChecklistTemplate[]> {
  const params = coachId ? `?${new URLSearchParams({ coachId }).toString()}` : "";
  const res = await fetch(`${API_PREFIX}/trade-plan-checklist-templates${params}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load checklist templates");
}

// ─── Trade Plans ────────────────────────────────────────────────────────

export interface ListTradePlansOptions {
  workspaceId?: number;
  strategyId?: number;
  status?: TradePlanStatus;
  direction?: TradePlanDirection;
  assetClass?: string;
  search?: string;
  sort?: "title" | "created" | "updated";
  includeArchived?: boolean;
}

export async function listTradePlans(coachId: CoachId, options?: ListTradePlansOptions): Promise<TradePlan[]> {
  const params = new URLSearchParams({ coachId });
  if (options?.workspaceId != null) params.set("workspaceId", String(options.workspaceId));
  if (options?.strategyId != null) params.set("strategyId", String(options.strategyId));
  if (options?.status) params.set("status", options.status);
  if (options?.direction) params.set("direction", options.direction);
  if (options?.assetClass) params.set("assetClass", options.assetClass);
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.includeArchived) params.set("includeArchived", "true");
  const res = await fetch(`${API_PREFIX}/trade-plans?${params.toString()}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load trade plans");
}

export interface CreateTradePlanInput {
  title: string;
  workspaceId?: number | null;
  strategyId?: number | null;
  plannedAsset?: string;
  assetClass?: string;
  direction?: TradePlanDirection;
  status?: TradePlanStatus;
  tags?: string[];
  changeSummary?: string;
}

export async function createTradePlan(coachId: CoachId, input: CreateTradePlanInput): Promise<TradePlan> {
  const res = await fetch(`${API_PREFIX}/trade-plans`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coachId, ...input }),
  });
  return parseOrThrow(res, "Failed to create trade plan");
}

export async function getTradePlan(id: number): Promise<TradePlanDetail> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${id}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load trade plan");
}

export interface UpdateTradePlanInput {
  title?: string;
  workspaceId?: number | null;
  strategyId?: number | null;
  plannedAsset?: string;
  assetClass?: string;
  direction?: TradePlanDirection;
  status?: TradePlanStatus;
  tags?: string[];
  pinned?: boolean;
  executedTradeRef?: string | null;
  changeSummary?: string;
}

export async function updateTradePlan(id: number, input: UpdateTradePlanInput): Promise<TradePlan> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update trade plan");
}

export async function deleteTradePlan(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${id}`, { method: "DELETE" });
  await voidOrThrow(res, "Failed to delete trade plan");
}

// ─── Deterministic analysis (no LLM call) ───────────────────────────────

export async function getMissingTradePlanInformation(planId: number): Promise<MissingTradePlanInfoResult> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/missing-information`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to detect missing information");
}

export async function getSimilarTradePlans(planId: number): Promise<SimilarTradePlanResult[]> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/similar`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to find similar trade plans");
}

// ─── Sections ───────────────────────────────────────────────────────────

export async function listTradePlanSections(planId: number): Promise<TradePlanSection[]> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/sections`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load sections");
}

export interface UpsertTradePlanSectionInput {
  kind: TradePlanSectionKind;
  content?: string;
  refNotebookId?: number;
  refConversationId?: number;
  refFileId?: number;
  changeSummary?: string;
}

/** Creates a new reference section (attachment/research_reference/
 * notebook_reference) OR upserts the singleton row for a qualitative
 * kind — the server decides which, based on `kind`. */
export async function upsertTradePlanSection(planId: number, input: UpsertTradePlanSectionInput): Promise<TradePlanSection> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/sections`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to save section");
}

export async function deleteTradePlanSection(planId: number, sectionId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/sections/${sectionId}`, { method: "DELETE" });
  await voidOrThrow(res, "Failed to delete section");
}

// ─── Checklist items (the Checklist Engine's persistent storage) ───────

export interface ListChecklistItemsResult {
  items: TradePlanChecklistItem[];
  progress: ChecklistProgress;
}

export async function listTradePlanChecklistItems(planId: number): Promise<ListChecklistItemsResult> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/checklist-items`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load checklist items");
}

export async function addTradePlanChecklistItem(
  planId: number,
  input: { label: string; required?: boolean; sortOrder?: number },
): Promise<TradePlanChecklistItem> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/checklist-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to add checklist item");
}

export async function applyTradePlanChecklistTemplate(planId: number, templateId: string): Promise<TradePlanChecklistItem[]> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/checklist-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  return parseOrThrow(res, "Failed to apply checklist template");
}

export async function updateTradePlanChecklistItem(
  planId: number,
  itemId: number,
  input: { label?: string; required?: boolean; completed?: boolean; sortOrder?: number },
): Promise<TradePlanChecklistItem> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/checklist-items/${itemId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update checklist item");
}

export async function deleteTradePlanChecklistItem(planId: number, itemId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/checklist-items/${itemId}`, { method: "DELETE" });
  await voidOrThrow(res, "Failed to delete checklist item");
}

// ─── Versions ───────────────────────────────────────────────────────────

export async function listTradePlanVersions(planId: number): Promise<TradePlanVersionSummary[]> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/versions`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load version history");
}

export async function getTradePlanVersion(planId: number, version: number): Promise<TradePlanVersionDetail> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/versions/${version}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load version");
}

export async function restoreTradePlanVersion(planId: number, version: number): Promise<TradePlan> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/versions/${version}/restore`, { method: "POST" });
  return parseOrThrow(res, "Failed to restore version");
}

// ─── Compare ────────────────────────────────────────────────────────────

export async function compareTradePlans(planIdA: number, planIdB: number): Promise<TradePlanComparison> {
  const params = new URLSearchParams({ a: String(planIdA), b: String(planIdB) });
  const res = await fetch(`${API_PREFIX}/trade-plans/compare?${params.toString()}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to compare trade plans");
}

export async function compareTradePlansWithAi(planIdA: number, planIdB: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/compare/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planIdA, planIdB }),
  });
  const body = await parseOrThrow<{ comparison: string; source: string }>(res, "Failed to generate comparison");
  return { text: body.comparison, source: body.source };
}

// ─── AI features — every call is explicit and user-triggered; none of
// these auto-save their own output into the plan, and none ever
// recommends actually executing the trade. ──────────────────────────────

export async function reviewTradePlan(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/review`, { method: "POST" });
  const body = await parseOrThrow<{ review: string; source: string }>(res, "Failed to review trade plan");
  return { text: body.review, source: body.source };
}

export async function summarizeTradePlan(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/summarize`, { method: "POST" });
  const body = await parseOrThrow<{ summary: string; source: string }>(res, "Failed to summarise trade plan");
  return { text: body.summary, source: body.source };
}

export async function generateTradePlanRiskHighlights(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/risk-highlights`, { method: "POST" });
  const body = await parseOrThrow<{ riskHighlights: string; source: string }>(res, "Failed to generate risk highlights");
  return { text: body.riskHighlights, source: body.source };
}

export async function reviewTradePlanRiskReward(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/risk-reward-review`, { method: "POST" });
  const body = await parseOrThrow<{ riskRewardReview: string; source: string }>(res, "Failed to review risk/reward");
  return { text: body.riskRewardReview, source: body.source };
}

export async function generateTradePlanExecutiveSummary(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/executive-summary`, { method: "POST" });
  const body = await parseOrThrow<{ executiveSummary: string; source: string }>(res, "Failed to generate executive summary");
  return { text: body.executiveSummary, source: body.source };
}

export async function generateTradePlanPreparationNotes(planId: number): Promise<TradePlanNarration> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/preparation-notes`, { method: "POST" });
  const body = await parseOrThrow<{ preparationNotes: string; source: string }>(res, "Failed to generate preparation notes");
  return { text: body.preparationNotes, source: body.source };
}

export async function generateTradePlanPreTradeChecklist(planId: number): Promise<TradePlanChecklistResult> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/pre-trade-checklist`, { method: "POST" });
  const body = await parseOrThrow<{ available: boolean; checklist: string[] }>(res, "Failed to generate pre-trade checklist");
  return { available: body.available, items: body.checklist };
}

export async function generateTradePlanVerificationQuestions(planId: number): Promise<TradePlanChecklistResult> {
  const res = await fetch(`${API_PREFIX}/trade-plans/${planId}/ai/verification-questions`, { method: "POST" });
  const body = await parseOrThrow<{ available: boolean; questions: string[] }>(res, "Failed to generate verification questions");
  return { available: body.available, items: body.questions };
}

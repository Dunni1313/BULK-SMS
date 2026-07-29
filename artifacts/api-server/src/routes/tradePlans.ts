// v1.5.0, Sprint 10 — Institutional Trade Planner.
//
// A Trade Plan is a fully prepared trade *before* execution, built on top
// of Sprint 7's AI Workspaces, Sprint 8's AI Research Notebooks, and
// Sprint 9's AI Strategy Builder, for the same three conversational AI
// Coaches (Trading, Investing, Options). Portfolio Coach remains excluded
// per the approved scope, the same exhaustive Sprint 3 finding Strategy
// Builder already relied on. This module is planning only — it never
// calls a broker, submits an order, or executes anything.
//
// Per the approved scope ("reuse existing architecture, introduce only
// the minimum schema required"), this file owns the four tables migration
// 043 introduced: trade_plans, trade_plan_sections (one kind-discriminated
// table for all 21 named sections — 18 singleton qualitative sections
// plus 3 many-per-plan reference kinds), trade_plan_versions (a full,
// immutable snapshot log, mirroring ai_strategy_versions exactly), and
// trade_plan_checklist_items (the Checklist Engine's persistent per-item
// storage — the one genuinely new table beyond Strategy Builder's own
// 3-table pattern, since required/optional/completion tracking needs
// real per-item rows Strategy Builder's own ephemeral AI checklists never
// needed).
//
// Two structure-list items are deliberately NOT their own section rows,
// to avoid storing the same relationship twice:
//   - "Linked Strategy"  -> trade_plans.strategyId (a real top-level FK).
//   - "Linked Notebook"  -> the notebook_reference section kind, which
//                           also covers AI Conversation references,
//                           mirroring Strategy Builder's own
//                           notebook_reference kind exactly.
//
// Every edit — a top-level field change, any section create/delete, or
// any checklist item add/remove/relabel — appends a new, immutable
// trade_plan_versions row. Checklist item COMPLETION toggling deliberately
// does NOT bump the version (mirrors pinned/archived not counting as a
// content edit), since ticking a checklist item is a working-state change,
// not a change to the plan's own written content.
//
// AI features are all explicit, user-triggered POST calls reusing
// coachLLM.ts's shared narrate()/JSON-extraction machinery — never run
// proactively, never auto-saving their own output, and every prompt
// explicitly forbids recommending the user actually execute the trade.
// "Identify Missing Information" and the list-generation half of
// "Compare Similar Plans" are deliberately DETERMINISTIC
// (lib/tradePlanAnalysis.ts), never an LLM call.
//
// Deliberately kept outside the OpenAPI/orval typed contract and
// validated via the same small, hand-written plain-validation functions
// Sprint 6/7/8/9 established.
//
// Every list/read/write is scoped by (user_id, coach_id) for plans, and
// transitively via plan ownership for sections/versions/checklist items —
// the same isolation discipline Sprint 6/7/8/9 established. 404, never a
// separate 403, for both "doesn't exist" and "isn't yours."

import { Router, type IRouter } from "express";
import {
  db,
  tradePlansTable,
  tradePlanSectionsTable,
  tradePlanVersionsTable,
  tradePlanChecklistItemsTable,
  aiWorkspaceFilesTable,
  aiCoachConversationsTable,
  aiNotebooksTable,
  TRADE_PLAN_SECTION_KINDS,
  TRADE_PLAN_STATUSES,
  TRADE_PLAN_DIRECTIONS,
  MULTI_TRADE_PLAN_SECTION_KINDS,
  type TradePlanSectionKind,
  type TradePlanStatus,
  type TradePlanDirection,
  type TradePlanSnapshot,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { COACH_IDS, type CoachId, loadOwnedWorkspace, loadOwnedConversation } from "./aiCoachConversations.js";
import { loadOwnedNotebook } from "./aiNotebooks.js";
import { loadOwnedStrategy } from "./aiStrategies.js";
import { listTradePlanChecklistTemplates, getTradePlanChecklistTemplate } from "../lib/tradePlanChecklistTemplates.js";
import { detectMissingInformation, findSimilarPlans, computeChecklistProgress } from "../lib/tradePlanAnalysis.js";
import {
  narrateTradePlanReview,
  narrateTradePlanSummary,
  narrateTradePlanRiskHighlights,
  narrateTradePlanRiskRewardReview,
  narrateTradePlanExecutiveSummary,
  narrateTradePlanPreparationNotes,
  narrateTradePlanComparison,
  generateTradePlanPreTradeChecklist,
  generateTradePlanVerificationQuestions,
} from "../lib/coachLLM.js";

const router: IRouter = Router();

function isCoachId(value: unknown): value is CoachId {
  return typeof value === "string" && (COACH_IDS as readonly string[]).includes(value);
}

function isSectionKind(value: unknown): value is TradePlanSectionKind {
  return typeof value === "string" && (TRADE_PLAN_SECTION_KINDS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is TradePlanStatus {
  return typeof value === "string" && (TRADE_PLAN_STATUSES as readonly string[]).includes(value);
}

function isDirection(value: unknown): value is TradePlanDirection {
  return typeof value === "string" && (TRADE_PLAN_DIRECTIONS as readonly string[]).includes(value);
}

function isMultiKind(kind: TradePlanSectionKind): boolean {
  return (MULTI_TRADE_PLAN_SECTION_KINDS as readonly string[]).includes(kind);
}

const TITLE_MAX_LENGTH = 200;
const ASSET_MAX_LENGTH = 40;
const CONTENT_MAX_LENGTH = 20000;
const TAG_MAX_LENGTH = 40;
const MAX_TAGS = 20;
const CHANGE_SUMMARY_MAX_LENGTH = 500;
const CHECKLIST_LABEL_MAX_LENGTH = 300;

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function parseOptionalString(value: unknown, field: string, maxLength: number): ValidationResult<string | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (typeof value !== "string") return { success: false, error: `${field} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { success: false, error: `${field} must be at most ${maxLength} characters` };
  return { success: true, data: trimmed };
}

function parseOptionalTags(value: unknown): ValidationResult<string[] | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (!Array.isArray(value)) return { success: false, error: "tags must be an array of strings" };
  if (value.length > MAX_TAGS) return { success: false, error: `tags must contain at most ${MAX_TAGS} entries` };
  const tags: string[] = [];
  for (const t of value) {
    if (typeof t !== "string" || t.trim().length === 0) return { success: false, error: "each tag must be a non-empty string" };
    if (t.trim().length > TAG_MAX_LENGTH) return { success: false, error: `each tag must be at most ${TAG_MAX_LENGTH} characters` };
    tags.push(t.trim());
  }
  return { success: true, data: tags };
}

function parseOptionalNullableInt(value: unknown, field: string): ValidationResult<number | null | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (value === null) return { success: true, data: null };
  if (typeof value !== "number" || !Number.isInteger(value)) return { success: false, error: `${field} must be an integer or null` };
  return { success: true, data: value };
}

interface CreateTradePlanInput {
  coachId: CoachId;
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

function parseCreateTradePlanBody(body: unknown): ValidationResult<CreateTradePlanInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isCoachId(b.coachId)) return { success: false, error: `coachId is required and must be one of: ${COACH_IDS.join(", ")}` };
  if (typeof b.title !== "string" || b.title.trim().length === 0) return { success: false, error: "title is required and must be a non-empty string" };
  if (b.title.trim().length > TITLE_MAX_LENGTH) return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };

  const plannedAsset = parseOptionalString(b.plannedAsset, "plannedAsset", ASSET_MAX_LENGTH);
  if (!plannedAsset.success) return { success: false, error: plannedAsset.error };
  const assetClass = parseOptionalString(b.assetClass, "assetClass", 100);
  if (!assetClass.success) return { success: false, error: assetClass.error };
  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };
  const workspaceId = parseOptionalNullableInt(b.workspaceId, "workspaceId");
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  const strategyId = parseOptionalNullableInt(b.strategyId, "strategyId");
  if (!strategyId.success) return { success: false, error: strategyId.error };
  const changeSummary = parseOptionalString(b.changeSummary, "changeSummary", CHANGE_SUMMARY_MAX_LENGTH);
  if (!changeSummary.success) return { success: false, error: changeSummary.error };

  let direction: TradePlanDirection | undefined;
  if (b.direction !== undefined) {
    if (!isDirection(b.direction)) return { success: false, error: `direction must be one of: ${TRADE_PLAN_DIRECTIONS.join(", ")}` };
    direction = b.direction;
  }
  let status: TradePlanStatus | undefined;
  if (b.status !== undefined) {
    if (!isStatus(b.status)) return { success: false, error: `status must be one of: ${TRADE_PLAN_STATUSES.join(", ")}` };
    status = b.status;
  }

  return {
    success: true,
    data: {
      coachId: b.coachId,
      title: b.title.trim(),
      workspaceId: workspaceId.data,
      strategyId: strategyId.data,
      plannedAsset: plannedAsset.data,
      assetClass: assetClass.data,
      direction,
      status,
      tags: tags.data,
      changeSummary: changeSummary.data,
    },
  };
}

interface UpdateTradePlanInput {
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

function parseUpdateTradePlanBody(body: unknown): ValidationResult<UpdateTradePlanInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;

  let title: string | undefined;
  if (b.title !== undefined) {
    if (typeof b.title !== "string" || b.title.trim().length === 0) return { success: false, error: "title must be a non-empty string" };
    if (b.title.trim().length > TITLE_MAX_LENGTH) return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };
    title = b.title.trim();
  }

  const plannedAsset = parseOptionalString(b.plannedAsset, "plannedAsset", ASSET_MAX_LENGTH);
  if (!plannedAsset.success) return { success: false, error: plannedAsset.error };
  const assetClass = parseOptionalString(b.assetClass, "assetClass", 100);
  if (!assetClass.success) return { success: false, error: assetClass.error };

  let direction: TradePlanDirection | undefined;
  if (b.direction !== undefined) {
    if (!isDirection(b.direction)) return { success: false, error: `direction must be one of: ${TRADE_PLAN_DIRECTIONS.join(", ")}` };
    direction = b.direction;
  }
  let status: TradePlanStatus | undefined;
  if (b.status !== undefined) {
    if (!isStatus(b.status)) return { success: false, error: `status must be one of: ${TRADE_PLAN_STATUSES.join(", ")}` };
    status = b.status;
  }

  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };

  let pinned: boolean | undefined;
  if (b.pinned !== undefined) {
    if (typeof b.pinned !== "boolean") return { success: false, error: "pinned must be a boolean" };
    pinned = b.pinned;
  }

  const workspaceId = parseOptionalNullableInt(b.workspaceId, "workspaceId");
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  const strategyId = parseOptionalNullableInt(b.strategyId, "strategyId");
  if (!strategyId.success) return { success: false, error: strategyId.error };

  let executedTradeRef: string | null | undefined;
  if (b.executedTradeRef !== undefined) {
    if (b.executedTradeRef === null) {
      executedTradeRef = null;
    } else {
      const parsed = parseOptionalString(b.executedTradeRef, "executedTradeRef", 200);
      if (!parsed.success) return { success: false, error: parsed.error };
      executedTradeRef = parsed.data;
    }
  }

  const changeSummary = parseOptionalString(b.changeSummary, "changeSummary", CHANGE_SUMMARY_MAX_LENGTH);
  if (!changeSummary.success) return { success: false, error: changeSummary.error };

  if (
    title === undefined &&
    plannedAsset.data === undefined &&
    assetClass.data === undefined &&
    direction === undefined &&
    status === undefined &&
    tags.data === undefined &&
    pinned === undefined &&
    workspaceId.data === undefined &&
    strategyId.data === undefined &&
    executedTradeRef === undefined
  ) {
    return { success: false, error: "At least one field must be provided." };
  }

  return {
    success: true,
    data: {
      title,
      workspaceId: workspaceId.data,
      strategyId: strategyId.data,
      plannedAsset: plannedAsset.data,
      assetClass: assetClass.data,
      direction,
      status,
      tags: tags.data,
      pinned,
      executedTradeRef,
      changeSummary: changeSummary.data,
    },
  };
}

interface CreateSectionInput {
  kind: TradePlanSectionKind;
  content?: string;
  refNotebookId?: number;
  refConversationId?: number;
  refFileId?: number;
  changeSummary?: string;
}

function parseCreateSectionBody(body: unknown): ValidationResult<CreateSectionInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isSectionKind(b.kind)) return { success: false, error: `kind is required and must be one of: ${TRADE_PLAN_SECTION_KINDS.join(", ")}` };

  const content = parseOptionalString(b.content, "content", CONTENT_MAX_LENGTH);
  if (!content.success) return { success: false, error: content.error };
  const changeSummary = parseOptionalString(b.changeSummary, "changeSummary", CHANGE_SUMMARY_MAX_LENGTH);
  if (!changeSummary.success) return { success: false, error: changeSummary.error };

  const refFields: Record<string, unknown> = {};
  for (const key of ["refNotebookId", "refConversationId", "refFileId"] as const) {
    if (b[key] === undefined) continue;
    if (typeof b[key] !== "number" || !Number.isInteger(b[key])) return { success: false, error: `${key} must be an integer` };
    refFields[key] = b[key];
  }

  const isMulti = isMultiKind(b.kind);
  if (!isMulti && Object.keys(refFields).length > 0) {
    return { success: false, error: `${b.kind} is a plain-text section and cannot carry a reference` };
  }
  if (b.kind === "research_reference" && (content.data === undefined || content.data.length === 0)) {
    return { success: false, error: "research_reference requires non-empty content (a URL)" };
  }
  if (b.kind === "notebook_reference" && refFields.refNotebookId === undefined && refFields.refConversationId === undefined) {
    return { success: false, error: "notebook_reference requires refNotebookId or refConversationId" };
  }
  if (!isMulti && (content.data === undefined || content.data.length === 0)) {
    return { success: false, error: "content is required and must be non-empty for this section kind" };
  }

  return {
    success: true,
    data: {
      kind: b.kind,
      content: content.data,
      refNotebookId: refFields.refNotebookId as number | undefined,
      refConversationId: refFields.refConversationId as number | undefined,
      refFileId: refFields.refFileId as number | undefined,
      changeSummary: changeSummary.data,
    },
  };
}

function formatTradePlan(row: typeof tradePlansTable.$inferSelect) {
  return {
    id: row.id,
    coachId: row.coachId,
    workspaceId: row.workspaceId ?? null,
    strategyId: row.strategyId ?? null,
    title: row.title,
    plannedAsset: row.plannedAsset ?? null,
    assetClass: row.assetClass ?? null,
    direction: row.direction ?? null,
    status: row.status,
    pinned: row.pinned,
    tags: row.tags,
    currentVersion: row.currentVersion,
    executedTradeRef: row.executedTradeRef ?? null,
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function formatSection(row: typeof tradePlanSectionsTable.$inferSelect) {
  let notebook: { id: number; title: string } | null = null;
  let conversation: { id: number; title: string } | null = null;
  let file: { id: number; fileName: string; fileUrl: string } | null = null;
  if (row.refNotebookId != null) {
    const [n] = await db.select().from(aiNotebooksTable).where(eq(aiNotebooksTable.id, row.refNotebookId));
    if (n) notebook = { id: n.id, title: n.title };
  }
  if (row.refConversationId != null) {
    const [c] = await db.select().from(aiCoachConversationsTable).where(eq(aiCoachConversationsTable.id, row.refConversationId));
    if (c) conversation = { id: c.id, title: c.title };
  }
  if (row.refFileId != null) {
    const [f] = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, row.refFileId));
    if (f) file = { id: f.id, fileName: f.fileName, fileUrl: f.fileUrl };
  }
  return {
    id: row.id,
    tradePlanId: row.tradePlanId,
    kind: row.kind,
    content: row.content ?? null,
    notebook,
    conversation,
    file,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatVersion(row: typeof tradePlanVersionsTable.$inferSelect) {
  return {
    id: row.id,
    tradePlanId: row.tradePlanId,
    version: row.version,
    changeSummary: row.changeSummary ?? null,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatChecklistItem(row: typeof tradePlanChecklistItemsTable.$inferSelect) {
  return {
    id: row.id,
    tradePlanId: row.tradePlanId,
    label: row.label,
    required: row.required,
    completed: row.completed,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseIdParam(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(value as string, 10);
  return isNaN(id) ? null : id;
}

function parseCoachIdQuery(raw: unknown): CoachId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isCoachId(value) ? value : null;
}

export async function loadOwnedTradePlan(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(tradePlansTable)
    .where(and(eq(tradePlansTable.id, id), eq(tradePlansTable.userId, userId)));
  return row ?? null;
}

async function loadSections(tradePlanId: number) {
  return db.select().from(tradePlanSectionsTable).where(eq(tradePlanSectionsTable.tradePlanId, tradePlanId));
}

async function loadChecklistItems(tradePlanId: number) {
  return db
    .select()
    .from(tradePlanChecklistItemsTable)
    .where(eq(tradePlanChecklistItemsTable.tradePlanId, tradePlanId))
    .orderBy(tradePlanChecklistItemsTable.sortOrder);
}

function buildSnapshot(
  plan: typeof tradePlansTable.$inferSelect,
  sections: (typeof tradePlanSectionsTable.$inferSelect)[],
  checklistItems: (typeof tradePlanChecklistItemsTable.$inferSelect)[],
): TradePlanSnapshot {
  return {
    title: plan.title,
    workspaceId: plan.workspaceId,
    strategyId: plan.strategyId,
    plannedAsset: plan.plannedAsset,
    assetClass: plan.assetClass,
    direction: plan.direction,
    status: plan.status,
    tags: plan.tags,
    sections: sections.map((s) => ({
      kind: s.kind,
      content: s.content,
      refNotebookId: s.refNotebookId,
      refConversationId: s.refConversationId,
      refFileId: s.refFileId,
    })),
    checklistItems: checklistItems.map((c) => ({
      label: c.label,
      required: c.required,
      completed: c.completed,
      sortOrder: c.sortOrder,
    })),
  };
}

/** Records the plan's own version 1 immediately after creation. */
async function recordInitialVersion(tradePlanId: number, userId: string, changeSummary?: string) {
  const plan = await loadOwnedTradePlan(tradePlanId, userId);
  if (!plan) return;
  const [sections, checklistItems] = await Promise.all([loadSections(tradePlanId), loadChecklistItems(tradePlanId)]);
  await db.insert(tradePlanVersionsTable).values({
    tradePlanId,
    version: 1,
    snapshot: buildSnapshot(plan, sections, checklistItems),
    changeSummary: changeSummary ?? "Created",
    authorUserId: userId,
  });
}

/** Appends a new, immutable version row capturing the plan's own current
 * state, and bumps trade_plans.currentVersion to match — never rewrites a
 * prior version in place. */
async function bumpVersion(tradePlanId: number, userId: string, changeSummary?: string) {
  const plan = await loadOwnedTradePlan(tradePlanId, userId);
  if (!plan) return null;
  const [sections, checklistItems] = await Promise.all([loadSections(tradePlanId), loadChecklistItems(tradePlanId)]);
  const nextVersion = plan.currentVersion + 1;
  await db.insert(tradePlanVersionsTable).values({
    tradePlanId,
    version: nextVersion,
    snapshot: buildSnapshot(plan, sections, checklistItems),
    changeSummary: changeSummary ?? null,
    authorUserId: userId,
  });
  const [updated] = await db
    .update(tradePlansTable)
    .set({ currentVersion: nextVersion, updatedAt: new Date() })
    .where(eq(tradePlansTable.id, tradePlanId))
    .returning();
  return updated ?? null;
}

/** Builds an honest, plan-context-shaped grounding object for the AI
 * narration functions — never fabricates content the plan doesn't
 * actually have. */
async function buildTradePlanContext(plan: typeof tradePlansTable.$inferSelect) {
  const sections = await loadSections(plan.id);
  return {
    title: plan.title,
    plannedAsset: plan.plannedAsset ?? null,
    assetClass: plan.assetClass ?? null,
    direction: plan.direction ?? null,
    status: plan.status,
    tags: plan.tags,
    sections: sections
      .filter((s) => !isMultiKind(s.kind as TradePlanSectionKind))
      .map((s) => ({ kind: s.kind, content: s.content })),
  };
}

// ─── Checklist templates ────────────────────────────────────────────────

router.get("/trade-plan-checklist-templates", async (req, res): Promise<void> => {
  const coachId = parseCoachIdQuery(req.query.coachId);
  const templates = listTradePlanChecklistTemplates(coachId ?? undefined);
  res.json(templates);
});

// ─── Trade Plans ────────────────────────────────────────────────────────

router.get("/trade-plans", async (req, res): Promise<void> => {
  const coachId = parseCoachIdQuery(req.query.coachId);
  if (!coachId) {
    res.status(400).json({ error: `coachId query param is required and must be one of: ${COACH_IDS.join(", ")}` });
    return;
  }

  const userId = await getScopedUserId(req);
  const includeArchived = req.query.includeArchived === "true";

  const workspaceIdRaw = Array.isArray(req.query.workspaceId) ? req.query.workspaceId[0] : req.query.workspaceId;
  let workspaceIdFilter: number | undefined;
  if (typeof workspaceIdRaw === "string" && workspaceIdRaw.length > 0) {
    const parsed = parseInt(workspaceIdRaw, 10);
    if (isNaN(parsed)) {
      res.status(400).json({ error: "workspaceId query param must be an integer" });
      return;
    }
    workspaceIdFilter = parsed;
  }

  const strategyIdRaw = Array.isArray(req.query.strategyId) ? req.query.strategyId[0] : req.query.strategyId;
  let strategyIdFilter: number | undefined;
  if (typeof strategyIdRaw === "string" && strategyIdRaw.length > 0) {
    const parsed = parseInt(strategyIdRaw, 10);
    if (isNaN(parsed)) {
      res.status(400).json({ error: "strategyId query param must be an integer" });
      return;
    }
    strategyIdFilter = parsed;
  }

  const rows = await db
    .select()
    .from(tradePlansTable)
    .where(
      and(
        eq(tradePlansTable.userId, userId),
        eq(tradePlansTable.coachId, coachId),
        ...(workspaceIdFilter !== undefined ? [eq(tradePlansTable.workspaceId, workspaceIdFilter)] : []),
        ...(strategyIdFilter !== undefined ? [eq(tradePlansTable.strategyId, strategyIdFilter)] : []),
      ),
    );

  let visible = includeArchived ? rows : rows.filter((r) => r.status !== "archived");

  const statusRaw = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  if (typeof statusRaw === "string" && isStatus(statusRaw)) visible = visible.filter((r) => r.status === statusRaw);

  const directionRaw = Array.isArray(req.query.direction) ? req.query.direction[0] : req.query.direction;
  if (typeof directionRaw === "string" && isDirection(directionRaw)) visible = visible.filter((r) => r.direction === directionRaw);

  const assetClassRaw = Array.isArray(req.query.assetClass) ? req.query.assetClass[0] : req.query.assetClass;
  if (typeof assetClassRaw === "string" && assetClassRaw.length > 0) visible = visible.filter((r) => r.assetClass === assetClassRaw);

  const searchRaw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
  const filtered = search
    ? visible.filter((r) => r.title.toLowerCase().includes(search) || (r.plannedAsset ?? "").toLowerCase().includes(search))
    : visible;

  const sortRaw = Array.isArray(req.query.sort) ? req.query.sort[0] : req.query.sort;
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortRaw === "title") return a.title.localeCompare(b.title);
    if (sortRaw === "created") return b.createdAt.getTime() - a.createdAt.getTime();
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  res.json(sorted.map(formatTradePlan));
});

router.post("/trade-plans", async (req, res): Promise<void> => {
  const parsed = parseCreateTradePlanBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);

  if (parsed.data.workspaceId != null) {
    const workspace = await loadOwnedWorkspace(parsed.data.workspaceId, userId);
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (workspace.coachId !== parsed.data.coachId) {
      res.status(400).json({ error: "Workspace belongs to a different coach" });
      return;
    }
  }

  if (parsed.data.strategyId != null) {
    const strategy = await loadOwnedStrategy(parsed.data.strategyId, userId);
    if (!strategy) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }
    if (strategy.coachId !== parsed.data.coachId) {
      res.status(400).json({ error: "Strategy belongs to a different coach" });
      return;
    }
  }

  const [row] = await db
    .insert(tradePlansTable)
    .values({
      userId,
      coachId: parsed.data.coachId,
      title: parsed.data.title,
      workspaceId: parsed.data.workspaceId ?? null,
      strategyId: parsed.data.strategyId ?? null,
      plannedAsset: parsed.data.plannedAsset ?? null,
      assetClass: parsed.data.assetClass ?? null,
      direction: parsed.data.direction ?? null,
      status: parsed.data.status ?? "draft",
      tags: parsed.data.tags ?? [],
    })
    .returning();

  await recordInitialVersion(row.id, userId, parsed.data.changeSummary);
  const created = await loadOwnedTradePlan(row.id, userId);
  res.status(201).json(formatTradePlan(created!));
});

// ─── Compare (registered before the generic /:id routes to avoid a route
// collision — "compare" would otherwise be parsed as an :id). ──────────

router.get("/trade-plans/compare", async (req, res): Promise<void> => {
  const aRaw = Array.isArray(req.query.a) ? req.query.a[0] : req.query.a;
  const bRaw = Array.isArray(req.query.b) ? req.query.b[0] : req.query.b;
  const aId = parseIdParam(aRaw);
  const bId = parseIdParam(bRaw);
  if (aId === null || bId === null) {
    res.status(400).json({ error: "Both a and b query params are required and must be integer trade plan ids" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [planA, planB] = await Promise.all([loadOwnedTradePlan(aId, userId), loadOwnedTradePlan(bId, userId)]);
  if (!planA || !planB) {
    res.status(404).json({ error: "One or both trade plans not found" });
    return;
  }

  const [sectionsA, sectionsB] = await Promise.all([loadSections(aId), loadSections(bId)]);
  res.json({
    planA: { ...formatTradePlan(planA), sections: await Promise.all(sectionsA.map(formatSection)) },
    planB: { ...formatTradePlan(planB), sections: await Promise.all(sectionsB.map(formatSection)) },
  });
});

router.post("/trade-plans/compare/ai", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const aId = typeof body.planIdA === "number" ? body.planIdA : null;
  const bId = typeof body.planIdB === "number" ? body.planIdB : null;
  if (aId === null || bId === null) {
    res.status(400).json({ error: "planIdA and planIdB are required and must be integers" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [planA, planB] = await Promise.all([loadOwnedTradePlan(aId, userId), loadOwnedTradePlan(bId, userId)]);
  if (!planA || !planB) {
    res.status(404).json({ error: "One or both trade plans not found" });
    return;
  }

  const [contextA, contextB] = await Promise.all([buildTradePlanContext(planA), buildTradePlanContext(planB)]);
  const fallback = `Comparing "${planA.title}" (${planA.plannedAsset ?? "unspecified asset"}) and "${planB.title}" (${planB.plannedAsset ?? "unspecified asset"}).`;
  const narration = await narrateTradePlanComparison({ planA: contextA, planB: contextB }, fallback);
  res.json({ comparison: narration.text, source: narration.source });
});

// ─── Single trade plan ──────────────────────────────────────────────────

router.get("/trade-plans/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const [sections, versions, checklistItems] = await Promise.all([
    loadSections(id),
    db.select().from(tradePlanVersionsTable).where(eq(tradePlanVersionsTable.tradePlanId, id)).orderBy(desc(tradePlanVersionsTable.version)),
    loadChecklistItems(id),
  ]);

  res.json({
    ...formatTradePlan(plan),
    sections: await Promise.all(sections.map(formatSection)),
    versions: versions.map(formatVersion),
    checklistItems: checklistItems.map(formatChecklistItem),
    checklistProgress: computeChecklistProgress(checklistItems),
  });
});

router.patch("/trade-plans/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseUpdateTradePlanBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const existing = await loadOwnedTradePlan(id, userId);
  if (!existing) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  if (parsed.data.workspaceId != null) {
    const workspace = await loadOwnedWorkspace(parsed.data.workspaceId, userId);
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (workspace.coachId !== existing.coachId) {
      res.status(400).json({ error: "Workspace belongs to a different coach" });
      return;
    }
  }

  if (parsed.data.strategyId != null) {
    const strategy = await loadOwnedStrategy(parsed.data.strategyId, userId);
    if (!strategy) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }
    if (strategy.coachId !== existing.coachId) {
      res.status(400).json({ error: "Strategy belongs to a different coach" });
      return;
    }
  }

  // Version history (full): bump on any versionable content field —
  // never on pinned, mirroring Sprint 9's own "favourite doesn't count as
  // a content edit" precedent. A status transition to "executed" here
  // only records the plan's OWN stated status; it never calls a broker.
  const contentChanged =
    parsed.data.title !== undefined ||
    parsed.data.workspaceId !== undefined ||
    parsed.data.strategyId !== undefined ||
    parsed.data.plannedAsset !== undefined ||
    parsed.data.assetClass !== undefined ||
    parsed.data.direction !== undefined ||
    parsed.data.status !== undefined ||
    parsed.data.tags !== undefined;

  const executedAtUpdate =
    parsed.data.status === "executed" && existing.status !== "executed" ? { executedAt: new Date() } : {};

  await db
    .update(tradePlansTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.workspaceId !== undefined ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(parsed.data.strategyId !== undefined ? { strategyId: parsed.data.strategyId } : {}),
      ...(parsed.data.plannedAsset !== undefined ? { plannedAsset: parsed.data.plannedAsset } : {}),
      ...(parsed.data.assetClass !== undefined ? { assetClass: parsed.data.assetClass } : {}),
      ...(parsed.data.direction !== undefined ? { direction: parsed.data.direction } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}),
      ...(parsed.data.executedTradeRef !== undefined ? { executedTradeRef: parsed.data.executedTradeRef } : {}),
      ...executedAtUpdate,
      updatedAt: new Date(),
    })
    .where(and(eq(tradePlansTable.id, id), eq(tradePlansTable.userId, userId)));

  const updated = contentChanged ? await bumpVersion(id, userId, parsed.data.changeSummary) : await loadOwnedTradePlan(id, userId);
  if (!updated) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  res.json(formatTradePlan(updated));
});

router.delete("/trade-plans/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(tradePlansTable)
    .where(and(eq(tradePlansTable.id, id), eq(tradePlansTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  res.status(204).send();
});

// ─── Deterministic analysis (never an LLM call) ─────────────────────────

router.get("/trade-plans/:id/missing-information", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const sections = await loadSections(id);
  res.json(detectMissingInformation(sections));
});

router.get("/trade-plans/:id/similar", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const candidates = (
    await db
      .select()
      .from(tradePlansTable)
      .where(and(eq(tradePlansTable.userId, userId), eq(tradePlansTable.coachId, plan.coachId)))
  ).filter((c) => c.status !== "archived");
  const similar = findSimilarPlans(plan, candidates);
  res.json(similar.map((s) => ({ plan: formatTradePlan(s.plan), score: s.score, matchedOn: s.matchedOn })));
});

// ─── Sections ───────────────────────────────────────────────────────────

router.get("/trade-plans/:id/sections", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const sections = await loadSections(id);
  res.json(await Promise.all(sections.map(formatSection)));
});

// Creates a new section (for a multi kind: attachment/research_reference/
// notebook_reference) OR upserts the singleton row for a qualitative kind
// — avoiding a second, separate PUT endpoint for the exact same shape.
router.post("/trade-plans/:id/sections", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseCreateSectionBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  if (parsed.data.refNotebookId != null) {
    const notebook = await loadOwnedNotebook(parsed.data.refNotebookId, userId);
    if (!notebook) {
      res.status(404).json({ error: "Notebook not found" });
      return;
    }
    if (notebook.coachId !== plan.coachId) {
      res.status(400).json({ error: "Notebook belongs to a different coach" });
      return;
    }
  }
  if (parsed.data.refConversationId != null) {
    const conversation = await loadOwnedConversation(parsed.data.refConversationId, userId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (conversation.coachId !== plan.coachId) {
      res.status(400).json({ error: "Conversation belongs to a different coach" });
      return;
    }
  }
  if (parsed.data.refFileId != null) {
    const [file] = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, parsed.data.refFileId));
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const fileWorkspace = await loadOwnedWorkspace(file.workspaceId, userId);
    if (!fileWorkspace) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (fileWorkspace.coachId !== plan.coachId) {
      res.status(400).json({ error: "File belongs to a different coach's workspace" });
      return;
    }
  }

  const values = {
    tradePlanId: id,
    kind: parsed.data.kind,
    content: parsed.data.content ?? null,
    refNotebookId: parsed.data.refNotebookId ?? null,
    refConversationId: parsed.data.refConversationId ?? null,
    refFileId: parsed.data.refFileId ?? null,
  };

  let row: typeof tradePlanSectionsTable.$inferSelect;
  if (!isMultiKind(parsed.data.kind)) {
    const [existing] = await db
      .select()
      .from(tradePlanSectionsTable)
      .where(and(eq(tradePlanSectionsTable.tradePlanId, id), eq(tradePlanSectionsTable.kind, parsed.data.kind)));
    if (existing) {
      const [updated] = await db
        .update(tradePlanSectionsTable)
        .set({ content: values.content, updatedAt: new Date() })
        .where(eq(tradePlanSectionsTable.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [inserted] = await db.insert(tradePlanSectionsTable).values(values).returning();
      row = inserted;
    }
  } else {
    const [inserted] = await db.insert(tradePlanSectionsTable).values(values).returning();
    row = inserted;
  }

  await bumpVersion(id, userId, parsed.data.changeSummary);
  res.status(201).json(await formatSection(row));
});

router.delete("/trade-plans/:id/sections/:sectionId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const sectionId = parseIdParam(req.params.sectionId);
  if (id === null || sectionId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const [row] = await db
    .delete(tradePlanSectionsTable)
    .where(and(eq(tradePlanSectionsTable.id, sectionId), eq(tradePlanSectionsTable.tradePlanId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Section not found" });
    return;
  }

  await bumpVersion(id, userId);
  res.status(204).send();
});

// ─── Checklist items (the Checklist Engine's persistent storage) ───────

router.get("/trade-plans/:id/checklist-items", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const items = await loadChecklistItems(id);
  res.json({ items: items.map(formatChecklistItem), progress: computeChecklistProgress(items) });
});

// Adds either one hand-written item ({ label, required?, sortOrder? }) or
// bulk-seeds every item from a named coach-specific template
// ({ templateId }) — both count as a content edit and bump the version.
router.post("/trade-plans/:id/checklist-items", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (typeof body.templateId === "string") {
    const template = getTradePlanChecklistTemplate(body.templateId);
    if (!template) {
      res.status(400).json({ error: `Unknown templateId: ${body.templateId}` });
      return;
    }
    const existing = await loadChecklistItems(id);
    let nextSortOrder = existing.length;
    const inserted: (typeof tradePlanChecklistItemsTable.$inferSelect)[] = [];
    for (const item of template.items) {
      const [row] = await db
        .insert(tradePlanChecklistItemsTable)
        .values({ tradePlanId: id, label: item.label, required: item.required, sortOrder: nextSortOrder })
        .returning();
      inserted.push(row);
      nextSortOrder += 1;
    }
    await bumpVersion(id, userId, `Applied checklist template: ${template.label}`);
    res.status(201).json(inserted.map(formatChecklistItem));
    return;
  }

  const label = parseOptionalString(body.label, "label", CHECKLIST_LABEL_MAX_LENGTH);
  if (!label.success || !label.data) {
    res.status(400).json({ error: label.error ?? "label is required and must be a non-empty string" });
    return;
  }
  let required = true;
  if (body.required !== undefined) {
    if (typeof body.required !== "boolean") {
      res.status(400).json({ error: "required must be a boolean" });
      return;
    }
    required = body.required;
  }
  let sortOrder: number | undefined;
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      res.status(400).json({ error: "sortOrder must be an integer" });
      return;
    }
    sortOrder = body.sortOrder;
  }
  if (sortOrder === undefined) {
    const existing = await loadChecklistItems(id);
    sortOrder = existing.length;
  }

  const [row] = await db
    .insert(tradePlanChecklistItemsTable)
    .values({ tradePlanId: id, label: label.data, required, sortOrder })
    .returning();

  await bumpVersion(id, userId, `Added checklist item: ${label.data}`);
  res.status(201).json(formatChecklistItem(row));
});

router.patch("/trade-plans/:id/checklist-items/:itemId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const itemId = parseIdParam(req.params.itemId);
  if (id === null || itemId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const updates: Partial<typeof tradePlanChecklistItemsTable.$inferInsert> = {};

  let contentChanged = false;
  if (body.label !== undefined) {
    const label = parseOptionalString(body.label, "label", CHECKLIST_LABEL_MAX_LENGTH);
    if (!label.success || !label.data) {
      res.status(400).json({ error: label.error ?? "label must be a non-empty string" });
      return;
    }
    updates.label = label.data;
    contentChanged = true;
  }
  if (body.required !== undefined) {
    if (typeof body.required !== "boolean") {
      res.status(400).json({ error: "required must be a boolean" });
      return;
    }
    updates.required = body.required;
    contentChanged = true;
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      res.status(400).json({ error: "sortOrder must be an integer" });
      return;
    }
    updates.sortOrder = body.sortOrder;
    contentChanged = true;
  }
  // Completion toggling is deliberately excluded from contentChanged — a
  // working-state change, not a content edit, mirroring pinned's own
  // precedent on the plan itself.
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      res.status(400).json({ error: "completed must be a boolean" });
      return;
    }
    updates.completed = body.completed;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "At least one field must be provided." });
    return;
  }

  const [row] = await db
    .update(tradePlanChecklistItemsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(tradePlanChecklistItemsTable.id, itemId), eq(tradePlanChecklistItemsTable.tradePlanId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  if (contentChanged) await bumpVersion(id, userId);
  res.json(formatChecklistItem(row));
});

router.delete("/trade-plans/:id/checklist-items/:itemId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const itemId = parseIdParam(req.params.itemId);
  if (id === null || itemId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const [row] = await db
    .delete(tradePlanChecklistItemsTable)
    .where(and(eq(tradePlanChecklistItemsTable.id, itemId), eq(tradePlanChecklistItemsTable.tradePlanId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  await bumpVersion(id, userId);
  res.status(204).send();
});

// ─── Versions ───────────────────────────────────────────────────────────

router.get("/trade-plans/:id/versions", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const versions = await db.select().from(tradePlanVersionsTable).where(eq(tradePlanVersionsTable.tradePlanId, id)).orderBy(desc(tradePlanVersionsTable.version));
  res.json(versions.map(formatVersion));
});

router.get("/trade-plans/:id/versions/:version", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const version = parseIdParam(req.params.version);
  if (id === null || version === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(tradePlanVersionsTable)
    .where(and(eq(tradePlanVersionsTable.tradePlanId, id), eq(tradePlanVersionsTable.version, version)));
  if (!row) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  res.json({ ...formatVersion(row), snapshot: row.snapshot });
});

router.post("/trade-plans/:id/versions/:version/restore", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const version = parseIdParam(req.params.version);
  if (id === null || version === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const [versionRow] = await db
    .select()
    .from(tradePlanVersionsTable)
    .where(and(eq(tradePlanVersionsTable.tradePlanId, id), eq(tradePlanVersionsTable.version, version)));
  if (!versionRow) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  const snapshot = versionRow.snapshot as TradePlanSnapshot;

  // Applies the snapshot's own top-level fields, replaces every section
  // and checklist-item row with the snapshot's own lists, then appends a
  // brand-new version representing the restore — never rewrites
  // versionRow itself.
  await db
    .update(tradePlansTable)
    .set({
      title: snapshot.title,
      workspaceId: snapshot.workspaceId,
      strategyId: snapshot.strategyId,
      plannedAsset: snapshot.plannedAsset,
      assetClass: snapshot.assetClass,
      direction: snapshot.direction,
      status: snapshot.status,
      tags: snapshot.tags,
      updatedAt: new Date(),
    })
    .where(eq(tradePlansTable.id, id));

  await db.delete(tradePlanSectionsTable).where(eq(tradePlanSectionsTable.tradePlanId, id));
  for (const s of snapshot.sections) {
    await db.insert(tradePlanSectionsTable).values({
      tradePlanId: id,
      kind: s.kind,
      content: s.content,
      refNotebookId: s.refNotebookId,
      refConversationId: s.refConversationId,
      refFileId: s.refFileId,
    });
  }

  await db.delete(tradePlanChecklistItemsTable).where(eq(tradePlanChecklistItemsTable.tradePlanId, id));
  for (const c of snapshot.checklistItems) {
    await db.insert(tradePlanChecklistItemsTable).values({
      tradePlanId: id,
      label: c.label,
      required: c.required,
      completed: c.completed,
      sortOrder: c.sortOrder,
    });
  }

  const updated = await bumpVersion(id, userId, `Restored to version ${version}`);
  res.json(formatTradePlan(updated!));
});

// ─── AI features — every one an explicit, user-triggered POST; none run
// proactively, none saves its own output automatically, and none ever
// recommends actually executing the trade. ──────────────────────────────

router.post("/trade-plans/:id/ai/review", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const sections = await loadSections(id);
  const missing = detectMissingInformation(sections);
  const context = { ...(await buildTradePlanContext(plan)), missingInformation: missing.missing };
  const fallback =
    missing.missing.length > 0
      ? `This plan is missing: ${missing.missing.join(", ")}.`
      : "Every qualitative section has content — review each for clarity and internal consistency before treating this plan as ready.";
  const narration = await narrateTradePlanReview(context, fallback);
  res.json({ review: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/summarize", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const fallback = `"${plan.title}" is a ${plan.direction ?? "unspecified-direction"} plan on ${plan.plannedAsset ?? "an unspecified asset"} with ${context.sections.length} section${context.sections.length === 1 ? "" : "s"} defined.`;
  const narration = await narrateTradePlanSummary(context, fallback);
  res.json({ summary: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/risk-highlights", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const sections = await loadSections(id);
  const missing = detectMissingInformation(sections);
  const context = { ...(await buildTradePlanContext(plan)), missingInformation: missing.missing };
  const fallback = missing.missing.includes("stop_loss")
    ? "No stop loss is defined yet — this is a significant gap."
    : "Review the stop loss, maximum risk, and invalidation sections for completeness.";
  const narration = await narrateTradePlanRiskHighlights(context, fallback);
  res.json({ riskHighlights: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/risk-reward-review", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const fallback = "Add entry zone, stop loss, and target sections to assess this plan's risk/reward.";
  const narration = await narrateTradePlanRiskRewardReview(context, fallback);
  res.json({ riskRewardReview: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/executive-summary", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const fallback = `"${plan.title}" — a ${plan.direction ?? "unspecified-direction"} plan on ${plan.plannedAsset ?? "an unspecified asset"} (status: ${plan.status}).`;
  const narration = await narrateTradePlanExecutiveSummary(context, fallback);
  res.json({ executiveSummary: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/preparation-notes", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const fallback = "Add market context and catalysts sections to generate preparation notes for this plan.";
  const narration = await narrateTradePlanPreparationNotes(context, fallback);
  res.json({ preparationNotes: narration.text, source: narration.source });
});

router.post("/trade-plans/:id/ai/pre-trade-checklist", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const checklist = await generateTradePlanPreTradeChecklist(context);
  res.json({ available: checklist !== null, checklist: checklist ?? [] });
});

router.post("/trade-plans/:id/ai/verification-questions", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const plan = await loadOwnedTradePlan(id, userId);
  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }
  const context = await buildTradePlanContext(plan);
  const questions = await generateTradePlanVerificationQuestions(context);
  res.json({ available: questions !== null, questions: questions ?? [] });
});

export default router;

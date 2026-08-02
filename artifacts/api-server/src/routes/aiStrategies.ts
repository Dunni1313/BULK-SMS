// v1.5.0, Sprint 9 — AI Strategy Builder.
//
// A Strategy is a reusable, structured trading/investing playbook, built on
// top of Sprint 7's AI Workspaces and Sprint 8's AI Research Notebooks, for
// the same three conversational AI Coaches (Trading, Investing, Options).
// Portfolio has no conversational coach (an exhaustive Sprint 3 finding)
// and has nothing registered here.
//
// Per the approved scope ("reuse Workspace architecture, introduce only
// the minimum schema required for Strategies / Strategy versions /
// Strategy sections, avoid duplicate storage"), this file owns the three
// tables migration 042 introduced: ai_strategies, ai_strategy_sections
// (one kind-discriminated table for all 17 named sections — 14 singleton
// qualitative sections plus 3 many-per-strategy reference kinds), and
// ai_strategy_versions (a full, immutable snapshot log).
//
// Reference-kind section mapping (all 3 ref columns exist on every row
// regardless of kind; the route layer, not the DB, decides which ref each
// kind is expected to carry):
//   - "attachment"          -> refFileId (an existing ai_workspace_files
//                              row from an associated workspace) OR
//                              freehand `content` (name/URL text) when no
//                              such workspace file exists — "references
//                              only," matching ai_workspace_files' own
//                              Sprint 7 precedent (no upload infra exists).
//   - "research_link"       -> `content` only (a plain URL/text link).
//   - "notebook_reference"  -> refNotebookId OR refConversationId — the
//                              approved scope's own "Workspace Integration:
//                              Strategies may link to Research Notebooks
//                              [and] AI Conversations" requirement, folded
//                              into this one named section kind rather
//                              than inventing a 4th kind/table.
//
// Every edit — a top-level field change, or any section create/delete —
// appends a new, immutable ai_strategy_versions row (see
// bumpVersion()/recordInitialVersion() below). Restoring a prior version
// never rewrites history in place; it applies that version's own snapshot
// to the live rows and then appends a brand-new version of its own.
//
// AI features are all explicit, user-triggered POST calls reusing
// coachLLM.ts's shared narrate()/JSON-extraction machinery — never run
// proactively, never auto-saving their own output. "Detect Missing
// Sections" and "Find Similar Strategies" are deliberately DETERMINISTIC
// (lib/strategyAnalysis.ts), never an LLM call, since both are honestly,
// exactly computable from already-saved data.
//
// Deliberately kept outside the OpenAPI/orval typed contract and
// validated via the same small, hand-written plain-validation functions
// Sprint 6/7/8 established (avoiding the zod-dependency-conflict risk
// those sprints' own validation disclosed).
//
// Every list/read/write is scoped by (user_id, coach_id) for strategies,
// and transitively via strategy ownership for sections/versions — the
// same isolation discipline Sprint 6/7/8 established. 404, never a
// separate 403, for both "doesn't exist" and "isn't yours."

import { Router, type IRouter } from "express";
import {
  db,
  aiStrategiesTable,
  aiStrategySectionsTable,
  aiStrategyVersionsTable,
  aiWorkspaceFilesTable,
  aiCoachConversationsTable,
  aiNotebooksTable,
  STRATEGY_SECTION_KINDS,
  STRATEGY_STATUSES,
  MULTI_STRATEGY_SECTION_KINDS,
  type StrategySectionKind,
  type StrategyStatus,
  type StrategySnapshot,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { COACH_IDS, type CoachId, loadOwnedWorkspace, loadOwnedConversation } from "./aiCoachConversations.js";
import { loadOwnedNotebook } from "./aiNotebooks.js";
import { STRATEGY_TEMPLATES, getStrategyTemplate, templateDefaultSections } from "../lib/strategyTemplates.js";
import { detectMissingSections, findSimilarStrategies } from "../lib/strategyAnalysis.js";
import {
  narrateStrategySummary,
  narrateStrategyImprovements,
  narrateStrategyExecutiveSummary,
  narrateStrategyComparison,
  narrateStrategyLearningNotes,
  narrateStrategyRiskHighlights,
  generateStrategySetupChecklist,
  generateStrategyTradePrepChecklist,
  generateStrategyReviewQuestions,
} from "../lib/coachLLM.js";

const router: IRouter = Router();

function isCoachId(value: unknown): value is CoachId {
  return typeof value === "string" && (COACH_IDS as readonly string[]).includes(value);
}

function isSectionKind(value: unknown): value is StrategySectionKind {
  return typeof value === "string" && (STRATEGY_SECTION_KINDS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is StrategyStatus {
  return typeof value === "string" && (STRATEGY_STATUSES as readonly string[]).includes(value);
}

function isMultiKind(kind: StrategySectionKind): boolean {
  return (MULTI_STRATEGY_SECTION_KINDS as readonly string[]).includes(kind);
}

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
const CONTENT_MAX_LENGTH = 20000;
const TAG_MAX_LENGTH = 40;
const MAX_TAGS = 20;
const CHANGE_SUMMARY_MAX_LENGTH = 500;

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

function parseOptionalWorkspaceId(value: unknown): ValidationResult<number | null | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (value === null) return { success: true, data: null };
  if (typeof value !== "number" || !Number.isInteger(value)) return { success: false, error: "workspaceId must be an integer or null" };
  return { success: true, data: value };
}

interface CreateStrategyInput {
  coachId: CoachId;
  title: string;
  description?: string;
  strategyType: string;
  assetClass?: string;
  folder?: string;
  tags?: string[];
  workspaceId?: number | null;
  templateId?: string;
  changeSummary?: string;
}

function parseCreateStrategyBody(body: unknown): ValidationResult<CreateStrategyInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isCoachId(b.coachId)) return { success: false, error: `coachId is required and must be one of: ${COACH_IDS.join(", ")}` };
  if (typeof b.title !== "string" || b.title.trim().length === 0) return { success: false, error: "title is required and must be a non-empty string" };
  if (b.title.trim().length > TITLE_MAX_LENGTH) return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };

  let strategyType: string;
  if (b.strategyType !== undefined) {
    if (typeof b.strategyType !== "string" || b.strategyType.trim().length === 0)
      return { success: false, error: "strategyType must be a non-empty string" };
    strategyType = b.strategyType.trim();
  } else if (typeof b.templateId === "string") {
    const template = getStrategyTemplate(b.templateId);
    if (!template) return { success: false, error: `Unknown templateId: ${b.templateId}` };
    strategyType = template.label;
  } else {
    return { success: false, error: "strategyType is required (or supply a valid templateId)" };
  }

  const description = parseOptionalString(b.description, "description", DESCRIPTION_MAX_LENGTH);
  if (!description.success) return { success: false, error: description.error };
  const assetClass = parseOptionalString(b.assetClass, "assetClass", 100);
  if (!assetClass.success) return { success: false, error: assetClass.error };
  const folder = parseOptionalString(b.folder, "folder", 100);
  if (!folder.success) return { success: false, error: folder.error };
  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };
  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  const changeSummary = parseOptionalString(b.changeSummary, "changeSummary", CHANGE_SUMMARY_MAX_LENGTH);
  if (!changeSummary.success) return { success: false, error: changeSummary.error };

  let templateId: string | undefined;
  if (b.templateId !== undefined) {
    if (typeof b.templateId !== "string" || !getStrategyTemplate(b.templateId)) return { success: false, error: `Unknown templateId: ${String(b.templateId)}` };
    templateId = b.templateId;
  }

  return {
    success: true,
    data: {
      coachId: b.coachId,
      title: b.title.trim(),
      description: description.data,
      strategyType,
      assetClass: assetClass.data,
      folder: folder.data,
      tags: tags.data,
      workspaceId: workspaceId.data,
      templateId,
      changeSummary: changeSummary.data,
    },
  };
}

interface UpdateStrategyInput {
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

function parseUpdateStrategyBody(body: unknown): ValidationResult<UpdateStrategyInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;

  let title: string | undefined;
  if (b.title !== undefined) {
    if (typeof b.title !== "string" || b.title.trim().length === 0) return { success: false, error: "title must be a non-empty string" };
    if (b.title.trim().length > TITLE_MAX_LENGTH) return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };
    title = b.title.trim();
  }

  let strategyType: string | undefined;
  if (b.strategyType !== undefined) {
    if (typeof b.strategyType !== "string" || b.strategyType.trim().length === 0) return { success: false, error: "strategyType must be a non-empty string" };
    strategyType = b.strategyType.trim();
  }

  const description = parseOptionalString(b.description, "description", DESCRIPTION_MAX_LENGTH);
  if (!description.success) return { success: false, error: description.error };
  const assetClass = parseOptionalString(b.assetClass, "assetClass", 100);
  if (!assetClass.success) return { success: false, error: assetClass.error };
  const folder = parseOptionalString(b.folder, "folder", 100);
  if (!folder.success) return { success: false, error: folder.error };

  let status: StrategyStatus | undefined;
  if (b.status !== undefined) {
    if (!isStatus(b.status)) return { success: false, error: `status must be one of: ${STRATEGY_STATUSES.join(", ")}` };
    status = b.status;
  }

  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };

  let pinned: boolean | undefined;
  if (b.pinned !== undefined) {
    if (typeof b.pinned !== "boolean") return { success: false, error: "pinned must be a boolean" };
    pinned = b.pinned;
  }
  let archived: boolean | undefined;
  if (b.archived !== undefined) {
    if (typeof b.archived !== "boolean") return { success: false, error: "archived must be a boolean" };
    archived = b.archived;
  }

  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  const changeSummary = parseOptionalString(b.changeSummary, "changeSummary", CHANGE_SUMMARY_MAX_LENGTH);
  if (!changeSummary.success) return { success: false, error: changeSummary.error };

  if (
    title === undefined &&
    description.data === undefined &&
    strategyType === undefined &&
    assetClass.data === undefined &&
    folder.data === undefined &&
    status === undefined &&
    tags.data === undefined &&
    pinned === undefined &&
    archived === undefined &&
    workspaceId.data === undefined
  ) {
    return { success: false, error: "At least one field must be provided." };
  }

  return {
    success: true,
    data: {
      title,
      description: description.data,
      strategyType,
      assetClass: assetClass.data,
      folder: folder.data,
      status,
      tags: tags.data,
      pinned,
      archived,
      workspaceId: workspaceId.data,
      changeSummary: changeSummary.data,
    },
  };
}

interface CreateSectionInput {
  kind: StrategySectionKind;
  content?: string;
  refNotebookId?: number;
  refConversationId?: number;
  refFileId?: number;
  changeSummary?: string;
}

function parseCreateSectionBody(body: unknown): ValidationResult<CreateSectionInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isSectionKind(b.kind)) return { success: false, error: `kind is required and must be one of: ${STRATEGY_SECTION_KINDS.join(", ")}` };

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
  if (b.kind === "research_link" && (content.data === undefined || content.data.length === 0)) {
    return { success: false, error: "research_link requires non-empty content (a URL)" };
  }
  if (b.kind === "notebook_reference" && refFields.refNotebookId === undefined && refFields.refConversationId === undefined) {
    return { success: false, error: "notebook_reference requires refNotebookId or refConversationId" };
  }
  if (
    !isMulti &&
    (content.data === undefined || content.data.length === 0)
  ) {
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

function formatStrategy(row: typeof aiStrategiesTable.$inferSelect) {
  return {
    id: row.id,
    coachId: row.coachId,
    workspaceId: row.workspaceId ?? null,
    title: row.title,
    description: row.description ?? null,
    strategyType: row.strategyType,
    assetClass: row.assetClass ?? null,
    folder: row.folder ?? null,
    status: row.status,
    pinned: row.pinned,
    archived: row.archived,
    tags: row.tags,
    currentVersion: row.currentVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function formatSection(row: typeof aiStrategySectionsTable.$inferSelect) {
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
    strategyId: row.strategyId,
    kind: row.kind,
    content: row.content ?? null,
    notebook,
    conversation,
    file,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatVersion(row: typeof aiStrategyVersionsTable.$inferSelect) {
  return {
    id: row.id,
    strategyId: row.strategyId,
    version: row.version,
    changeSummary: row.changeSummary ?? null,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt.toISOString(),
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

export async function loadOwnedStrategy(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(aiStrategiesTable)
    .where(and(eq(aiStrategiesTable.id, id), eq(aiStrategiesTable.userId, userId)));
  return row ?? null;
}

async function loadSections(strategyId: number) {
  return db.select().from(aiStrategySectionsTable).where(eq(aiStrategySectionsTable.strategyId, strategyId));
}

function buildSnapshot(strategy: typeof aiStrategiesTable.$inferSelect, sections: (typeof aiStrategySectionsTable.$inferSelect)[]): StrategySnapshot {
  return {
    title: strategy.title,
    description: strategy.description,
    strategyType: strategy.strategyType,
    assetClass: strategy.assetClass,
    folder: strategy.folder,
    status: strategy.status,
    tags: strategy.tags,
    sections: sections.map((s) => ({
      kind: s.kind,
      content: s.content,
      refNotebookId: s.refNotebookId,
      refConversationId: s.refConversationId,
      refFileId: s.refFileId,
    })),
  };
}

/** Records the strategy's own version 1 immediately after creation. */
async function recordInitialVersion(strategyId: number, userId: string, changeSummary?: string) {
  const strategy = await loadOwnedStrategy(strategyId, userId);
  if (!strategy) return;
  const sections = await loadSections(strategyId);
  await db.insert(aiStrategyVersionsTable).values({
    strategyId,
    version: 1,
    snapshot: buildSnapshot(strategy, sections),
    changeSummary: changeSummary ?? "Created",
    authorUserId: userId,
  });
}

/** Appends a new, immutable version row capturing the strategy's own
 * current state, and bumps ai_strategies.currentVersion to match — never
 * rewrites a prior version in place. */
async function bumpVersion(strategyId: number, userId: string, changeSummary?: string) {
  const strategy = await loadOwnedStrategy(strategyId, userId);
  if (!strategy) return null;
  const sections = await loadSections(strategyId);
  const nextVersion = strategy.currentVersion + 1;
  await db.insert(aiStrategyVersionsTable).values({
    strategyId,
    version: nextVersion,
    snapshot: buildSnapshot(strategy, sections),
    changeSummary: changeSummary ?? null,
    authorUserId: userId,
  });
  const [updated] = await db
    .update(aiStrategiesTable)
    .set({ currentVersion: nextVersion, updatedAt: new Date() })
    .where(eq(aiStrategiesTable.id, strategyId))
    .returning();
  return updated ?? null;
}

/** Builds an honest, notebook-context-shaped grounding object for the AI
 * narration functions — never fabricates content the strategy doesn't
 * actually have. */
async function buildStrategyContext(strategy: typeof aiStrategiesTable.$inferSelect) {
  const sections = await loadSections(strategy.id);
  return {
    title: strategy.title,
    description: strategy.description ?? null,
    strategyType: strategy.strategyType,
    assetClass: strategy.assetClass ?? null,
    status: strategy.status,
    tags: strategy.tags,
    sections: sections
      .filter((s) => !isMultiKind(s.kind as StrategySectionKind))
      .map((s) => ({ kind: s.kind, content: s.content })),
  };
}

// ─── Templates ──────────────────────────────────────────────────────────

router.get("/ai-strategy-templates", async (_req, res): Promise<void> => {
  res.json(STRATEGY_TEMPLATES.map((t) => ({ id: t.id, label: t.label, suggestedCoachId: t.suggestedCoachId, suggestedAssetClass: t.suggestedAssetClass, description: t.description })));
});

// ─── Strategies ─────────────────────────────────────────────────────────

router.get("/ai-strategies", async (req, res): Promise<void> => {
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

  const rows = await db
    .select()
    .from(aiStrategiesTable)
    .where(
      and(
        eq(aiStrategiesTable.userId, userId),
        eq(aiStrategiesTable.coachId, coachId),
        ...(workspaceIdFilter !== undefined ? [eq(aiStrategiesTable.workspaceId, workspaceIdFilter)] : []),
      ),
    );

  let visible = includeArchived ? rows : rows.filter((r) => !r.archived);

  const folderRaw = Array.isArray(req.query.folder) ? req.query.folder[0] : req.query.folder;
  if (typeof folderRaw === "string" && folderRaw.length > 0) visible = visible.filter((r) => (r.folder ?? r.coachId) === folderRaw);

  const strategyTypeRaw = Array.isArray(req.query.strategyType) ? req.query.strategyType[0] : req.query.strategyType;
  if (typeof strategyTypeRaw === "string" && strategyTypeRaw.length > 0) visible = visible.filter((r) => r.strategyType === strategyTypeRaw);

  const assetClassRaw = Array.isArray(req.query.assetClass) ? req.query.assetClass[0] : req.query.assetClass;
  if (typeof assetClassRaw === "string" && assetClassRaw.length > 0) visible = visible.filter((r) => r.assetClass === assetClassRaw);

  const statusRaw = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  if (typeof statusRaw === "string" && isStatus(statusRaw)) visible = visible.filter((r) => r.status === statusRaw);

  const searchRaw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
  const filtered = search ? visible.filter((r) => r.title.toLowerCase().includes(search)) : visible;

  const sortRaw = Array.isArray(req.query.sort) ? req.query.sort[0] : req.query.sort;
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortRaw === "title") return a.title.localeCompare(b.title);
    if (sortRaw === "created") return b.createdAt.getTime() - a.createdAt.getTime();
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  res.json(sorted.map(formatStrategy));
});

router.post("/ai-strategies", async (req, res): Promise<void> => {
  const parsed = parseCreateStrategyBody(req.body);
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

  const [row] = await db
    .insert(aiStrategiesTable)
    .values({
      userId,
      coachId: parsed.data.coachId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      strategyType: parsed.data.strategyType,
      assetClass: parsed.data.assetClass ?? (parsed.data.templateId ? getStrategyTemplate(parsed.data.templateId)?.suggestedAssetClass ?? null : null),
      folder: parsed.data.folder ?? null,
      tags: parsed.data.tags ?? [],
      workspaceId: parsed.data.workspaceId ?? null,
    })
    .returning();

  if (parsed.data.templateId) {
    const defaults = templateDefaultSections(parsed.data.templateId);
    for (const d of defaults) {
      await db.insert(aiStrategySectionsTable).values({ strategyId: row.id, kind: d.kind, content: d.content });
    }
  }

  await recordInitialVersion(row.id, userId, parsed.data.changeSummary);
  const created = await loadOwnedStrategy(row.id, userId);
  res.status(201).json(formatStrategy(created!));
});

// ─── Compare (registered before the generic /:id routes to avoid a route
// collision — "compare" would otherwise be parsed as an :id). ──────────

router.get("/ai-strategies/compare", async (req, res): Promise<void> => {
  const aRaw = Array.isArray(req.query.a) ? req.query.a[0] : req.query.a;
  const bRaw = Array.isArray(req.query.b) ? req.query.b[0] : req.query.b;
  const aId = parseIdParam(aRaw);
  const bId = parseIdParam(bRaw);
  if (aId === null || bId === null) {
    res.status(400).json({ error: "Both a and b query params are required and must be integer strategy ids" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [strategyA, strategyB] = await Promise.all([loadOwnedStrategy(aId, userId), loadOwnedStrategy(bId, userId)]);
  if (!strategyA || !strategyB) {
    res.status(404).json({ error: "One or both strategies not found" });
    return;
  }

  const [sectionsA, sectionsB] = await Promise.all([loadSections(aId), loadSections(bId)]);
  res.json({
    strategyA: { ...formatStrategy(strategyA), sections: await Promise.all(sectionsA.map(formatSection)) },
    strategyB: { ...formatStrategy(strategyB), sections: await Promise.all(sectionsB.map(formatSection)) },
  });
});

router.post("/ai-strategies/compare/ai", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const aId = typeof body.strategyIdA === "number" ? body.strategyIdA : null;
  const bId = typeof body.strategyIdB === "number" ? body.strategyIdB : null;
  if (aId === null || bId === null) {
    res.status(400).json({ error: "strategyIdA and strategyIdB are required and must be integers" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [strategyA, strategyB] = await Promise.all([loadOwnedStrategy(aId, userId), loadOwnedStrategy(bId, userId)]);
  if (!strategyA || !strategyB) {
    res.status(404).json({ error: "One or both strategies not found" });
    return;
  }

  const [contextA, contextB] = await Promise.all([buildStrategyContext(strategyA), buildStrategyContext(strategyB)]);
  const fallback = `Comparing "${strategyA.title}" (${strategyA.strategyType}) and "${strategyB.title}" (${strategyB.strategyType}).`;
  const narration = await narrateStrategyComparison({ strategyA: contextA, strategyB: contextB }, fallback);
  res.json({ comparison: narration.text, source: narration.source });
});

// ─── Single strategy ────────────────────────────────────────────────────

router.get("/ai-strategies/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const [sections, versions] = await Promise.all([
    loadSections(id),
    db.select().from(aiStrategyVersionsTable).where(eq(aiStrategyVersionsTable.strategyId, id)).orderBy(desc(aiStrategyVersionsTable.version)),
  ]);

  res.json({
    ...formatStrategy(strategy),
    sections: await Promise.all(sections.map(formatSection)),
    versions: versions.map(formatVersion),
  });
});

router.patch("/ai-strategies/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseUpdateStrategyBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const existing = await loadOwnedStrategy(id, userId);
  if (!existing) {
    res.status(404).json({ error: "Strategy not found" });
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

  // Version history (full): bump on any versionable content field —
  // never on pinned/archived/workspaceId, mirroring Sprint 8's own
  // "favourite/archive don't count as content edits" precedent.
  const contentChanged =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.strategyType !== undefined ||
    parsed.data.assetClass !== undefined ||
    parsed.data.folder !== undefined ||
    parsed.data.status !== undefined ||
    parsed.data.tags !== undefined;

  await db
    .update(aiStrategiesTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.strategyType !== undefined ? { strategyType: parsed.data.strategyType } : {}),
      ...(parsed.data.assetClass !== undefined ? { assetClass: parsed.data.assetClass } : {}),
      ...(parsed.data.folder !== undefined ? { folder: parsed.data.folder } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}),
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      ...(parsed.data.workspaceId !== undefined ? { workspaceId: parsed.data.workspaceId } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(aiStrategiesTable.id, id), eq(aiStrategiesTable.userId, userId)));

  const updated = contentChanged ? await bumpVersion(id, userId, parsed.data.changeSummary) : await loadOwnedStrategy(id, userId);
  if (!updated) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.json(formatStrategy(updated));
});

router.delete("/ai-strategies/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(aiStrategiesTable)
    .where(and(eq(aiStrategiesTable.id, id), eq(aiStrategiesTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.status(204).send();
});

// ─── Deterministic analysis (never an LLM call) ─────────────────────────

router.get("/ai-strategies/:id/missing-sections", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const sections = await loadSections(id);
  res.json(detectMissingSections(sections));
});

router.get("/ai-strategies/:id/similar", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const candidates = await db.select().from(aiStrategiesTable).where(and(eq(aiStrategiesTable.userId, userId), eq(aiStrategiesTable.archived, false)));
  const similar = findSimilarStrategies(strategy, candidates);
  res.json(similar.map((s) => ({ strategy: formatStrategy(s.strategy), score: s.score, matchedOn: s.matchedOn })));
});

// ─── Sections ───────────────────────────────────────────────────────────

router.get("/ai-strategies/:id/sections", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const sections = await loadSections(id);
  res.json(await Promise.all(sections.map(formatSection)));
});

// Creates a new section (for a multi kind: attachment/research_link/
// notebook_reference) OR upserts the singleton row for a qualitative kind
// — avoiding a second, separate PUT endpoint for the exact same shape.
router.post("/ai-strategies/:id/sections", async (req, res): Promise<void> => {
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
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  if (parsed.data.refNotebookId != null) {
    const notebook = await loadOwnedNotebook(parsed.data.refNotebookId, userId);
    if (!notebook) {
      res.status(404).json({ error: "Notebook not found" });
      return;
    }
    if (notebook.coachId !== strategy.coachId) {
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
    if (conversation.coachId !== strategy.coachId) {
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
    if (fileWorkspace.coachId !== strategy.coachId) {
      res.status(400).json({ error: "File belongs to a different coach's workspace" });
      return;
    }
  }

  const values = {
    strategyId: id,
    kind: parsed.data.kind,
    content: parsed.data.content ?? null,
    refNotebookId: parsed.data.refNotebookId ?? null,
    refConversationId: parsed.data.refConversationId ?? null,
    refFileId: parsed.data.refFileId ?? null,
  };

  let row: typeof aiStrategySectionsTable.$inferSelect;
  if (!isMultiKind(parsed.data.kind)) {
    const [existing] = await db
      .select()
      .from(aiStrategySectionsTable)
      .where(and(eq(aiStrategySectionsTable.strategyId, id), eq(aiStrategySectionsTable.kind, parsed.data.kind)));
    if (existing) {
      const [updated] = await db
        .update(aiStrategySectionsTable)
        .set({ content: values.content, updatedAt: new Date() })
        .where(eq(aiStrategySectionsTable.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [inserted] = await db.insert(aiStrategySectionsTable).values(values).returning();
      row = inserted;
    }
  } else {
    const [inserted] = await db.insert(aiStrategySectionsTable).values(values).returning();
    row = inserted;
  }

  await bumpVersion(id, userId, parsed.data.changeSummary);
  res.status(201).json(await formatSection(row));
});

router.delete("/ai-strategies/:id/sections/:sectionId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const sectionId = parseIdParam(req.params.sectionId);
  if (id === null || sectionId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const [row] = await db
    .delete(aiStrategySectionsTable)
    .where(and(eq(aiStrategySectionsTable.id, sectionId), eq(aiStrategySectionsTable.strategyId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Section not found" });
    return;
  }

  await bumpVersion(id, userId);
  res.status(204).send();
});

// ─── Versions ───────────────────────────────────────────────────────────

router.get("/ai-strategies/:id/versions", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const versions = await db.select().from(aiStrategyVersionsTable).where(eq(aiStrategyVersionsTable.strategyId, id)).orderBy(desc(aiStrategyVersionsTable.version));
  res.json(versions.map(formatVersion));
});

router.get("/ai-strategies/:id/versions/:version", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const version = parseIdParam(req.params.version);
  if (id === null || version === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(aiStrategyVersionsTable)
    .where(and(eq(aiStrategyVersionsTable.strategyId, id), eq(aiStrategyVersionsTable.version, version)));
  if (!row) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  res.json({ ...formatVersion(row), snapshot: row.snapshot });
});

router.post("/ai-strategies/:id/versions/:version/restore", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const version = parseIdParam(req.params.version);
  if (id === null || version === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const [versionRow] = await db
    .select()
    .from(aiStrategyVersionsTable)
    .where(and(eq(aiStrategyVersionsTable.strategyId, id), eq(aiStrategyVersionsTable.version, version)));
  if (!versionRow) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  const snapshot = versionRow.snapshot as StrategySnapshot;

  // Applies the snapshot's own top-level fields, replaces every section
  // row with the snapshot's own section list, then appends a brand-new
  // version representing the restore — never rewrites versionRow itself.
  await db
    .update(aiStrategiesTable)
    .set({
      title: snapshot.title,
      description: snapshot.description,
      strategyType: snapshot.strategyType,
      assetClass: snapshot.assetClass,
      folder: snapshot.folder,
      status: snapshot.status,
      tags: snapshot.tags,
      updatedAt: new Date(),
    })
    .where(eq(aiStrategiesTable.id, id));

  // v1.5.0, Sprint 22 (Release Candidate consolidation) — batched into one
  // insert call instead of one insert per row (an N+1 pattern flagged by
  // the sprint's own audit, the same fix applied to tradePlans.ts's
  // identically-shaped restore path). Behavior-preserving: same rows, same
  // values, same order.
  await db.delete(aiStrategySectionsTable).where(eq(aiStrategySectionsTable.strategyId, id));
  if (snapshot.sections.length > 0) {
    await db.insert(aiStrategySectionsTable).values(
      snapshot.sections.map((s) => ({
        strategyId: id,
        kind: s.kind,
        content: s.content,
        refNotebookId: s.refNotebookId,
        refConversationId: s.refConversationId,
        refFileId: s.refFileId,
      })),
    );
  }

  const updated = await bumpVersion(id, userId, `Restored to version ${version}`);
  res.json(formatStrategy(updated!));
});

// ─── AI features — every one an explicit, user-triggered POST; none run
// proactively, and none saves its own output automatically. ────────────

router.post("/ai-strategies/:id/ai/summarize", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const fallback = `"${strategy.title}" is a ${strategy.strategyType} strategy with ${context.sections.length} section${context.sections.length === 1 ? "" : "s"} defined.`;
  const narration = await narrateStrategySummary(context, fallback);
  res.json({ summary: narration.text, source: narration.source });
});

router.post("/ai-strategies/:id/ai/suggest-improvements", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const sections = await loadSections(id);
  const missing = detectMissingSections(sections);
  const context = { ...(await buildStrategyContext(strategy)), missingSections: missing.missing };
  const fallback =
    missing.missing.length > 0
      ? `Consider filling in these sections: ${missing.missing.join(", ")}.`
      : "Every qualitative section has content — review each for clarity and internal consistency.";
  const narration = await narrateStrategyImprovements(context, fallback);
  res.json({ improvements: narration.text, source: narration.source });
});

router.post("/ai-strategies/:id/ai/executive-summary", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const fallback = `"${strategy.title}" — a ${strategy.strategyType} strategy (status: ${strategy.status}).`;
  const narration = await narrateStrategyExecutiveSummary(context, fallback);
  res.json({ executiveSummary: narration.text, source: narration.source });
});

router.post("/ai-strategies/:id/ai/learning-notes", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const fallback = "Add psychology notes and common mistakes to generate learning notes for this strategy.";
  const narration = await narrateStrategyLearningNotes(context, fallback);
  res.json({ learningNotes: narration.text, source: narration.source });
});

router.post("/ai-strategies/:id/ai/risk-highlights", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const sections = await loadSections(id);
  const missing = detectMissingSections(sections);
  const context = { ...(await buildStrategyContext(strategy)), missingSections: missing.missing };
  const fallback = missing.missing.includes("risk") || missing.missing.includes("stop") ? "No stop-loss or risk section is defined yet — this is a significant gap." : "Review the risk and stop-loss sections for completeness.";
  const narration = await narrateStrategyRiskHighlights(context, fallback);
  res.json({ riskHighlights: narration.text, source: narration.source });
});

router.post("/ai-strategies/:id/ai/setup-checklist", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const checklist = await generateStrategySetupChecklist(context);
  res.json({ available: checklist !== null, checklist: checklist ?? [] });
});

router.post("/ai-strategies/:id/ai/trade-prep-checklist", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const checklist = await generateStrategyTradePrepChecklist(context);
  res.json({ available: checklist !== null, checklist: checklist ?? [] });
});

router.post("/ai-strategies/:id/ai/review-questions", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const strategy = await loadOwnedStrategy(id, userId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const context = await buildStrategyContext(strategy);
  const questions = await generateStrategyReviewQuestions(context);
  res.json({ available: questions !== null, questions: questions ?? [] });
});

export default router;

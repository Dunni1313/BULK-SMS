// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built as
// a distinctly-named "Opportunity Pipeline" — see this sprint's own
// lib/opportunityPipeline.ts header comment and
// docs/v1.5.0-Sprint-21-Opportunity-Discovery-Engine.md §1 for the
// disclosed naming-collision reasoning against the pre-existing Phase 15
// Opportunity Discovery stock scanner). Mirrors routes/tradingJournal.ts's
// own list/create/get/update/delete pattern directly. Every query is
// scoped via getScopedUserId(req) and the established
// and(eq(id), eq(userId)) ownership pattern — 404, never a separate 403,
// for both "doesn't exist" and "isn't yours".
//
// This route ONLY persists a user's own explicitly-captured opportunities
// and moves them through the pipeline. The discovery composition itself —
// reading Market Intelligence/Watchlists/Portfolio & Risk
// Intelligence/Knowledge Graph/Research Notes and turning them into
// candidate opportunities — happens entirely on the frontend
// (src/lib/opportunityPipeline.ts, ravish-trading) from data every one of
// those already-existing systems already exposes; nothing here duplicates
// that computation.

import { Router, type IRouter } from "express";
import { db, investingOpportunityPipelineItemsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListOpportunityPipelineItemsResponse,
  ListOpportunityPipelineItemsResponseItem,
  CaptureOpportunityPipelineItemBody,
  UpdateOpportunityPipelineItemBody,
  UpdateOpportunityPipelineItemResponse,
  DeleteOpportunityPipelineItemResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { stageLabel, nextRecommendedActionFor } from "../lib/opportunityPipeline.js";

const router: IRouter = Router();

function formatItem(row: typeof investingOpportunityPipelineItemsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    origin: row.origin,
    evidence: row.evidenceJson,
    relatedAssets: row.relatedAssetsJson,
    relatedSectors: row.relatedSectorsJson,
    priority: row.priority,
    stage: row.stage,
    stageLabel: stageLabel(row.stage),
    nextRecommendedAction: nextRecommendedActionFor(row.stage),
    linkedNotebookId: row.linkedNotebookId,
    relatedResearchSymbol: row.relatedResearchSymbol,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

router.get("/opportunity-pipeline/items", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(investingOpportunityPipelineItemsTable)
    .where(eq(investingOpportunityPipelineItemsTable.userId, userId))
    .orderBy(desc(investingOpportunityPipelineItemsTable.createdAt));
  res.json(ListOpportunityPipelineItemsResponse.parse(rows.map(formatItem)));
});

router.post("/opportunity-pipeline/items", async (req, res): Promise<void> => {
  const parsed = CaptureOpportunityPipelineItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const d = parsed.data;
  const [row] = await db
    .insert(investingOpportunityPipelineItemsTable)
    .values({
      userId,
      title: d.title,
      category: d.category,
      origin: d.origin,
      evidenceJson: d.evidence,
      relatedAssetsJson: d.relatedAssets,
      relatedSectorsJson: d.relatedSectors,
      priority: d.priority,
      stage: "discovered",
    })
    .returning();
  res.status(201).json(ListOpportunityPipelineItemsResponseItem.parse(formatItem(row)));
});

router.patch("/opportunity-pipeline/items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid opportunity pipeline item id" });
    return;
  }
  const parsed = UpdateOpportunityPipelineItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const d = parsed.data;
  const [row] = await db
    .update(investingOpportunityPipelineItemsTable)
    .set({
      ...(d.stage !== undefined ? { stage: d.stage, archivedAt: d.stage === "archived" ? new Date() : null } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.linkedNotebookId !== undefined ? { linkedNotebookId: d.linkedNotebookId } : {}),
      ...(d.relatedResearchSymbol !== undefined ? { relatedResearchSymbol: d.relatedResearchSymbol } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(investingOpportunityPipelineItemsTable.id, id), eq(investingOpportunityPipelineItemsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Opportunity pipeline item not found" });
    return;
  }
  res.json(UpdateOpportunityPipelineItemResponse.parse(formatItem(row)));
});

router.delete("/opportunity-pipeline/items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid opportunity pipeline item id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingOpportunityPipelineItemsTable)
    .where(and(eq(investingOpportunityPipelineItemsTable.id, id), eq(investingOpportunityPipelineItemsTable.userId, userId)))
    .returning({ id: investingOpportunityPipelineItemsTable.id });
  res.json(DeleteOpportunityPipelineItemResponse.parse({ success: !!row }));
});

export default router;

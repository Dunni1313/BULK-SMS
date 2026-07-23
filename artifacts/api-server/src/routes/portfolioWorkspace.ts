// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
import { Router, type IRouter } from "express";
import {
  GetPortfolioWorkspaceDashboardResponse,
  ListWorkflowDefinitionsResponse,
  ListWorkflowInstancesResponse,
  UpdateWorkflowInstanceBody,
  UpdateWorkflowInstanceResponse,
  DeleteWorkflowInstanceResponse,
  ListPinnedResourcesResponse,
  ListPinnedResourcesResponseItem,
  PinResourceBody,
  ReorderPinnedResourcesBody,
  ReorderPinnedResourcesResponse,
  ListRecentViewsResponse,
  ListRecentViewsResponseItem,
  RecordRecentViewBody,
  ListQuickActionsResponse,
  ListWorkspaceCoachTopicsResponse,
  GetWorkspaceCoachTopicResponse,
  ListWorkspaceLearningResponse,
  GetWorkspaceLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildPortfolioWorkspaceDashboard } from "../lib/portfolioWorkspace.js";
import {
  WORKFLOW_CATALOG,
  startWorkflowInstance,
  listWorkflowInstances,
  updateWorkflowInstanceStep,
  setWorkflowInstanceStatus,
  deleteWorkflowInstance,
} from "../lib/portfolioWorkflows.js";
import { listPinnedResources, pinResource, unpinResource, reorderPinnedResources, listRecentViews, recordRecentView, WORKSPACE_QUICK_ACTIONS } from "../lib/workspacePins.js";
import { allWorkspaceTopics, explainWorkspaceTopic } from "../lib/workspaceCoach.js";
import { allWorkspaceLearning, getWorkspaceLearning } from "../lib/workspaceLearning.js";

const router: IRouter = Router();

router.get("/portfolio-workspace/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildPortfolioWorkspaceDashboard(userId);
  res.json(GetPortfolioWorkspaceDashboardResponse.parse(dashboard));
});

// ─── Workflow Center ────────────────────────────────────────────────────

router.get("/portfolio-workspace/workflows", async (_req, res): Promise<void> => {
  res.json(ListWorkflowDefinitionsResponse.parse(WORKFLOW_CATALOG));
});

// Static-suffix route registered BEFORE the generic /workflows/{key}/start
// param route below — same Express registration-order discipline
// established at Phase 43 (routes/watchlists.ts).
router.get("/portfolio-workspace/workflows/instances", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const instances = await listWorkflowInstances(userId, status);
  res.json(ListWorkflowInstancesResponse.parse(instances));
});

router.post("/portfolio-workspace/workflows/:key/start", async (req, res): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const userId = await getScopedUserId(req);
  const instance = await startWorkflowInstance(userId, key);
  if (!instance) {
    res.status(404).json({ error: "Unknown workflow key" });
    return;
  }
  res.status(201).json(UpdateWorkflowInstanceResponse.parse(instance));
});

router.patch("/portfolio-workspace/workflows/instances/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid instance id" });
    return;
  }
  const parsed = UpdateWorkflowInstanceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  let instance;
  if (parsed.data.stepKey) {
    instance = await updateWorkflowInstanceStep(userId, id, parsed.data.stepKey, parsed.data.completed ?? true);
  } else if (parsed.data.status) {
    instance = await setWorkflowInstanceStatus(userId, id, parsed.data.status);
  } else {
    res.status(400).json({ error: "Either stepKey or status must be provided" });
    return;
  }
  if (!instance) {
    res.status(404).json({ error: "Instance not found, or the step key is not part of this workflow's own catalog definition" });
    return;
  }
  res.json(UpdateWorkflowInstanceResponse.parse(instance));
});

router.delete("/portfolio-workspace/workflows/instances/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid instance id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const deleted = await deleteWorkflowInstance(userId, id);
  if (!deleted) {
    res.status(404).json({ error: "Instance not found" });
    return;
  }
  res.json(DeleteWorkflowInstanceResponse.parse({ success: true }));
});

// ─── Pinned Resources (Favorites) ───────────────────────────────────────

router.get("/portfolio-workspace/pins", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const pins = await listPinnedResources(userId);
  res.json(ListPinnedResourcesResponse.parse(pins));
});

router.post("/portfolio-workspace/pins", async (req, res): Promise<void> => {
  const parsed = PinResourceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const result = await pinResource(userId, parsed.data);
  if (result === "duplicate") {
    res.status(409).json({ error: "This resource is already pinned" });
    return;
  }
  res.status(201).json(ListPinnedResourcesResponseItem.parse(result));
});

router.delete("/portfolio-workspace/pins/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid pin id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const removed = await unpinResource(userId, id);
  if (!removed) {
    res.status(404).json({ error: "Pin not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/portfolio-workspace/pins/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderPinnedResourcesBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  await reorderPinnedResources(userId, parsed.data.orderedIds);
  res.json(ReorderPinnedResourcesResponse.parse({ success: true }));
});

// ─── Recently Viewed ─────────────────────────────────────────────────────

router.get("/portfolio-workspace/recent-views", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const views = await listRecentViews(userId);
  res.json(ListRecentViewsResponse.parse(views));
});

router.post("/portfolio-workspace/recent-views", async (req, res): Promise<void> => {
  const parsed = RecordRecentViewBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const entry = await recordRecentView(userId, parsed.data);
  res.status(201).json(ListRecentViewsResponseItem.parse(entry));
});

// ─── Quick Actions ───────────────────────────────────────────────────────

router.get("/portfolio-workspace/quick-actions", async (_req, res): Promise<void> => {
  res.json(ListQuickActionsResponse.parse(WORKSPACE_QUICK_ACTIONS));
});

// ─── AI Coach ────────────────────────────────────────────────────────────

router.get("/portfolio-workspace/coach", async (_req, res): Promise<void> => {
  res.json(ListWorkspaceCoachTopicsResponse.parse(allWorkspaceTopics()));
});

router.get("/portfolio-workspace/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainWorkspaceTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetWorkspaceCoachTopicResponse.parse(explanation));
});

// ─── Learning Centre ─────────────────────────────────────────────────────

router.get("/portfolio-workspace/learning", async (_req, res): Promise<void> => {
  res.json(ListWorkspaceLearningResponse.parse(allWorkspaceLearning()));
});

router.get("/portfolio-workspace/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getWorkspaceLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown learning topic" });
    return;
  }
  res.json(GetWorkspaceLearningResponse.parse(learning));
});

export default router;

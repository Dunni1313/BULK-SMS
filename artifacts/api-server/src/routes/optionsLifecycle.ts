// Phase 36 — Institutional Position Lifecycle Manager.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own trades/lifecycle rows and handing them to
// lib/optionsLifecycle.ts's / lib/optionsPortfolioManagement.ts's /
// lib/optionsLifecycleCoach.ts's pure functions. No live brokerage
// execution, no auto trading, no auto adjustments, no AI predictions, no
// direction forecasting, no position recommendations, no trade alerts, no
// automated rolling, no automated assignment handling.

import { Router, type IRouter } from "express";
import {
  GetOptionsLifecyclePortfolioResponse,
  ListOptionsLifecycleCoachTopicsResponse,
  GetOptionsLifecycleCoachTopicResponse,
  ListOptionsLifecycleLearningResponse,
  GetOptionsLifecycleLearningResponse,
  GetOptionsLifecycleStateResponse,
  UpdateOptionsLifecycleStateBody,
  UpdateOptionsLifecycleStateResponse,
  GetOptionsLifecycleTimelineResponse,
  CreateOptionsLifecycleEventBody,
  CreateOptionsLifecycleEventResponse,
  GetOptionsLifecycleChecklistResponse,
  UpdateOptionsLifecycleChecklistItemBody,
  UpdateOptionsLifecycleChecklistItemResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildOptionsPortfolioManagementView } from "../lib/optionsPortfolioManagement.js";
import { allLifecycleTopics, explainLifecycleTopic } from "../lib/optionsLifecycleCoach.js";
import { allStageLearning, getStageLearning } from "../lib/optionsLifecycleLearning.js";
import {
  getOrCreateLifecycleState,
  setLifecycleStage,
  setReviewCadence,
  getPositionTimeline,
  logReview,
  logAdjustmentNote,
  logAssignmentNote,
  getOrCreateChecklist,
  toggleChecklistItem,
} from "../lib/optionsLifecycle.js";

const router: IRouter = Router();

function parseTradeId(raw: unknown): number | null {
  const id = parseInt(Array.isArray(raw) ? raw[0] : (raw as string), 10);
  return isNaN(id) ? null : id;
}

router.get("/options-lifecycle/portfolio", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const view = await buildOptionsPortfolioManagementView(userId);
  res.json(GetOptionsLifecyclePortfolioResponse.parse(view));
});

router.get("/options-lifecycle/coach", async (_req, res): Promise<void> => {
  res.json(ListOptionsLifecycleCoachTopicsResponse.parse(allLifecycleTopics()));
});

router.get("/options-lifecycle/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainLifecycleTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetOptionsLifecycleCoachTopicResponse.parse(explanation));
});

router.get("/options-lifecycle/learning", async (_req, res): Promise<void> => {
  res.json(ListOptionsLifecycleLearningResponse.parse(allStageLearning()));
});

router.get("/options-lifecycle/learning/:stage", async (req, res): Promise<void> => {
  const stage = Array.isArray(req.params.stage) ? req.params.stage[0] : req.params.stage;
  const learning = getStageLearning(stage);
  if (!learning) {
    res.status(404).json({ error: "Unknown lifecycle stage" });
    return;
  }
  res.json(GetOptionsLifecycleLearningResponse.parse(learning));
});

router.get("/options-lifecycle/:tradeId/state", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const state = await getOrCreateLifecycleState(userId, tradeId);
  if (!state) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  res.json(GetOptionsLifecycleStateResponse.parse(state));
});

router.patch("/options-lifecycle/:tradeId/state", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const parsed = UpdateOptionsLifecycleStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);

  const existing = await getOrCreateLifecycleState(userId, tradeId);
  if (!existing) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  if (parsed.data.stage !== undefined) {
    const updated = await setLifecycleStage(userId, tradeId, parsed.data.stage);
    if (!updated) {
      res.status(400).json({ error: "Invalid stage" });
      return;
    }
  }
  if (parsed.data.reviewCadence !== undefined) {
    const updated = await setReviewCadence(userId, tradeId, parsed.data.reviewCadence);
    if (!updated) {
      res.status(400).json({ error: "Invalid review cadence" });
      return;
    }
  }

  const final = await getOrCreateLifecycleState(userId, tradeId);
  res.json(UpdateOptionsLifecycleStateResponse.parse(final));
});

router.get("/options-lifecycle/:tradeId/timeline", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const timeline = await getPositionTimeline(userId, tradeId);
  if (!timeline) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  res.json(GetOptionsLifecycleTimelineResponse.parse(timeline));
});

router.post("/options-lifecycle/:tradeId/events", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const parsed = CreateOptionsLifecycleEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);

  let created;
  if (parsed.data.eventType === "review") {
    if (!parsed.data.reviewType) {
      res.status(400).json({ error: "reviewType is required for a review event" });
      return;
    }
    created = await logReview(userId, tradeId, parsed.data.reviewType, parsed.data.detail);
  } else if (parsed.data.eventType === "adjustment_note") {
    created = await logAdjustmentNote(userId, tradeId, parsed.data.detail);
  } else {
    created = await logAssignmentNote(userId, tradeId, parsed.data.detail);
  }

  if (!created) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  res.json(CreateOptionsLifecycleEventResponse.parse(created));
});

router.get("/options-lifecycle/:tradeId/checklist", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const strategyKeyRaw = req.query.strategyKey;
  const strategyKey = typeof strategyKeyRaw === "string" ? strategyKeyRaw : "";
  const userId = await getScopedUserId(req);
  const checklist = await getOrCreateChecklist(userId, tradeId, strategyKey);
  if (!checklist) {
    res.status(404).json({ error: "Position not found, or an unknown strategyKey (required on first read)" });
    return;
  }
  res.json(GetOptionsLifecycleChecklistResponse.parse(checklist));
});

router.patch("/options-lifecycle/:tradeId/checklist", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params.tradeId);
  if (tradeId === null) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }
  const parsed = UpdateOptionsLifecycleChecklistItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const updated = await toggleChecklistItem(userId, tradeId, parsed.data.itemId, parsed.data.checked);
  if (!updated) {
    res.status(404).json({ error: "Checklist not found" });
    return;
  }
  res.json(UpdateOptionsLifecycleChecklistItemResponse.parse(updated));
});

export default router;

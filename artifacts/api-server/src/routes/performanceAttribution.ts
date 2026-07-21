// Phase 38 — Institutional Performance & Attribution Engine.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own holdings/positions/trades and handing them to
// lib/performanceAttribution.ts's / lib/performanceAttributionCoach.ts's /
// lib/performanceAttributionLearning.ts's pure functions. Analytical only —
// no AI predictions, no forecasts, no trade recommendations, no portfolio
// optimisation, no auto rebalancing, no auto execution, no alpha
// generation, no benchmark prediction.

import { Router, type IRouter } from "express";
import {
  GetPerformanceDashboardResponse,
  ListPerformanceAttributionCoachTopicsResponse,
  GetPerformanceAttributionCoachTopicResponse,
  ListPerformanceAttributionLearningResponse,
  GetPerformanceAttributionLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildPerformanceDashboard } from "../lib/performanceAttribution.js";
import { allPerformanceAttributionTopics, explainPerformanceAttributionTopic } from "../lib/performanceAttributionCoach.js";
import { allPerformanceAttributionLearning, getPerformanceAttributionLearning } from "../lib/performanceAttributionLearning.js";

const router: IRouter = Router();

router.get("/performance-attribution/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildPerformanceDashboard(userId);
  res.json(GetPerformanceDashboardResponse.parse(dashboard));
});

router.get("/performance-attribution/coach", async (_req, res): Promise<void> => {
  res.json(ListPerformanceAttributionCoachTopicsResponse.parse(allPerformanceAttributionTopics()));
});

router.get("/performance-attribution/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainPerformanceAttributionTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetPerformanceAttributionCoachTopicResponse.parse(explanation));
});

router.get("/performance-attribution/learning", async (_req, res): Promise<void> => {
  res.json(ListPerformanceAttributionLearningResponse.parse(allPerformanceAttributionLearning()));
});

router.get("/performance-attribution/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getPerformanceAttributionLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetPerformanceAttributionLearningResponse.parse(learning));
});

export default router;

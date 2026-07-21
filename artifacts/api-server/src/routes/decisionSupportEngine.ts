// Phase 40 — Institutional Decision Support & Executive Insights Engine.
import { Router, type IRouter } from "express";
import {
  GetDecisionSupportDashboardResponse,
  ListDecisionSupportCoachTopicsResponse,
  GetDecisionSupportCoachTopicResponse,
  ListDecisionSupportLearningResponse,
  GetDecisionSupportLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildDecisionSupportDashboard } from "../lib/decisionSupportEngine.js";
import { allDecisionSupportTopics, explainDecisionSupportTopic } from "../lib/decisionSupportCoach.js";
import { allDecisionSupportLearning, getDecisionSupportLearning } from "../lib/decisionSupportLearning.js";

const router: IRouter = Router();

router.get("/decision-support/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildDecisionSupportDashboard(userId);
  res.json(GetDecisionSupportDashboardResponse.parse(dashboard));
});

router.get("/decision-support/coach", async (_req, res): Promise<void> => {
  res.json(ListDecisionSupportCoachTopicsResponse.parse(allDecisionSupportTopics()));
});

router.get("/decision-support/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainDecisionSupportTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetDecisionSupportCoachTopicResponse.parse(explanation));
});

router.get("/decision-support/learning", async (_req, res): Promise<void> => {
  res.json(ListDecisionSupportLearningResponse.parse(allDecisionSupportLearning()));
});

router.get("/decision-support/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getDecisionSupportLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetDecisionSupportLearningResponse.parse(learning));
});

export default router;

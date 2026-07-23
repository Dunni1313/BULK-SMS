// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own portfolios/positions/trades and handing them to
// lib/riskExposureEngine.ts's / lib/riskExposureCoach.ts's /
// lib/riskExposureLearning.ts's pure functions. Analytics and visibility
// only — no live execution, no auto hedging, no auto rebalancing, no
// trade/position recommendations, no AI predictions, no probability
// forecasting, no AI-based risk scoring, no automated alerts.

import { Router, type IRouter } from "express";
import {
  GetRiskExposureDashboardResponse,
  ListRiskExposureCoachTopicsResponse,
  GetRiskExposureCoachTopicResponse,
  ListRiskExposureLearningResponse,
  GetRiskExposureLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildRiskExposureDashboard } from "../lib/riskExposureEngine.js";
import { allRiskExposureTopics, explainRiskExposureTopic } from "../lib/riskExposureCoach.js";
import { allRiskExposureLearning, getRiskExposureLearning } from "../lib/riskExposureLearning.js";

const router: IRouter = Router();

router.get("/risk-exposure/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildRiskExposureDashboard(userId);
  res.json(GetRiskExposureDashboardResponse.parse(dashboard));
});

router.get("/risk-exposure/coach", async (_req, res): Promise<void> => {
  res.json(ListRiskExposureCoachTopicsResponse.parse(allRiskExposureTopics()));
});

router.get("/risk-exposure/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainRiskExposureTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetRiskExposureCoachTopicResponse.parse(explanation));
});

router.get("/risk-exposure/learning", async (_req, res): Promise<void> => {
  res.json(ListRiskExposureLearningResponse.parse(allRiskExposureLearning()));
});

router.get("/risk-exposure/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getRiskExposureLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetRiskExposureLearningResponse.parse(learning));
});

export default router;

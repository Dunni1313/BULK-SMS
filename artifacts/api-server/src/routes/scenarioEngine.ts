// Phase 39 — Institutional Scenario & Stress Testing Engine.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own holdings/positions/trades and handing them to
// lib/scenarioEngine.ts's / lib/scenarioCoach.ts's /
// lib/scenarioLearning.ts's pure functions. Analytical only — no AI
// predictions, no market forecasting, no price targets, no trade
// recommendations, no portfolio optimisation, no auto hedging, no auto
// execution, no Monte Carlo simulation, no random scenario generation.

import { Router, type IRouter } from "express";
import {
  RunScenarioDashboardBody,
  RunScenarioDashboardResponse,
  ListScenarioCoachTopicsResponse,
  GetScenarioCoachTopicResponse,
  ListScenarioLearningResponse,
  GetScenarioLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildScenarioDashboard } from "../lib/scenarioEngine.js";
import { allScenarioTopics, explainScenarioTopic } from "../lib/scenarioCoach.js";
import { allScenarioLearning, getScenarioLearning } from "../lib/scenarioLearning.js";

const router: IRouter = Router();

// A POST, not a GET, mirroring lib/portfolioStressTest.ts's own
// POST /execution/stress-test precedent — the dashboard optionally accepts
// caller-supplied "Custom percentage move" scenarios in the request body,
// on top of the fixed named presets.
router.post("/scenario-engine/dashboard", async (req, res): Promise<void> => {
  const parsed = RunScenarioDashboardBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const dashboard = await buildScenarioDashboard(userId, { customScenarios: parsed.data.customScenarios ?? undefined });
  res.json(RunScenarioDashboardResponse.parse(dashboard));
});

router.get("/scenario-engine/coach", async (_req, res): Promise<void> => {
  res.json(ListScenarioCoachTopicsResponse.parse(allScenarioTopics()));
});

router.get("/scenario-engine/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainScenarioTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetScenarioCoachTopicResponse.parse(explanation));
});

router.get("/scenario-engine/learning", async (_req, res): Promise<void> => {
  res.json(ListScenarioLearningResponse.parse(allScenarioLearning()));
});

router.get("/scenario-engine/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getScenarioLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetScenarioLearningResponse.parse(learning));
});

export default router;

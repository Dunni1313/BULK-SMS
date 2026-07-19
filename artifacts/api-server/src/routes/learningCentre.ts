// AI Teacher & Learning Centre sprint — the Learning Centre API surface.
// Educational only. Read-only, except the 2 explicit Learning Progress
// mutation routes (view/complete) — the ONLY user-state mutation this
// sprint introduces. Never contacts a broker, never creates or modifies
// an order or position, never generates a trade recommendation. Every
// piece of educational content is deterministic (lib/glossary.ts,
// lib/learningPaths.ts, lib/strategyAcademy.ts) — never an LLM call.

import { Router, type IRouter } from "express";
import {
  GetGlossaryResponse,
  GetLearningPathsResponse,
  GetLearningPathByKeyResponse,
  GetStrategyAcademyResponse,
  GetStrategyAcademyEntryByKeyResponse,
  GetLearningProgressResponse,
  GetPortfolioLessonResponse,
  RecordLearningItemViewedBody,
  RecordLearningItemViewedResponse,
  RecordLearningItemCompletedBody,
  RecordLearningItemCompletedResponse,
  RunLearningSimulationBody,
  RunLearningSimulationResponse,
} from "@workspace/api-zod";
import { searchGlossary, getGlossaryTerm, type GlossaryCategory } from "../lib/glossary.js";
import { LEARNING_PATHS, getLearningPath } from "../lib/learningPaths.js";
import { allStrategyAcademyEntries, getStrategyAcademyEntry } from "../lib/strategyAcademy.js";
import { getLearningProgress, recordViewed, recordCompleted, type LearningItemType } from "../lib/learningProgress.js";
import { explainMetric, MetricExplainerError, METRIC_CODES } from "../lib/metricExplainer.js";
import {
  simulateDelta,
  simulateTheta,
  simulateExpectedMove,
  simulatePayoff,
  simulateConcentration,
  SimulationError,
  type PayoffStrategy,
} from "../lib/interactiveSimulations.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

const VALID_ITEM_TYPES: LearningItemType[] = ["lesson", "glossary", "path", "strategy", "coach"];

// GET /learning-centre/glossary?q=&category=
router.get("/learning-centre/glossary", (req, res): void => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? (req.query.category as GlossaryCategory) : undefined;
  res.json(GetGlossaryResponse.parse(searchGlossary(q, category)));
});

// GET /learning-centre/glossary/:key
router.get("/learning-centre/glossary/:key", (req, res): void => {
  const term = getGlossaryTerm(req.params.key);
  if (!term) {
    res.status(404).json({ error: "Unknown glossary term" });
    return;
  }
  res.json(term);
});

// GET /learning-centre/paths
router.get("/learning-centre/paths", (_req, res): void => {
  res.json(GetLearningPathsResponse.parse(LEARNING_PATHS));
});

// GET /learning-centre/paths/:pathKey
router.get("/learning-centre/paths/:pathKey", (req, res): void => {
  const path = getLearningPath(req.params.pathKey);
  if (!path) {
    res.status(404).json({ error: "Unknown learning path" });
    return;
  }
  res.json(GetLearningPathByKeyResponse.parse(path));
});

// GET /learning-centre/strategy-academy
router.get("/learning-centre/strategy-academy", (_req, res): void => {
  res.json(GetStrategyAcademyResponse.parse(allStrategyAcademyEntries()));
});

// GET /learning-centre/strategy-academy/:strategy
router.get("/learning-centre/strategy-academy/:strategy", (req, res): void => {
  const entry = getStrategyAcademyEntry(req.params.strategy);
  if (!entry) {
    res.status(404).json({ error: "Unknown strategy" });
    return;
  }
  res.json(GetStrategyAcademyEntryByKeyResponse.parse(entry));
});

// GET /learning-centre/explain/:metric?tradeId= — Explain Mode. Deliberately
// kept outside the strict OpenAPI/orval typed contract: documenting a path
// parameter together with a query parameter on the same operation is a
// known Orval codegen collision, first disclosed at Sprint 40 of the
// Alpaca Paper Trading family of sprints ("GetTradingStructureParams") —
// this route's own real ?tradeId= override is fully functional server-side,
// just outside the formal typed contract, matching that established
// precedent exactly.
router.get("/learning-centre/explain/:metric", async (req, res): Promise<void> => {
  if (!METRIC_CODES.includes(req.params.metric as (typeof METRIC_CODES)[number])) {
    res.status(400).json({ error: `Unknown metric: ${req.params.metric}` });
    return;
  }
  const tradeIdRaw = req.query.tradeId;
  const tradeId = typeof tradeIdRaw === "string" && tradeIdRaw.length > 0 ? Number(tradeIdRaw) : undefined;
  if (tradeIdRaw !== undefined && (tradeId === undefined || !Number.isInteger(tradeId))) {
    res.status(400).json({ error: "tradeId must be an integer" });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const explanation = await explainMetric(req.params.metric, userId, { tradeId });
    res.json(explanation);
  } catch (err) {
    if (err instanceof MetricExplainerError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// GET /learning-centre/portfolio-lesson — Portfolio Learning Mode: bundles
// Explain Mode over the calling user's own real, current portfolio.
// Never recommends a trade.
router.get("/learning-centre/portfolio-lesson", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const codes = ["portfolio_health", "buying_power", "delta", "theta", "concentration", "event_risk"] as const;
  const items = await Promise.all(codes.map((code) => explainMetric(code, userId)));
  res.json(GetPortfolioLessonResponse.parse({ items, generatedAt: new Date().toISOString() }));
});

// GET /learning-centre/progress
router.get("/learning-centre/progress", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const progress = await getLearningProgress(userId);
  res.json(GetLearningProgressResponse.parse(progress));
});

// POST /learning-centre/progress/view — the ONLY user-state mutation this
// sprint introduces (alongside .../complete below).
router.post("/learning-centre/progress/view", async (req, res): Promise<void> => {
  const parsed = RecordLearningItemViewedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!VALID_ITEM_TYPES.includes(parsed.data.itemType as LearningItemType)) {
    res.status(400).json({ error: "Invalid itemType" });
    return;
  }
  const userId = await getScopedUserId(req);
  await recordViewed(userId, parsed.data.itemType as LearningItemType, parsed.data.itemKey);
  res.json(RecordLearningItemViewedResponse.parse({ success: true }));
});

// POST /learning-centre/progress/complete
router.post("/learning-centre/progress/complete", async (req, res): Promise<void> => {
  const parsed = RecordLearningItemCompletedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!VALID_ITEM_TYPES.includes(parsed.data.itemType as LearningItemType)) {
    res.status(400).json({ error: "Invalid itemType" });
    return;
  }
  const userId = await getScopedUserId(req);
  await recordCompleted(userId, parsed.data.itemType as LearningItemType, parsed.data.itemKey);
  res.json(RecordLearningItemCompletedResponse.parse({ success: true }));
});

// POST /learning-centre/simulate — Interactive Education. Deterministic,
// never randomness, never an LLM. Always labeled Educational Simulation /
// Not Market Data / No Trade Recommendation in the response itself.
router.post("/learning-centre/simulate", (req, res): void => {
  const parsed = RunLearningSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  try {
    let result;
    switch (body.type) {
      case "delta":
        result = simulateDelta(body.strike ?? 100, body.iv ?? 0.3, body.dte ?? 30);
        break;
      case "theta":
        result = simulateTheta(body.strike ?? 100, body.iv ?? 0.3);
        break;
      case "expected_move":
        result = simulateExpectedMove(body.price ?? 100, body.iv ?? 0.3);
        break;
      case "payoff":
        if (!body.strategy) {
          res.status(400).json({ error: "strategy is required for a payoff simulation" });
          return;
        }
        result = simulatePayoff(body.strategy as PayoffStrategy, {
          stockCostBasis: body.stockCostBasis,
          callStrike: body.callStrike,
          callPremium: body.callPremium,
          putStrike: body.putStrike,
          putPremium: body.putPremium,
          longPutStrike: body.longPutStrike,
          longCallStrike: body.longCallStrike,
          netCredit: body.netCredit,
        });
        break;
      case "concentration":
        result = simulateConcentration(body.weights ?? [40, 30, 20, 10]);
        break;
      default:
        res.status(400).json({ error: `Unknown simulation type: ${body.type}` });
        return;
    }
    res.json(RunLearningSimulationResponse.parse(result));
  } catch (err) {
    if (err instanceof SimulationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

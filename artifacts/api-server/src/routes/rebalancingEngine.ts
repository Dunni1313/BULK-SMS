// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
import { Router, type IRouter } from "express";
import { db, investingPortfoliosTable, investingHoldingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  GetRebalancingDashboardResponse,
  ProposeAllocationBody,
  ProposeAllocationResponse,
  ListRebalancingCoachTopicsResponse,
  GetRebalancingCoachTopicResponse,
  ListRebalancingLearningResponse,
  GetRebalancingLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getFundamentalsProvider } from "../lib/fundamentals.js";
import { buildRebalancingDashboard, buildProposedAllocationComparisonForPortfolio } from "../lib/rebalancingEngine.js";
import type { PortfolioHoldingInput } from "../lib/portfolioConstruction.js";
import { allRebalancingTopics, explainRebalancingTopic } from "../lib/rebalancingCoach.js";
import { allRebalancingLearning, getRebalancingLearning } from "../lib/rebalancingLearning.js";

const router: IRouter = Router();

router.get("/rebalancing/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildRebalancingDashboard(userId);
  res.json(GetRebalancingDashboardResponse.parse(dashboard));
});

router.post("/rebalancing/portfolios/:id/propose", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const parsed = ProposeAllocationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);

  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, id), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  const holdingRows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, id), eq(investingHoldingsTable.userId, userId)));
  const holdingInputs: PortfolioHoldingInput[] = holdingRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
    avgCostBasis: r.avgCostBasis,
  }));

  const provider = await getFundamentalsProvider(userId);
  const comparison = await buildProposedAllocationComparisonForPortfolio(id, holdingInputs, parsed.data.targets, provider);
  res.json(ProposeAllocationResponse.parse(comparison));
});

router.get("/rebalancing/coach", async (_req, res): Promise<void> => {
  res.json(ListRebalancingCoachTopicsResponse.parse(allRebalancingTopics()));
});

router.get("/rebalancing/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainRebalancingTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetRebalancingCoachTopicResponse.parse(explanation));
});

router.get("/rebalancing/learning", async (_req, res): Promise<void> => {
  res.json(ListRebalancingLearningResponse.parse(allRebalancingLearning()));
});

router.get("/rebalancing/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getRebalancingLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetRebalancingLearningResponse.parse(learning));
});

export default router;

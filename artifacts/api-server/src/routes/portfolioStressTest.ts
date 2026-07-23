// Portfolio Stress Test & Scenario Simulator sprint.
//
// One dedicated, read-only endpoint: builds a full What-If stress test
// via lib/portfolioStressTest.ts, which itself only ever reads local
// trade data and reuses optionsMath.ts's existing, unmodified bs() for
// every shocked repricing. Never contacts a broker execution endpoint,
// never creates, closes, or modifies an order or position, never mutates
// the trades/journal/settings tables.
import { Router, type IRouter } from "express";
import { RunPortfolioStressTestBody, RunPortfolioStressTestResponse } from "@workspace/api-zod";
import { buildPortfolioStressTest } from "../lib/portfolioStressTest.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.post("/execution/stress-test", async (req, res): Promise<void> => {
  const parsed = RunPortfolioStressTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const result = await buildPortfolioStressTest(parsed.data, userId);
  res.json(RunPortfolioStressTestResponse.parse(result));
});

export default router;

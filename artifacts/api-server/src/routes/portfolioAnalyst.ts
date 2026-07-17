// AI Portfolio Analyst — Phase 8, Sprint 3.
//
// One dedicated, read-only endpoint: builds the full executive
// portfolio briefing via lib/portfolioAnalyst.ts, itself a pure
// composition over already-existing, unmodified modules (see that
// file's own header). Never contacts a broker execution endpoint,
// never creates or modifies an order or position, never mutates the
// trades/journal/settings tables. The only write this route can ever
// trigger is the same, already-existing, at-most-once-per-calendar-day
// intelligence_snapshots insert the Institutional Intelligence Engine
// itself already performs (via buildInstitutionalIntelligence(),
// reused here) — never a second, competing write.
import { Router, type IRouter } from "express";
import { GetPortfolioAnalystResponse } from "@workspace/api-zod";
import { buildPortfolioAnalyst } from "../lib/portfolioAnalyst.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/portfolio-analyst", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildPortfolioAnalyst(userId);
  res.json(GetPortfolioAnalystResponse.parse(result));
});

export default router;

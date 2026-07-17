// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation).
//
// One dedicated, read-only endpoint: builds the full Institutional
// Intelligence result via lib/intelligenceEngine.ts, which itself only
// composes already-existing, unmodified modules (the Portfolio
// Dashboard sprint's own buildPortfolioDashboard(), and the same
// theta-income composition routes/portfolio.ts's own GET
// /portfolio/theta route already uses). Never contacts a broker
// execution endpoint, never creates or modifies an order or position,
// never mutates the trades/journal/settings tables. The only write this
// route can ever trigger is a single, at-most-once-per-calendar-day
// insert into the new intelligence_snapshots table (never more than
// once, never automatically polled).
import { Router, type IRouter } from "express";
import { GetInstitutionalIntelligenceResponse } from "@workspace/api-zod";
import { buildInstitutionalIntelligence } from "../lib/intelligenceEngine.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/intelligence", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildInstitutionalIntelligence(userId);
  res.json(GetInstitutionalIntelligenceResponse.parse(result));
});

export default router;

// AI Trade Journal — Phase 8, Sprint 4.
//
// Two dedicated, read-only endpoints: builds the full deterministic
// journal result via lib/tradeJournal.ts, itself a pure composition over
// already-existing, unmodified modules (see that file's own header).
// Never contacts a broker execution endpoint, never creates or modifies
// an order or position, never mutates the trades/journal/settings
// tables — every function here is a plain SELECT.
import { Router, type IRouter } from "express";
import { GetAITradeJournalResponse, GetTradeReviewResponse } from "@workspace/api-zod";
import { buildTradeJournal, buildSingleTradeReview } from "../lib/tradeJournal.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/trade-journal", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildTradeJournal(userId);
  res.json(GetAITradeJournalResponse.parse(result));
});

router.get("/trade-journal/:tradeId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;
  const tradeId = parseInt(raw, 10);
  if (isNaN(tradeId)) {
    res.status(400).json({ error: "Invalid tradeId" });
    return;
  }

  const userId = await getScopedUserId(req);
  const review = await buildSingleTradeReview(userId, tradeId);
  if (!review) {
    res.status(404).json({ error: "Trade review not found" });
    return;
  }
  res.json(GetTradeReviewResponse.parse(review));
});

export default router;

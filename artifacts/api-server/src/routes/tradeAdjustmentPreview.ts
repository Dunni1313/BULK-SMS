// Trade Adjustment & Roll/Convert Preview Simulator sprint.
//
// One dedicated, read-only endpoint: builds a full trade-adjustment
// preview via lib/tradeAdjustmentPreview.ts, which itself only ever reads
// local data and reuses execution.ts's existing, unmodified
// buildAdjustmentTicket()/previewAdjustmentOrder()/previewOptionOrder().
// Never contacts a broker execution endpoint, never creates or closes an
// order, never mutates the trades/journal/settings tables. Deliberately a
// distinct path from the existing, real POST /execution/adjustment/preview
// (routes/execution.ts) — that route is part of the genuine roll/convert
// submission flow (leading to /execution/adjustment/submit); this one is
// a standalone dry-run simulator with no submission path at all.
import { Router, type IRouter } from "express";
import { PreviewTradeAdjustmentBody, PreviewTradeAdjustmentResponse } from "@workspace/api-zod";
import { buildTradeAdjustmentPreview } from "../lib/tradeAdjustmentPreview.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.post("/execution/adjustment/preview-simulator", async (req, res): Promise<void> => {
  const parsed = PreviewTradeAdjustmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const result = await buildTradeAdjustmentPreview(parsed.data, userId);
  res.json(PreviewTradeAdjustmentResponse.parse(result));
});

export default router;

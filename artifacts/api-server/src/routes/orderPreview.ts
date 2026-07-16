// Paper Trading Order Preview & Risk Simulator sprint.
//
// One dedicated, read-only endpoint: builds a dry-run order preview via
// lib/orderPreview.ts, which itself only ever reads (never writes) local
// data and reuses execution.ts's existing, unmodified ticket-building
// logic. Never contacts a broker execution endpoint, never creates an
// order, never mutates the trades/journal/settings tables.
import { Router, type IRouter } from "express";
import { PreviewOrderBody, PreviewOrderResponse } from "@workspace/api-zod";
import { buildOrderPreview } from "../lib/orderPreview.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.post("/execution/order-preview", async (req, res): Promise<void> => {
  const parsed = PreviewOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const result = await buildOrderPreview(parsed.data, userId);
  res.json(PreviewOrderResponse.parse(result));
});

export default router;

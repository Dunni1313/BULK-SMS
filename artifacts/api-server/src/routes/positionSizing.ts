// Position Sizing & Portfolio Impact Calculator sprint.
//
// One dedicated, read-only endpoint: builds a full position-sizing +
// portfolio-impact analysis via lib/positionSizing.ts, which itself only
// ever reads (never writes) local data and reuses execution.ts's existing,
// unmodified ticket-building logic (via last sprint's buildOrderPreview()).
// Never contacts a broker execution endpoint, never creates an order,
// never mutates the trades/journal/settings tables.
import { Router, type IRouter } from "express";
import { PreviewPositionSizingBody, PreviewPositionSizingResponse } from "@workspace/api-zod";
import { buildPositionSizingAnalysis } from "../lib/positionSizing.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.post("/execution/position-sizing", async (req, res): Promise<void> => {
  const parsed = PreviewPositionSizingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const result = await buildPositionSizingAnalysis(parsed.data, userId);
  res.json(PreviewPositionSizingResponse.parse(result));
});

export default router;

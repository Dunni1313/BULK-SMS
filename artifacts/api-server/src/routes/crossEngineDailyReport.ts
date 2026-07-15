// Phase 5, Sprint 68 — Cross-Engine Daily Report (approved Phase 5 roadmap
// review). On-demand only: the report is computed when the user requests
// it, never on a schedule, never emailed/pushed, no cron/background job.
//
// GET /cross-engine-report returns the deterministic composition
// only (fast, no LLM call) — mirroring GET /trading/risk's own portfolio-
// wide, ownership-scoped, no-query-override shape. POST .../narrate (+ SSE
// stream variant) is a SEPARATE, explicit on-demand action, matching the
// "deterministic math stays eager and fast, LLM narration is a separate
// on-demand layer" discipline established since Sprint 19 and reaffirmed
// explicitly at Sprint 61 (Investment Committee narration) — the deterministic
// summary/data is never blocked on or replaced by the LLM call.
//
// Ownership-scoped via getScopedUserId(req), the same discipline every
// user-authored/user-scoped-composition route in this codebase uses
// (routes/tradingRisk.ts, routes/notifications.ts) — this report reads the
// calling user's own watchlist, trading positions, and options trades, never
// another user's.

import { Router, type IRouter } from "express";
import { buildCrossEngineDailyReport } from "../lib/crossEngineDailyReport.js";
import { narrateCrossEngineDailyReport, narrateCrossEngineDailyReportStream, llmAvailable } from "../lib/coachLLM.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { openSse } from "../lib/sse.js";
import { GetCrossEngineDailyReportResponse, NarrateCrossEngineDailyReportResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function narrationCacheKey(userId: string, date: string): string {
  return `cross-engine-daily:${userId}:${date}`;
}

router.get("/cross-engine-report", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildCrossEngineDailyReport(userId);
  res.json(GetCrossEngineDailyReportResponse.parse(report));
});

router.post("/cross-engine-report/narrate", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildCrossEngineDailyReport(userId);
  const n = await narrateCrossEngineDailyReport(report, report.summary, narrationCacheKey(userId, report.date));
  res.json(NarrateCrossEngineDailyReportResponse.parse({ narrative: n.text, narrativeSource: n.source }));
});

// SSE variant — same event contract as /investment-committee/narrate/stream
// (meta -> delta... -> done). Deliberately NOT in the OpenAPI/orval contract,
// matching that route's own precedent — orval only models single-shot JSON.
router.post("/cross-engine-report/narrate/stream", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildCrossEngineDailyReport(userId);
  const fallback = report.summary;

  const sse = openSse(res);
  try {
    sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
    const n = await narrateCrossEngineDailyReportStream(
      report,
      fallback,
      (t) => sse.send("delta", { text: t }),
      narrationCacheKey(userId, report.date),
    );
    sse.send("done", { narrative: n.text, narrativeSource: n.source });
  } catch (err) {
    req.log.error({ err }, "cross-engine daily report narrate stream failed");
    sse.send("error", { error: "Failed to narrate the daily report" });
  } finally {
    sse.close();
  }
});

export default router;

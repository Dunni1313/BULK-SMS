import { Router, type IRouter } from "express";
import { db, dailyReportsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  GetPortfolioHealthResponse,
  GetMarketBriefingResponse,
  GenerateDailyReportResponse,
  GetDailyReportResponse,
  ListDailyReportsResponse,
  NarrateReportComparisonBody,
  NarrateReportComparisonResponse,
  DeleteDailyReportResponse,
  ClearDailyReportsResponse,
  RestoreDailyReportsBody,
  RestoreDailyReportsResponse,
} from "@workspace/api-zod";
import { buildMarketBriefing } from "../lib/marketBriefing.js";
import {
  assembleDailyReport,
  buildReportComparison,
  comparisonFallback,
  type DailyReport,
} from "../lib/dailyReport.js";
import {
  narrateMarketBriefing,
  narrateMarketBriefingStream,
  narrateReportComparison,
  narrateReportComparisonStream,
  llmAvailable,
} from "../lib/coachLLM.js";
import { openSse } from "../lib/sse.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Deterministic fallback prose so the briefing always reads well even with no LLM.
function briefingFallback(b: ReturnType<typeof buildMarketBriefing>): string {
  const cat = b.catalysts.length
    ? ` Key catalysts: ${b.catalysts.map((c) => c.label).slice(0, 3).join(", ")}.`
    : " No major catalysts on the near-term calendar.";
  return `${b.headline} ${b.ivEnvironment}${cat}`;
}

router.get("/portfolio/health", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await assembleDailyReport(userId);
  res.json(GetPortfolioHealthResponse.parse(report.health));
});

router.get("/briefing", async (_req, res): Promise<void> => {
  const briefing = buildMarketBriefing();
  const fallback = briefingFallback(briefing);
  const n = await narrateMarketBriefing(briefing, fallback);
  res.json(
    GetMarketBriefingResponse.parse({
      briefing,
      narration: n.text,
      narrationSource: n.source,
    }),
  );
});

// Task #57 — SSE variant of /briefing. Streams the briefing prose live
// (meta → delta… → done) like the other coach stream endpoints. The
// deterministic briefing chips are still served by GET /briefing; this only
// streams the narration prose.
router.post("/briefing/stream", async (req, res): Promise<void> => {
  const briefing = buildMarketBriefing();
  const fallback = briefingFallback(briefing);
  // An explicit refresh from the client busts the cached "briefing" narration
  // so the user gets a brand-new take instead of the previously cached prose.
  const refresh = req.body?.refresh === true;

  const sse = openSse(res);
  try {
    sse.send("meta", {
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const n = await narrateMarketBriefingStream(
      briefing,
      fallback,
      (t) => sse.send("delta", { text: t }),
      refresh,
    );
    sse.send("done", {
      narration: n.text,
      narrationSource: n.source,
      cached: n.cached ?? false,
      generatedAt: n.generatedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "market briefing stream failed");
    sse.send("error", { error: "Failed to generate briefing" });
  } finally {
    sse.close();
  }
});

// Serialised report row → API DailyReport (payload holds the full structured object).
function rowToReport(row: typeof dailyReportsTable.$inferSelect): DailyReport & {
  id: number;
  briefing: string;
  briefingSource: string;
} {
  const payload = row.payload as DailyReport;
  return {
    ...payload,
    id: row.id,
    briefing: row.briefing,
    briefingSource: row.briefingSource,
  };
}

router.post("/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await assembleDailyReport(userId);
  const fallback = briefingFallback(report.market);
  const n = await narrateMarketBriefing(report.market, fallback);

  const [row] = await db
    .insert(dailyReportsTable)
    .values({
      userId,
      reportDate: report.date,
      healthScore: report.health.health.score,
      healthLabel: report.health.health.label,
      exposureScore: report.health.exposure.score,
      riskScore: report.health.riskConcentration.score,
      openPositions: report.summary.openPositions,
      redCount: report.health.threatCounts.red,
      yellowCount: report.health.threatCounts.yellow,
      netTheta: report.summary.netTheta,
      briefing: n.text,
      briefingSource: n.source,
      payload: report,
    })
    .returning();

  res.json(
    GenerateDailyReportResponse.parse({
      ...report,
      id: row.id,
      briefing: n.text,
      briefingSource: n.source,
    }),
  );
});

router.get("/reports", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(dailyReportsTable)
    .where(eq(dailyReportsTable.userId, userId))
    .orderBy(desc(dailyReportsTable.createdAt))
    .limit(limit);
  res.json(
    ListDailyReportsResponse.parse(
      rows.map((r) => ({
        id: r.id,
        reportDate: r.reportDate,
        healthScore: r.healthScore,
        healthLabel: r.healthLabel,
        exposureScore: r.exposureScore,
        riskScore: r.riskScore,
        openPositions: r.openPositions,
        redCount: r.redCount,
        yellowCount: r.yellowCount,
        netTheta: r.netTheta,
        briefing: r.briefing,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

// Bulk-clear the entire daily report history in one step. Returns the full
// deleted rows so the client can offer a short-lived "Undo" (restore) action.
router.delete("/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .delete(dailyReportsTable)
    .where(eq(dailyReportsTable.userId, userId))
    .returning();
  res.json(
    ClearDailyReportsResponse.parse({
      deleted: rows.length,
      reports: rows.map((r) => ({
        reportDate: r.reportDate,
        healthScore: r.healthScore,
        healthLabel: r.healthLabel,
        exposureScore: r.exposureScore,
        riskScore: r.riskScore,
        openPositions: r.openPositions,
        redCount: r.redCount,
        yellowCount: r.yellowCount,
        netTheta: r.netTheta,
        briefing: r.briefing,
        briefingSource: r.briefingSource,
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
      })),
    }),
  );
});

// Restore previously cleared reports (the "Undo" path for the bulk clear).
// New ids are assigned, but the original report content and createdAt are
// preserved so history ordering and the health trend chart stay correct.
router.post("/reports/restore", async (req, res): Promise<void> => {
  const parsed = RestoreDailyReportsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "reports are required" });
    return;
  }
  const { reports } = parsed.data;
  if (reports.length === 0) {
    res.json(RestoreDailyReportsResponse.parse({ restored: 0 }));
    return;
  }
  const userId = await getScopedUserId(req);
  await db.insert(dailyReportsTable).values(
    reports.map((r) => ({
      userId,
      reportDate: r.reportDate,
      healthScore: r.healthScore,
      healthLabel: r.healthLabel,
      exposureScore: r.exposureScore,
      riskScore: r.riskScore,
      openPositions: r.openPositions,
      redCount: r.redCount,
      yellowCount: r.yellowCount,
      netTheta: r.netTheta,
      briefing: r.briefing,
      briefingSource: r.briefingSource,
      payload: r.payload,
      createdAt: new Date(r.createdAt),
    })),
  );
  res.json(RestoreDailyReportsResponse.parse({ restored: reports.length }));
});

// Task #51 — plain-English narration of what changed between two reports. The
// deltas are computed deterministically (source of truth); the LLM only narrates.
router.post("/reports/compare-narration", async (req, res): Promise<void> => {
  const parsed = NarrateReportComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "fromId and toId are required" });
    return;
  }
  const { fromId, toId } = parsed.data;
  if (fromId === toId) {
    res.status(400).json({ error: "Pick two different reports to compare" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [rowA] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, fromId), eq(dailyReportsTable.userId, userId)));
  const [rowB] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, toId), eq(dailyReportsTable.userId, userId)));
  if (!rowA || !rowB) {
    res.status(404).json({ error: "One or both reports not found" });
    return;
  }

  const delta = buildReportComparison(rowToReport(rowA), rowToReport(rowB));
  const fallback = comparisonFallback(delta);
  const refresh = req.body?.refresh === true;
  const n = await narrateReportComparison(delta, fallback, `comparison:${fromId}:${toId}`, refresh);

  res.json(
    NarrateReportComparisonResponse.parse({
      narration: n.text,
      narrationSource: n.source,
    }),
  );
});

// Task #55 — SSE variant of /reports/compare-narration. Streams the prose live
// (meta → delta… → done) like the other coach stream endpoints. Validation and
// lookup failures are returned as plain JSON BEFORE the stream is opened.
router.post("/reports/compare-narration/stream", async (req, res): Promise<void> => {
  const parsed = NarrateReportComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "fromId and toId are required" });
    return;
  }
  const { fromId, toId } = parsed.data;
  if (fromId === toId) {
    res.status(400).json({ error: "Pick two different reports to compare" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [rowA] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, fromId), eq(dailyReportsTable.userId, userId)));
  const [rowB] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, toId), eq(dailyReportsTable.userId, userId)));
  if (!rowA || !rowB) {
    res.status(404).json({ error: "One or both reports not found" });
    return;
  }

  const delta = buildReportComparison(rowToReport(rowA), rowToReport(rowB));
  const fallback = comparisonFallback(delta);
  // An explicit refresh from the client busts the cached comparison narration
  // (keyed per report pair) so the user gets a brand-new take after conditions shift.
  const refresh = req.body?.refresh === true;
  const cacheKey = `comparison:${fromId}:${toId}`;

  const sse = openSse(res);
  try {
    sse.send("meta", {
      fromId,
      toId,
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const n = await narrateReportComparisonStream(
      delta,
      fallback,
      (t) => sse.send("delta", { text: t }),
      cacheKey,
      refresh,
    );
    sse.send("done", {
      narration: n.text,
      narrationSource: n.source,
      cached: n.cached ?? false,
      generatedAt: n.generatedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "report comparison stream failed");
    sse.send("error", { error: "Failed to generate summary" });
  } finally {
    sse.close();
  }
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .select()
    .from(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, id), eq(dailyReportsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(GetDailyReportResponse.parse(rowToReport(row)));
});

router.delete("/reports/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(dailyReportsTable)
    .where(and(eq(dailyReportsTable.id, id), eq(dailyReportsTable.userId, userId)))
    .returning({ id: dailyReportsTable.id });
  if (!row) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(DeleteDailyReportResponse.parse({ id: row.id, deleted: true }));
});

export default router;

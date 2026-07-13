// Task #66 — Buffett-style value-investing research & education routes.
//
// Everything here is read-only and ADVISORY/EDUCATION only — these endpoints
// never preview, schedule, or submit an order. All fundamentals are SIMULATED
// (see lib/fundamentals.ts) and labelled as such. Fair value is never fabricated:
// when it cannot be computed the valuation carries `available: false` and the UI
// shows "unavailable". The LLM only narrates around the deterministic numbers.

import { Router, type IRouter } from "express";
import {
  db,
  stockAnalysisHistoryTable,
  valueWatchlistTable,
  valueQuizResultsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  GetValueUniverseResponse,
  GetValueReportResponse,
  GenerateValueResearchBody,
  GenerateValueResearchResponse,
  GetValueHistoryResponse,
  GetValueWatchlistResponse,
  AddValueWatchlistBody,
  AddValueWatchlistResponse,
  UpdateValueWatchlistBody,
  UpdateValueWatchlistResponse,
  DeleteValueWatchlistResponse,
  GetValueLessonsResponse,
  GenerateValueQuizBody,
  GenerateValueQuizResponse,
  GradeValueQuizBody,
  GradeValueQuizResponse,
  GetFinancialStatementsResponse,
  GetIndustryComparisonResponse,
} from "@workspace/api-zod";
import { INVESTING_UNIVERSE } from "../lib/investingUniverse.js";
import { getFundamentalsProvider } from "../lib/fundamentals.js";
import { buildValueResearchReport, type ValueResearchReport } from "../lib/valueReport.js";
import { buildIndustryComparison } from "../lib/industryComparison.js";
import { analyzeInvestmentSuitability } from "../lib/valueInvesting.js";
import {
  getValueLessons,
  generateValueQuiz,
  gradeValueQuiz,
} from "../lib/valueSchool.js";
import { CoachError } from "../lib/coach.js";
import { narrateValueResearch, narrateValueResearchStream, llmAvailable } from "../lib/coachLLM.js";
import { openSse } from "../lib/sse.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function handleCoachError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof CoachError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

// Denormalised margin-of-safety string for history rows — never fabricated.
function mosText(report: ValueResearchReport): string {
  return report.valuation.available
    ? `${Math.round(report.valuation.marginOfSafety * 100)}%`
    : "unavailable";
}

// Compact deterministic context handed to the LLM narrator. The numbers here are
// the source of truth; the model only turns them into prose.
function narrationContext(report: ValueResearchReport) {
  return {
    symbol: report.symbol,
    name: report.name,
    kind: report.kind,
    dataSource: report.dataSource,
    price: report.price,
    businessQuality: { score: report.businessQuality.score, rating: report.businessQuality.rating },
    moat: { rating: report.moat.rating, durabilityYears: report.moat.durabilityYears },
    financialStrength: report.financialStrength.rating,
    valuation: report.valuation.available
      ? {
          available: true,
          fairValue: report.valuation.fairValue,
          marginOfSafety: report.valuation.marginOfSafety,
          rating: report.valuation.rating,
        }
      : { available: false, reason: report.valuation.reason },
    decision: { verdict: report.decision.verdict, conviction: report.decision.conviction },
    stockVsOptions: report.stockVsOptions.verdict,
  };
}

function narrationFallback(report: ValueResearchReport): string {
  const dataLabel = report.dataSource === "SIMULATED" ? "SIMULATED" : "live";
  const val = report.valuation.available
    ? `fair value is estimated near $${report.valuation.fairValue.toFixed(2)} (${Math.round(report.valuation.marginOfSafety * 100)}% margin of safety, ${report.valuation.rating})`
    : `fair value is unavailable from the current ${dataLabel} inputs, so no margin of safety can be judged`;
  return (
    `${report.name} (${report.symbol}) scores ${report.businessQuality.score}/100 on business quality ` +
    `with a ${report.moat.rating.toLowerCase()} moat and ${report.financialStrength.rating.toLowerCase()} balance sheet. ` +
    `At $${report.price.toFixed(2)}, ${val}. The value-investor read is ${report.decision.verdict}.`
  );
}

function summaryFromReport(report: ValueResearchReport) {
  // Re-express the already-computed engine pillars as scanner ranking numbers.
  const suitability = analyzeInvestmentSuitability(
    report.businessQuality,
    report.moat,
    report.financialStrength,
    report.valuation,
    report.stockVsOptions,
    report.decision,
  );
  return {
    symbol: report.symbol,
    name: report.name,
    kind: report.kind,
    price: report.price,
    businessQualityScore: report.businessQuality.score,
    businessQualityRating: report.businessQuality.rating,
    moatRating: report.moat.rating,
    financialStrength: report.financialStrength.rating,
    valuationRating: report.valuation.available ? report.valuation.rating : "Unavailable",
    marginOfSafety: report.valuation.available ? report.valuation.marginOfSafety : null,
    decision: report.decision.verdict,
    stockInvestmentScore: suitability.stockInvestmentScore,
    optionsSuitabilityScore: suitability.optionsSuitabilityScore,
    useCase: suitability.useCase,
    suggestedAction: suitability.suggestedAction,
    dataSource: report.dataSource,
    fetchedAt: report.fetchedAt,
    simulated: report.simulated,
  };
}

// Persist a research run and return the new history id.
async function persistResearch(report: ValueResearchReport, userId: string): Promise<number> {
  const [row] = await db
    .insert(stockAnalysisHistoryTable)
    .values({
      userId,
      symbol: report.symbol,
      analysisDate: report.asOf,
      businessQualityScore: report.businessQuality.score,
      businessQualityRating: report.businessQuality.rating,
      moatRating: report.moat.rating,
      financialStrength: report.financialStrength.rating,
      valuationRating: report.valuation.available ? report.valuation.rating : "Unavailable",
      marginOfSafety: mosText(report),
      valueInvestorDecision: report.decision.verdict,
      stockVsOptionsDecision: report.stockVsOptions.verdict,
      dataSource: report.dataSource,
      valueResearchJson: report,
    })
    .returning({ id: stockAnalysisHistoryTable.id });
  return row.id;
}

// ─── Universe headline ratings ────────────────────────────────────────────────
router.get("/value-universe", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  // Resolve the provider once so the universe loop reuses a single live/simulated
  // selection (and the live in-memory cache) rather than re-reading settings per symbol.
  const provider = await getFundamentalsProvider(userId);
  // `forceRefresh=true` bypasses the short-lived live cache for an explicit, user-
  // initiated refresh (still subject to provider rate limits). No-op for simulated.
  const forceRefresh = req.query.forceRefresh === "true" || req.query.forceRefresh === "1";
  const reports = await Promise.all(
    INVESTING_UNIVERSE.map((u) =>
      buildValueResearchReport(u.symbol, undefined, provider, undefined, { forceRefresh }, userId),
    ),
  );
  const summaries = reports
    .filter((r): r is ValueResearchReport => r !== null)
    .map(summaryFromReport);
  res.json(GetValueUniverseResponse.parse(summaries));
});

// ─── Generate research (with AI thesis) ───────────────────────────────────────
router.post("/value-research", async (req, res): Promise<void> => {
  const parsed = GenerateValueResearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(
    parsed.data.symbol,
    undefined,
    undefined,
    undefined,
    { forceRefresh: parsed.data.forceRefresh },
    userId,
  );
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${parsed.data.symbol}` });
    return;
  }
  const fallback = narrationFallback(report);
  const n = await narrateValueResearch(narrationContext(report), fallback, `value:${report.symbol}`);
  const historyId = parsed.data.persist ? await persistResearch(report, userId) : undefined;
  res.json(
    GenerateValueResearchResponse.parse({
      report,
      commentary: n.text,
      commentarySource: n.source,
      ...(historyId != null ? { historyId } : {}),
    }),
  );
});

// SSE variant of /value/research — streams the AI thesis live (meta → delta… →
// done). Deliberately NOT in the OpenAPI/orval contract (orval only models
// single-shot JSON); the frontend hand-rolls the SSE parse. A 404 for an unknown
// symbol is returned as plain JSON BEFORE the stream opens.
router.post("/value-research/stream", async (req, res): Promise<void> => {
  const parsed = GenerateValueResearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(
    parsed.data.symbol,
    undefined,
    undefined,
    undefined,
    { forceRefresh: parsed.data.forceRefresh },
    userId,
  );
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${parsed.data.symbol}` });
    return;
  }
  const fallback = narrationFallback(report);

  const sse = openSse(res);
  try {
    sse.send("meta", {
      report,
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const n = await narrateValueResearchStream(
      narrationContext(report),
      fallback,
      (t) => sse.send("delta", { text: t }),
      `value:${report.symbol}`,
    );
    const historyId = parsed.data.persist ? await persistResearch(report, userId) : undefined;
    sse.send("done", {
      commentary: n.text,
      commentarySource: n.source,
      ...(historyId != null ? { historyId } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "value research stream failed");
    sse.send("error", { error: "Failed to generate research" });
  } finally {
    sse.close();
  }
});

// ─── History ──────────────────────────────────────────────────────────────────
router.get("/value-history", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(stockAnalysisHistoryTable)
    .where(eq(stockAnalysisHistoryTable.userId, userId))
    .orderBy(desc(stockAnalysisHistoryTable.createdAt))
    .limit(limit);
  res.json(
    GetValueHistoryResponse.parse(
      rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        analysisDate: r.analysisDate,
        businessQualityScore: r.businessQualityScore,
        businessQualityRating: r.businessQualityRating,
        moatRating: r.moatRating,
        financialStrength: r.financialStrength,
        valuationRating: r.valuationRating,
        marginOfSafety: r.marginOfSafety,
        valueInvestorDecision: r.valueInvestorDecision,
        stockVsOptionsDecision: r.stockVsOptionsDecision,
        dataSource: r.dataSource,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

// ─── Watchlist (advisory only — never places an order) ────────────────────────
function watchlistItem(r: typeof valueWatchlistTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
    category: r.category,
    fairValueEstimate: r.fairValueEstimate,
    desiredBuyPrice: r.desiredBuyPrice,
    marginOfSafetyTarget: r.marginOfSafetyTarget,
    reason: r.reason,
    currentDecision: r.currentDecision,
    lastResearchedAt: r.lastResearchedAt ? r.lastResearchedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/value-watchlist", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(valueWatchlistTable)
    .where(eq(valueWatchlistTable.userId, userId))
    .orderBy(desc(valueWatchlistTable.createdAt));
  res.json(GetValueWatchlistResponse.parse(rows.map(watchlistItem)));
});

router.post("/value-watchlist", async (req, res): Promise<void> => {
  const parsed = AddValueWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const symbol = body.symbol.toUpperCase();
  const userId = await getScopedUserId(req);

  // Enrich from a fresh research run when possible (never fabricates fair value:
  // only fills it in when the deterministic valuation is actually available).
  const report = await buildValueResearchReport(symbol, undefined, undefined, undefined, undefined, userId);
  const fairValueEstimate =
    body.fairValueEstimate ??
    (report && report.valuation.available ? report.valuation.fairValue : null);
  const currentDecision = body.currentDecision ?? report?.decision.verdict ?? "WATCHLIST";

  const [row] = await db
    .insert(valueWatchlistTable)
    .values({
      userId,
      symbol,
      category: body.category ?? "Researching",
      fairValueEstimate,
      desiredBuyPrice: body.desiredBuyPrice ?? null,
      marginOfSafetyTarget: body.marginOfSafetyTarget ?? 25,
      reason: body.reason ?? "",
      currentDecision,
      lastResearchedAt: report ? new Date() : null,
    })
    .returning();
  res.json(AddValueWatchlistResponse.parse(watchlistItem(row)));
});

router.patch("/value-watchlist/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const parsed = UpdateValueWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const b = parsed.data;
  const patch: Partial<typeof valueWatchlistTable.$inferInsert> = {};
  if (b.category !== undefined) patch.category = b.category;
  if (b.fairValueEstimate !== undefined) patch.fairValueEstimate = b.fairValueEstimate;
  if (b.desiredBuyPrice !== undefined) patch.desiredBuyPrice = b.desiredBuyPrice;
  if (b.marginOfSafetyTarget !== undefined) patch.marginOfSafetyTarget = b.marginOfSafetyTarget;
  if (b.reason !== undefined) patch.reason = b.reason;
  if (b.currentDecision !== undefined) patch.currentDecision = b.currentDecision;

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(valueWatchlistTable)
    .set(patch)
    .where(and(eq(valueWatchlistTable.id, id), eq(valueWatchlistTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Watchlist item not found" });
    return;
  }
  res.json(UpdateValueWatchlistResponse.parse(watchlistItem(row)));
});

router.delete("/value-watchlist/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(valueWatchlistTable)
    .where(and(eq(valueWatchlistTable.id, id), eq(valueWatchlistTable.userId, userId)))
    .returning({ id: valueWatchlistTable.id });
  res.json(DeleteValueWatchlistResponse.parse({ success: !!row }));
});

// ─── Value Investing School ───────────────────────────────────────────────────
router.get("/value-school", (_req, res): void => {
  res.json(GetValueLessonsResponse.parse(getValueLessons()));
});

router.post("/value-quiz", (req, res): void => {
  const parsed = GenerateValueQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const quiz = generateValueQuiz(parsed.data.topic ?? "mixed", parsed.data.count ?? 5);
  res.json(GenerateValueQuizResponse.parse(quiz));
});

router.post("/value-quiz/grade", async (req, res): Promise<void> => {
  const parsed = GradeValueQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const result = gradeValueQuiz(parsed.data.quizId, parsed.data.answers);
    await db.insert(valueQuizResultsTable).values({
      userId,
      topic: result.topic,
      score: result.score,
      total: result.total,
      percent: result.percent,
    });
    res.json(GradeValueQuizResponse.parse(result));
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }
});

// ─── Full report for a symbol (param route LAST so it can't shadow the literal
// /value/* routes above) ──────────────────────────────────────────────────────
router.get("/value/:symbol", async (req, res): Promise<void> => {
  // NOTE: kept as /value/:symbol (mounts under /stock-analyst) — see router mount.
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetValueReportResponse.parse(report));
});

// Phase 2, Sprint 19 — full multi-year financial statements. Deliberately a
// separate, on-demand endpoint (not folded into /value/:symbol) so opening the
// Financial Statements tab is the only thing that triggers this heavier fetch —
// buildValueResearchReport() never calls it.
router.get("/financial-statements/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  let statements;
  try {
    statements = await provider.getFinancialStatements(req.params.symbol);
  } catch (err) {
    // Mirrors resolveFundamentals()'s honesty discipline: a live provider
    // outage/rate-limit is reported plainly, never silently swapped for a
    // SIMULATED result the user didn't ask for on this on-demand tab.
    req.log.error({ err }, "financial statements fetch failed");
    res.status(502).json({ error: "Live financial statements provider is currently unavailable." });
    return;
  }
  if (!statements) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetFinancialStatementsResponse.parse(statements));
});

// Phase 2, Sprint 20 — Industry Comparison. Deliberately a separate, on-demand
// endpoint (not folded into /value/:symbol): each peer needs its own
// Fundamentals fetch, so a full comparison costs several times the provider
// calls of viewing a single report — opening the Peers tab is the only thing
// that triggers it.
router.get("/industry-comparison/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  let comparison;
  try {
    comparison = await buildIndustryComparison(req.params.symbol, provider);
  } catch (err) {
    req.log.error({ err }, "industry comparison failed");
    res.status(502).json({ error: "Live fundamentals provider is currently unavailable." });
    return;
  }
  if (!comparison) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetIndustryComparisonResponse.parse(comparison));
});

export default router;

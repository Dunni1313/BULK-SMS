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
  investingResearchNotesTable,
  investingDecisionSnapshotsTable,
  investingDecisionNotesTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  platformNotificationsTable,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  GetValueUniverseResponse,
  GetValueReportResponse,
  GenerateValueResearchBody,
  GenerateValueResearchResponse,
  AskValueResearchBody,
  AskValueResearchResponse,
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
  GetFilingAnalysisResponse,
  GetManagementQualityAnalysisResponse,
  GetEarningsIntelligenceResponse,
  GetMacroContextResponse,
  NarrateInvestmentCommitteeBody,
  NarrateInvestmentCommitteeResponse,
  GetAllResearchNotesResponse,
  GetResearchNotesResponse,
  AddResearchNoteBody,
  AddResearchNoteResponse,
  UpdateResearchNoteBody,
  UpdateResearchNoteResponse,
  DeleteResearchNoteResponse,
  GetInvestmentThesisResponse,
  GetInstitutionalDecisionResponse,
  GetDecisionSnapshotsResponse,
  SaveDecisionSnapshotResponse,
  GetDecisionNotesResponse,
  AddDecisionNoteBody,
  AddDecisionNoteResponse,
  UpdateDecisionNoteBody,
  UpdateDecisionNoteResponse,
  DeleteDecisionNoteResponse,
  GetInvestmentMemoResponse,
  GetRecentDecisionSnapshotsResponse,
  GetCoachExplanationResponse,
} from "@workspace/api-zod";
import { INVESTING_UNIVERSE } from "../lib/investingUniverse.js";
import { getFundamentalsProvider, resolveFundamentals, type FundamentalsProvider } from "../lib/fundamentals.js";
import { buildValueResearchReport, type ValueResearchReport } from "../lib/valueReport.js";
import { buildInvestmentThesis } from "../lib/investmentThesisGenerator.js";
import { buildInvestmentMemo } from "../lib/investmentMemo.js";
import { formatNotification } from "./notifications.js";
import { buildMacroContext } from "../lib/investingMacro.js";
import { todayStr } from "../lib/deterministic.js";
import { computeWatchlistTargets } from "../lib/watchlistTargets.js";
import { buildIndustryComparison } from "../lib/industryComparison.js";
import { buildFilingAnalysis } from "../lib/filingAnalysis.js";
import { buildManagementQualityAnalysis } from "../lib/managementAnalysis.js";
import {
  buildInstitutionalDecision,
  type DecisionPortfolioContext,
  type ManagementQualityResult,
} from "../lib/decisionEngine.js";
import { buildPortfolioIntelligence } from "../lib/portfolioIntelligence.js";
import { type PortfolioHoldingInput } from "../lib/portfolioConstruction.js";
import { explainCoach, COACH_TYPES, type CoachType } from "../lib/investingCoach.js";
import { buildEarningsIntelligence } from "../lib/earningsAnalysis.js";
import { EdgarDocumentProvider, DOCUMENT_TYPES, type DocumentType } from "../lib/documentProviders.js";
import { analyzeInvestmentSuitability } from "../lib/valueInvesting.js";
import {
  getValueLessons,
  generateValueQuiz,
  gradeValueQuiz,
} from "../lib/valueSchool.js";
import { CoachError } from "../lib/coach.js";
import { computeQuizProgress } from "../lib/quizProgress.js";
import {
  narrateValueResearch,
  narrateValueResearchStream,
  narrateValueFreeform,
  narrateValueFreeformStream,
  narrateInvestmentCommitteeSynthesis,
  narrateInvestmentCommitteeSynthesisStream,
  llmAvailable,
} from "../lib/coachLLM.js";
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

// Compact summary of a discriminated-union valuation model (Graham/DCF/
// Buffett all share this `{available: true, fairValue, marginOfSafety,
// rating} | {available: false, reason}` shape) — never fabricates a value
// for a model that reports itself unavailable.
function valuationModelContext(v: { available: boolean; fairValue?: number; marginOfSafety?: number; rating?: string; reason?: string }) {
  return v.available
    ? { available: true, fairValue: v.fairValue, marginOfSafety: v.marginOfSafety, rating: v.rating }
    : { available: false, reason: v.reason };
}

// Phase 2, Sprint 30 — AI Investment Analyst. Broader grounding context for
// the free-form Q&A narrator: everything narrationContext() already passes,
// PLUS Investment Quality, Competitive Advantage, all 3 named valuation
// models + the consolidated margin of safety, the full Tom Nash pillar
// analysis, and the Investment Committee's votes/verdict — all already
// computed on `report` (Sprints 12-17), zero new provider calls. Deliberately
// excludes Industry Comparison/Earnings/Filings/Management Quality, since
// those are separate on-demand reports not present on the eager report.
function buildFreeformContext(report: ValueResearchReport) {
  return {
    ...narrationContext(report),
    investmentQuality: {
      score: report.investmentQuality.score,
      confidenceLevel: report.investmentQuality.confidenceLevel,
      strengths: report.investmentQuality.strengths,
      weaknesses: report.investmentQuality.weaknesses,
    },
    competitiveAdvantage: {
      score: report.competitiveAdvantage.score,
      classification: report.competitiveAdvantage.classification,
    },
    grahamValuation: valuationModelContext(report.grahamValuation),
    dcfValuation: valuationModelContext(report.dcfValuation),
    buffettValuation: valuationModelContext(report.buffettValuation),
    consolidatedMarginOfSafety: {
      modelsAvailable: report.consolidatedMarginOfSafety.modelsAvailable,
      averageFairValue: report.consolidatedMarginOfSafety.averageFairValue,
      averageMarginOfSafety: report.consolidatedMarginOfSafety.averageMarginOfSafety,
      agreement: report.consolidatedMarginOfSafety.agreement,
    },
    tomNash: {
      convictionScore: report.tomNash.convictionScore,
      verdict: report.tomNash.verdict,
      dataCompleteness: report.tomNash.dataCompleteness,
      pillars: {
        businessQuality: report.tomNash.businessQuality.score,
        growth: report.tomNash.growth.score,
        capitalAllocation: report.tomNash.capitalAllocation.score,
        financialStrength: report.tomNash.financialStrength.score,
        valuation: report.tomNash.valuation.score,
      },
      rationale: report.tomNash.rationale,
    },
    investmentCommittee: {
      consolidatedVerdict: report.investmentCommittee.consolidatedVerdict,
      confidenceScore: report.investmentCommittee.confidenceScore,
      agreement: report.investmentCommittee.agreement,
      votes: report.investmentCommittee.votes,
      summary: report.investmentCommittee.summary,
    },
  };
}

// Honest deterministic fallback for the free-form Q&A when the LLM is
// unavailable — never attempts to literally answer the open-ended question
// (which would require the LLM), only states that plainly alongside the
// deterministic facts the report DOES contain.
function freeformFallback(report: ValueResearchReport, question: string): string {
  return (
    `AI narration is not available right now, so I can't directly answer "${question}". ` +
    `Here is what the deterministic report shows: ${narrationFallback(report)}`
  );
}

// Phase 4, Sprint 61 — AI Investment Committee LLM-Narrated Synthesis.
// Compact context for narrating WHY the Committee reached its consolidated
// verdict — reuses report.investmentCommittee directly (already computed by
// synthesizeInvestmentCommittee(), Sprint 17), zero new computation.
function committeeNarrationContext(report: ValueResearchReport) {
  return {
    symbol: report.symbol,
    consolidatedVerdict: report.investmentCommittee.consolidatedVerdict,
    confidenceScore: report.investmentCommittee.confidenceScore,
    agreement: report.investmentCommittee.agreement,
    votes: report.investmentCommittee.votes,
  };
}

// Byte-identical to Sprint 17's own deterministic reasoning — the honest
// fallback rendered when the LLM is unavailable, never a fabricated prose
// summary.
function committeeNarrationFallback(report: ValueResearchReport): string {
  return [...report.investmentCommittee.reasoning, report.investmentCommittee.summary].join(" ");
}

// Deterministic per report state — a symbol's verdict/confidence only change
// when the underlying analysis does, so concurrent narration requests for the
// same, already-settled Committee outcome can share one LLM call.
function committeeCacheKey(report: ValueResearchReport): string {
  return `committee:${report.symbol}:${report.investmentCommittee.consolidatedVerdict}:${report.investmentCommittee.confidenceScore}`;
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

// Phase 4, Sprint 55 — Macro/Regime Side-by-Side View. A thin pass-through
// to buildMacroContext() (lib/investingMacro.ts, Phase 2 Sprint 26), which
// previously had no route of its own — only consumed internally by the Tom
// Nash Engine's pillar rationale text. Global/date-seeded, not symbol-
// scoped: no ownership scoping needed, no path parameter, always "today"
// (matching every other day-seeded proxy's own "changes only as the
// calendar date changes" contract — no query-param override this sprint,
// consistent with the plan's own "S" effort sizing for this module).
router.get("/macro", (_req, res): void => {
  res.json(GetMacroContextResponse.parse(buildMacroContext(todayStr())));
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

// ─── AI Investment Analyst — free-form Q&A (Phase 2, Sprint 30) ────────────────
// Grounded in the full assembled report (see buildFreeformContext()), including
// Tom Nash's pillar analysis and the Investment Committee's votes/verdict.
// Rebuilds the report server-side each call (same pattern as /value-research) —
// SIMULATED reports are cheap/deterministic and LIVE reports are already
// short-TTL cached in fundamentals.ts, so no additional caching is added here.
router.post("/value-research/ask", async (req, res): Promise<void> => {
  const parsed = AskValueResearchBody.safeParse(req.body);
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
  const fallback = freeformFallback(report, parsed.data.question);
  const n = await narrateValueFreeform(parsed.data.question, buildFreeformContext(report), fallback);
  res.json(AskValueResearchResponse.parse({ answer: n.text, answerSource: n.source }));
});

// SSE variant — same event contract as /value-research/stream (meta → delta… →
// done). Deliberately NOT in the OpenAPI/orval contract, matching that route's
// own precedent — orval only models single-shot JSON responses.
router.post("/value-research/ask/stream", async (req, res): Promise<void> => {
  const parsed = AskValueResearchBody.safeParse(req.body);
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
  const fallback = freeformFallback(report, parsed.data.question);

  const sse = openSse(res);
  try {
    sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
    const n = await narrateValueFreeformStream(
      parsed.data.question,
      buildFreeformContext(report),
      fallback,
      (t) => sse.send("delta", { text: t }),
    );
    sse.send("done", { answer: n.text, answerSource: n.source });
  } catch (err) {
    req.log.error({ err }, "value research ask stream failed");
    sse.send("error", { error: "Failed to answer question" });
  } finally {
    sse.close();
  }
});

// Phase 4, Sprint 61 — AI Investment Committee LLM-Narrated Synthesis.
// Deliberately a separate, on-demand route (not folded into
// synthesizeInvestmentCommittee()'s own eager output on /value/:symbol,
// which stays completely untouched, deterministic-only, and synchronous):
// narration is an LLM call, and the eager report path stays fast, the same
// discipline every on-demand module since Sprint 19 (Statements) follows.
// Rebuilds the report server-side each call (same pattern as
// /value-research/ask) — 404 for an unknown symbol, never a fabricated
// narration.
router.post("/investment-committee/narrate", async (req, res): Promise<void> => {
  const parsed = NarrateInvestmentCommitteeBody.safeParse(req.body);
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
  const n = await narrateInvestmentCommitteeSynthesis(
    committeeNarrationContext(report),
    committeeNarrationFallback(report),
    committeeCacheKey(report),
  );
  res.json(NarrateInvestmentCommitteeResponse.parse({ narrative: n.text, narrativeSource: n.source }));
});

// SSE variant — same event contract as /value-research/ask/stream (meta →
// delta… → done). Deliberately NOT in the OpenAPI/orval contract, matching
// that route's own precedent — orval only models single-shot JSON responses.
router.post("/investment-committee/narrate/stream", async (req, res): Promise<void> => {
  const parsed = NarrateInvestmentCommitteeBody.safeParse(req.body);
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
  const fallback = committeeNarrationFallback(report);

  const sse = openSse(res);
  try {
    sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
    const n = await narrateInvestmentCommitteeSynthesisStream(
      committeeNarrationContext(report),
      fallback,
      (t) => sse.send("delta", { text: t }),
      committeeCacheKey(report),
    );
    sse.send("done", { narrative: n.text, narrativeSource: n.source });
  } catch (err) {
    req.log.error({ err }, "investment committee narrate stream failed");
    sse.send("error", { error: "Failed to narrate the Investment Committee verdict" });
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
    // Phase 2, Sprint 27 — always present, always null unless the caller
    // opted into ?checkTargets=true (never fabricated, never silently stale).
    currentPrice: null as number | null,
    priceTargetCrossed: null as boolean | null,
    marginOfSafetyTargetCrossed: null as boolean | null,
  };
}

router.get("/value-watchlist", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(valueWatchlistTable)
    .where(eq(valueWatchlistTable.userId, userId))
    .orderBy(desc(valueWatchlistTable.createdAt));

  // Phase 2, Sprint 27 — opt-in only: the default GET (no query param) is
  // byte-identical to pre-Sprint-27 behavior, zero extra provider calls.
  // Resolving a fresh price per row is a real, proportional cost, so it's
  // never automatic — the same on-demand discipline every heavier lookup in
  // this file already follows (Financial Statements, Industry Comparison,
  // Filings, Earnings).
  if (req.query.checkTargets === "true") {
    const provider = await getFundamentalsProvider(userId);
    const items = await Promise.all(
      rows.map(async (r) => ({ ...watchlistItem(r), ...(await computeWatchlistTargets(r, provider)) })),
    );
    res.json(GetValueWatchlistResponse.parse(items));
    return;
  }

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

// ─── Research Notes (Phase 12) ─────────────────────────────────────────────────
// Free-text, per-user, per-symbol notes. Deliberately NOT tied to a watchlist
// row by foreign key — a note can exist for a symbol never added to (or since
// removed from) the watchlist, matching journal_entries.trade_id's own loose,
// unenforced-reference precedent. Never fabricated, never AI-generated: this is
// the user's own durable, free-text record.
function researchNoteItem(r: typeof investingResearchNotesTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// Phase 17 — Institutional Workspace. The only genuine backend gap this
// phase found: no way to list a user's own research notes across every
// symbol (only a per-symbol lookup existed). Needed for the Workspace's
// left-sidebar "Notes" section — reuses the exact same researchNoteItem()
// formatter and table, zero new business logic, just a missing filter-free
// read. Declared before the parameterized /research-notes/:symbol route in
// this file for readability only — Express matches these as distinct paths
// regardless of declaration order (different segment counts).
router.get("/research-notes", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(investingResearchNotesTable)
    .where(eq(investingResearchNotesTable.userId, userId))
    .orderBy(desc(investingResearchNotesTable.createdAt));
  res.json(GetAllResearchNotesResponse.parse(rows.map(researchNoteItem)));
});

router.get("/research-notes/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const symbol = req.params.symbol.toUpperCase();
  const rows = await db
    .select()
    .from(investingResearchNotesTable)
    .where(and(eq(investingResearchNotesTable.userId, userId), eq(investingResearchNotesTable.symbol, symbol)))
    .orderBy(desc(investingResearchNotesTable.createdAt));
  res.json(GetResearchNotesResponse.parse(rows.map(researchNoteItem)));
});

router.post("/research-notes", async (req, res): Promise<void> => {
  const parsed = AddResearchNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(investingResearchNotesTable)
    .values({ userId, symbol: parsed.data.symbol.toUpperCase(), note: parsed.data.note })
    .returning();
  res.json(AddResearchNoteResponse.parse(researchNoteItem(row)));
});

router.patch("/research-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid research note id" });
    return;
  }
  const parsed = UpdateResearchNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingResearchNotesTable)
    .set({ note: parsed.data.note, updatedAt: new Date() })
    .where(and(eq(investingResearchNotesTable.id, id), eq(investingResearchNotesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Research note not found" });
    return;
  }
  res.json(UpdateResearchNoteResponse.parse(researchNoteItem(row)));
});

router.delete("/research-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid research note id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingResearchNotesTable)
    .where(and(eq(investingResearchNotesTable.id, id), eq(investingResearchNotesTable.userId, userId)))
    .returning({ id: investingResearchNotesTable.id });
  res.json(DeleteResearchNoteResponse.parse({ success: !!row }));
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

// GET /value-quiz/progress — AI Teacher & Learning Centre sprint: the Value
// Investing quiz previously had no progress endpoint at all (unlike the
// Greeks quiz's own GET /coach/quiz/progress) — this closes that gap by
// reusing the exact same shared aggregation (lib/quizProgress.ts's
// computeQuizProgress(), extracted from routes/coach.ts, zero duplicated
// streak/improvement math) against value_quiz_results instead of
// greeks_quiz_results.
router.get("/value-quiz/progress", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(valueQuizResultsTable)
    .where(eq(valueQuizResultsTable.userId, userId))
    .orderBy(desc(valueQuizResultsTable.createdAt))
    .limit(50);
  const history = await db
    .select({
      topic: valueQuizResultsTable.topic,
      score: valueQuizResultsTable.score,
      total: valueQuizResultsTable.total,
      percent: valueQuizResultsTable.percent,
      createdAt: valueQuizResultsTable.createdAt,
    })
    .from(valueQuizResultsTable)
    .where(eq(valueQuizResultsTable.userId, userId))
    .orderBy(asc(valueQuizResultsTable.createdAt));
  res.json(computeQuizProgress(rows, history));
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

// Phase 12 — Investment Thesis Generator. Deterministic, template-based,
// zero LLM calls: rebuilds the same ValueResearchReport /value/:symbol
// itself builds (no new provider calls, no new scoring), then composes it
// into a structured thesis via lib/investmentThesisGenerator.ts. 404 for an
// unresolvable symbol, matching every other per-symbol route in this file.
router.get("/investment-thesis/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetInvestmentThesisResponse.parse(buildInvestmentThesis(report)));
});

// Phase 14 — Institutional Investment Decision Engine. Pure composition over
// the same ValueResearchReport /value/:symbol itself builds (no duplicate
// scoring), plus an optional Management Quality reuse (honestly unavailable
// when Document Intelligence/EDGAR can't resolve a filing — never blocks the
// rest of the decision) and an optional portfolio context resolved from the
// caller's own portfolio via the already-shipped buildPortfolioIntelligence()
// (Phase 13) when ?portfolioId= is supplied.
// Exported (Phase 22 — Institutional Reporting & Client Presentation Engine)
// so routes/institutionalReporting.ts can reuse this exact composition
// instead of duplicating it — the same "extract on the second real
// consumer" precedent this codebase has followed since
// classifyMarginOfSafety()/historyConsistencyScore()/formatNotification().
// Zero behavior change: these two functions are otherwise untouched.
export async function resolveDecisionManagementQuality(
  symbol: string,
  provider: FundamentalsProvider,
  userId: string,
): Promise<ManagementQualityResult> {
  try {
    const mgmt = await buildManagementQualityAnalysis(symbol, edgarDocumentProvider, provider, "10-K", undefined, userId);
    if (!mgmt) return { available: false, score: null, reason: "Unknown symbol." };
    if (mgmt.score == null) return { available: false, score: null, reason: mgmt.confidenceExplanation || "Management Quality could not be scored for this symbol." };
    return { available: true, score: mgmt.score };
  } catch {
    return { available: false, score: null, reason: "Management Quality analysis is currently unavailable (Document Intelligence could not resolve a filing)." };
  }
}

export async function resolveDecisionPortfolioContext(
  report: ValueResearchReport,
  portfolioId: number,
  userId: string,
): Promise<DecisionPortfolioContext | null> {
  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, portfolioId), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) return null;

  const holdingRows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, portfolioId), eq(investingHoldingsTable.userId, userId)));
  const holdingInputs: PortfolioHoldingInput[] = holdingRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    avgCostBasis: r.avgCostBasis,
    notes: r.notes,
  }));

  const provider = await getFundamentalsProvider(userId);
  const intelligence = await buildPortfolioIntelligence(holdingInputs, provider);
  const held = intelligence.holdings.find((h) => h.symbol === report.symbol.toUpperCase());
  const sectorSlice = report.sector ? intelligence.allocation.bySector.find((s) => s.label === report.sector) : undefined;

  return {
    portfolioId,
    alreadyHeld: !!held,
    currentWeightPct: held?.weightPct ?? null,
    sectorExposurePct: sectorSlice?.weightPct ?? null,
    diversificationScore: intelligence.diversificationScore.score,
    portfolioRiskScore: intelligence.risk.overall.score,
  };
}

router.get("/decision/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const managementQuality = await resolveDecisionManagementQuality(report.symbol, provider, userId);

  const portfolioIdRaw = req.query.portfolioId;
  const portfolioId = typeof portfolioIdRaw === "string" && Number.isInteger(Number(portfolioIdRaw)) ? Number(portfolioIdRaw) : null;
  const portfolioContext = portfolioId != null ? await resolveDecisionPortfolioContext(report, portfolioId, userId) : null;

  const decision = buildInstitutionalDecision(report, managementQuality, portfolioContext);
  res.json(GetInstitutionalDecisionResponse.parse(decision));
});

function decisionSnapshotItem(r: typeof investingDecisionSnapshotsTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
    recommendation: r.recommendation,
    confidence: r.confidence,
    analysis: r.analysisJson,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/decision/:symbol/snapshots", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const symbol = req.params.symbol.toUpperCase();
  const rows = await db
    .select()
    .from(investingDecisionSnapshotsTable)
    .where(and(eq(investingDecisionSnapshotsTable.userId, userId), eq(investingDecisionSnapshotsTable.symbol, symbol)))
    .orderBy(desc(investingDecisionSnapshotsTable.createdAt));
  res.json(GetDecisionSnapshotsResponse.parse(rows.map(decisionSnapshotItem)));
});

router.post("/decision/:symbol/snapshots", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const managementQuality = await resolveDecisionManagementQuality(report.symbol, provider, userId);
  const decision = buildInstitutionalDecision(report, managementQuality, null);
  const [row] = await db
    .insert(investingDecisionSnapshotsTable)
    .values({
      userId,
      symbol: report.symbol,
      recommendation: decision.recommendation,
      confidence: decision.confidence,
      analysisJson: decision,
    })
    .returning();
  res.json(SaveDecisionSnapshotResponse.parse(decisionSnapshotItem(row)));
});

function decisionNoteItem(r: typeof investingDecisionNotesTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/decision/:symbol/notes", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const symbol = req.params.symbol.toUpperCase();
  const rows = await db
    .select()
    .from(investingDecisionNotesTable)
    .where(and(eq(investingDecisionNotesTable.userId, userId), eq(investingDecisionNotesTable.symbol, symbol)))
    .orderBy(desc(investingDecisionNotesTable.createdAt));
  res.json(GetDecisionNotesResponse.parse(rows.map(decisionNoteItem)));
});

router.post("/decision/:symbol/notes", async (req, res): Promise<void> => {
  const parsed = AddDecisionNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(investingDecisionNotesTable)
    .values({ userId, symbol: req.params.symbol.toUpperCase(), note: parsed.data.note })
    .returning();
  res.json(AddDecisionNoteResponse.parse(decisionNoteItem(row)));
});

router.patch("/decision/notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid decision note id" });
    return;
  }
  const parsed = UpdateDecisionNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingDecisionNotesTable)
    .set({ note: parsed.data.note, updatedAt: new Date() })
    .where(and(eq(investingDecisionNotesTable.id, id), eq(investingDecisionNotesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Decision note not found" });
    return;
  }
  res.json(UpdateDecisionNoteResponse.parse(decisionNoteItem(row)));
});

router.delete("/decision/notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid decision note id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingDecisionNotesTable)
    .where(and(eq(investingDecisionNotesTable.id, id), eq(investingDecisionNotesTable.userId, userId)))
    .returning({ id: investingDecisionNotesTable.id });
  res.json(DeleteDecisionNoteResponse.parse({ success: !!row }));
});

// Phase 19 — Institutional Investment Committee Workbench. Cross-symbol
// decision-snapshot history for the calling user, powering the Workbench's
// Committee Dashboard / Active Reviews. Reuses investing_decision_snapshots
// (Phase 14) and its own decisionSnapshotItem formatter unmodified — the
// only change from GET /decision/:symbol/snapshots is removing the symbol
// filter and capping the result. Zero new persistence.
router.get("/decision/snapshots/recent", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(investingDecisionSnapshotsTable)
    .where(eq(investingDecisionSnapshotsTable.userId, userId))
    .orderBy(desc(investingDecisionSnapshotsTable.createdAt))
    .limit(20);
  res.json(GetRecentDecisionSnapshotsResponse.parse(rows.map(decisionSnapshotItem)));
});

// Phase 19 — Institutional Investment Committee Workbench. A deterministic
// Investment Memo assembled entirely from already-computed outputs: the
// same ValueResearchReport /value/:symbol builds, the same
// InstitutionalDecisionAnalysis /decision/:symbol builds (reusing the exact
// same resolveDecisionManagementQuality/resolveDecisionPortfolioContext
// helpers), the user's own Research Notes (same query as
// GET /research-notes/:symbol), and the user's own Monitoring alerts for
// this symbol (same platform_notifications table GET /notifications reads,
// filtered here by relatedSymbol, formatted via that route's own exported
// formatNotification — zero duplicated field mapping). No new scoring, no
// new persistence, no LLM call.
router.get("/investment-memo/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const managementQuality = await resolveDecisionManagementQuality(report.symbol, provider, userId);

  const portfolioIdRaw = req.query.portfolioId;
  const portfolioId = typeof portfolioIdRaw === "string" && Number.isInteger(Number(portfolioIdRaw)) ? Number(portfolioIdRaw) : null;
  const portfolioContext = portfolioId != null ? await resolveDecisionPortfolioContext(report, portfolioId, userId) : null;

  const decision = buildInstitutionalDecision(report, managementQuality, portfolioContext);

  const [noteRows, alertRows] = await Promise.all([
    db
      .select()
      .from(investingResearchNotesTable)
      .where(and(eq(investingResearchNotesTable.userId, userId), eq(investingResearchNotesTable.symbol, report.symbol)))
      .orderBy(desc(investingResearchNotesTable.createdAt)),
    db
      .select()
      .from(platformNotificationsTable)
      .where(and(eq(platformNotificationsTable.userId, userId), eq(platformNotificationsTable.relatedSymbol, report.symbol)))
      .orderBy(desc(platformNotificationsTable.createdAt)),
  ]);

  const memo = buildInvestmentMemo(
    report,
    decision,
    noteRows.map((n) => ({ note: n.note, createdAt: n.createdAt.toISOString() })),
    alertRows.map(formatNotification),
  );
  res.json(GetInvestmentMemoResponse.parse(memo));
});

// Phase 21 — Institutional AI Coach & Education Platform. Pure orchestration:
// reuses the exact same buildValueResearchReport/buildInstitutionalDecision/
// resolveDecisionManagementQuality/resolveDecisionPortfolioContext helpers the
// /decision/:symbol and /investment-memo/:symbol routes already call above,
// plus this symbol's own Monitoring alerts (same platform_notifications query
// as /investment-memo/:symbol). No new scoring, no new persistence, no LLM
// call — see lib/investingCoach.ts's own header comment for the full reuse
// map. 400 for an unrecognized coach type, 404 for an unresolvable symbol.
router.get("/coach/:coach/:symbol", async (req, res): Promise<void> => {
  const coach = req.params.coach as CoachType;
  if (!COACH_TYPES.includes(coach)) {
    res.status(400).json({ error: `Unknown coach type: ${req.params.coach}. Valid coaches: ${COACH_TYPES.join(", ")}` });
    return;
  }

  const userId = await getScopedUserId(req);
  const report = await buildValueResearchReport(req.params.symbol, undefined, undefined, undefined, undefined, userId);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  const provider = await getFundamentalsProvider(userId);
  const managementQuality = await resolveDecisionManagementQuality(report.symbol, provider, userId);

  const portfolioIdRaw = req.query.portfolioId;
  const portfolioId = typeof portfolioIdRaw === "string" && Number.isInteger(Number(portfolioIdRaw)) ? Number(portfolioIdRaw) : null;
  const portfolioContext = portfolioId != null ? await resolveDecisionPortfolioContext(report, portfolioId, userId) : null;

  const decision = buildInstitutionalDecision(report, managementQuality, portfolioContext);

  const alertRows = await db
    .select()
    .from(platformNotificationsTable)
    .where(and(eq(platformNotificationsTable.userId, userId), eq(platformNotificationsTable.relatedSymbol, report.symbol)))
    .orderBy(desc(platformNotificationsTable.createdAt));

  const explanation = explainCoach(coach, {
    report,
    decision,
    portfolioContext,
    alerts: alertRows.map(formatNotification),
  });
  res.json(GetCoachExplanationResponse.parse(explanation));
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

// Phase 2, Sprint 22 — Document Intelligence Engine (Annual Report Analysis).
// Deliberately a separate, on-demand endpoint (not folded into /value/:symbol):
// fetching and extracting a filing is far heavier than a fundamentals fetch.
// Never 502s for a missing/unreachable filing (that's an honest
// documentAvailable:false in a normal 200) — only a genuinely unknown symbol
// 404s, matching every other stock-analyst route's contract.
const edgarDocumentProvider = new EdgarDocumentProvider();

// Phase 4, Sprint 60 — an optional ?documentType= override, defaulting to
// "10-K" (byte-identical to every pre-Sprint-60 caller that never passed
// one). Only "10-K"/"10-Q" produce real extracted content today
// (EdgarDocumentProvider's own EDGAR_SUPPORTED_TYPES); any other syntactically
// valid DocumentType (e.g. "earnings-transcript", already anticipated in the
// union for future work per the approved, narrowed Sprint 60 scope) is
// accepted here too and honestly degrades to documentAvailable:false via
// buildFilingAnalysis()'s own existing catch — never a 502, never fabricated.
// A value outside the DocumentType union entirely (a typo, garbage input) is
// the one thing this rejects, with a 400.
function parseDocumentTypeQuery(req: { query: Record<string, unknown> }): DocumentType | undefined {
  const raw = req.query.documentType;
  if (raw === undefined) return "10-K";
  if (typeof raw === "string" && (DOCUMENT_TYPES as readonly string[]).includes(raw)) {
    return raw as DocumentType;
  }
  return undefined;
}

router.get("/filings/:symbol", async (req, res): Promise<void> => {
  const documentType = parseDocumentTypeQuery(req);
  if (!documentType) {
    res.status(400).json({ error: `Invalid documentType. Expected one of: ${DOCUMENT_TYPES.join(", ")}` });
    return;
  }
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  let analysis;
  try {
    analysis = await buildFilingAnalysis(req.params.symbol, edgarDocumentProvider, provider, documentType, undefined, userId);
  } catch (err) {
    req.log.error({ err }, "filing analysis failed");
    res.status(502).json({ error: "Filing analysis is currently unavailable." });
    return;
  }
  if (!analysis) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetFilingAnalysisResponse.parse(analysis));
});

// Phase 2, Sprint 23 — Management Quality Analysis Engine. Deliberately a
// separate, on-demand endpoint (not folded into /value/:symbol or
// /filings/:symbol): it depends on the same heavier EDGAR fetch as Filings,
// and passes persist:false to buildFilingAnalysis() so it never writes a
// duplicate investing_filing_analysis row. Never 502s for a missing/
// unreachable filing (dimensions honestly report unavailable in a normal
// 200) — only a genuinely unknown symbol 404s.
router.get("/management-quality/:symbol", async (req, res): Promise<void> => {
  const documentType = parseDocumentTypeQuery(req);
  if (!documentType) {
    res.status(400).json({ error: `Invalid documentType. Expected one of: ${DOCUMENT_TYPES.join(", ")}` });
    return;
  }
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  let analysis;
  try {
    analysis = await buildManagementQualityAnalysis(req.params.symbol, edgarDocumentProvider, provider, documentType, undefined, userId);
  } catch (err) {
    req.log.error({ err }, "management quality analysis failed");
    res.status(502).json({ error: "Management quality analysis is currently unavailable." });
    return;
  }
  if (!analysis) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetManagementQualityAnalysisResponse.parse(analysis));
});

// Phase 2, Sprint 25 — Earnings Intelligence Engine. Deliberately a separate,
// on-demand endpoint (not folded into /value/:symbol): buildValueResearchReport()
// never gains an earnings-shaped field this sprint. Mirrors Financial
// Statements' honest-502-on-live-failure / 404-on-unknown-symbol contract.
router.get("/earnings/:symbol", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);
  let analysis;
  try {
    analysis = await buildEarningsIntelligence(req.params.symbol, provider);
  } catch (err) {
    req.log.error({ err }, "earnings intelligence fetch failed");
    res.status(502).json({ error: "Live earnings provider is currently unavailable." });
    return;
  }
  if (!analysis) {
    res.status(404).json({ error: `Unknown symbol: ${req.params.symbol}` });
    return;
  }
  res.json(GetEarningsIntelligenceResponse.parse(analysis));
});

export default router;

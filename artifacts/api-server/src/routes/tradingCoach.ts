// Phase 3, Sprint 47 — Institutional Trading Engine, AI Trade Coach
// (approved Phase 3 plan §17; see docs/Phase-3-Trading-Engine-Execution-
// Plan.md's Sprint 47 as-built note).
//
// Objective (§17): the third proof point of the deterministic-math ->
// ai-core narration -> enforced-disclaimer shape, after the options coach
// and Engine 1's value coach (Phase 2 Sprint 30). This is a pure
// COMPOSITION layer over every prior Engine 2 module — it introduces no
// new trading calculations, only assembles their already-computed outputs
// into one grounding object for the LLM.
//
// One call, buildProbabilityAnalysis(symbol, provider), transitively
// resolves the Probability Engine (Sprint 37), the Market Regime Engine
// (Sprint 36, via ProbabilityAnalysis.regime), the Multi-Timeframe Trend
// Engine (Sprint 34, via regime.multiTimeframe), the Liquidity Engine
// (Sprint 35, via regime.liquidity), and the Market Structure Engine
// (Sprint 33, via each of multiTimeframe.timeframes[].structure) — zero
// duplicate candle fetches, exactly mirroring Sprint 38's own
// buildTradingRiskAnalysis() reuse of this same regime-resolution chain.
// A second call, buildTradingRiskAnalysis(), reuses the Risk Management
// Engine (Sprint 38) over the calling user's own trading_positions. A
// direct DB query reuses the Trading Journal's own table (Sprint 39,
// unmodified) for the user's most recent reflections, the same
// eq(userId)-scoped read routes/tradingJournal.ts already performs.
//
// Every grounding fact is either a real (SIMULATED or LIVE) engine output
// or an honest null/unavailable — narrateTradeFreeform()'s own prompt
// (coachLLM.ts) explicitly instructs the model to say so rather than
// invent an answer when a question falls outside the DATA, the exact
// discipline valueFreeformPrompt already established (Sprint 30).
//
// 404 for an unresolvable symbol, matching every other per-symbol Engine 2
// route's honest-degradation contract. No live broker, Level 2,
// order-flow, or execution data anywhere in this module.

import { Router, type IRouter } from "express";
import {
  db,
  tradingPositionsTable,
  tradingJournalEntriesTable,
  tradingTradePlansTable,
  tradingStrategiesTable,
  tradingStrategyChecklistsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { buildProbabilityAnalysis, type ProbabilityAnalysis } from "../lib/tradingProbability.js";
import {
  buildTradingRiskAnalysis,
  type TradingPositionInput,
  type TradingRiskAnalysisWithContext,
} from "../lib/tradingRisk.js";
import { getMarketDataProvider, type MarketDataProvider } from "../lib/tradingMarketData.js";
import {
  TRADING_COACH_TYPES,
  SYMBOL_SCOPED_TRADING_COACHES,
  ACCOUNT_SCOPED_TRADING_COACHES,
  type TradingCoachType,
  explainStructureCoach,
  explainLiquidityCoach,
  explainSessionCoach,
  explainRiskCoach,
  explainTradePlanCoach,
  explainJournalCoach,
  explainPsychologyCoach,
  explainScenarioCoach,
  explainStrategyCoach,
} from "../lib/tradingCoach.js";
import type { StrategyChecklistItemState, StrategyCategory, EvidenceSourceType } from "../lib/tradingStrategyFramework.js";
import type { Timeframe } from "../lib/tradingMarketData.js";
import { computeScenarioComparison, MIN_SCENARIOS, MAX_SCENARIOS } from "../lib/tradingScenarioComparison.js";
import {
  GetTradingCoachExplanationResponse,
  GetTradingCoachAccountExplanationResponse,
  GetTradingCoachStrategyExplanationResponse,
  ExplainTradingScenarioBody,
  ExplainTradingScenarioResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getSettingsRow } from "../lib/serverState.js";
import { narrateTradeFreeform, narrateTradeFreeformStream, llmAvailable } from "../lib/coachLLM.js";
import { openSse } from "../lib/sse.js";
import { buildSessionData } from "../lib/trading/sessionService.js";
import type { SessionData } from "../lib/tradingDomainModel.js";
import { AskTradingCoachBody, AskTradingCoachResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// How many of the user's own most recent journal entries to surface as
// context — a bounded "recent reflections" read, not a full history dump.
const RECENT_JOURNAL_ENTRIES_LIMIT = 5;

async function gatherUserContext(userId: string, provider: MarketDataProvider) {
  const positionRows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  const positions: TradingPositionInput[] = positionRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side === "short" ? "short" : "long",
    status: r.status === "closed" ? "closed" : "open",
    quantity: r.quantity,
    entryPrice: r.entryPrice,
    stopPrice: r.stopPrice ?? null,
    targetPrice: r.targetPrice ?? null,
  }));

  const settings = await getSettingsRow(userId);
  const risk = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);

  const journalRows = await db
    .select()
    .from(tradingJournalEntriesTable)
    .where(eq(tradingJournalEntriesTable.userId, userId))
    .orderBy(desc(tradingJournalEntriesTable.createdAt))
    .limit(RECENT_JOURNAL_ENTRIES_LIMIT);

  return { risk, journalRows };
}

function buildTradeCoachContext(
  probability: ProbabilityAnalysis,
  risk: TradingRiskAnalysisWithContext,
  journalRows: (typeof tradingJournalEntriesTable.$inferSelect)[],
  session: SessionData | null,
) {
  const regime = probability.regime;
  const multiTimeframe = regime.multiTimeframe;

  return {
    symbol: probability.symbol,
    dataSource: probability.dataSource,
    currentPrice: probability.currentPrice,
    // Phase 27 — Institutional Liquidity & Session Workbench. Reuses
    // sessionService.ts's own buildSessionData() unmodified — the coach
    // previously had no session-hours awareness at all. Honestly null
    // when the symbol's own session data can't be resolved (never
    // fabricated), matching every other honest-null field in this context.
    session: session
      ? {
          activeSessions: session.activeSessions,
          sessionHigh: session.sessionHigh,
          sessionLow: session.sessionLow,
        }
      : null,
    structure: multiTimeframe.timeframes.map((tf) => ({
      interval: tf.interval,
      trend: tf.structure.trend,
      confidenceLevel: tf.structure.confidenceLevel,
      summary: tf.structure.summary,
    })),
    multiTimeframe: {
      dominantTrend: multiTimeframe.dominantTrend,
      trendAgreement: multiTimeframe.trendAgreement,
      confluenceScore: multiTimeframe.confluenceScore,
      confidenceLevel: multiTimeframe.confidenceLevel,
      summary: multiTimeframe.summary,
    },
    liquidity: {
      liquidityBand: regime.liquidity.liquidityBand,
      avgDollarVolume: regime.liquidity.avgDollarVolume,
      buySellPressure: regime.liquidity.buySellPressure,
      confidenceLevel: regime.liquidity.confidenceLevel,
      summary: regime.liquidity.summary,
    },
    regime: {
      regimeLabel: regime.regimeLabel,
      volatilityRegime: regime.volatilityRegime,
      volatilityAnnualizedPct: regime.volatilityAnnualizedPct,
      confidenceLevel: regime.confidenceLevel,
      summary: regime.summary,
    },
    probability: {
      available: probability.available,
      unavailableReason: probability.unavailableReason,
      volatilityAnnualizedPct: probability.volatilityAnnualizedPct,
      cone: probability.cone,
      confidenceLevel: probability.confidenceLevel,
      summary: probability.summary,
    },
    portfolioRisk: {
      overall: risk.overall,
      positionSizing: {
        label: risk.positionSizing.label,
        detail: risk.positionSizing.detail,
        capBreached: risk.positionSizing.capBreached,
      },
      stopDiscipline: { label: risk.stopDiscipline.label, detail: risk.stopDiscipline.detail },
      portfolioBudget: {
        label: risk.portfolioBudget.label,
        detail: risk.portfolioBudget.detail,
        capBreached: risk.portfolioBudget.capBreached,
      },
      openPositionsCount: risk.openPositionsCount,
      accountValue: risk.accountValue,
    },
    recentJournalReflections: journalRows.map((e) => ({
      title: e.title,
      mood: e.mood,
      lessonLearned: e.lessonLearned ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

function tradeCoachFallback(probability: ProbabilityAnalysis, risk: TradingRiskAnalysisWithContext, question: string): string {
  const regime = probability.regime;
  const mtf = regime.multiTimeframe;
  return (
    `AI narration is not available right now, so I can't directly answer "${question}". ` +
    `Here is what the deterministic data shows: ${probability.symbol} is in a ${regime.regimeLabel} regime ` +
    `(${regime.volatilityRegime} volatility, ${regime.liquidityRegime} liquidity), with multi-timeframe trend ` +
    `agreement ${mtf.trendAgreement}${mtf.dominantTrend ? ` (${mtf.dominantTrend})` : ""}. ` +
    `Your own portfolio risk reads ${risk.overall.label}` +
    `${risk.openPositionsCount > 0 ? ` across ${risk.openPositionsCount} open position(s)` : ", with no open positions"}.`
  );
}

router.post("/trading/coach/ask", async (req, res): Promise<void> => {
  const parsed = AskTradingCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const probability = await buildProbabilityAnalysis(parsed.data.symbol, provider);
  if (!probability) {
    res.status(404).json({ error: `Unknown symbol: ${parsed.data.symbol}` });
    return;
  }

  const { risk, journalRows } = await gatherUserContext(userId, provider);
  const session = await buildSessionData(parsed.data.symbol);
  const context = buildTradeCoachContext(probability, risk, journalRows, session);
  const fallback = tradeCoachFallback(probability, risk, parsed.data.question);
  const n = await narrateTradeFreeform(parsed.data.question, context, fallback);
  res.json(AskTradingCoachResponse.parse({ answer: n.text, answerSource: n.source }));
});

// SSE variant — same event contract as /stock-analyst/value-research/ask/
// stream (meta -> delta... -> done). Deliberately NOT in the OpenAPI/orval
// contract, matching that route's own precedent — orval only models
// single-shot JSON responses.
router.post("/trading/coach/ask/stream", async (req, res): Promise<void> => {
  const parsed = AskTradingCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const probability = await buildProbabilityAnalysis(parsed.data.symbol, provider);
  if (!probability) {
    res.status(404).json({ error: `Unknown symbol: ${parsed.data.symbol}` });
    return;
  }

  const { risk, journalRows } = await gatherUserContext(userId, provider);
  const session = await buildSessionData(parsed.data.symbol);
  const context = buildTradeCoachContext(probability, risk, journalRows, session);
  const fallback = tradeCoachFallback(probability, risk, parsed.data.question);

  const sse = openSse(res);
  try {
    sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
    const n = await narrateTradeFreeformStream(parsed.data.question, context, fallback, (t) => sse.send("delta", { text: t }));
    sse.send("done", { answer: n.text, answerSource: n.source });
  } catch (err) {
    req.log.error({ err }, "trade coach ask stream failed");
    sse.send("error", { error: "Failed to answer question" });
  } finally {
    sse.close();
  }
});

// ---------------------------------------------------------------------------
// Phase 29 — Institutional Trading AI Coach. Deterministic (zero-LLM)
// explanations, the exact same "compose, never compute" discipline as
// Engine 1's GET /stock-analyst/coach/:coach/:symbol (lib/investingCoach.ts,
// Phase 21) — never predicts price, never invents a probability, never
// recommends buying or selling. Separate from the free-form LLM Q&A routes
// above (POST /trading/coach/ask[/stream]), which are untouched.
//
// Account-wide coaches (journal, psychology) are registered on a shorter
// path (no :symbol) than the symbol-scoped coaches below — Express
// distinguishes them by segment count, so both can coexist safely.
// ---------------------------------------------------------------------------

async function gatherRecentJournalEntries(userId: string) {
  return db
    .select()
    .from(tradingJournalEntriesTable)
    .where(eq(tradingJournalEntriesTable.userId, userId))
    .orderBy(desc(tradingJournalEntriesTable.createdAt))
    .limit(RECENT_JOURNAL_ENTRIES_LIMIT);
}

function toJournalCoachInput(rows: (typeof tradingJournalEntriesTable.$inferSelect)[]) {
  return rows.map((r) => ({
    title: r.title,
    mood: r.mood,
    lessonLearned: r.lessonLearned ?? null,
    rMultiple: r.rMultiple ?? null,
    setupType: r.setupType ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

router.get("/trading/coach/:coach", async (req, res): Promise<void> => {
  const coach = req.params.coach as TradingCoachType;
  if (!ACCOUNT_SCOPED_TRADING_COACHES.includes(coach)) {
    res.status(400).json({
      error: `Coach type "${req.params.coach}" requires a symbol. Account-wide coaches: ${ACCOUNT_SCOPED_TRADING_COACHES.join(", ")}`,
    });
    return;
  }

  const userId = await getScopedUserId(req);
  const rows = await gatherRecentJournalEntries(userId);
  const entries = toJournalCoachInput(rows);

  const explanation = coach === "journal" ? explainJournalCoach(entries) : explainPsychologyCoach(entries);
  res.json(GetTradingCoachAccountExplanationResponse.parse(explanation));
});

// Strategy Coach (Phase 30) — resolved by strategy id, not a market
// symbol or the account-wide reads above. A literal "strategy" first
// path segment, registered before the generic /:coach/:symbol route
// below so Express matches this one first (both would otherwise
// structurally match a 2-segment URL); "strategy" is intentionally
// absent from both SYMBOL_SCOPED_TRADING_COACHES and
// ACCOUNT_SCOPED_TRADING_COACHES so neither of those two general
// handlers accidentally accepts it either.
router.get("/trading/coach/strategy/:strategyId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
  const strategyId = parseInt(raw, 10);
  if (isNaN(strategyId)) {
    res.status(400).json({ error: "Invalid strategy id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [strategyRow] = await db
    .select()
    .from(tradingStrategiesTable)
    .where(and(eq(tradingStrategiesTable.id, strategyId), eq(tradingStrategiesTable.userId, userId)));

  if (!strategyRow) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const checklistIdRaw = typeof req.query.checklistId === "string" ? req.query.checklistId : undefined;
  let checklistRow: typeof tradingStrategyChecklistsTable.$inferSelect | null = null;
  if (checklistIdRaw !== undefined) {
    const checklistId = parseInt(checklistIdRaw, 10);
    if (isNaN(checklistId)) {
      res.status(400).json({ error: "Invalid checklistId" });
      return;
    }
    const [row] = await db
      .select()
      .from(tradingStrategyChecklistsTable)
      .where(and(eq(tradingStrategyChecklistsTable.id, checklistId), eq(tradingStrategyChecklistsTable.userId, userId), eq(tradingStrategyChecklistsTable.strategyId, strategyId)));
    checklistRow = row ?? null;
  }

  const explanation = explainStrategyCoach(
    {
      id: strategyRow.id,
      name: strategyRow.name,
      description: strategyRow.description,
      category: strategyRow.category as StrategyCategory,
      timeframes: strategyRow.timeframes as Timeframe[],
      markets: strategyRow.markets as string[],
      requiredEvidence: strategyRow.requiredEvidence as EvidenceSourceType[],
      checklist: strategyRow.checklist,
      educationalNotes: strategyRow.educationalNotes,
      references: strategyRow.references as string[],
      version: strategyRow.version,
      createdAt: strategyRow.createdAt.toISOString(),
      updatedAt: strategyRow.updatedAt.toISOString(),
    },
    checklistRow
      ? {
          id: checklistRow.id,
          strategyId: checklistRow.strategyId,
          symbol: checklistRow.symbol ?? null,
          status: checklistRow.status as "in_progress" | "complete",
          items: checklistRow.items as StrategyChecklistItemState[],
          notes: checklistRow.notes,
          createdAt: checklistRow.createdAt.toISOString(),
          updatedAt: checklistRow.updatedAt.toISOString(),
        }
      : null,
  );

  res.json(GetTradingCoachStrategyExplanationResponse.parse(explanation));
});

router.get("/trading/coach/:coach/:symbol", async (req, res): Promise<void> => {
  const coach = req.params.coach as TradingCoachType;
  if (!TRADING_COACH_TYPES.includes(coach) || !SYMBOL_SCOPED_TRADING_COACHES.includes(coach)) {
    res.status(400).json({
      error: `Unknown or non-symbol-scoped coach type: ${req.params.coach}. Symbol-scoped coaches: ${SYMBOL_SCOPED_TRADING_COACHES.join(", ")}`,
    });
    return;
  }

  const symbol = req.params.symbol.toUpperCase();
  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const probability = await buildProbabilityAnalysis(symbol, provider);
  if (!probability) {
    res.status(404).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }
  const regime = probability.regime;

  let explanation;
  if (coach === "structure") {
    explanation = explainStructureCoach(symbol, regime.multiTimeframe);
  } else if (coach === "liquidity") {
    explanation = explainLiquidityCoach(symbol, regime.liquidity);
  } else if (coach === "session") {
    const session = await buildSessionData(symbol);
    explanation = explainSessionCoach(symbol, session);
  } else if (coach === "risk") {
    const { risk } = await gatherUserContext(userId, provider);
    explanation = explainRiskCoach(symbol, risk);
  } else {
    // trade-plan — explain the user's own most recent saved plan for this symbol
    const plans = await db
      .select()
      .from(tradingTradePlansTable)
      .where(and(eq(tradingTradePlansTable.userId, userId), eq(tradingTradePlansTable.symbol, symbol)))
      .orderBy(desc(tradingTradePlansTable.createdAt))
      .limit(1);
    const p = plans[0] ?? null;
    explanation = explainTradePlanCoach(
      symbol,
      p
        ? {
            id: p.id,
            symbol: p.symbol,
            direction: p.direction,
            status: p.status,
            thesis: p.thesis,
            risk: {
              accountRiskPct: p.accountRiskPct,
              entryPrice: p.entryPrice,
              stopPrice: p.stopPrice,
              targetPrice: p.targetPrice,
              positionSize: p.positionSize ?? null,
              riskRewardRatio: p.riskRewardRatio ?? null,
            },
            createdAt: p.createdAt.toISOString(),
          }
        : null,
    );
  }

  res.json(GetTradingCoachExplanationResponse.parse(explanation));
});

// Scenario Coach — stateless, mirrors POST /trading/trade-plans/scenarios/
// compare's own request body exactly and reuses computeScenarioComparison()
// (Phase 28, unmodified) to produce the same comparison, then explains it.
router.post("/trading/coach/scenario", async (req, res): Promise<void> => {
  const parsed = ExplainTradingScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (d.scenarios.length < MIN_SCENARIOS || d.scenarios.length > MAX_SCENARIOS) {
    res.status(400).json({ error: `Provide between ${MIN_SCENARIOS} and ${MAX_SCENARIOS} scenarios to compare.` });
    return;
  }

  let accountValue: number | null = d.accountValue ?? null;
  if (accountValue == null) {
    const userId = await getScopedUserId(req);
    const settings = await getSettingsRow(userId);
    accountValue = settings.tradingAccountValue ?? null;
  }

  const comparison = computeScenarioComparison(d.symbol ? d.symbol.toUpperCase() : null, d.scenarios, accountValue);
  const explanation = explainScenarioCoach(comparison);
  res.json(ExplainTradingScenarioResponse.parse(explanation));
});

export default router;

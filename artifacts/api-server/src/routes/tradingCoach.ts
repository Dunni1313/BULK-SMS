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
import { db, tradingPositionsTable, tradingJournalEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { buildProbabilityAnalysis, type ProbabilityAnalysis } from "../lib/tradingProbability.js";
import {
  buildTradingRiskAnalysis,
  type TradingPositionInput,
  type TradingRiskAnalysisWithContext,
} from "../lib/tradingRisk.js";
import { getMarketDataProvider, type MarketDataProvider } from "../lib/tradingMarketData.js";
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

export default router;

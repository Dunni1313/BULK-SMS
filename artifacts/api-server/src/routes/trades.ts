import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradesResponse,
  GetTradeResponse,
  CloseTradeResponse,
  CreateTradeBody,
  GetTradeMonitorResponse,
  ListTradeAdjustmentsResponse,
  GetTradeAdjustmentResponse,
} from "@workspace/api-zod";
import {
  getSnapshot,
  buildIronCondor,
  buildIronFly,
  buildCalendar,
  buildEarnings,
  type StrategyQuote,
} from "../lib/optionsMath.js";
import { validateTrade, maxLossFromLegs, computeStopLoss } from "../lib/risk.js";
import {
  computeTradeGreeks,
  getAccountValue,
  getSettingsRow,
  type StoredLeg,
} from "../lib/serverState.js";
import { closeTradePosition } from "../lib/tradeClose.js";
import { evaluateTradeAdjustment, ADJUSTMENT_DISCLAIMER } from "../lib/adjustment.js";
import { narrateAdjustment, narrateAdjustmentStream } from "../lib/coachLLM.js";
import { openSse } from "../lib/sse.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatTrade(t: typeof tradesTable.$inferSelect) {
  return {
    ...t,
    legs: (t.legs as unknown[]) || [],
    openDate: t.openDate.toISOString(),
    closeDate: t.closeDate ? t.closeDate.toISOString() : null,
  };
}

function canonicalQuote(symbol: string, strategy: string): StrategyQuote | null {
  const snap = getSnapshot(symbol);
  if (!snap) return null;
  switch (strategy) {
    case "iron_condor":
      return buildIronCondor(snap);
    case "iron_fly":
      return buildIronFly(snap);
    case "calendar_spread":
      return buildCalendar(snap);
    case "earnings":
      return buildEarnings(snap) ?? buildIronFly(snap, { strategy: "earnings" });
    default:
      return buildIronCondor(snap);
  }
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

router.get("/trades", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const strategy = req.query.strategy as string | undefined;
  const limit = Number(req.query.limit) || 50;

  const userId = await getScopedUserId(req);
  const all = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.createdAt))
    .limit(limit);

  const filtered = all
    .filter((t) => !status || t.status === status)
    .filter((t) => !strategy || t.strategy === strategy);

  res.json(ListTradesResponse.parse(filtered.map(formatTrade)));
});

router.post("/trades", async (req, res): Promise<void> => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, strategy, executionMode, legs, notes, scannerResultId } = parsed.data;

  const creditPer =
    legs
      .filter((l) => l.side === "sell")
      .reduce((sum, l) => sum + (l.openPrice || 0) * l.quantity, 0) -
    legs
      .filter((l) => l.side === "buy")
      .reduce((sum, l) => sum + (l.openPrice || 0) * l.quantity, 0);
  const credit = Math.round(creditPer * 100 * 100) / 100;

  // Risk metrics that scale with the submitted legs/quantities (so multi-lot or
  // non-canonical structures are sized correctly), with POP/EV/theta/score taken
  // from the canonical snapshot for the strategy as a quality reference.
  const riskLegs = legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    quantity: l.quantity,
    expiration: l.expiration ?? null,
  }));
  const maxLoss = maxLossFromLegs(riskLegs, credit);
  const canonical = canonicalQuote(symbol, strategy);
  const lots = Math.max(1, legs.reduce((m, l) => Math.max(m, l.quantity), 1));
  const maxProfit = credit > 0 ? credit : canonical ? canonical.maxProfit * lots : Math.max(0, credit);
  const pop = canonical ? canonical.pop : 0;
  const ev = canonical ? canonical.ev * lots : 0;
  const theta = canonical ? canonical.theta * lots : 0;
  const ravishScore = canonical ? canonical.ravishScore : 0;

  const userId = await getScopedUserId(req);

  // Enforce risk rules before the trade can be opened.
  const settings = await getSettingsRow(userId);
  const accountValue = await getAccountValue(userId);
  const validation = validateTrade(
    { symbol, strategy, legs: riskLegs, credit, maxLoss },
    accountValue,
    {
      maxRiskPerTrade: settings.maxRiskPerTrade,
      maxPortfolioRisk: settings.maxPortfolioRisk,
      stopLossMultiplier: settings.stopLossMultiplier,
      profitTarget50: settings.profitTarget50,
      profitTarget75: settings.profitTarget75,
      profitTarget90: settings.profitTarget90,
    },
  );

  if (!validation.valid) {
    res.status(422).json({
      error: "Trade rejected by risk rules",
      violations: validation.violations,
      checks: validation.checks,
    });
    return;
  }

  // Enforce the cumulative portfolio cap at entry: existing open risk + this trade
  // must stay within the portfolio risk limit.
  const openTrades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "open"), eq(tradesTable.userId, userId)));
  const openRisk = openTrades.reduce((s, t) => s + Math.max(0, t.maxLoss), 0);
  const projectedRisk = openRisk + maxLoss;
  const projectedPct = accountValue > 0 ? (projectedRisk / accountValue) * 100 : 0;
  if (projectedPct > settings.maxPortfolioRisk + 1e-6) {
    res.status(422).json({
      error: "Trade rejected by risk rules",
      violations: [
        `Opening this trade would raise portfolio risk to ${projectedPct.toFixed(1)}%, above the ${settings.maxPortfolioRisk}% cap`,
      ],
      checks: validation.checks,
    });
    return;
  }

  const expiration = legs[0]?.expiration || null;
  // Record the underlying IV at entry so the adjustment engine can measure IV
  // expansion later (vs. falling back to the IV-rank proxy).
  const entryIv = getSnapshot(symbol)?.iv ?? null;

  const [trade] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy,
      executionMode,
      legs: legs as unknown as (typeof tradesTable.$inferInsert)["legs"],
      expiration,
      credit,
      maxProfit,
      maxLoss,
      pop,
      ev,
      theta,
      ravishScore,
      entryIv,
      notes: notes ?? null,
      scannerResultId: scannerResultId ?? null,
      status: "open",
    })
    .returning();

  res.status(201).json(GetTradeResponse.parse(formatTrade(trade)));
});

// Registered BEFORE "/trades/:id" so the literal "adjustments" segment is not
// captured as an :id.
router.get("/trades/adjustments", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const open = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "open"), eq(tradesTable.userId, userId)))
    .orderBy(desc(tradesTable.ravishScore));
  const adjustments = open.map((t) => evaluateTradeAdjustment(t, settings));
  res.json(ListTradeAdjustmentsResponse.parse(adjustments));
});

router.get("/trades/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.json(GetTradeResponse.parse(formatTrade(trade)));
});

router.delete("/trades/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [existing] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const { trade } = await closeTradePosition(existing, userId);
  res.json(CloseTradeResponse.parse(formatTrade(trade)));
});

router.get("/trades/:id/monitor", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const settings = await getSettingsRow(userId);
  const g = computeTradeGreeks(trade);
  const maxProfit = trade.maxProfit;
  const stopLoss = computeStopLoss(trade.credit, trade.maxLoss, settings.stopLossMultiplier);
  const dte = daysUntil(trade.expiration);

  const target50 = maxProfit * (settings.profitTarget50 / 100);
  const target75 = maxProfit * (settings.profitTarget75 / 100);
  const target90 = maxProfit * (settings.profitTarget90 / 100);

  const alerts: string[] = [];
  if (g.unrealizedPnl >= target90) alerts.push("90% profit target reached — close now");
  else if (g.unrealizedPnl >= target75) alerts.push("75% profit target reached — consider closing");
  else if (g.unrealizedPnl >= target50) alerts.push("50% profit target reached");
  if (g.unrealizedPnl <= stopLoss) alerts.push("Stop loss breached — exit immediately");
  if (dte <= 21) alerts.push(`${dte} days to expiry — manage gamma risk`);

  res.json(
    GetTradeMonitorResponse.parse({
      tradeId: id,
      currentPnl: g.unrealizedPnl,
      currentPnlPercent: g.unrealizedPnlPercent,
      profitTarget50: Math.round(target50 * 100) / 100,
      profitTarget75: Math.round(target75 * 100) / 100,
      profitTarget90: Math.round(target90 * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      daysToExpiry: dte,
      delta: g.delta,
      theta: g.theta,
      alerts,
    }),
  );
});

router.get("/trades/:id/adjustment", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const settings = await getSettingsRow(userId);
  res.json(GetTradeAdjustmentResponse.parse(evaluateTradeAdjustment(trade, settings)));
});

// SSE: streams the AI "why" narration for an adjustment. Deliberately NOT in the
// OpenAPI/orval contract — the deterministic JSON above is the contract; the
// stream client hand-rolls fetch + SSE parsing (mirrors the other coach streams).
router.post("/trades/:id/adjustment/stream", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trade id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const settings = await getSettingsRow(userId);
  const adj = evaluateTradeAdjustment(trade, settings);
  const level = req.body?.level === "beginner" || req.body?.level === "advanced" ? req.body.level : undefined;

  // The deterministic context goes out FIRST so the client can render structure
  // (action, numbers, disclaimer) before any prose arrives.
  const sse = openSse(res);
  sse.send("meta", adj);
  const n = await narrateAdjustmentStream(
    {
      symbol: adj.symbol,
      symbolName: adj.symbolName,
      strategyLabel: adj.strategyLabel,
      action: adj.action,
      actionLabel: adj.actionLabel,
      severity: adj.severity,
      rationale: adj.rationale,
      triggeredSignals: adj.triggeredSignals,
      currentPop: adj.currentPop,
      entryPop: adj.entryPop,
      daysToExpiry: adj.daysToExpiry,
      currentPnl: adj.currentPnl,
      maxLoss: adj.maxLoss,
      maxProfit: adj.maxProfit,
      threatenedSide: adj.threatenedSide,
      nearestShortStrike: adj.nearestShortStrike,
      distanceToShortPct: adj.distanceToShortPct,
      assignmentRisk: adj.assignmentRisk,
      disclaimer: ADJUSTMENT_DISCLAIMER,
    },
    (chunk) => sse.send("delta", { text: chunk }),
    level,
  );
  sse.send("done", { text: n.text, source: n.source, adjustment: adj });
  sse.close();
});

export default router;

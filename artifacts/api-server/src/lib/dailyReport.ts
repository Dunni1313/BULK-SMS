// Task #38 — Portfolio AI. Daily Report assembler.
//
// Stitches the existing engines (portfolio greeks, risk, theta-income, the
// adjustment engine, the scanner table and the event-risk calendar) plus the new
// portfolio-health scorer and market briefing into one structured report object.
// It reads from the DB but performs no scoring of its own beyond delegation —
// every number originates in a deterministic engine.

import { db, tradesTable, scannerResultsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  computeTradeGreeks,
  ensureSeedTrades,
  getAccountValue,
  getSettingsRow,
} from "./serverState.js";
import { getSnapshot, UNIVERSE_SYMBOLS, todayStr } from "./optionsMath.js";
import { computePortfolioRisk } from "./risk.js";
import { computeThetaIncome } from "./thetaIncome.js";
import { evaluateTradeAdjustment, type AdjustmentResult } from "./adjustment.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { buildMarketBriefing, type MarketBriefing } from "./marketBriefing.js";
import {
  computePortfolioHealth,
  threatFromSeverity,
  type PortfolioHealth,
  type ThreatLevel,
} from "./portfolioHealth.js";

export const PORTFOLIO_AI_DISCLAIMER =
  "Advisory only. This cockpit summarises simulated data and never executes or adjusts a trade on its own — every decision is yours.";

export interface ReportSummary {
  accountValue: number;
  openPositions: number;
  totalUnrealizedPnl: number;
  netDelta: number;
  netTheta: number;
  netVega: number;
  netGamma: number;
  portfolioRiskUsedPct: number;
  maxPortfolioRiskPct: number;
  withinLimits: boolean;
  thetaDaily: number;
  thetaMonthly: number;
}

export interface PositionThreat {
  tradeId: number;
  symbol: string;
  symbolName: string;
  strategy: string;
  strategyLabel: string;
  threatLevel: ThreatLevel;
  severity: AdjustmentResult["severity"];
  action: AdjustmentResult["action"];
  actionLabel: string;
  currentPnl: number;
  currentPnlPercent: number;
  currentPop: number;
  daysToExpiry: number;
  rationale: string;
}

export interface ReportOpportunity {
  symbol: string;
  strategy: string;
  ravishScore: number;
  ravishTier: string;
  pop: number;
  ev: number;
  theta: number;
  eventRiskLevel: string;
}

export interface TradeToAvoid {
  symbol: string;
  symbolName: string;
  reason: string;
  level: string;
  earningsInDays: number | null;
}

export interface DailyReport {
  date: string;
  generatedAt: string;
  health: PortfolioHealth;
  summary: ReportSummary;
  market: MarketBriefing;
  positions: PositionThreat[];
  opportunities: ReportOpportunity[];
  tradesToAvoid: TradeToAvoid[];
  adjustments: AdjustmentResult[];
  disclaimer: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// Build everything except the LLM prose. The route layer adds the narrated
// briefing text on top (routed through coachLLM.narrate for the disclaimer).
export async function assembleDailyReport(now: number = Date.now()): Promise<DailyReport> {
  await ensureSeedTrades();
  const [trades, settings, accountValue] = await Promise.all([
    db.select().from(tradesTable).where(eq(tradesTable.status, "open")),
    getSettingsRow(),
    getAccountValue(),
  ]);

  // Aggregate Greeks + theta.
  let netDelta = 0;
  let netTheta = 0;
  let netVega = 0;
  let netGamma = 0;
  let unrealized = 0;
  const thetaPositions = trades.map((t) => {
    const g = computeTradeGreeks(t);
    netDelta += g.delta;
    netTheta += g.theta;
    netVega += g.vega;
    netGamma += g.gamma;
    unrealized += g.unrealizedPnl;
    return { symbol: t.symbol, strategy: t.strategy, theta: g.theta };
  });
  netDelta = round2(netDelta);
  netTheta = round2(netTheta);
  netVega = round2(netVega);
  netGamma = Math.round(netGamma * 1000) / 1000;
  unrealized = round2(unrealized);
  const theta = computeThetaIncome(thetaPositions);

  // Risk status.
  const risk = computePortfolioRisk(
    trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      credit: t.credit,
      maxLoss: t.maxLoss,
    })),
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

  // Per-position adjustment recommendations → threat-badged monitor.
  const adjustments = trades.map((t) =>
    evaluateTradeAdjustment(t, {
      stopLossMultiplier: settings.stopLossMultiplier,
      profitTarget50: settings.profitTarget50,
      profitTarget75: settings.profitTarget75,
      profitTarget90: settings.profitTarget90,
      adjDeltaDriftTrigger: settings.adjDeltaDriftTrigger,
      adjPopDropTrigger: settings.adjPopDropTrigger,
      adjShortStrikeProximityPct: settings.adjShortStrikeProximityPct,
      adjIvExpansionTrigger: settings.adjIvExpansionTrigger,
      adjDteTrigger: settings.adjDteTrigger,
    }),
  );

  const positions: PositionThreat[] = adjustments.map((a) => ({
    tradeId: a.tradeId,
    symbol: a.symbol,
    symbolName: a.symbolName,
    strategy: a.strategy,
    strategyLabel: a.strategyLabel,
    threatLevel: threatFromSeverity(a.severity),
    severity: a.severity,
    action: a.action,
    actionLabel: a.actionLabel,
    currentPnl: a.currentPnl,
    currentPnlPercent: a.currentPnlPercent,
    currentPop: a.currentPop,
    daysToExpiry: a.daysToExpiry,
    rationale: a.rationale,
  }));

  const attentionCount = positions.filter((p) => p.threatLevel !== "green").length;
  const criticalCount = positions.filter((p) => p.threatLevel === "red").length;

  // Portfolio health score.
  const health = computePortfolioHealth({
    accountValue,
    openTrades: trades.length,
    netDelta,
    netTheta,
    netVega,
    netGamma,
    portfolioRiskUsedPct: risk.portfolioRiskUsedPct,
    maxPortfolioRiskPct: risk.maxPortfolioRiskPct,
    withinLimits: risk.withinLimits,
    perTradeOverCap: risk.perTrade.filter((p) => !p.withinLimit).length,
    symbolRisk: risk.perTrade.map((p) => ({ symbol: p.symbol, riskDollars: p.riskDollars })),
    attentionCount,
    criticalCount,
  });

  // Top scanner opportunities.
  const scanRows = await db
    .select()
    .from(scannerResultsTable)
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(5);
  const opportunities: ReportOpportunity[] = scanRows.map((r) => ({
    symbol: r.symbol,
    strategy: r.strategy,
    ravishScore: Math.round(r.ravishScore),
    ravishTier: r.ravishTier,
    pop: round2(r.pop),
    ev: round2(r.ev),
    theta: round2(r.theta),
    eventRiskLevel: r.eventRiskLevel,
  }));

  // Trades-to-avoid: per-symbol signals only. We deliberately use the hard
  // `blockShortPremium` flag (earnings inside the expiry window) rather than the
  // assessment `level`, because market-wide macro (e.g. FOMC) lands inside almost
  // any 45-DTE window and would otherwise flag the entire universe as "avoid".
  const expiry = todayStr(new Date(now + 45 * 86_400_000));
  const tradesToAvoid: TradeToAvoid[] = [];
  for (const sym of UNIVERSE_SYMBOLS) {
    const assessment = getEventRiskForSymbol(sym, "iron_condor", expiry, now, settings.eventRiskEnabled);
    if (!assessment.blockShortPremium) continue;
    const snap = getSnapshot(sym, todayStr(new Date(now)));
    tradesToAvoid.push({
      symbol: sym,
      symbolName: snap?.name ?? sym,
      reason: "Earnings inside the expiry window — avoid opening short premium.",
      level: assessment.level,
      earningsInDays: snap?.earningsInDays ?? null,
    });
  }

  return {
    date: todayStr(new Date(now)),
    generatedAt: new Date(now).toISOString(),
    health,
    summary: {
      accountValue: round2(accountValue + unrealized),
      openPositions: trades.length,
      totalUnrealizedPnl: unrealized,
      netDelta,
      netTheta,
      netVega,
      netGamma,
      portfolioRiskUsedPct: risk.portfolioRiskUsedPct,
      maxPortfolioRiskPct: risk.maxPortfolioRiskPct,
      withinLimits: risk.withinLimits,
      thetaDaily: theta.daily,
      thetaMonthly: theta.monthly,
    },
    market: buildMarketBriefing(now),
    positions,
    opportunities,
    tradesToAvoid,
    adjustments,
    disclaimer: PORTFOLIO_AI_DISCLAIMER,
  };
}

// ─── Report comparison (Task #51) ────────────────────────────────────────────
// Deterministic delta between two persisted reports. These numbers are the
// source of truth; the LLM only narrates them. The shape mirrors what the
// frontend ReportComparison renders, so the prose and the grid never diverge.
export interface ReportComparisonDelta {
  fromDate: string;
  toDate: string;
  healthFrom: number;
  healthTo: number;
  healthDelta: number;
  healthLabelFrom: string;
  healthLabelTo: string;
  exposureDelta: number;
  riskConcentrationDelta: number;
  openPositionsDelta: number;
  redDelta: number;
  yellowDelta: number;
  greenDelta: number;
  tradesToAvoidDelta: number;
  netDeltaDelta: number;
  netThetaDelta: number;
  unrealizedPnlDelta: number;
  riskUsedPctDelta: number;
  newPositions: string[];
  removedPositions: string[];
  newAvoid: string[];
  removedAvoid: string[];
}

const posLabel = (p: PositionThreat): string => `${p.symbol} ${p.strategyLabel}`;

// `a`/`b` may be in any order; we anchor on the chronologically older report as
// the baseline ("from") so positive deltas read as "since the older report",
// matching the frontend ordering.
export function buildReportComparison(a: DailyReport, b: DailyReport): ReportComparisonDelta {
  const [from, to] =
    new Date(a.generatedAt).getTime() <= new Date(b.generatedAt).getTime() ? [a, b] : [b, a];

  const fromPos = new Map(from.positions.map((p) => [p.tradeId, p]));
  const toPos = new Map(to.positions.map((p) => [p.tradeId, p]));
  const newPositions = to.positions.filter((p) => !fromPos.has(p.tradeId)).map(posLabel);
  const removedPositions = from.positions.filter((p) => !toPos.has(p.tradeId)).map(posLabel);

  const fromAvoid = new Set(from.tradesToAvoid.map((t) => t.symbol));
  const toAvoid = new Set(to.tradesToAvoid.map((t) => t.symbol));
  const newAvoid = to.tradesToAvoid.filter((t) => !fromAvoid.has(t.symbol)).map((t) => t.symbol);
  const removedAvoid = from.tradesToAvoid.filter((t) => !toAvoid.has(t.symbol)).map((t) => t.symbol);

  return {
    fromDate: from.date,
    toDate: to.date,
    healthFrom: from.health.health.score,
    healthTo: to.health.health.score,
    healthDelta: to.health.health.score - from.health.health.score,
    healthLabelFrom: from.health.health.label,
    healthLabelTo: to.health.health.label,
    exposureDelta: to.health.exposure.score - from.health.exposure.score,
    riskConcentrationDelta: to.health.riskConcentration.score - from.health.riskConcentration.score,
    openPositionsDelta: to.summary.openPositions - from.summary.openPositions,
    redDelta: to.health.threatCounts.red - from.health.threatCounts.red,
    yellowDelta: to.health.threatCounts.yellow - from.health.threatCounts.yellow,
    greenDelta: to.health.threatCounts.green - from.health.threatCounts.green,
    tradesToAvoidDelta: to.tradesToAvoid.length - from.tradesToAvoid.length,
    netDeltaDelta: round2(to.health.netDelta - from.health.netDelta),
    netThetaDelta: round2(to.health.netTheta - from.health.netTheta),
    unrealizedPnlDelta: round2(to.summary.totalUnrealizedPnl - from.summary.totalUnrealizedPnl),
    riskUsedPctDelta: round2(to.summary.portfolioRiskUsedPct - from.summary.portfolioRiskUsedPct),
    newPositions,
    removedPositions,
    newAvoid,
    removedAvoid,
  };
}

// Deterministic plain-English fallback so the comparison card always reads well
// even with no LLM. Mentions only the materially-changed dimensions.
export function comparisonFallback(d: ReportComparisonDelta): string {
  const parts: string[] = [];
  const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;

  if (d.healthDelta !== 0) {
    parts.push(
      `Portfolio health ${d.healthDelta > 0 ? "improved" : "declined"} ${Math.abs(d.healthDelta)} point${
        Math.abs(d.healthDelta) === 1 ? "" : "s"
      } (${d.healthFrom} → ${d.healthTo}, ${d.healthLabelTo}).`,
    );
  } else {
    parts.push(`Portfolio health held at ${d.healthTo} (${d.healthLabelTo}).`);
  }

  if (d.redDelta !== 0) {
    parts.push(
      `Critical threats ${d.redDelta > 0 ? "rose" : "fell"} by ${Math.abs(d.redDelta)}.`,
    );
  }
  if (d.newPositions.length) {
    parts.push(`New position${d.newPositions.length === 1 ? "" : "s"}: ${d.newPositions.join(", ")}.`);
  }
  if (d.removedPositions.length) {
    parts.push(`Closed: ${d.removedPositions.join(", ")}.`);
  }
  if (d.newAvoid.length) {
    parts.push(
      `${d.newAvoid.join(", ")} entered the avoid list.`,
    );
  }
  if (d.removedAvoid.length) {
    parts.push(`${d.removedAvoid.join(", ")} cleared the avoid list.`);
  }
  if (d.unrealizedPnlDelta !== 0) {
    parts.push(`Unrealized P&L moved ${signed(d.unrealizedPnlDelta, 2)}.`);
  }

  if (parts.length <= 1 && !d.newPositions.length && !d.removedPositions.length) {
    parts.push("Little else changed materially between the two reports.");
  }

  return parts.join(" ");
}

// totalPnl referenced for parity with portfolio summary; exported helper kept
// inline above. (No external use — silence unused warnings by not exporting.)

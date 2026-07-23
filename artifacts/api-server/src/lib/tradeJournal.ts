// AI Trade Journal — Phase 8, Sprint 4. A deterministic behavioural
// analysis and trade review system for the Ravish Institutional Trading
// Operating System, analysing completed Paper Trading trades using
// existing analytics and generating structured educational feedback.
//
// PURE COMPOSITION, with a small number of disclosed, minimal helpers
// documented at their own definition (never new pricing/risk logic —
// each one is a trivial generalization of an existing, already-real
// formula, parameterized by a historical date instead of "now"):
//
//  - computeGreeksAsOf(): the exact same bs()/leg-sign/multiplier
//    formula serverState.ts's own computeTradeGreeks() already uses,
//    generalized to accept an arbitrary `asOf` date (needed because
//    computeTradeGreeks() itself hardcodes Date.now() — this sprint's
//    own explicit "Greeks at Entry"/"Greeks at Exit" requirement cannot
//    be satisfied without evaluating at a historical date). Reuses
//    bs()/getSnapshot() unmodified.
//  - deriveLotQuantity(): the same max()-of-leg-quantities formula
//    portfolioEventRisk.ts's own private deriveLotQuantity() already
//    uses (that function is not exported, and portfolioEventRisk.ts is
//    explicitly out of scope for modification this sprint per "Do NOT
//    modify portfolio analytics").
//  - tradeHoldingPeriodDays(): the exact same
//    (closeDate-openDate)/86400000 formula
//    artifacts/ravish-trading/src/lib/tradeAnalytics.ts's own
//    holdingPeriodDays() already uses on the frontend — necessarily
//    reimplemented backend-side since this codebase has no
//    frontend/backend shared-logic layer (the same disclosed constraint
//    noted by the Trade History sprint).
//
// Genuine, real reuse (unmodified): getEventRiskForSymbol() (eventRisk.ts,
// already accepts a `now` override — the exact same function
// execution.ts/autoExecution.ts/portfolioEventRisk.ts already call),
// computeStopLoss() (risk.ts), getAccountValue()/getSettingsRow()
// (serverState.ts), computeTrend() (intelligenceTrend.ts),
// getLearningTopic() (learningPaths.ts), getGlossaryTerm() (glossary.ts),
// getStrategyAcademyEntry() (strategyAcademy.ts), learningLinksFor()
// (intelligenceLearning.ts), getLearningProgress() (learningProgress.ts).
//
// Not a chatbot. Not an AI trading signal engine. Not financial advice.
// Not portfolio management. Every score/pattern is deterministic and
// traceable to an existing calculation or a real, stored trade field —
// never a fabricated judgement. Never routes to a broker, never creates
// or modifies an order or position, never mutates the trades table.

import { and, desc, eq } from "drizzle-orm";
import { db, tradesTable, journalEntriesTable, type Trade } from "@workspace/db";
import { bs, getSnapshot, type EventRiskEvent, type EventRiskLevel } from "./optionsMath.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { computeStopLoss } from "./risk.js";
import { getAccountValue, getSettingsRow, type StoredLeg } from "./serverState.js";
import { getLearningTopic } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";
import { getStrategyAcademyEntry, type StrategyAcademyKey } from "./strategyAcademy.js";
import { learningLinksFor, type LearningCategory } from "./intelligenceLearning.js";
import { getLearningProgress } from "./learningProgress.js";
import { computeTrend, type TrendDirection } from "./intelligenceTrend.js";

const MAX_REVIEWS_RETURNED = 50;

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ─── Small, disclosed helpers (see file header) ─────────────────────────────

export interface GreeksSnapshot {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

const ZERO_GREEKS: GreeksSnapshot = { delta: 0, gamma: 0, theta: 0, vega: 0 };

function computeGreeksAsOf(symbol: string, legs: unknown, asOf: Date): GreeksSnapshot {
  const dateStr = asOf.toISOString().slice(0, 10);
  const snap = getSnapshot(symbol, dateStr);
  const list = (legs as StoredLeg[]) ?? [];
  if (!snap || list.length === 0) return ZERO_GREEKS;

  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  for (const leg of list) {
    const T = (new Date(leg.expiration).getTime() - asOf.getTime()) / (365 * 24 * 60 * 60 * 1000);
    const g = bs(snap.price, leg.strike, T, snap.iv, leg.optionType);
    const sign = leg.side === "sell" ? -1 : 1;
    delta += sign * g.delta * leg.quantity;
    gamma += sign * g.gamma * leg.quantity;
    theta += sign * g.theta * leg.quantity * 100;
    vega += sign * g.vega * leg.quantity * 100;
  }
  return { delta: round(delta, 3), gamma: round(gamma, 4), theta: round(theta, 2), vega: round(vega, 2) };
}

function deriveLotQuantity(legs: unknown): number {
  const list = (legs as StoredLeg[]) ?? [];
  if (list.length === 0) return 1;
  return Math.max(1, ...list.map((l) => l.quantity || 1));
}

function tradeHoldingPeriodDays(trade: Trade): number {
  const openMs = new Date(trade.openDate).getTime();
  const endMs = trade.closeDate ? new Date(trade.closeDate).getTime() : Date.now();
  return round(Math.max(0, (endMs - openMs) / (24 * 60 * 60 * 1000)), 1);
}

// ─── Event Risk at Entry ─────────────────────────────────────────────────────
// Reuses getEventRiskForSymbol() exactly as execution.ts/autoExecution.ts/
// portfolioEventRisk.ts already do, evaluated `now = openDate` instead of
// the live default — this reconstructs, deterministically, what the same
// event-risk gate would have reported AT ENTRY, since earningsEvent()'s own
// underlying seeded snapshot is itself a pure function of (symbol, date).

export interface EventRiskAtEntry {
  level: EventRiskLevel;
  events: EventRiskEvent[];
}

function eventRiskAtEntry(trade: Trade): EventRiskAtEntry {
  if (!trade.expiration) return { level: "none", events: [] };
  const assessment = getEventRiskForSymbol(trade.symbol, trade.strategy, trade.expiration, new Date(trade.openDate).getTime());
  return { level: assessment.level, events: assessment.events };
}

function heldThroughEarnings(trade: Trade, entry: EventRiskAtEntry): boolean {
  if (!trade.closeDate) return false;
  const openStr = new Date(trade.openDate).toISOString().slice(0, 10);
  const closeStr = new Date(trade.closeDate).toISOString().slice(0, 10);
  return entry.events.some((e) => e.type === "earnings" && e.date >= openStr && e.date <= closeStr);
}

// ─── Decision Quality ────────────────────────────────────────────────────────
// Every tag references a real, existing rule/threshold — never a
// subjective AI judgement. Position sizing is evaluated against the
// account's CURRENT value (account value at the moment of entry is not
// persisted anywhere in this codebase), a disclosed, honest proxy rather
// than a fabricated historical figure.

export type DecisionQualityCode =
  | "sizing_respected"
  | "sizing_exceeded"
  | "exit_stop_loss_rule"
  | "exit_profit_target_rule"
  | "exit_manual"
  | "winner_let_run"
  | "winner_closed_early"
  | "loss_capped_appropriately"
  | "loss_ran_beyond_plan"
  | "held_through_earnings";

export interface DecisionQualityTag {
  code: DecisionQualityCode;
  label: string;
  detail: string;
  severity: "positive" | "info" | "watch";
  ruleReference: string;
}

function scoreDecisionQuality(
  trade: Trade,
  accountValue: number,
  maxRiskPerTradePct: number,
  profitTarget75Pct: number,
  entry: EventRiskAtEntry,
): DecisionQualityTag[] {
  const tags: DecisionQualityTag[] = [];
  const pnl = trade.currentPnl ?? 0;
  const pnlPct = trade.currentPnlPercent ?? 0;
  const exitReason = trade.exitReason ?? "";

  const riskDollarLimit = accountValue * (maxRiskPerTradePct / 100);
  if (trade.maxLoss <= riskDollarLimit) {
    tags.push({
      code: "sizing_respected",
      label: "Position Sizing Respected",
      detail: `Max loss of $${trade.maxLoss.toFixed(2)} stayed within the ${maxRiskPerTradePct}% max-risk-per-trade limit ($${riskDollarLimit.toFixed(2)}, evaluated against current account value).`,
      severity: "positive",
      ruleReference: "settings.maxRiskPerTrade",
    });
  } else {
    tags.push({
      code: "sizing_exceeded",
      label: "Risk Exceeded Allocation",
      detail: `Max loss of $${trade.maxLoss.toFixed(2)} exceeded the ${maxRiskPerTradePct}% max-risk-per-trade limit ($${riskDollarLimit.toFixed(2)}, evaluated against current account value).`,
      severity: "watch",
      ruleReference: "settings.maxRiskPerTrade",
    });
  }

  if (exitReason === "Stop loss hit") {
    tags.push({
      code: "exit_stop_loss_rule",
      label: "Exited According to Plan (Stop Loss)",
      detail: "Position closed automatically once the configured stop-loss threshold was reached.",
      severity: "positive",
      ruleReference: "risk.ts — computeStopLoss()",
    });
  } else if (exitReason === "Profit target reached (75%)") {
    tags.push({
      code: "exit_profit_target_rule",
      label: "Exited According to Plan (Profit Target)",
      detail: "Position closed automatically once the configured 75% profit target was reached.",
      severity: "positive",
      ruleReference: "settings.profitTarget75",
    });
  } else if (exitReason === "Manual exit") {
    tags.push({
      code: "exit_manual",
      label: "Closed Manually",
      detail: "Position was closed by a manual decision rather than an automated rule.",
      severity: "info",
      ruleReference: "trades.exitReason",
    });
  }

  if (pnl > 0) {
    if (pnlPct >= profitTarget75Pct) {
      tags.push({
        code: "winner_let_run",
        label: "Allowed Winner to Run",
        detail: `Captured ${pnlPct.toFixed(1)}% of max profit — at or beyond the platform's own ${profitTarget75Pct}% profit-target rule.`,
        severity: "positive",
        ruleReference: "settings.profitTarget75",
      });
    } else if (exitReason === "Manual exit") {
      tags.push({
        code: "winner_closed_early",
        label: "Closed Early",
        detail: `Captured only ${pnlPct.toFixed(1)}% of max profit — closed manually before reaching the platform's own ${profitTarget75Pct}% profit-target rule.`,
        severity: "watch",
        ruleReference: "settings.profitTarget75",
      });
    }
  } else if (pnl < 0) {
    const stopLossBound = computeStopLoss(trade.credit, trade.maxLoss, 2.0);
    if (pnl >= stopLossBound) {
      tags.push({
        code: "loss_capped_appropriately",
        label: "Cut Losses Appropriately",
        detail: `Loss of $${pnl.toFixed(2)} stayed within the platform's own configured stop-loss bound ($${stopLossBound.toFixed(2)}).`,
        severity: "positive",
        ruleReference: "risk.ts — computeStopLoss()",
      });
    } else {
      tags.push({
        code: "loss_ran_beyond_plan",
        label: "Held a Losing Trade Too Long",
        detail: `Loss of $${pnl.toFixed(2)} exceeded the platform's own configured stop-loss bound ($${stopLossBound.toFixed(2)}).`,
        severity: "watch",
        ruleReference: "risk.ts — computeStopLoss()",
      });
    }
  }

  if (heldThroughEarnings(trade, entry)) {
    tags.push({
      code: "held_through_earnings",
      label: "Held Through Earnings",
      detail: "A real (SIMULATED) earnings event fell within this trade's own holding period.",
      severity: "info",
      ruleReference: "eventRisk.ts — getEventRiskForSymbol()",
    });
  }

  return tags;
}

// ─── Trade Review ────────────────────────────────────────────────────────────

export interface TradeReview {
  tradeId: number;
  symbol: string;
  strategy: string;
  openDate: string;
  closeDate: string | null;
  holdingPeriodDays: number;
  credit: number;
  maxProfit: number;
  maxLoss: number;
  realizedPnl: number | null;
  realizedPnlPercent: number | null;
  positionSizeContracts: number;
  positionSizePctOfAccount: number;
  greeksAtEntry: GreeksSnapshot;
  greeksAtExit: GreeksSnapshot | null;
  eventRiskAtEntry: EventRiskAtEntry;
  exitReason: string | null;
  decisionQuality: DecisionQualityTag[];
  linkedJournalEntry: { id: number; title: string; content: string } | null;
}

function buildTradeReviewFor(
  trade: Trade,
  accountValue: number,
  maxRiskPerTradePct: number,
  profitTarget75Pct: number,
  linkedJournalEntry: { id: number; title: string; content: string } | null,
): TradeReview {
  const entry = eventRiskAtEntry(trade);
  const decisionQuality = scoreDecisionQuality(trade, accountValue, maxRiskPerTradePct, profitTarget75Pct, entry);
  return {
    tradeId: trade.id,
    symbol: trade.symbol,
    strategy: trade.strategy,
    openDate: new Date(trade.openDate).toISOString(),
    closeDate: trade.closeDate ? new Date(trade.closeDate).toISOString() : null,
    holdingPeriodDays: tradeHoldingPeriodDays(trade),
    credit: trade.credit,
    maxProfit: trade.maxProfit,
    maxLoss: trade.maxLoss,
    realizedPnl: trade.currentPnl,
    realizedPnlPercent: trade.currentPnlPercent,
    positionSizeContracts: deriveLotQuantity(trade.legs),
    positionSizePctOfAccount: accountValue > 0 ? round((trade.maxLoss / accountValue) * 100, 2) : 0,
    greeksAtEntry: computeGreeksAsOf(trade.symbol, trade.legs, new Date(trade.openDate)),
    greeksAtExit: trade.closeDate ? computeGreeksAsOf(trade.symbol, trade.legs, new Date(trade.closeDate)) : null,
    eventRiskAtEntry: entry,
    exitReason: trade.exitReason,
    decisionQuality,
    linkedJournalEntry,
  };
}

// ─── Behaviour Analysis ──────────────────────────────────────────────────────
// Every pattern is a plain count/ratio over the real, historical closed-
// trade set — never a fabricated observation. Thresholds are named,
// disclosed constants (the same "state a reasonable default, disclose it"
// precedent this project has followed since e.g. Sprint 29's 25%/40%
// concentration caps).

export const OVERSIZING_PATTERN_THRESHOLD_PCT = 25;
export const DISCIPLINE_PATTERN_THRESHOLD_PCT = 70;
export const CONCENTRATION_PATTERN_THRESHOLD_PCT = 50;
export const EARLY_EXIT_PATTERN_THRESHOLD_PCT = 50;
export const DIVERSIFICATION_PATTERN_THRESHOLD_PCT = 60;
export const MIN_TRADES_FOR_PATTERN = 3;

export interface BehaviorPattern {
  code: string;
  label: string;
  detail: string;
  severity: "positive" | "watch" | "elevated";
  tradeCount: number;
}

function pct(count: number, total: number): number {
  return total > 0 ? round((count / total) * 100, 1) : 0;
}

function analyzeBehaviour(reviews: TradeReview[]): BehaviorPattern[] {
  const patterns: BehaviorPattern[] = [];
  const total = reviews.length;
  if (total < MIN_TRADES_FOR_PATTERN) return patterns;

  const hasTag = (code: DecisionQualityCode) => reviews.filter((r) => r.decisionQuality.some((t) => t.code === code));

  const oversized = hasTag("sizing_exceeded");
  const oversizedPct = pct(oversized.length, total);
  if (oversizedPct >= OVERSIZING_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "oversizing",
      label: "Over-Sizing",
      detail: `${oversizedPct}% of closed trades (${oversized.length}/${total}) exceeded the configured max-risk-per-trade limit.`,
      severity: "elevated",
      tradeCount: oversized.length,
    });
  } else {
    const respected = hasTag("sizing_respected");
    patterns.push({
      code: "stable_position_sizing",
      label: "Stable Position Sizing",
      detail: `${pct(respected.length, total)}% of closed trades (${respected.length}/${total}) stayed within the configured max-risk-per-trade limit.`,
      severity: "positive",
      tradeCount: respected.length,
    });
  }

  const ruleBased = hasTag("exit_stop_loss_rule").length + hasTag("exit_profit_target_rule").length;
  const ruleBasedPct = pct(ruleBased, total);
  if (ruleBasedPct >= DISCIPLINE_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "consistent_discipline",
      label: "Consistent Discipline",
      detail: `${ruleBasedPct}% of closed trades (${ruleBased}/${total}) exited via a defined stop-loss or profit-target rule rather than an ad hoc manual decision.`,
      severity: "positive",
      tradeCount: ruleBased,
    });
  }

  const symbolCounts = new Map<string, number>();
  for (const r of reviews) symbolCounts.set(r.symbol, (symbolCounts.get(r.symbol) ?? 0) + 1);
  const distinctSymbols = symbolCounts.size;
  let topSymbol = "";
  let topCount = 0;
  for (const [sym, count] of symbolCounts) {
    if (count > topCount) {
      topSymbol = sym;
      topCount = count;
    }
  }
  const topSymbolPct = pct(topCount, total);
  if (topSymbolPct >= CONCENTRATION_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "excessive_concentration",
      label: "Excessive Concentration",
      detail: `${topSymbol} accounts for ${topSymbolPct}% of closed trades (${topCount}/${total}).`,
      severity: "elevated",
      tradeCount: topCount,
    });
  }
  const diversificationPct = pct(distinctSymbols, total);
  if (diversificationPct >= DIVERSIFICATION_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "strong_diversification",
      label: "Strong Diversification",
      detail: `${distinctSymbols} distinct symbols across ${total} closed trades (${diversificationPct}% unique).`,
      severity: "positive",
      tradeCount: distinctSymbols,
    });
  }

  const winners = reviews.filter((r) => (r.realizedPnl ?? 0) > 0);
  const earlyExits = hasTag("winner_closed_early");
  const earlyExitPct = pct(earlyExits.length, winners.length);
  if (winners.length >= MIN_TRADES_FOR_PATTERN && earlyExitPct >= EARLY_EXIT_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "frequent_early_exits",
      label: "Frequent Early Exits",
      detail: `${earlyExitPct}% of winning trades (${earlyExits.length}/${winners.length}) were closed manually before reaching the platform's own profit-target rule.`,
      severity: "watch",
      tradeCount: earlyExits.length,
    });
  }

  const losers = reviews.filter((r) => (r.realizedPnl ?? 0) < 0);
  const heldTooLong = hasTag("loss_ran_beyond_plan");
  const heldTooLongPct = pct(heldTooLong.length, losers.length);
  if (losers.length >= MIN_TRADES_FOR_PATTERN && heldTooLongPct >= EARLY_EXIT_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "holding_losers_too_long",
      label: "Holding Losing Trades Too Long",
      detail: `${heldTooLongPct}% of losing trades (${heldTooLong.length}/${losers.length}) exceeded the platform's own configured stop-loss bound.`,
      severity: "elevated",
      tradeCount: heldTooLong.length,
    });
  }

  const earningsHeld = hasTag("held_through_earnings");
  const earningsHeldPct = pct(earningsHeld.length, total);
  if (earningsHeldPct >= OVERSIZING_PATTERN_THRESHOLD_PCT) {
    patterns.push({
      code: "repeated_earnings_exposure",
      label: "Repeated Earnings Exposure",
      detail: `${earningsHeldPct}% of closed trades (${earningsHeld.length}/${total}) were held through a real (SIMULATED) earnings event.`,
      severity: "watch",
      tradeCount: earningsHeld.length,
    });
  }

  return patterns;
}

// A rolling-window trend, reusing the shared computeTrend() primitive
// (intelligenceTrend.ts) exactly as every other engine in this codebase
// already does — never a second, competing trend formula. Compares the
// rule-based-exit rate over the most recent window of trades against the
// rate over the earlier trades, honestly reporting insufficient_history
// when there's no earlier window to compare against.
export const BEHAVIOR_TREND_WINDOW = 5;

export interface BehaviorTrend {
  direction: TrendDirection;
  detail: string;
  asOfTradeId: number;
  asOfDate: string;
}

function computeBehaviorTrend(reviews: TradeReview[]): BehaviorTrend | null {
  if (reviews.length < BEHAVIOR_TREND_WINDOW * 2) return null;
  // reviews are already sorted newest-first.
  const recent = reviews.slice(0, BEHAVIOR_TREND_WINDOW);
  const earlier = reviews.slice(BEHAVIOR_TREND_WINDOW);
  const ruleBasedRate = (set: TradeReview[]) =>
    pct(
      set.filter((r) => r.decisionQuality.some((t) => t.code === "exit_stop_loss_rule" || t.code === "exit_profit_target_rule")).length,
      set.length,
    );
  const recentRate = ruleBasedRate(recent);
  const earlierRate = ruleBasedRate(earlier);
  const trend = computeTrend(recentRate, earlierRate);
  if (trend.direction === "insufficient_history") return null;
  return {
    direction: trend.direction,
    detail: `Rule-based exit rate over the last ${BEHAVIOR_TREND_WINDOW} closed trades: ${recentRate}% (prior trades: ${earlierRate}%).`,
    asOfTradeId: recent[0].tradeId,
    asOfDate: recent[0].closeDate ?? recent[0].openDate,
  };
}

// ─── Learning Recommendations ────────────────────────────────────────────────
// Never a trade recommendation — education only. Reuses the exact same
// crossLinkFor() technique lib/portfolioAnalyst.ts's own Learning Summary
// already established (Phase 8, Sprint 3) — a small, local, disclosed
// re-implementation rather than importing a private helper from that
// file (portfolioAnalyst.ts is explicitly out of scope for modification
// this sprint).

export interface LearningCrossLink {
  category: string;
  lessonHref: string | null;
  lessonTitle: string | null;
  glossaryHref: string | null;
  glossaryTerm: string | null;
  strategyHref: string | null;
  strategyLabel: string | null;
}

const PATTERN_CATEGORY: Record<string, LearningCategory> = {
  oversizing: "buying_power",
  excessive_concentration: "concentration",
  strong_diversification: "diversification",
  repeated_earnings_exposure: "event_risk",
};

const PATTERN_GLOSSARY_KEY: Record<string, string> = {
  oversizing: "position-sizing",
  stable_position_sizing: "position-sizing",
  consistent_discipline: "decision-quality",
  excessive_concentration: "concentration",
  strong_diversification: "diversification",
  frequent_early_exits: "decision-quality",
  holding_losers_too_long: "max-loss",
  repeated_earnings_exposure: "event-risk",
};

function crossLinkForPattern(code: string): LearningCrossLink {
  const category = PATTERN_CATEGORY[code];
  const links = category ? learningLinksFor(category) : [];
  const lesson = links.find((l) => l.label.startsWith("Lesson:")) ?? null;
  const glossaryLink = links.find((l) => l.label.startsWith("Glossary:")) ?? null;

  const decisionTopic = getLearningTopic("institutional", "institutional-decision-quality");
  const fallbackLesson = lesson ?? (decisionTopic ? { href: `/learn/paths/institutional/institutional-decision-quality`, label: `Lesson: ${decisionTopic.title}` } : null);

  const glossaryKey = PATTERN_GLOSSARY_KEY[code];
  const glossaryTerm = glossaryKey ? getGlossaryTerm(glossaryKey) : null;

  return {
    category: category ?? "decision_quality",
    lessonHref: fallbackLesson?.href ?? null,
    lessonTitle: fallbackLesson ? fallbackLesson.label.replace(/^Lesson:\s*/, "") : null,
    glossaryHref: glossaryTerm ? `/learn/glossary/${glossaryTerm.key}` : (glossaryLink?.href ?? null),
    glossaryTerm: glossaryTerm ? glossaryTerm.term : (glossaryLink ? glossaryLink.label.replace(/^Glossary:\s*/, "") : null),
    strategyHref: null,
    strategyLabel: null,
  };
}

// Decision-quality codes map to a real, existing StrategyAcademy entry
// where a genuine thematic match exists — never fabricated.
const DECISION_STRATEGY: Partial<Record<DecisionQualityCode, StrategyAcademyKey>> = {
  sizing_exceeded: "vertical_spread",
  winner_closed_early: "covered_call",
  loss_ran_beyond_plan: "iron_condor",
  held_through_earnings: "calendar_spread",
};

function crossLinkForDecisionCode(code: DecisionQualityCode): LearningCrossLink {
  const base = crossLinkForPattern(code);
  const strategyKey = DECISION_STRATEGY[code];
  const strategy = strategyKey ? getStrategyAcademyEntry(strategyKey) : null;
  return {
    ...base,
    strategyHref: strategy ? `/learn/strategy-academy/${strategy.key}` : null,
    strategyLabel: strategy?.label ?? null,
  };
}

// ─── Journal Timeline ────────────────────────────────────────────────────────
// A new, purpose-built chronological event log — reusing the Timeline
// Engine's own established TimelineEntry-shaped vocabulary/status
// conventions (Phase 8, Sprint 1) as its structural pattern, NOT
// importing intelligenceTimeline.ts's own buildTimeline() directly,
// since that function solves a genuinely different problem (day-over-day
// PORTFOLIO OBSERVATION diffing against intelligence_snapshots), not a
// chronological log of already-timestamped trade-lifecycle events. Every
// entry below carries a REAL, stored timestamp — trade_opened/
// trade_closed from trades.openDate/closeDate, learning_completed from
// learning_progress.completedAt (getLearningProgress(), Phase 8 Sprint
// 2) — never a fabricated event time. "Review generated" is not a
// separately-timestamped event (a Trade Review is computed fresh on
// every request, never persisted) — it is represented as part of the
// same trade_closed entry, since a review becomes available the instant
// a trade closes. "Behaviour changes" is represented by the one, real,
// computeTrend()-derived BehaviorTrend above, anchored at the real close
// date of the most recent trade in its own comparison window — never a
// second, fabricated timeline entry with no real backing data.

export type JournalTimelineEventType = "trade_opened" | "trade_closed" | "learning_completed" | "behaviour_change";

export interface JournalTimelineEvent {
  type: JournalTimelineEventType;
  label: string;
  timestamp: string;
  tradeId: number | null;
}

function buildJournalTimeline(
  reviews: TradeReview[],
  learningHistory: { itemType: string; itemKey: string; completedAt: string | null }[],
  behaviorTrend: BehaviorTrend | null,
): JournalTimelineEvent[] {
  const events: JournalTimelineEvent[] = [];
  for (const r of reviews) {
    events.push({ type: "trade_opened", label: `Opened ${r.symbol} ${r.strategy.replace(/_/g, " ")}`, timestamp: r.openDate, tradeId: r.tradeId });
    if (r.closeDate) {
      events.push({
        type: "trade_closed",
        label: `Closed ${r.symbol} ${r.strategy.replace(/_/g, " ")} — review generated (${r.exitReason ?? "unknown reason"})`,
        timestamp: r.closeDate,
        tradeId: r.tradeId,
      });
    }
  }
  for (const h of learningHistory) {
    if (h.completedAt) {
      events.push({ type: "learning_completed", label: `Completed ${h.itemType}: ${h.itemKey}`, timestamp: h.completedAt, tradeId: null });
    }
  }
  if (behaviorTrend) {
    events.push({
      type: "behaviour_change",
      label: `Discipline trend ${behaviorTrend.direction}: ${behaviorTrend.detail}`,
      timestamp: behaviorTrend.asOfDate,
      tradeId: behaviorTrend.asOfTradeId,
    });
  }
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── Top-level assembly ──────────────────────────────────────────────────────

export interface DecisionQualitySummary {
  sizingRespectedRatePct: number;
  ruleBasedExitRatePct: number;
  averageDisciplineScore: number;
}

export interface AITradeJournalResult {
  paperTradingMode: true;
  deterministicAnalysis: true;
  educationalOnly: true;
  totalClosedTrades: number;
  recentTrades: TradeReview[];
  behaviorPatterns: BehaviorPattern[];
  behaviorTrend: BehaviorTrend | null;
  disciplineScore: number;
  decisionQualitySummary: DecisionQualitySummary;
  strengths: BehaviorPattern[];
  areasToImprove: BehaviorPattern[];
  learningRecommendations: LearningCrossLink[];
  timeline: JournalTimelineEvent[];
  generatedAt: string;
}

async function closedTrades(userId: string): Promise<Trade[]> {
  return db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "closed"), eq(tradesTable.userId, userId)))
    .orderBy(desc(tradesTable.closeDate));
}

async function linkedJournalEntriesFor(userId: string, tradeIds: number[]): Promise<Map<number, { id: number; title: string; content: string }>> {
  const map = new Map<number, { id: number; title: string; content: string }>();
  if (tradeIds.length === 0) return map;
  const rows = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  for (const row of rows) {
    if (row.tradeId !== null && tradeIds.includes(row.tradeId) && !map.has(row.tradeId)) {
      map.set(row.tradeId, { id: row.id, title: row.title, content: row.content });
    }
  }
  return map;
}

export async function buildTradeJournal(userId: string): Promise<AITradeJournalResult> {
  const [trades, settings, accountValue] = [
    await closedTrades(userId),
    await getSettingsRow(userId),
    await getAccountValue(userId),
  ];

  const journalMap = await linkedJournalEntriesFor(userId, trades.map((t) => t.id));

  const allReviews = trades.map((t) =>
    buildTradeReviewFor(t, accountValue, settings.maxRiskPerTrade, settings.profitTarget75, journalMap.get(t.id) ?? null),
  );

  const behaviorPatterns = analyzeBehaviour(allReviews);
  const behaviorTrend = computeBehaviorTrend(allReviews);

  const sizingRespected = allReviews.filter((r) => r.decisionQuality.some((t) => t.code === "sizing_respected"));
  const ruleBasedExits = allReviews.filter((r) => r.decisionQuality.some((t) => t.code === "exit_stop_loss_rule" || t.code === "exit_profit_target_rule"));
  const sizingRespectedRatePct = pct(sizingRespected.length, allReviews.length);
  const ruleBasedExitRatePct = pct(ruleBasedExits.length, allReviews.length);
  const disciplineScore = allReviews.length > 0 ? round((sizingRespectedRatePct + ruleBasedExitRatePct) / 2, 1) : 0;

  const strengths = behaviorPatterns.filter((p) => p.severity === "positive");
  const areasToImprove = behaviorPatterns.filter((p) => p.severity !== "positive");

  const learningRecommendations = dedupeCrossLinks(areasToImprove.map((p) => crossLinkForPattern(p.code)));

  const learningProgress = await getLearningProgress(userId);
  const timeline = buildJournalTimeline(allReviews.slice(0, MAX_REVIEWS_RETURNED), learningProgress.recentHistory, behaviorTrend);

  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    educationalOnly: true,
    totalClosedTrades: allReviews.length,
    recentTrades: allReviews.slice(0, MAX_REVIEWS_RETURNED),
    behaviorPatterns,
    behaviorTrend,
    disciplineScore,
    decisionQualitySummary: { sizingRespectedRatePct, ruleBasedExitRatePct, averageDisciplineScore: disciplineScore },
    strengths,
    areasToImprove,
    learningRecommendations,
    timeline,
    generatedAt: new Date().toISOString(),
  };
}

function dedupeCrossLinks(links: LearningCrossLink[]): LearningCrossLink[] {
  const seen = new Set<string>();
  const out: LearningCrossLink[] = [];
  for (const l of links) {
    const key = `${l.lessonHref ?? ""}|${l.glossaryHref ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

// Exported for a single, focused per-trade lookup (the Trade Review's own
// "supporting analytics only" requirement) without recomputing behaviour
// analysis over the whole history — reuses buildTradeReviewFor() directly.
export async function buildSingleTradeReview(userId: string, tradeId: number): Promise<TradeReview | null> {
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId), eq(tradesTable.status, "closed")));
  if (!trade) return null;
  const settings = await getSettingsRow(userId);
  const accountValue = await getAccountValue(userId);
  const journalMap = await linkedJournalEntriesFor(userId, [trade.id]);
  return buildTradeReviewFor(trade, accountValue, settings.maxRiskPerTrade, settings.profitTarget75, journalMap.get(trade.id) ?? null);
}

// Exposed for the Learning Recommendations UI to resolve a specific
// decision-quality code's own cross-link (e.g. from a Trade Review card),
// reusing the exact same crossLinkForDecisionCode() the aggregate
// learningRecommendations list already uses.
export function learningCrossLinkForDecisionCode(code: DecisionQualityCode): LearningCrossLink {
  return crossLinkForDecisionCode(code);
}

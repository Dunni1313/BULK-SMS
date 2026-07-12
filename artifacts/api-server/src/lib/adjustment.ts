// Task #20 — Trade Adjustment Engine (deterministic core).
//
// For an open position this computes a fixed set of monitoring signals from the
// SAME canonical market math the rest of the engine uses (computeTradeGreeks,
// getSnapshot, probAbove/popVol, computeStopLoss) and then selects exactly ONE
// recommended action via a documented, pure precedence ladder.
//
// This is the "math" half of the hybrid: every number here is the source of
// truth. The LLM layer (coachLLM.narrateAdjustment) only narrates WHY — it never
// computes a figure and never changes the recommended action. The engine is also
// advisory by default; auto-execution (lib/autoAdjustment.ts) only ever acts on
// the close/de-risk subset and only when full_auto + the kill switch are armed.

import { getSnapshot, probAbove, popVol } from "./optionsMath.js";
import { computeTradeGreeks, type StoredLeg } from "./serverState.js";
import { computeStopLoss } from "./risk.js";

export type AdjustmentAction =
  | "hold"
  | "close_for_profit"
  | "close_for_loss"
  | "roll_threatened"
  | "roll_untested"
  | "convert"
  | "reduce_risk"
  | "do_nothing";

export type AdjustmentSeverity = "none" | "info" | "warning" | "critical";

// The subset of actions the auto-adjustment loop is permitted to execute. Rolling
// and converting are multi-leg structural changes and are NEVER auto-run.
export const AUTO_ACTIONABLE: ReadonlySet<AdjustmentAction> = new Set<AdjustmentAction>([
  "close_for_profit",
  "close_for_loss",
  "reduce_risk",
]);

export interface AdjustmentSignal {
  key: string;
  label: string;
  triggered: boolean;
  value: number;
  threshold: number;
  detail: string;
}

export interface AdjustmentGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface AdjustmentResult {
  tradeId: number;
  symbol: string;
  symbolName: string;
  strategy: string;
  strategyLabel: string;
  status: string;
  action: AdjustmentAction;
  actionLabel: string;
  severity: AdjustmentSeverity;
  rationale: string;
  signals: AdjustmentSignal[];
  triggeredSignals: string[];
  autoActionable: boolean;
  // Source-of-truth numbers.
  underlyingPrice: number;
  daysToExpiry: number;
  currentPnl: number;
  currentPnlPercent: number;
  maxLoss: number;
  maxProfit: number;
  entryPop: number;
  currentPop: number;
  nearestShortStrike: number | null;
  distanceToShortPct: number | null;
  threatenedSide: "call" | "put" | null;
  greeks: AdjustmentGreeks;
  assignmentRisk: string;
  isCredit: boolean;
  disclaimer: string;
}

export const ADJUSTMENT_DISCLAIMER =
  "Advisory only. The Ravish Engine never adjusts a position automatically unless Full-Auto and the auto-adjust switch are armed; any change is your decision.";

const STRATEGY_LABELS: Record<string, string> = {
  iron_condor: "Iron Condor",
  iron_fly: "Iron Fly",
  calendar_spread: "Calendar Spread",
  earnings: "Earnings Play",
};

const ACTION_LABELS: Record<AdjustmentAction, string> = {
  hold: "Hold",
  close_for_profit: "Close for profit",
  close_for_loss: "Close for loss",
  roll_threatened: "Roll the threatened side",
  roll_untested: "Roll the untested side",
  convert: "Convert the position",
  reduce_risk: "Reduce risk",
  do_nothing: "Do nothing",
};

function strategyLabel(strategy: string): string {
  return STRATEGY_LABELS[strategy] ?? strategy.replace(/_/g, " ");
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ─── Pure action selection (no I/O — unit-tested in phase8.adjustment.test.ts) ─

export interface SelectionInput {
  isOpen: boolean;
  profitPct: number; // unrealized P&L as % of max profit (negative when losing)
  profitTarget50: number;
  profitTarget75: number;
  profitTarget90: number;
  lossPct: number; // unrealized loss as % of max loss (>=0; 0 when not losing)
  unrealizedPnl: number;
  stopLoss: number; // negative dollars
  shortBreached: boolean; // spot within the proximity band of a short strike
  deltaDrift: boolean;
  popDrop: boolean;
  ivExpansion: boolean;
  dteLow: boolean;
}

export interface SelectionResult {
  action: AdjustmentAction;
  severity: AdjustmentSeverity;
}

// Documented precedence ladder. First match wins, so the most urgent / protective
// action always takes priority over softer management. Closing for a realized loss
// (stop breach) outranks rolling; rolling to repair requires time on the clock
// (not dteLow) — without it we de-risk instead.
export function selectAdjustment(i: SelectionInput): SelectionResult {
  if (!i.isOpen) return { action: "do_nothing", severity: "none" };

  // 1. Lock in profit once the target band is reached.
  if (i.profitPct >= i.profitTarget90) return { action: "close_for_profit", severity: "info" };
  if (i.profitPct >= i.profitTarget75) return { action: "close_for_profit", severity: "info" };

  // 2. Hard stop: a breached stop-loss exits immediately.
  if (i.unrealizedPnl <= i.stopLoss) return { action: "close_for_loss", severity: "critical" };

  // 3. Loss at/over half of max loss: roll the threatened side if there's time to
  //    repair, otherwise cut it.
  if (i.lossPct >= 50) {
    if (i.shortBreached && !i.dteLow) return { action: "roll_threatened", severity: "critical" };
    return { action: "close_for_loss", severity: "critical" };
  }

  // 4. A short strike is under pressure but the loss is still contained.
  if (i.shortBreached) {
    if (i.dteLow) return { action: "reduce_risk", severity: "warning" };
    return { action: "roll_threatened", severity: "warning" };
  }

  // 5. Directional delta has drifted past tolerance without a strike breach.
  if (i.deltaDrift) {
    if (i.dteLow) return { action: "reduce_risk", severity: "warning" };
    if (i.popDrop && i.ivExpansion) return { action: "convert", severity: "warning" };
    return { action: "roll_untested", severity: "warning" };
  }

  // 6. Probability eroding while volatility expands — restructure (e.g. IC→IF).
  if (i.popDrop && i.ivExpansion) return { action: "convert", severity: "warning" };

  // 7. Late-cycle gamma management on an otherwise healthy position.
  if (i.dteLow) {
    if (i.profitPct >= i.profitTarget50) return { action: "close_for_profit", severity: "info" };
    return { action: "reduce_risk", severity: "info" };
  }

  // 8. Partial profit in the 50–75% band — reasonable to take.
  if (i.profitPct >= i.profitTarget50) return { action: "close_for_profit", severity: "info" };

  // 9. Nothing actionable — keep holding.
  return { action: "hold", severity: "none" };
}

// ─── Full evaluation ─────────────────────────────────────────────────────────

interface AdjSettings {
  stopLossMultiplier: number;
  profitTarget50: number;
  profitTarget75: number;
  profitTarget90: number;
  adjDeltaDriftTrigger: number;
  adjPopDropTrigger: number;
  adjShortStrikeProximityPct: number;
  adjIvExpansionTrigger: number;
  adjDteTrigger: number;
}

interface AdjTrade {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  legs: unknown;
  credit: number;
  maxProfit: number;
  maxLoss: number;
  pop: number;
  expiration: string | null;
  entryIv: number | null;
}

export function evaluateTradeAdjustment(trade: AdjTrade, settings: AdjSettings): AdjustmentResult {
  const snap = getSnapshot(trade.symbol);
  const price = snap?.price ?? 0;
  const iv = snap?.iv ?? 0;
  const ivRank = snap?.ivRank ?? 0;
  const symbolName = snap?.name ?? trade.symbol;

  const g = computeTradeGreeks(trade);
  const dte = daysUntil(trade.expiration);
  const T = Math.max(dte, 1) / 365;
  const legs = (trade.legs as StoredLeg[]) ?? [];
  const isCredit = trade.credit > 0;
  const isOpen = trade.status === "open";

  const stopLoss = computeStopLoss(trade.credit, trade.maxLoss, settings.stopLossMultiplier);

  // Short strikes by type.
  const sellCalls = legs.filter((l) => l.side === "sell" && l.optionType === "call");
  const sellPuts = legs.filter((l) => l.side === "sell" && l.optionType === "put");
  const shortCall = sellCalls.length ? Math.max(...sellCalls.map((l) => l.strike)) : null;
  const shortPut = sellPuts.length ? Math.min(...sellPuts.map((l) => l.strike)) : null;

  // Directional gap to each short, as a fraction of spot: POSITIVE when the short
  // is still out-of-the-money (safe) and NEGATIVE once spot has breached it (ITM).
  // Using a signed gap (not absolute distance) is essential — a deeply breached
  // short is the MOST threatened, not the least, so it must order ahead of an OTM
  // short and must always trigger the proximity signal.
  const callGap = shortCall != null && price > 0 ? (shortCall - price) / price : Infinity;
  const putGap = shortPut != null && price > 0 ? (price - shortPut) / price : Infinity;
  let nearestShortStrike: number | null = null;
  let threatenedSide: "call" | "put" | null = null;
  let distanceToShortPct: number | null = null;
  let shortBreached = false;
  if (Number.isFinite(callGap) || Number.isFinite(putGap)) {
    if (callGap <= putGap) {
      nearestShortStrike = shortCall;
      threatenedSide = "call";
      distanceToShortPct = round(Math.abs(callGap) * 100, 2);
      shortBreached = callGap < 0;
    } else {
      nearestShortStrike = shortPut;
      threatenedSide = "put";
      distanceToShortPct = round(Math.abs(putGap) * 100, 2);
      shortBreached = putGap < 0;
    }
  }

  // Current POP. For two-sided credit structures (condor/fly/earnings) recompute
  // from the live spot/IV using the same breakeven math as the scanner. Calendars
  // have no opposing short pair and an intractable closed form, so we hold the
  // entry POP as the current estimate.
  const lots = Math.max(1, ...legs.map((l) => l.quantity));
  const creditPerShare = lots > 0 ? trade.credit / 100 / lots : 0;
  let currentPop = trade.pop;
  if (shortCall != null && shortPut != null && price > 0) {
    const beHigh = shortCall + creditPerShare;
    const beLow = shortPut - creditPerShare;
    const vol = popVol(iv);
    const popFrac = probAbove(price, beLow, T, vol) - probAbove(price, beHigh, T, vol);
    currentPop = round(Math.max(0, Math.min(1, popFrac)) * 100, 1);
  }

  // Signals.
  const absDelta = Math.abs(g.delta);
  const lossPct = g.unrealizedPnl < 0 && trade.maxLoss > 0 ? round((-g.unrealizedPnl / trade.maxLoss) * 100, 1) : 0;
  const profitPct = trade.maxProfit > 0 ? round((g.unrealizedPnl / trade.maxProfit) * 100, 1) : 0;
  const popDropValue = round(trade.pop - currentPop, 1);

  const hasEntryIv = trade.entryIv != null && trade.entryIv > 0;
  const ivChangePct = hasEntryIv ? round(((iv - (trade.entryIv as number)) / (trade.entryIv as number)) * 100, 1) : ivRank;
  const ivThreshold = hasEntryIv ? settings.adjIvExpansionTrigger : 70;
  const ivExpansion = ivChangePct >= ivThreshold;

  // A short is "under pressure" when spot is within the proximity band OR has already
  // breached it (ITM). Breach must always trigger regardless of how deep it has gone.
  const proximityTriggered =
    threatenedSide != null &&
    (shortBreached ||
      (distanceToShortPct != null && distanceToShortPct <= settings.adjShortStrikeProximityPct));
  const deltaDrift = absDelta >= settings.adjDeltaDriftTrigger;
  const popDrop = popDropValue >= settings.adjPopDropTrigger;
  const dteLow = dte <= settings.adjDteTrigger;
  const stopBreached = g.unrealizedPnl <= stopLoss;
  const lossSignal = lossPct >= 50;
  const profitSignal = profitPct >= settings.profitTarget50;

  const signals: AdjustmentSignal[] = [
    {
      key: "delta_drift",
      label: "Delta drift",
      triggered: deltaDrift,
      value: round(absDelta, 3),
      threshold: settings.adjDeltaDriftTrigger,
      detail: `Net position delta ${round(g.delta, 3)} (|Δ| ${round(absDelta, 3)} vs ${settings.adjDeltaDriftTrigger} trigger)`,
    },
    {
      key: "short_strike_proximity",
      label: "Short strike proximity",
      triggered: proximityTriggered,
      value: distanceToShortPct ?? 999,
      threshold: settings.adjShortStrikeProximityPct,
      detail:
        nearestShortStrike != null
          ? shortBreached
            ? `Spot ${round(price, 2)} has BREACHED the ${threatenedSide} short at ${nearestShortStrike} (${distanceToShortPct}% ITM)`
            : `Spot ${round(price, 2)} is ${distanceToShortPct}% from the ${threatenedSide} short at ${nearestShortStrike}`
          : "No short strike to test (debit/calendar structure)",
    },
    {
      key: "pop_drop",
      label: "POP drop",
      triggered: popDrop,
      value: popDropValue,
      threshold: settings.adjPopDropTrigger,
      detail: `POP ${currentPop}% now vs ${round(trade.pop, 1)}% at entry (${popDropValue >= 0 ? "-" : "+"}${Math.abs(popDropValue)} pts)`,
    },
    {
      key: "loss",
      label: "Loss ≥ 50% max loss",
      triggered: lossSignal,
      value: lossPct,
      threshold: 50,
      detail: stopBreached
        ? `Stop-loss breached: P&L $${round(g.unrealizedPnl, 0)} ≤ stop $${round(stopLoss, 0)}`
        : `Open P&L $${round(g.unrealizedPnl, 0)} = ${lossPct}% of $${round(trade.maxLoss, 0)} max loss`,
    },
    {
      key: "profit",
      label: "Profit target",
      triggered: profitSignal,
      value: profitPct,
      threshold: settings.profitTarget50,
      detail: `Open P&L $${round(g.unrealizedPnl, 0)} = ${profitPct}% of max profit (targets ${settings.profitTarget50}/${settings.profitTarget75}/${settings.profitTarget90}%)`,
    },
    {
      key: "iv_expansion",
      label: hasEntryIv ? "IV expansion" : "IV elevated (rank proxy)",
      triggered: ivExpansion,
      value: ivChangePct,
      threshold: ivThreshold,
      detail: hasEntryIv
        ? `IV ${round(iv, 3)} vs entry ${round(trade.entryIv as number, 3)} (${ivChangePct >= 0 ? "+" : ""}${ivChangePct}% vs ${ivThreshold}% trigger)`
        : `Entry IV not recorded — using IV rank ${ivRank} vs ${ivThreshold} proxy`,
    },
    {
      key: "dte",
      label: "Days to expiry",
      triggered: dteLow,
      value: dte,
      threshold: settings.adjDteTrigger,
      detail: `${dte} DTE (manage gamma at ≤ ${settings.adjDteTrigger})`,
    },
  ];

  const { action, severity } = selectAdjustment({
    isOpen,
    profitPct,
    profitTarget50: settings.profitTarget50,
    profitTarget75: settings.profitTarget75,
    profitTarget90: settings.profitTarget90,
    lossPct,
    unrealizedPnl: g.unrealizedPnl,
    stopLoss,
    shortBreached: proximityTriggered,
    deltaDrift,
    popDrop,
    ivExpansion,
    dteLow,
  });

  const triggeredSignals = signals.filter((s) => s.triggered).map((s) => s.label);
  const rationale = buildRationale(action, {
    symbol: trade.symbol,
    strategyLabel: strategyLabel(trade.strategy),
    threatenedSide,
    nearestShortStrike,
    distanceToShortPct,
    profitPct,
    lossPct,
    dte,
    currentPop,
    entryPop: round(trade.pop, 1),
    unrealizedPnl: round(g.unrealizedPnl, 0),
    triggeredSignals,
  });

  const assignmentRisk = buildAssignmentRisk(threatenedSide, nearestShortStrike, distanceToShortPct, dte, isCredit, shortBreached);

  return {
    tradeId: trade.id,
    symbol: trade.symbol,
    symbolName,
    strategy: trade.strategy,
    strategyLabel: strategyLabel(trade.strategy),
    status: trade.status,
    action,
    actionLabel: ACTION_LABELS[action],
    severity,
    rationale,
    signals,
    triggeredSignals,
    autoActionable: isOpen && AUTO_ACTIONABLE.has(action),
    underlyingPrice: round(price, 2),
    daysToExpiry: dte,
    currentPnl: round(g.unrealizedPnl, 2),
    currentPnlPercent: g.unrealizedPnlPercent,
    maxLoss: round(trade.maxLoss, 2),
    maxProfit: round(trade.maxProfit, 2),
    entryPop: round(trade.pop, 1),
    currentPop,
    nearestShortStrike,
    distanceToShortPct,
    threatenedSide,
    greeks: { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega },
    assignmentRisk,
    isCredit,
    disclaimer: ADJUSTMENT_DISCLAIMER,
  };
}

interface RationaleCtx {
  symbol: string;
  strategyLabel: string;
  threatenedSide: "call" | "put" | null;
  nearestShortStrike: number | null;
  distanceToShortPct: number | null;
  profitPct: number;
  lossPct: number;
  dte: number;
  currentPop: number;
  entryPop: number;
  unrealizedPnl: number;
  triggeredSignals: string[];
}

function buildRationale(action: AdjustmentAction, c: RationaleCtx): string {
  const sideStrike =
    c.threatenedSide && c.nearestShortStrike != null
      ? `${c.threatenedSide} short ${c.nearestShortStrike} (${c.distanceToShortPct}% away)`
      : "the short strikes";
  switch (action) {
    case "close_for_profit":
      return `${c.symbol} ${c.strategyLabel} is at ${c.profitPct}% of max profit ($${c.unrealizedPnl}). Theta has done its work — banking the gain removes remaining tail risk.`;
    case "close_for_loss":
      return `${c.symbol} ${c.strategyLabel} is down ${c.lossPct}% of max loss ($${c.unrealizedPnl}) and has hit the exit rule. Cutting it caps the loss inside the defined-risk plan.`;
    case "roll_threatened":
      return `${c.symbol} is pressuring ${sideStrike} with ${c.dte} DTE of repair time. Rolling the tested side out/down collects credit and re-centers the structure.`;
    case "roll_untested":
      return `${c.symbol} delta has drifted but ${sideStrike} is not yet breached. Rolling the untested side toward the move rebalances delta and adds credit.`;
    case "convert":
      return `${c.symbol} POP has slipped to ${c.currentPop}% (from ${c.entryPop}%) as volatility expands. Converting the structure (e.g. tightening to an Iron Fly) restores the edge.`;
    case "reduce_risk":
      return `${c.symbol} ${c.strategyLabel} is under pressure with only ${c.dte} DTE — too little time to repair. Trimming size or closing reduces gamma exposure into expiry.`;
    case "hold":
      return `${c.symbol} ${c.strategyLabel} is inside all thresholds (POP ${c.currentPop}%, ${c.dte} DTE). No adjustment is warranted — let theta work.`;
    case "do_nothing":
    default:
      return `${c.symbol} ${c.strategyLabel} is not an open position, so there is nothing to adjust.`;
  }
}

function buildAssignmentRisk(
  side: "call" | "put" | null,
  strike: number | null,
  distancePct: number | null,
  dte: number,
  isCredit: boolean,
  breached: boolean,
): string {
  if (!isCredit || side == null || strike == null || distancePct == null) {
    return "Assignment risk is negligible — no short option is near the money.";
  }
  // A breached (ITM) short is the highest-risk state — never let a large absolute
  // distance past the strike read as "low".
  let level: string;
  if (breached) level = dte <= 7 ? "high" : "elevated";
  else if (distancePct <= 1) level = dte <= 7 ? "high" : "elevated";
  else if (distancePct <= 3) level = "elevated";
  else level = "low";
  const position = breached ? `is ${distancePct}% ITM` : `sits ${distancePct}% from spot`;
  return `Short ${side} at ${strike} ${position} with ${dte} DTE — assignment risk is ${level}. Early assignment is most likely if it goes deep ITM near expiry or across a dividend.`;
}

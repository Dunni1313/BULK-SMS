// Trade Adjustment & Roll/Convert Preview Simulator sprint — extends the
// existing Order Preview / Position Sizing composition layers with a
// read-only, dry-run "what would this adjustment look like" simulator for
// an EXISTING open position.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or closes an order, and NEVER performs a database write of any kind —
// every function here is read-only. It reuses the existing, unmodified
// adjustment engine directly:
//   - execution.ts's own buildAdjustmentTicket()/previewAdjustmentOrder()
//     (an alias for buildAdjustmentTicket) for the "roll_forward" and
//     "convert" intents — the exact same functions/numbers the real
//     roll/convert submit path uses.
//   - execution.ts's own previewOptionOrder()/canonicalQuote() for the
//     "close_replace" intent (composed here, see §"Close & Replace"
//     below — still 100% reused primitives, zero new pricing math).
//   - lib/adjustment.ts's own evaluateTradeAdjustment() to determine
//     which intent(s) a given position is actually eligible for, exactly
//     matching the real roll/convert submit path's own eligibility gate.
//   - serverState.ts's own computeTradeGreeks() for every Greeks figure.
//   - lib/positionSizing.ts's own buildSnapshot()/currentOpenTrades()
//     (exported last sprint for exactly this kind of reuse) for portfolio
//     exposure/concentration before and after.
// execution.ts, optionsMath.ts, risk.ts, and adjustment.ts are not
// modified by this sprint.
//
// ── Scope decision, disclosed here and in docs/Trade-Adjustment.md ──────
// The sprint's own requested picker lists 8 named adjustment shapes (Roll
// Forward, Roll Out, Roll Up, Roll Down, Roll Out & Up, Roll Out & Down,
// Convert Position, Close & Replace). The REUSED engine's own
// buildAdjustmentQuote() (execution.ts) always re-centers every strike on
// the current spot price at a fixed 45-day cycle for a roll, and always
// tightens/widens Iron Condor <-> Iron Fly for a convert — it has no
// parameter for shifting strikes independently of re-centering, or for
// extending expiration while holding strikes fixed. Per this project's
// established "never fabricate, always honestly disclose" discipline
// (see e.g. lib/positionSizing.ts's own sector-exposure and calendar-
// spread break-even disclosures), only 3 of the 8 requested shapes are
// genuinely computable by the reused engine — Roll Forward, Convert
// Position, and Close & Replace (a new, small, still-100%-reused
// composition, see below). The other 5 are honestly presented as
// selectable options in the UI but always report available:false with an
// explicit, consistent reason — never an invented strike-selection
// result.

import { db, tradesTable } from "@workspace/db";
import { and, eq, ne, inArray } from "drizzle-orm";
import {
  buildAdjustmentTicket,
  previewOptionOrder,
  TicketError,
  type ExecutionTicket,
  type AdjustmentSourcePosition,
  type OrderLeg,
} from "./execution.js";
import { evaluateTradeAdjustment } from "./adjustment.js";
import { computeTradeGreeks, getAccountValue, getSettingsRow, type StoredLeg } from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import { getLastBrokerCheckConnected, getLastSuccessfulBrokerCheck } from "./providers/alpacaBroker.js";
import { buildSnapshot, currentOpenTrades, type PortfolioSnapshot, type TradeRow } from "./positionSizing.js";

export type AdjustmentIntent =
  | "roll_forward"
  | "roll_out"
  | "roll_up"
  | "roll_down"
  | "roll_out_up"
  | "roll_out_down"
  | "convert"
  | "close_replace";

const ALL_INTENTS: readonly AdjustmentIntent[] = [
  "roll_forward",
  "roll_out",
  "roll_up",
  "roll_down",
  "roll_out_up",
  "roll_out_down",
  "convert",
  "close_replace",
];

const COMPUTABLE_INTENTS: ReadonlySet<AdjustmentIntent> = new Set(["roll_forward", "convert", "close_replace"]);

export const INTENT_LABELS: Record<AdjustmentIntent, string> = {
  roll_forward: "Roll Forward",
  roll_out: "Roll Out",
  roll_up: "Roll Up",
  roll_down: "Roll Down",
  roll_out_up: "Roll Out & Up",
  roll_out_down: "Roll Out & Down",
  convert: "Convert Position",
  close_replace: "Close & Replace",
};

const STRIKE_SHIFT_UNAVAILABLE_REASON =
  "This simulator's reused engine always re-centers every strike on the current spot price at a fixed 45-day cycle for a roll — it has no parameter for shifting strikes independently of re-centering, or for extending expiration while holding strikes fixed. This adjustment shape cannot be honestly distinguished from Roll Forward without new strike-selection logic outside this sprint's reuse-only scope.";

// Named, disclosed thresholds, matching last sprint's own precedent
// (BUYING_POWER_EXHAUSTION_THRESHOLD_PCT / MAX_LEVERAGE_RATIO in
// lib/positionSizing.ts) — kept as separate, independently-adjustable
// constants here since an adjustment's "after" position replaces rather
// than adds to the portfolio.
export const ADJUSTMENT_LEVERAGE_RATIO = 3;

export interface TradeAdjustmentInputIssue {
  field: "tradeId" | "intent" | "quantity";
  code: string;
  message: string;
}

export type AdjustmentCheckStatus = "ok" | "warning" | "blocked";

export interface TradeAdjustmentWarning {
  code: string;
  label: string;
  status: AdjustmentCheckStatus;
  detail: string;
}

export interface PositionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export type ComparisonDirection = "improved" | "worse" | "neutral" | "unknown";

export interface MetricComparison {
  code: string;
  label: string;
  before: number | null;
  after: number | null;
  change: number | null;
  direction: ComparisonDirection;
}

export interface BreakEvenPrice {
  label: string;
  price: number;
}

export type ProposedPosition = ExecutionTicket;

export interface TradeAdjustmentPreviewResult {
  available: boolean;
  inputIssues: TradeAdjustmentInputIssue[];
  intent: AdjustmentIntent | null;
  intentLabel: string | null;
  intentAvailable: boolean;
  intentUnavailableReason: string | null;
  existingPosition: AdjustmentSourcePosition | null;
  proposedPosition: ProposedPosition | null;
  netCashflow: number | null;
  greeksBefore: PositionGreeks | null;
  greeksAfter: PositionGreeks | null;
  breakEvenBefore: BreakEvenPrice[];
  breakEvenBeforeUnavailableReason: string | null;
  breakEvenAfter: BreakEvenPrice[];
  breakEvenAfterUnavailableReason: string | null;
  portfolioExposureBefore: PortfolioSnapshot;
  portfolioExposureAfter: PortfolioSnapshot | null;
  comparisons: MetricComparison[];
  riskWarnings: TradeAdjustmentWarning[];
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  accountValue: number;
  generatedAt: string;
}

export interface TradeAdjustmentPreviewInput {
  tradeId?: number | null;
  intent?: AdjustmentIntent | null;
  quantity?: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Strip persistence-only underscore-prefixed fields, matching
// lib/orderPreview.ts's own established publicTicket() helper exactly.
function publicTicket(t: ExecutionTicket): ExecutionTicket {
  const { _quote, _storedLegs, ...rest } = t as ExecutionTicket & {
    _quote: unknown;
    _storedLegs: unknown;
    _scannerResultId?: unknown;
  };
  void _quote;
  void _storedLegs;
  const { _scannerResultId, ...clean } = rest as Record<string, unknown>;
  void _scannerResultId;
  return clean as unknown as ExecutionTicket;
}

// Generalized over a minimal leg shape so it works for both
// AdjustmentSourceLeg (existing position) and OrderLeg (proposed
// ticket) — the same standard credit-spread break-even formula
// lib/positionSizing.ts's own deriveBreakEvens() established last
// sprint, computed only for iron condor / iron fly for the same
// disclosed reason (calendar/earnings involve multiple expirations).
function deriveBreakEvensGeneric(
  legs: { side: "buy" | "sell"; optionType: "call" | "put"; strike: number }[],
  strategy: string,
  creditPerShare: number,
): { breakEvens: BreakEvenPrice[]; reason: string | null } {
  if (strategy !== "iron_condor" && strategy !== "iron_fly") {
    return {
      breakEvens: [],
      reason:
        "Break-even is only computed for single-expiration credit spreads (iron condor / iron fly) in this simulator — calendar spreads and earnings plays involve multiple expirations, so a simple break-even formula would misrepresent the real payoff.",
    };
  }
  const shortPut = legs.find((l) => l.side === "sell" && l.optionType === "put");
  const shortCall = legs.find((l) => l.side === "sell" && l.optionType === "call");
  if (!shortPut || !shortCall) {
    return { breakEvens: [], reason: "Could not identify both short legs on this position." };
  }
  const lower = round2(shortPut.strike - creditPerShare);
  const upper = round2(shortCall.strike + creditPerShare);
  return { breakEvens: [{ label: "Lower", price: lower }, { label: "Upper", price: upper }], reason: null };
}

function positionGreeks(symbol: string, legs: unknown, credit: number, maxProfit: number): PositionGreeks {
  const g = computeTradeGreeks({ symbol, legs, credit, maxProfit });
  return { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega };
}

function notionalValueOf(legs: OrderLeg[], quantity: number): number {
  return round2(legs.reduce((sum, l) => sum + l.strike * 100 * l.ratioQty * quantity, 0));
}

function compareMetric(
  code: string,
  label: string,
  before: number | null,
  after: number | null,
  polarity: "lower_better" | "higher_better",
): MetricComparison {
  if (before === null || after === null) {
    return { code, label, before, after, change: null, direction: "unknown" };
  }
  const change = round2(after - before);
  let direction: ComparisonDirection;
  if (Math.abs(change) < 0.01) {
    direction = "neutral";
  } else if (polarity === "lower_better") {
    direction = change < 0 ? "improved" : "worse";
  } else {
    direction = change > 0 ? "improved" : "worse";
  }
  return { code, label, before, after, change, direction };
}

interface ExistingPositionData {
  trade: typeof tradesTable.$inferSelect;
  storedLegs: StoredLeg[];
  lots: number;
  greeks: PositionGreeks & { costToClose: number; unrealizedPnl: number };
  entryPricePerSpread: number;
}

async function loadExistingPosition(tradeId: number, userId: string): Promise<ExistingPositionData | null> {
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));
  if (!trade || trade.status !== "open") return null;

  const storedLegs = (trade.legs as StoredLeg[] | null) ?? [];
  const lots = Math.max(1, ...storedLegs.map((l) => l.quantity || 1));
  const full = computeTradeGreeks({ symbol: trade.symbol, legs: trade.legs, credit: trade.credit, maxProfit: trade.maxProfit });
  return {
    trade,
    storedLegs,
    lots,
    greeks: { delta: full.delta, gamma: full.gamma, theta: full.theta, vega: full.vega, costToClose: full.costToClose, unrealizedPnl: full.unrealizedPnl },
    entryPricePerSpread: lots > 0 ? round2(trade.credit / lots) : 0,
  };
}

function sourceAsPosition(existing: ExistingPositionData): AdjustmentSourcePosition {
  const sourceDte = existing.trade.expiration
    ? Math.max(0, Math.round((new Date(existing.trade.expiration).getTime() - Date.now()) / 86_400_000))
    : 0;
  return {
    tradeId: existing.trade.id,
    symbol: existing.trade.symbol,
    strategy: existing.trade.strategy,
    strategyLabel: existing.trade.strategy.replace(/_/g, " "),
    expiration: existing.trade.expiration,
    daysToExpiry: sourceDte,
    legs: existing.storedLegs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, quantity: l.quantity })),
    credit: round2(existing.trade.credit),
    maxProfit: round2(existing.trade.maxProfit),
    maxLoss: round2(existing.trade.maxLoss),
    pop: existing.trade.pop,
    costToClose: existing.greeks.costToClose,
    currentPnl: existing.greeks.unrealizedPnl,
    isCredit: existing.trade.credit >= 0,
  };
}

function buildWarnings(ctx: {
  missingPosition: boolean;
  invalidAdjustment: boolean;
  invalidAdjustmentDetail: string;
  brokerConnected: boolean | null;
  credentialsConfigured: boolean;
  concentrationAfterPct: number | null;
  maxPortfolioRisk: number;
  leverageRatio: number | null;
  conflictingOrder: boolean;
  conflictingAdjustment: boolean;
}): TradeAdjustmentWarning[] {
  const warnings: TradeAdjustmentWarning[] = [];

  warnings.push({
    code: "missing_position",
    label: "Missing position",
    status: ctx.missingPosition ? "blocked" : "ok",
    detail: ctx.missingPosition
      ? "This position could not be found, is not open, or does not belong to you."
      : "The position resolved successfully.",
  });

  warnings.push({
    code: "invalid_adjustment",
    label: "Invalid adjustment",
    status: ctx.invalidAdjustment ? "blocked" : "ok",
    detail: ctx.invalidAdjustment ? ctx.invalidAdjustmentDetail : "The selected adjustment is computable for this position.",
  });

  warnings.push({
    code: "buying_power_unavailable",
    label: "Buying power unavailable",
    status: ctx.brokerConnected === true ? "ok" : "warning",
    detail:
      ctx.brokerConnected === true
        ? "Verified against the most recent Broker Health check."
        : "No successful Broker Health check yet — buying power figures shown are a local estimate only, not verified against a live Alpaca account.",
  });

  warnings.push({
    code: "broker_disconnected",
    label: "Broker disconnected",
    status: ctx.brokerConnected === true ? "ok" : "warning",
    detail:
      ctx.brokerConnected === true
        ? "The most recent Broker Health check reported a connected Alpaca Paper Trading account."
        : ctx.brokerConnected === false
          ? "The most recent Broker Health check reported the broker as disconnected."
          : "No Broker Health check has been performed yet this session.",
  });

  warnings.push({
    code: "missing_credentials",
    label: "Missing credentials",
    status: ctx.credentialsConfigured ? "ok" : "warning",
    detail: ctx.credentialsConfigured
      ? "Alpaca Paper Trading credentials are configured."
      : "No Alpaca Paper Trading credentials are configured — this preview is fully computable without them, but no real adjustment could ever be routed.",
  });

  warnings.push({
    code: "excess_concentration",
    label: "Excess concentration",
    status:
      ctx.concentrationAfterPct === null
        ? "warning"
        : ctx.concentrationAfterPct > ctx.maxPortfolioRisk
          ? "blocked"
          : "ok",
    detail:
      ctx.concentrationAfterPct === null
        ? "Concentration after this adjustment could not be computed."
        : `Portfolio risk after this adjustment would be ${ctx.concentrationAfterPct.toFixed(1)}% (cap ${ctx.maxPortfolioRisk}%).`,
  });

  warnings.push({
    code: "excess_leverage",
    label: "Excess leverage",
    status:
      ctx.leverageRatio === null ? "warning" : ctx.leverageRatio > ADJUSTMENT_LEVERAGE_RATIO ? "blocked" : "ok",
    detail:
      ctx.leverageRatio === null
        ? "Leverage ratio could not be computed."
        : `Notional value of the proposed position is ${ctx.leverageRatio.toFixed(2)}x local account value (cap ${ADJUSTMENT_LEVERAGE_RATIO}x).`,
  });

  warnings.push({
    code: "existing_conflicting_order",
    label: "Existing conflicting order",
    status: ctx.conflictingOrder ? "warning" : "ok",
    detail: ctx.conflictingOrder
      ? "A pending (submitted but not yet filled) order already exists for this symbol."
      : "No pending order exists for this symbol.",
  });

  warnings.push({
    code: "existing_conflicting_adjustment",
    label: "Existing conflicting adjustment",
    status: ctx.conflictingAdjustment ? "warning" : "ok",
    detail: ctx.conflictingAdjustment
      ? "Another open position in this symbol also has a pending roll/convert recommendation — review both before adjusting either."
      : "No other open position in this symbol currently has a conflicting roll/convert recommendation.",
  });

  return warnings;
}

export async function buildTradeAdjustmentPreview(
  input: TradeAdjustmentPreviewInput,
  userId: string,
): Promise<TradeAdjustmentPreviewResult> {
  const generatedAt = new Date().toISOString();
  const inputIssues: TradeAdjustmentInputIssue[] = [];

  const tradeId = input.tradeId ?? null;
  const intent = input.intent ?? null;
  const quantity = input.quantity ?? null;

  if (tradeId == null) {
    inputIssues.push({ field: "tradeId", code: "missing_field", message: "A position (tradeId) is required." });
  }
  if (!intent) {
    inputIssues.push({ field: "intent", code: "missing_field", message: "An adjustment intent is required." });
  } else if (!ALL_INTENTS.includes(intent)) {
    inputIssues.push({ field: "intent", code: "invalid_intent", message: `"${intent}" is not a supported adjustment intent.` });
  }
  if (quantity != null && (!Number.isInteger(quantity) || quantity <= 0)) {
    inputIssues.push({ field: "quantity", code: "invalid_quantity", message: "Quantity must be a positive whole number." });
  }

  const settings = await getSettingsRow(userId);
  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();
  const accountValue = await getAccountValue(userId);

  const allTrades = await currentOpenTrades(userId);
  const portfolioExposureBefore = buildSnapshot(allTrades, accountValue);

  let existing: ExistingPositionData | null = null;
  if (tradeId != null && inputIssues.length === 0) {
    existing = await loadExistingPosition(tradeId, userId);
    if (!existing) {
      inputIssues.push({ field: "tradeId", code: "missing_position", message: "This position could not be found, is not open, or does not belong to you." });
    }
  }

  if (inputIssues.length > 0 || !existing) {
    return {
      available: false,
      inputIssues,
      intent,
      intentLabel: intent ? INTENT_LABELS[intent] : null,
      intentAvailable: false,
      intentUnavailableReason: null,
      existingPosition: null,
      proposedPosition: null,
      netCashflow: null,
      greeksBefore: null,
      greeksAfter: null,
      breakEvenBefore: [],
      breakEvenBeforeUnavailableReason: null,
      breakEvenAfter: [],
      breakEvenAfterUnavailableReason: null,
      portfolioExposureBefore,
      portfolioExposureAfter: null,
      comparisons: [],
      riskWarnings: buildWarnings({
        missingPosition: !existing,
        invalidAdjustment: false,
        invalidAdjustmentDetail: "",
        brokerConnected,
        credentialsConfigured,
        concentrationAfterPct: null,
        maxPortfolioRisk: settings.maxPortfolioRisk,
        leverageRatio: null,
        conflictingOrder: false,
        conflictingAdjustment: false,
      }),
      credentialsConfigured,
      brokerConnected,
      lastBrokerCheckAt,
      accountValue,
      generatedAt,
    };
  }

  const intentTyped = intent!;
  const existingPositionShaped = sourceAsPosition(existing);
  const greeksBefore = { delta: existing.greeks.delta, gamma: existing.greeks.gamma, theta: existing.greeks.theta, vega: existing.greeks.vega };
  const beforeBE = deriveBreakEvensGeneric(existingPositionShaped.legs, existing.trade.strategy, existing.entryPricePerSpread / 100);

  // Position conflicts (other trades in the SAME symbol, excluding the
  // position being adjusted itself) — plain, new, read-only queries.
  const otherTradesSameSymbol = allTrades.filter((t) => t.symbol === existing!.trade.symbol && t.id !== existing!.trade.id);
  const pendingRows = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), eq(tradesTable.symbol, existing.trade.symbol), eq(tradesTable.status, "pending"), ne(tradesTable.id, existing.trade.id)));
  const conflictingOrder = pendingRows.length > 0;

  let conflictingAdjustment = false;
  if (otherTradesSameSymbol.length > 0) {
    const siblingRows = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open"), inArray(tradesTable.id, otherTradesSameSymbol.map((t) => t.id))));
    for (const row of siblingRows) {
      const adj = evaluateTradeAdjustment(row, settings);
      if (adj.action === "roll_threatened" || adj.action === "roll_untested" || adj.action === "convert") {
        conflictingAdjustment = true;
        break;
      }
    }
  }

  // Determine eligibility for the SELECTED intent.
  if (!COMPUTABLE_INTENTS.has(intentTyped)) {
    return {
      available: false,
      inputIssues: [],
      intent: intentTyped,
      intentLabel: INTENT_LABELS[intentTyped],
      intentAvailable: false,
      intentUnavailableReason: STRIKE_SHIFT_UNAVAILABLE_REASON,
      existingPosition: existingPositionShaped,
      proposedPosition: null,
      netCashflow: null,
      greeksBefore,
      greeksAfter: null,
      breakEvenBefore: beforeBE.breakEvens,
      breakEvenBeforeUnavailableReason: beforeBE.reason,
      breakEvenAfter: [],
      breakEvenAfterUnavailableReason: STRIKE_SHIFT_UNAVAILABLE_REASON,
      portfolioExposureBefore,
      portfolioExposureAfter: null,
      comparisons: [],
      riskWarnings: buildWarnings({
        missingPosition: false,
        invalidAdjustment: true,
        invalidAdjustmentDetail: STRIKE_SHIFT_UNAVAILABLE_REASON,
        brokerConnected,
        credentialsConfigured,
        concentrationAfterPct: null,
        maxPortfolioRisk: settings.maxPortfolioRisk,
        leverageRatio: null,
        conflictingOrder,
        conflictingAdjustment,
      }),
      credentialsConfigured,
      brokerConnected,
      lastBrokerCheckAt,
      accountValue,
      generatedAt,
    };
  }

  let proposed: ExecutionTicket | null = null;
  let intentUnavailableReason: string | null = null;

  if (intentTyped === "roll_forward" || intentTyped === "convert") {
    const currentAdj = evaluateTradeAdjustment(existing.trade, settings);
    const eligible =
      intentTyped === "convert"
        ? currentAdj.action === "convert"
        : currentAdj.action === "roll_threatened" || currentAdj.action === "roll_untested";
    if (!eligible) {
      intentUnavailableReason = `This position's current recommendation is "${currentAdj.actionLabel}", not a roll or convert — only positions the deterministic adjustment engine has actually flagged as needing a ${
        intentTyped === "convert" ? "convert" : "roll"
      } can be previewed with ${INTENT_LABELS[intentTyped]}. Try Close & Replace instead, which works for any open position.`;
    } else {
      try {
        const raw = await buildAdjustmentTicket({ tradeId: existing.trade.id, quantity: quantity ?? existing.lots }, userId);
        proposed = publicTicket(raw);
      } catch (err) {
        if (err instanceof TicketError) {
          intentUnavailableReason = err.message;
        } else {
          throw err;
        }
      }
    }
  } else {
    // close_replace: works for ANY open position, regardless of its own
    // current adjustment recommendation — composed entirely from
    // execution.ts's own exported, unmodified previewOptionOrder().
    try {
      const raw = await previewOptionOrder({ symbol: existing.trade.symbol, strategy: existing.trade.strategy, quantity: quantity ?? existing.lots }, userId);
      proposed = publicTicket(raw);
    } catch (err) {
      if (err instanceof TicketError) {
        intentUnavailableReason = err.message;
      } else {
        throw err;
      }
    }
  }

  if (!proposed) {
    return {
      available: false,
      inputIssues: [],
      intent: intentTyped,
      intentLabel: INTENT_LABELS[intentTyped],
      intentAvailable: false,
      intentUnavailableReason,
      existingPosition: existingPositionShaped,
      proposedPosition: null,
      netCashflow: null,
      greeksBefore,
      greeksAfter: null,
      breakEvenBefore: beforeBE.breakEvens,
      breakEvenBeforeUnavailableReason: beforeBE.reason,
      breakEvenAfter: [],
      breakEvenAfterUnavailableReason: null,
      portfolioExposureBefore,
      portfolioExposureAfter: null,
      comparisons: [],
      riskWarnings: buildWarnings({
        missingPosition: false,
        invalidAdjustment: true,
        invalidAdjustmentDetail: intentUnavailableReason ?? "This adjustment could not be computed.",
        brokerConnected,
        credentialsConfigured,
        concentrationAfterPct: null,
        maxPortfolioRisk: settings.maxPortfolioRisk,
        leverageRatio: null,
        conflictingOrder,
        conflictingAdjustment,
      }),
      credentialsConfigured,
      brokerConnected,
      lastBrokerCheckAt,
      accountValue,
      generatedAt,
    };
  }

  // Net cashflow: the new structure's own open credit minus the cost to
  // close the existing position — the same formula buildAdjustmentTicket
  // itself uses internally, computed here from already-public numbers.
  const netCashflow = round2(proposed.netCredit - existing.greeks.costToClose);

  const afterTradeRow: TradeRow = {
    id: -1,
    symbol: proposed.symbol,
    strategy: proposed.strategy,
    credit: proposed.netCredit,
    maxLoss: proposed.maxLoss,
    maxProfit: proposed.maxProfit,
    legs: proposed.legs.map((l: OrderLeg) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.price, quantity: l.ratioQty * proposed!.quantity })),
  };
  const tradesExcludingSource = allTrades.filter((t) => t.id !== existing!.trade.id);
  const portfolioExposureAfter = buildSnapshot([...tradesExcludingSource, afterTradeRow], accountValue);

  const greeksAfter = positionGreeks(proposed.symbol, afterTradeRow.legs, proposed.netCredit, proposed.maxProfit);
  // The proposed ticket (a stripped ExecutionTicket) has no
  // entryPricePerSpread field of its own — that's Order Preview's own
  // derived field, not part of the base ticket — so it's re-derived here
  // with the exact same formula (netCredit / quantity / 100).
  const creditPerShareAfter = proposed.netCredit / proposed.quantity / 100;
  const afterBreakEvens = deriveBreakEvensGeneric(proposed.legs, proposed.strategy, creditPerShareAfter);

  const leverageRatio = accountValue > 0 ? notionalValueOf(proposed.legs, proposed.quantity) / accountValue : null;

  const comparisons: MetricComparison[] = [
    compareMetric("max_risk", "Maximum Risk", existingPositionShaped.maxLoss, proposed.maxLoss, "lower_better"),
    compareMetric("max_reward", "Maximum Reward", existingPositionShaped.maxProfit, proposed.maxProfit, "higher_better"),
    compareMetric("buying_power_impact", "Buying Power Impact", existingPositionShaped.maxLoss, proposed.buyingPowerRequired, "lower_better"),
    compareMetric("margin_impact", "Margin Impact", existingPositionShaped.maxLoss, proposed.maxLoss, "lower_better"),
    compareMetric(
      "risk_reward_ratio",
      "Risk/Reward Ratio",
      existingPositionShaped.maxLoss > 0 ? round2(existingPositionShaped.maxProfit / existingPositionShaped.maxLoss) : null,
      proposed.maxLoss > 0 ? round2(proposed.maxProfit / proposed.maxLoss) : null,
      "higher_better",
    ),
    compareMetric("concentration", "Portfolio Concentration", portfolioExposureBefore.totalRiskPct, portfolioExposureAfter.totalRiskPct, "lower_better"),
  ];

  return {
    available: true,
    inputIssues: [],
    intent: intentTyped,
    intentLabel: INTENT_LABELS[intentTyped],
    intentAvailable: true,
    intentUnavailableReason: null,
    existingPosition: existingPositionShaped,
    proposedPosition: proposed,
    netCashflow,
    greeksBefore,
    greeksAfter,
    breakEvenBefore: beforeBE.breakEvens,
    breakEvenBeforeUnavailableReason: beforeBE.reason,
    breakEvenAfter: afterBreakEvens.breakEvens,
    breakEvenAfterUnavailableReason: afterBreakEvens.reason,
    portfolioExposureBefore,
    portfolioExposureAfter,
    comparisons,
    riskWarnings: buildWarnings({
      missingPosition: false,
      invalidAdjustment: false,
      invalidAdjustmentDetail: "",
      brokerConnected,
      credentialsConfigured,
      concentrationAfterPct: portfolioExposureAfter.totalRiskPct,
      maxPortfolioRisk: settings.maxPortfolioRisk,
      leverageRatio,
      conflictingOrder,
      conflictingAdjustment,
    }),
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    accountValue,
    generatedAt,
  };
}

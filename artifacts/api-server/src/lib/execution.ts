// Phase 5 — semi-automatic trade execution.
//
// This module turns a reviewed scanner/strategy candidate into a concrete,
// defined-risk multi-leg option order, runs it through a full pre-trade risk gate,
// and (on explicit confirmation, in semi-auto mode only) submits it through the
// existing Alpaca connection — falling back to a mock order id when no broker
// credentials are configured. It never auto-trades and never bypasses risk checks.

import { db, tradesTable, journalEntriesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getSnapshot,
  buildIronCondor,
  buildIronFly,
  buildCalendar,
  buildEarnings,
  type StrategyQuote,
  type QuoteLeg,
} from "./optionsMath.js";
import {
  validateTrade,
  isDefinedRisk,
  maxLossFromLegs,
  type RiskLeg,
  type RiskSettings,
} from "./risk.js";
import {
  getAccountValue,
  getSettingsRow,
  computeTradeGreeks,
  type StoredLeg,
} from "./serverState.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import { logger } from "./logger.js";
import {
  evaluateTradeAdjustment,
  type AdjustmentAction,
} from "./adjustment.js";
import { closeTradePosition } from "./tradeClose.js";

const ALPACA_ORDERS_URL = "https://paper-api.alpaca.markets/v2/orders";

// Hard pre-trade gates (Phase 5 spec). These are floors enforced on every
// execution regardless of per-account settings.
export const MIN_RAVISH_SCORE = 62;
export const MIN_LIQUIDITY_SCORE = 50;

export type ExecutionMode = "manual" | "semi_auto" | "full_auto";
export type Strategy = "iron_condor" | "iron_fly" | "calendar_spread" | "earnings";

// ─── Canonical candidate resolution ──────────────────────────────────────────

export function canonicalQuote(symbol: string, strategy: string): StrategyQuote | null {
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

// ─── OCC option symbol ───────────────────────────────────────────────────────

// Build an OCC-21 option symbol, e.g. AAPL + 2024-12-20 + call + 150 →
// AAPL241220C00150000. This is the symbol format Alpaca's order API expects.
export function toOcc(
  symbol: string,
  expiration: string,
  type: "call" | "put",
  strike: number,
): string {
  const d = new Date(expiration);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const cp = type === "call" ? "C" : "P";
  const strike8 = String(Math.round(strike * 1000)).padStart(8, "0");
  return `${symbol.toUpperCase()}${yy}${mm}${dd}${cp}${strike8}`;
}

// ─── Multi-leg order builder ─────────────────────────────────────────────────

export interface OrderLeg {
  occSymbol: string;
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  ratioQty: number;
  positionIntent: "buy_to_open" | "sell_to_open";
  price: number; // per-share mid used for the quote
}

export interface BuiltOrder {
  symbol: string;
  strategy: string;
  orderClass: "mleg";
  type: "limit";
  timeInForce: "day";
  // Net per-spread price. Positive = limit credit, negative = limit debit.
  netPrice: number;
  isCredit: boolean;
  quantity: number; // number of spreads
  legs: OrderLeg[];
}

// Translate a StrategyQuote's legs into an Alpaca multi-leg ("mleg") order.
// Iron condors and flys produce 4 legs; calendars produce 2. ratioQty preserves
// the per-spread leg ratio; `quantity` is the number of spreads.
export function buildOptionOrderFromTrade(
  quote: StrategyQuote,
  quantity: number,
): BuiltOrder {
  const qty = Math.max(1, Math.floor(quantity));
  const legs: OrderLeg[] = quote.legs.map((l: QuoteLeg) => ({
    occSymbol: toOcc(quote.symbol, l.expiration, l.optionType, l.strike),
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration: l.expiration,
    ratioQty: l.quantity,
    positionIntent: l.side === "sell" ? "sell_to_open" : "buy_to_open",
    price: l.openPrice,
  }));
  // quote.credit is dollars for one spread (negative = debit). Per-share net price.
  const netPerShare = Math.round((quote.credit / 100) * 100) / 100;
  return {
    symbol: quote.symbol,
    strategy: quote.strategy,
    orderClass: "mleg",
    type: "limit",
    timeInForce: "day",
    netPrice: netPerShare,
    isCredit: quote.credit >= 0,
    quantity: qty,
    legs,
  };
}

// ─── Pre-trade risk validation ───────────────────────────────────────────────

export interface PreTradeCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface PreTradeValidation {
  valid: boolean;
  checks: PreTradeCheck[];
  violations: string[];
  warnings: string[];
  riskDollars: number;
  riskPct: number;
  portfolioRiskBeforePct: number;
  portfolioRiskAfterPct: number;
}

export interface PreTradeInput {
  legs: RiskLeg[];
  credit: number; // dollars (negative = debit)
  maxLoss: number; // dollars
  ev: number; // dollars
  ravishScore: number;
  liquidityScore: number;
  dataFresh: boolean;
  accountValue: number;
  openRiskDollars: number; // existing open max-loss across portfolio
  settings: RiskSettings;
  // Event Risk Filter result for this candidate. `blockShortPremium` becomes a hard
  // violation (earnings inside a short-premium trade window); `warnings` are advisory.
  eventRisk?: {
    blockShortPremium: boolean;
    level: string;
    warnings: string[];
  };
}

function countLegs(legs: RiskLeg[], side: "buy" | "sell", type: "call" | "put"): number {
  return legs
    .filter((l) => l.side === side && l.optionType === type)
    .reduce((s, l) => s + l.quantity, 0);
}

// Composes the existing risk engine (defined-risk + per-trade cap) with the
// Phase-5-specific execution gates: no naked legs, positive EV, Ravish Score
// floor, liquidity, data freshness, and the portfolio cap after this entry.
export function validatePreTrade(input: PreTradeInput): PreTradeValidation {
  const {
    legs,
    credit,
    maxLoss,
    ev,
    ravishScore,
    liquidityScore,
    dataFresh,
    accountValue,
    openRiskDollars,
    settings,
  } = input;

  const checks: PreTradeCheck[] = [];
  const violations: string[] = [];
  const warnings: string[] = [];

  // Reuse the core risk engine for defined-risk + per-trade cap + shape.
  const core = validateTrade(
    { symbol: "", strategy: "", legs, credit, maxLoss },
    accountValue,
    settings,
  );

  const defined = isDefinedRisk(legs);
  checks.push({
    label: "Defined risk only",
    passed: defined.ok,
    detail: defined.ok ? "Every short leg is covered by a long leg" : defined.reason!,
  });
  if (!defined.ok) violations.push(defined.reason!);

  const nakedCall = countLegs(legs, "sell", "call") > countLegs(legs, "buy", "call");
  checks.push({
    label: "No naked calls",
    passed: !nakedCall,
    detail: nakedCall ? "Short calls exceed long calls" : "No uncovered short calls",
  });
  if (nakedCall) violations.push("Naked short call — undefined risk not allowed");

  const nakedPut = countLegs(legs, "sell", "put") > countLegs(legs, "buy", "put");
  checks.push({
    label: "No naked puts",
    passed: !nakedPut,
    detail: nakedPut ? "Short puts exceed long puts" : "No uncovered short puts",
  });
  if (nakedPut) violations.push("Naked short put — undefined risk not allowed");

  const riskDollars = Math.max(0, maxLoss);
  const riskPct = accountValue > 0 ? (riskDollars / accountValue) * 100 : 0;
  const perTradeOk = riskPct <= settings.maxRiskPerTrade + 1e-6;
  checks.push({
    label: `Max risk per trade ≤ ${settings.maxRiskPerTrade}%`,
    passed: perTradeOk,
    detail: `$${riskDollars.toFixed(0)} = ${riskPct.toFixed(2)}% of account`,
  });
  if (!perTradeOk) {
    violations.push(
      `Trade risk ${riskPct.toFixed(2)}% exceeds the ${settings.maxRiskPerTrade}% per-trade cap`,
    );
  }

  const portfolioRiskBeforePct =
    accountValue > 0 ? (openRiskDollars / accountValue) * 100 : 0;
  const portfolioRiskAfterPct =
    accountValue > 0 ? ((openRiskDollars + riskDollars) / accountValue) * 100 : 0;
  const portfolioOk = portfolioRiskAfterPct <= settings.maxPortfolioRisk + 1e-6;
  checks.push({
    label: `Total portfolio risk ≤ ${settings.maxPortfolioRisk}%`,
    passed: portfolioOk,
    detail: `${portfolioRiskBeforePct.toFixed(1)}% → ${portfolioRiskAfterPct.toFixed(1)}% after entry`,
  });
  if (!portfolioOk) {
    violations.push(
      `Opening this trade would raise portfolio risk to ${portfolioRiskAfterPct.toFixed(1)}%, above the ${settings.maxPortfolioRisk}% cap`,
    );
  }

  const liqOk = liquidityScore >= MIN_LIQUIDITY_SCORE;
  checks.push({
    label: "Liquidity passed",
    passed: liqOk,
    detail: `Liquidity score ${liquidityScore.toFixed(0)} (floor ${MIN_LIQUIDITY_SCORE})`,
  });
  if (!liqOk) violations.push(`Liquidity score ${liquidityScore.toFixed(0)} below the ${MIN_LIQUIDITY_SCORE} floor`);

  checks.push({
    label: "Data freshness passed",
    passed: dataFresh,
    detail: dataFresh ? "Quotes are within the freshness window" : "Market data is stale",
  });
  if (!dataFresh) violations.push("Market data is stale — refusing to route on stale quotes");

  const evOk = ev > 0;
  checks.push({
    label: "Positive expected value",
    passed: evOk,
    detail: `EV ${ev >= 0 ? "+" : ""}$${ev.toFixed(0)} per spread`,
  });
  if (!evOk) violations.push(`Expected value $${ev.toFixed(0)} is not positive`);

  const scoreOk = ravishScore >= MIN_RAVISH_SCORE;
  checks.push({
    label: `Ravish Score ≥ ${MIN_RAVISH_SCORE}`,
    passed: scoreOk,
    detail: `Score ${ravishScore.toFixed(1)}`,
  });
  if (!scoreOk) {
    violations.push(`Ravish Score ${ravishScore.toFixed(1)} is below the ${MIN_RAVISH_SCORE} execution floor`);
  }

  // Event Risk Filter: hard-block short-premium trades whose window contains earnings.
  if (input.eventRisk) {
    const noEarningsBlock = !input.eventRisk.blockShortPremium;
    checks.push({
      label: "No earnings inside trade window",
      passed: noEarningsBlock,
      detail: noEarningsBlock
        ? "No earnings event before this trade's expiration"
        : "Earnings falls inside the trade window — short premium not allowed",
    });
    if (input.eventRisk.blockShortPremium) {
      violations.push(
        "Earnings event inside the trade window — refusing to open short premium before earnings",
      );
    }
  }

  // Non-blocking advisories.
  if (!core.valid) {
    for (const v of core.violations) if (!violations.includes(v)) violations.push(v);
  }
  if (scoreOk && ravishScore < 68) {
    warnings.push("Ravish Score is acceptable but not Elite — size conservatively");
  }
  if (input.eventRisk) {
    for (const w of input.eventRisk.warnings) if (!warnings.includes(w)) warnings.push(w);
  }

  return {
    valid: violations.length === 0,
    checks,
    violations,
    warnings,
    riskDollars: Math.round(riskDollars),
    riskPct: Math.round(riskPct * 100) / 100,
    portfolioRiskBeforePct: Math.round(portfolioRiskBeforePct * 100) / 100,
    portfolioRiskAfterPct: Math.round(portfolioRiskAfterPct * 100) / 100,
  };
}

// ─── Ticket assembly (shared by preview + submit) ────────────────────────────

export interface TicketInput {
  scannerResultId?: number | null;
  symbol?: string | null;
  strategy?: string | null;
  quantity: number;
}

export interface ExecutionTicket {
  symbol: string;
  strategy: string;
  expiration: string;
  daysToExpiry: number;
  quantity: number;
  legs: OrderLeg[];
  netCredit: number; // dollars across all spreads (negative = debit)
  isCredit: boolean;
  maxProfit: number;
  maxLoss: number;
  pop: number;
  ev: number;
  ravishScore: number;
  ravishTier: string;
  returnOnCapital: number;
  buyingPowerRequired: number;
  accountValue: number;
  riskPct: number;
  portfolioRiskBeforePct: number;
  portfolioRiskAfterPct: number;
  executionMode: ExecutionMode;
  canSubmit: boolean;
  validation: PreTradeValidation;
  warnings: string[];
  // Present only on roll/convert tickets built from an open position's
  // recommendation; null on ordinary scanner-driven tickets.
  adjustment: TicketAdjustmentContext | null;
  // Carried for persistence on submit (not part of the API surface).
  _quote: StrategyQuote;
  _storedLegs: StoredLeg[];
}

// Describes a roll/convert ticket derived from an open position's deterministic
// recommendation. Numbers always come from the ticket itself; this is metadata
// the UI uses to explain that the source position will be closed first.
export interface TicketAdjustmentContext {
  sourceTradeId: number;
  action: Extract<AdjustmentAction, "roll_threatened" | "roll_untested" | "convert">;
  actionLabel: string;
  kind: "roll" | "convert";
  fromStrategy: string;
  toStrategy: string;
  closeDescription: string;
  rationale: string;
  // Snapshot of the position being closed, so the UI can render a before/after
  // comparison against the new structure (which is the ticket itself).
  source: AdjustmentSourcePosition;
  // Net cash flow of the whole adjustment = new-structure open credit minus the
  // debit to buy back the source position. Positive = net credit collected.
  netCashflow: number;
}

// A single leg of the position being closed, mirroring StoredLeg minus the
// transient openPrice (the UI only needs strike/side/type/expiry/size).
export interface AdjustmentSourceLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  quantity: number;
}

// Deterministic snapshot of the open position a roll/convert will close.
export interface AdjustmentSourcePosition {
  tradeId: number;
  symbol: string;
  strategy: string;
  strategyLabel: string;
  expiration: string | null;
  daysToExpiry: number;
  legs: AdjustmentSourceLeg[];
  credit: number; // original credit collected when the position was opened
  maxProfit: number;
  maxLoss: number;
  pop: number;
  costToClose: number; // debit to buy the position back now (≥0 closes a credit spread)
  currentPnl: number; // unrealized P&L at current marks
  isCredit: boolean;
}

function riskSettings(s: {
  maxRiskPerTrade: number;
  maxPortfolioRisk: number;
  stopLossMultiplier: number;
  profitTarget50: number;
  profitTarget75: number;
  profitTarget90: number;
}): RiskSettings {
  return {
    maxRiskPerTrade: s.maxRiskPerTrade,
    maxPortfolioRisk: s.maxPortfolioRisk,
    stopLossMultiplier: s.stopLossMultiplier,
    profitTarget50: s.profitTarget50,
    profitTarget75: s.profitTarget75,
    profitTarget90: s.profitTarget90,
  };
}

export class TicketError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Resolve the candidate, scale by quantity, build the order, and validate.
export async function buildTicket(input: TicketInput): Promise<ExecutionTicket> {
  const qty = Math.max(1, Math.floor(input.quantity || 1));

  let symbol = input.symbol ?? null;
  let strategy = input.strategy ?? null;
  let scannerResultId = input.scannerResultId ?? null;

  if (scannerResultId != null) {
    const { scannerResultsTable } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(scannerResultsTable)
      .where(eq(scannerResultsTable.id, scannerResultId));
    if (!row) throw new TicketError("Scanner result not found", 404);
    symbol = row.symbol;
    strategy = row.strategy;
  }

  if (!symbol || !strategy) {
    throw new TicketError("symbol and strategy (or scannerResultId) are required", 400);
  }

  const quote = canonicalQuote(symbol, strategy);
  if (!quote) throw new TicketError(`Unable to build a ${strategy} quote for ${symbol}`, 400);

  return assembleTicketFromQuote(quote, qty, { scannerResultId });
}

// Shared ticket assembly: scale a 1-lot canonical quote by quantity, build the
// multi-leg order, run the full pre-trade risk gate, and shape the ticket. Used by
// both scanner-driven tickets (buildTicket) and roll/convert tickets
// (buildAdjustmentTicket). `excludeTradeId` drops a position (the one being rolled)
// from the portfolio-risk total so a roll isn't double-counted against the cap.
async function assembleTicketFromQuote(
  quote: StrategyQuote,
  quantity: number,
  opts: {
    scannerResultId?: number | null;
    excludeTradeId?: number | null;
    adjustment?: TicketAdjustmentContext | null;
  } = {},
): Promise<ExecutionTicket & { _scannerResultId: number | null }> {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const symbol = quote.symbol;
  const strategy = quote.strategy;
  const scannerResultId = opts.scannerResultId ?? null;
  const excludeTradeId = opts.excludeTradeId ?? null;

  const order = buildOptionOrderFromTrade(quote, qty);

  // Scale 1-lot canonical metrics by the requested quantity.
  const netCredit = Math.round(quote.credit * qty * 100) / 100;
  const maxProfit = Math.round(quote.maxProfit * qty * 100) / 100;
  const maxLoss = Math.round(quote.maxLoss * qty * 100) / 100;
  const ev = Math.round(quote.ev * qty * 100) / 100;

  const riskLegs: RiskLeg[] = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    quantity: l.quantity * qty,
    expiration: l.expiration,
  }));
  // Recompute max loss from the scaled legs so multi-lot risk is sized correctly.
  const sizedMaxLoss = maxLossFromLegs(riskLegs, netCredit) || maxLoss;

  const settingsRow = await getSettingsRow();
  const accountValue = await getAccountValue();

  // Count both filled (open) and already-submitted-but-unfilled (pending) trades
  // toward the portfolio cap. Submitted orders persist as "pending", so excluding
  // them would let sequential submits stack risk past the cap before any fill.
  // A roll/convert excludes its source position, which is closed on submit, so the
  // new structure's risk replaces (not stacks on top of) the old.
  const committedTrades = await db
    .select()
    .from(tradesTable)
    .where(inArray(tradesTable.status, ["open", "pending"]));
  const openRiskDollars = committedTrades
    .filter((t) => excludeTradeId == null || t.id !== excludeTradeId)
    .reduce((s, t) => s + Math.max(0, t.maxLoss), 0);

  // Freshness is sourced from the ticket's own data: an expired (DTE ≤ 0) contract
  // is untradeable/stale. Canonical quotes are regenerated for the current trading
  // day on every request, so live (non-zero DTE) candidates are current.
  const dataFresh = quote.daysToExpiry > 0;

  // Event Risk Filter assessment for this candidate (earnings/macro inside the window).
  const eventAssessment = getEventRiskForSymbol(
    symbol,
    strategy,
    quote.expiration,
    Date.now(),
    settingsRow.eventRiskEnabled,
  );
  // The earnings short-premium block is itself gated by its dedicated setting toggle.
  const blockShortPremium =
    eventAssessment.blockShortPremium && settingsRow.eventRiskBlockEarningsShortPremium;

  const validation = validatePreTrade({
    legs: riskLegs,
    credit: netCredit,
    maxLoss: sizedMaxLoss,
    ev,
    ravishScore: quote.ravishScore,
    liquidityScore: quote.liquidityScore,
    dataFresh,
    accountValue,
    openRiskDollars,
    settings: riskSettings(settingsRow),
    eventRisk: {
      blockShortPremium,
      level: eventAssessment.level,
      warnings: eventAssessment.warnings,
    },
  });

  const executionMode = settingsRow.executionMode as ExecutionMode;
  // Both semi-auto and full-auto are execution-enabled modes; manual is scanner-only.
  const canSubmit =
    (executionMode === "semi_auto" || executionMode === "full_auto") && validation.valid;

  const storedLegs: StoredLeg[] = quote.legs.map((l) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration: l.expiration,
    openPrice: l.openPrice,
    quantity: l.quantity * qty,
  }));

  return {
    symbol,
    strategy,
    expiration: quote.expiration,
    daysToExpiry: quote.daysToExpiry,
    quantity: qty,
    legs: order.legs,
    netCredit,
    isCredit: netCredit >= 0,
    maxProfit,
    maxLoss: sizedMaxLoss,
    pop: quote.pop,
    ev,
    ravishScore: quote.ravishScore,
    ravishTier: quote.ravishTier,
    returnOnCapital: quote.returnOnCapital,
    buyingPowerRequired: Math.round(sizedMaxLoss),
    accountValue: Math.round(accountValue),
    riskPct: validation.riskPct,
    portfolioRiskBeforePct: validation.portfolioRiskBeforePct,
    portfolioRiskAfterPct: validation.portfolioRiskAfterPct,
    executionMode,
    canSubmit,
    validation,
    warnings: validation.warnings,
    adjustment: opts.adjustment ?? null,
    _quote: quote,
    _storedLegs: storedLegs,
    _scannerResultId: scannerResultId,
  } as ExecutionTicket & { _scannerResultId: number | null };
}

export async function previewOptionOrder(input: TicketInput): Promise<ExecutionTicket> {
  return buildTicket(input);
}

// ─── Roll / convert tickets (Task #22) ───────────────────────────────────────
//
// Turn an open position's deterministic roll/convert recommendation into a
// ready-to-submit ticket that reuses the exact same risk-validation path as a
// scanner-driven entry. Structural changes (rolls, converts) are ALWAYS human-
// gated — there is deliberately no auto path here (AUTO_ACTIONABLE never includes
// them). Submit closes the source position, then opens the new structure.

const ROLLABLE_ACTIONS: ReadonlySet<AdjustmentAction> = new Set<AdjustmentAction>([
  "roll_threatened",
  "roll_untested",
  "convert",
]);

const STRATEGY_LABELS: Record<string, string> = {
  iron_condor: "Iron Condor",
  iron_fly: "Iron Fly",
  calendar_spread: "Calendar Spread",
  earnings: "Earnings Play",
};

function strategyLabel(strategy: string): string {
  return STRATEGY_LABELS[strategy] ?? strategy.replace(/_/g, " ");
}

// Map a recommended action + current strategy to the candidate's target strategy.
// A convert tightens an Iron Condor into an Iron Fly (or widens a Fly back into a
// Condor); a roll keeps the same strategy but re-centers on spot at a fresh
// expiration. Everything is deterministic.
export function resolveAdjustmentTarget(
  action: Extract<AdjustmentAction, "roll_threatened" | "roll_untested" | "convert">,
  currentStrategy: string,
): { strategy: string; kind: "roll" | "convert" } {
  if (action === "convert") {
    if (currentStrategy === "iron_fly") return { strategy: "iron_condor", kind: "convert" };
    // Iron Condor (and any other premium structure) tightens into an Iron Fly.
    return { strategy: "iron_fly", kind: "convert" };
  }
  return { strategy: currentStrategy, kind: "roll" };
}

// Build the candidate quote for a roll/convert. Rolls extend to a fresh ~45 DTE so
// the new expiration is genuinely further out than the threatened position; the
// canonical builders re-center every strike on the current spot.
const ROLL_DTE = 45;
function buildAdjustmentQuote(
  snap: NonNullable<ReturnType<typeof getSnapshot>>,
  strategy: string,
): StrategyQuote | null {
  switch (strategy) {
    case "iron_condor":
      return buildIronCondor(snap, { dte: ROLL_DTE });
    case "iron_fly":
      return buildIronFly(snap, { dte: ROLL_DTE });
    case "calendar_spread":
      return buildCalendar(snap);
    case "earnings":
      return buildEarnings(snap) ?? buildIronFly(snap, { dte: ROLL_DTE, strategy: "earnings" });
    default:
      return buildIronCondor(snap, { dte: ROLL_DTE });
  }
}

export interface AdjustmentTicketInput {
  tradeId: number;
  quantity?: number | null;
}

// Resolve the open position's recommendation and assemble a risk-validated ticket
// for the roll/convert candidate. Rejects positions whose recommendation is not a
// roll or convert.
export async function buildAdjustmentTicket(
  input: AdjustmentTicketInput,
): Promise<ExecutionTicket & { _scannerResultId: number | null }> {
  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, input.tradeId));
  if (!trade) throw new TicketError("Trade not found", 404);
  if (trade.status !== "open") {
    throw new TicketError("Only open positions can be rolled or converted", 409);
  }

  const settingsRow = await getSettingsRow();
  const adj = evaluateTradeAdjustment(trade, settingsRow);
  if (!ROLLABLE_ACTIONS.has(adj.action)) {
    throw new TicketError(
      `The recommendation for this position is "${adj.actionLabel}", which is not a roll or convert. Only roll and convert recommendations can be previewed as a new ticket.`,
      409,
    );
  }
  const action = adj.action as Extract<
    AdjustmentAction,
    "roll_threatened" | "roll_untested" | "convert"
  >;

  const snap = getSnapshot(trade.symbol);
  if (!snap) throw new TicketError(`No market snapshot available for ${trade.symbol}`, 400);

  const target = resolveAdjustmentTarget(action, trade.strategy);
  const quote = buildAdjustmentQuote(snap, target.strategy);
  if (!quote) {
    throw new TicketError(
      `Unable to build a ${target.strategy} candidate for ${trade.symbol}`,
      400,
    );
  }

  // Size the new structure to match the existing position by default.
  const storedLegs = (trade.legs as StoredLeg[] | null) ?? [];
  const lots = Math.max(1, ...storedLegs.map((l) => l.quantity || 1));
  const qty = Math.max(1, Math.floor(input.quantity ?? lots));

  const closeDescription =
    target.kind === "convert"
      ? `Submitting closes your current ${strategyLabel(trade.strategy)} (${lots} lot${
          lots > 1 ? "s" : ""
        }, position #${trade.id}) and opens the converted ${strategyLabel(target.strategy)} below.`
      : `Submitting closes your current ${strategyLabel(trade.strategy)} (${lots} lot${
          lots > 1 ? "s" : ""
        }, position #${trade.id}) and opens the rolled ${strategyLabel(
          target.strategy,
        )} below at a fresh expiration.`;

  // Snapshot the position being closed so the UI can render before/after. Numbers
  // are deterministic: credit/maxProfit/maxLoss are the persisted position totals;
  // costToClose + currentPnl are marked to the current snapshot.
  const greeks = computeTradeGreeks({
    symbol: trade.symbol,
    legs: trade.legs,
    credit: trade.credit,
    maxProfit: trade.maxProfit,
  });
  const sourceDte = trade.expiration
    ? Math.max(0, Math.round((new Date(trade.expiration).getTime() - Date.now()) / 86_400_000))
    : 0;
  const source: AdjustmentSourcePosition = {
    tradeId: trade.id,
    symbol: trade.symbol,
    strategy: trade.strategy,
    strategyLabel: strategyLabel(trade.strategy),
    expiration: trade.expiration,
    daysToExpiry: sourceDte,
    legs: storedLegs.map((l) => ({
      side: l.side,
      optionType: l.optionType,
      strike: l.strike,
      expiration: l.expiration,
      quantity: l.quantity,
    })),
    credit: Math.round(trade.credit * 100) / 100,
    maxProfit: Math.round(trade.maxProfit * 100) / 100,
    maxLoss: Math.round(trade.maxLoss * 100) / 100,
    pop: trade.pop,
    costToClose: greeks.costToClose,
    currentPnl: greeks.unrealizedPnl,
    isCredit: trade.credit >= 0,
  };

  // Net adjustment cash flow = open credit of the new structure (scaled to qty)
  // minus the debit to buy back the source position. Positive = net credit.
  const openCredit = Math.round(quote.credit * qty * 100) / 100;
  const netCashflow = Math.round((openCredit - greeks.costToClose) * 100) / 100;

  const adjustment: TicketAdjustmentContext = {
    sourceTradeId: trade.id,
    action,
    actionLabel: adj.actionLabel,
    kind: target.kind,
    fromStrategy: trade.strategy,
    toStrategy: target.strategy,
    closeDescription,
    rationale: adj.rationale,
    source,
    netCashflow,
  };

  return assembleTicketFromQuote(quote, qty, {
    excludeTradeId: trade.id,
    adjustment,
  });
}

export async function previewAdjustmentOrder(
  input: AdjustmentTicketInput,
): Promise<ExecutionTicket> {
  return buildAdjustmentTicket(input);
}

export interface AdjustmentSubmitInput {
  tradeId: number;
  quantity?: number | null;
  confirm: boolean;
}

export interface AdjustmentSubmitOutput extends SubmitOutput {
  closedTradeId: number;
  closedReason: string;
}

// Execute a roll/convert: re-validate the candidate, OPEN the new structure, then
// close the source position. Human-gated only (explicit confirm + non-manual mode);
// never reachable from any auto loop.
//
// Ordering matters for consistency. We deliberately open FIRST and close SECOND so
// a failure can never leave the source position closed without a replacement (the
// worst outcome — naked-or-vanished exposure). If the open fails, the source is
// untouched (still open) and we surface the error. If the open succeeds but the
// close fails, we compensate by rolling back the just-opened trade + its journal
// entry and rethrow, again leaving the source open. The brief window where both
// legs exist is acceptable — pre-trade validation already excluded the source from
// portfolio risk, so it modeled the post-roll risk picture, and this is PAPER/MOCK.
export async function submitAdjustmentOrder(
  input: AdjustmentSubmitInput,
): Promise<AdjustmentSubmitOutput> {
  if (!input.confirm) {
    throw new TicketError("Explicit confirmation is required to submit an order", 400);
  }

  const ticket = await buildAdjustmentTicket({
    tradeId: input.tradeId,
    quantity: input.quantity,
  });
  const adjustment = ticket.adjustment;
  if (!adjustment) {
    throw new TicketError("This position no longer has a roll/convert recommendation", 409);
  }

  if (ticket.executionMode === "manual") {
    throw new TicketError(
      "Manual mode is scanner-only. Switch to Semi-Auto in Settings to submit orders.",
      409,
    );
  }

  if (!ticket.validation.valid) {
    throw new TicketError(
      `Trade rejected by risk rules: ${ticket.validation.violations.join("; ")}`,
      422,
    );
  }

  const [existing] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.id, adjustment.sourceTradeId));
  if (!existing) throw new TicketError("The position to roll no longer exists", 404);
  if (existing.status !== "open") {
    throw new TicketError("The position to roll is no longer open", 409);
  }

  const source: ExecutionSource =
    ticket.executionMode === "full_auto" ? "full_auto" : "semi_auto";

  // 1. Open the replacement first. If this throws, the source remains open.
  const result = await executeValidatedTicket(ticket, source);

  // 2. Close the source. If this fails, roll back the trade we just opened so we
  //    never end up with the new structure orphaned from a still-open source.
  const closeReason =
    adjustment.kind === "convert"
      ? `Converted to ${strategyLabel(adjustment.toStrategy)} (manual)`
      : `Rolled to a new ${strategyLabel(adjustment.toStrategy)} (manual)`;
  let closed: Awaited<ReturnType<typeof closeTradePosition>>;
  try {
    closed = await closeTradePosition(existing, closeReason);
  } catch (closeErr) {
    // Compensating rollback: remove the just-opened trade + journal entry.
    try {
      await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, result.journalId));
      await db.delete(tradesTable).where(eq(tradesTable.id, result.tradeId));
    } catch {
      // If even the rollback fails there is nothing more we can do safely here;
      // surface the original close failure below.
    }
    throw new TicketError(
      `Opened the replacement but failed to close the source position (#${existing.id}); the new order was rolled back. Please retry. (${
        closeErr instanceof Error ? closeErr.message : "unknown error"
      })`,
      502,
    );
  }

  return {
    ...result,
    closedTradeId: closed.trade.id,
    closedReason: closeReason,
    message: `Closed position #${existing.id} and ${
      adjustment.kind === "convert" ? "opened the converted" : "opened the rolled"
    } ${strategyLabel(adjustment.toStrategy)}.`,
    ticket,
  };
}

// ─── Alpaca submission (with mock fallback) ──────────────────────────────────

interface SubmitResult {
  orderId: string;
  status: string;
  broker: "alpaca" | "mock";
}

async function routeOrder(
  order: BuiltOrder,
  settingsApiKey: string | null,
): Promise<SubmitResult> {
  const creds = readAlpacaCreds(settingsApiKey);
  if (!creds) {
    // No broker connection — produce a deterministic-shaped mock acknowledgement.
    return { orderId: `mock-${randomUUID()}`, status: "accepted", broker: "mock" };
  }
  try {
    const body = {
      order_class: order.orderClass,
      qty: String(order.quantity),
      type: order.type,
      time_in_force: order.timeInForce,
      limit_price: String(Math.abs(order.netPrice)),
      legs: order.legs.map((l) => ({
        symbol: l.occSymbol,
        ratio_qty: String(l.ratioQty),
        side: l.side,
        position_intent: l.positionIntent,
      })),
    };
    const resp = await fetch(ALPACA_ORDERS_URL, {
      method: "POST",
      headers: {
        "APCA-API-KEY-ID": creds.key,
        "APCA-API-SECRET-KEY": creds.secret,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new TicketError(`Alpaca rejected the order (${resp.status}): ${text}`, 502);
    }
    const data = (await resp.json()) as { id?: string; status?: string };
    return {
      orderId: data.id ?? `alpaca-${randomUUID()}`,
      status: data.status ?? "accepted",
      broker: "alpaca",
    };
  } catch (err) {
    if (err instanceof TicketError) throw err;
    logger.error({ err, symbol: order.symbol }, "Alpaca order submission failed");
    throw new TicketError("Alpaca order submission failed", 502);
  }
}

export interface SubmitInput extends TicketInput {
  confirm: boolean;
}

export interface SubmitOutput {
  orderId: string;
  status: string;
  broker: "alpaca" | "mock";
  tradeId: number;
  journalId: number;
  message: string;
  ticket: ExecutionTicket;
}

export type ExecutionSource = "semi_auto" | "full_auto";

export interface PersistResult {
  orderId: string;
  status: string;
  broker: "alpaca" | "mock";
  tradeId: number;
  journalId: number;
}

// Route a *validated* ticket to the broker and persist the resulting pending trade
// + journal entry. Shared by the semi-auto submit endpoint and the full-auto engine
// so both go through the exact same routing and persistence path. The caller is
// responsible for having already run the pre-trade validation gate.
export async function executeValidatedTicket(
  ticket: ExecutionTicket & { _scannerResultId?: number | null },
  source: ExecutionSource,
): Promise<PersistResult> {
  const order = buildOptionOrderFromTrade(ticket._quote, ticket.quantity);
  const settingsRow = await getSettingsRow();
  const result = await routeOrder(order, settingsRow.alpacaApiKey);

  const sourceLabel = source === "full_auto" ? "Full-auto" : "Semi-auto";

  const [trade] = await db
    .insert(tradesTable)
    .values({
      symbol: ticket.symbol,
      strategy: ticket.strategy,
      status: "pending",
      executionMode: source,
      legs: ticket._storedLegs as unknown as (typeof tradesTable.$inferInsert)["legs"],
      expiration: ticket.expiration,
      credit: ticket.netCredit,
      maxProfit: ticket.maxProfit,
      maxLoss: ticket.maxLoss,
      pop: ticket.pop,
      ev: ticket.ev,
      theta: ticket._quote.theta * ticket.quantity,
      ravishScore: ticket.ravishScore,
      entryIv: getSnapshot(ticket.symbol)?.iv ?? null,
      scannerResultId: ticket._scannerResultId ?? null,
      alpacaOrderId: result.orderId,
      notes: `${sourceLabel} submit via ${result.broker}`,
    })
    .returning();

  const [journal] = await db
    .insert(journalEntriesTable)
    .values({
      tradeId: trade.id,
      title: `${sourceLabel === "Full-auto" ? "Auto-submitted" : "Submitted"} ${ticket.symbol} ${ticket.strategy.replace(/_/g, " ")}`,
      content: `Order ${result.orderId} (${result.status}) via ${result.broker}. ${ticket.quantity} spread(s), net ${
        ticket.isCredit ? "credit" : "debit"
      } $${Math.abs(ticket.netCredit).toFixed(0)}, max risk $${ticket.maxLoss.toFixed(0)} (${ticket.riskPct}% of account). Status pending fill.`,
      mood: "confident",
      tags: [ticket.strategy, "pending", source],
      strategy: ticket.strategy,
      entryCredit: ticket.netCredit,
      maxProfit: ticket.maxProfit,
      maxLoss: ticket.maxLoss,
      ev: ticket.ev,
      pop: ticket.pop,
      ravishScore: ticket.ravishScore,
    })
    .returning();

  return {
    orderId: result.orderId,
    status: result.status,
    broker: result.broker,
    tradeId: trade.id,
    journalId: journal.id,
  };
}

// Submit an order from the Trade Ticket. Enforces: explicit confirmation,
// execution-enabled mode (manual is scanner-only), and a fresh pre-trade
// validation. Persists a pending trade and a journal entry on success.
export async function submitOptionOrder(input: SubmitInput): Promise<SubmitOutput> {
  if (!input.confirm) {
    throw new TicketError("Explicit confirmation is required to submit an order", 400);
  }

  const ticket = (await buildTicket(input)) as ExecutionTicket & {
    _scannerResultId: number | null;
  };

  if (ticket.executionMode === "manual") {
    throw new TicketError(
      "Manual mode is scanner-only. Switch to Semi-Auto in Settings to submit orders.",
      409,
    );
  }

  if (!ticket.validation.valid) {
    throw new TicketError(
      `Trade rejected by risk rules: ${ticket.validation.violations.join("; ")}`,
      422,
    );
  }

  const source: ExecutionSource =
    ticket.executionMode === "full_auto" ? "full_auto" : "semi_auto";
  const result = await executeValidatedTicket(ticket, source);

  return {
    orderId: result.orderId,
    status: result.status,
    broker: result.broker,
    tradeId: result.tradeId,
    journalId: result.journalId,
    message: `Order submitted to ${result.broker} (${result.status}).`,
    ticket,
  };
}

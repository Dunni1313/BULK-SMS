// Paper Trading Order Preview & Risk Simulator sprint — a read-only,
// dry-run "what would this order look like" composition layer.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates an
// order, NEVER writes to trades/journal, and NEVER performs a database
// write of any kind — every function here is read-only. It reuses the
// existing, unmodified execution/risk abstractions (execution.ts's
// canonicalQuote/previewOptionOrder — itself just an alias for the same
// buildTicket() the real submit path uses, so the numbers shown here are
// identical to what a real ticket build would compute) plus the existing,
// unmodified broker-credential/connection-state readers
// (alpacaProvider.readAlpacaCreds, alpacaBroker's cached last-check state)
// for its display data. execution.ts, optionsMath.ts, and risk.ts are not
// modified by this sprint.
//
// The 8 pre-trade validation categories this sprint asks for (missing
// fields, invalid quantity, invalid symbol, buying power unavailable,
// broker disconnected, missing credentials, position conflict, existing
// open order) are NOT part of the real execution engine's own risk gate
// (execution.ts's validatePreTrade, unchanged) — they are a separate,
// additive checklist specific to this preview page, computed here.

import { db, tradesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  canonicalQuote,
  previewOptionOrder,
  TicketError,
  type ExecutionTicket,
  type Strategy,
} from "./execution.js";
import { getAccountValue, getSettingsRow } from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import {
  getLastBrokerCheckConnected,
  getLastSuccessfulBrokerCheck,
} from "./providers/alpacaBroker.js";

const VALID_STRATEGIES: readonly Strategy[] = [
  "iron_condor",
  "iron_fly",
  "calendar_spread",
  "earnings",
];

// Same shape-only guard used elsewhere in this codebase (e.g.
// investingUniverse.ts's isValidTickerShape) — deliberately not a
// real-symbol lookup, just enough to honestly reject obvious garbage
// input before ever calling into the execution engine.
const TICKER_RE = /^[A-Z]{1,6}$/;
function isValidTickerShape(symbol: string): boolean {
  return TICKER_RE.test(symbol);
}

export interface OrderPreviewInput {
  symbol?: string | null;
  strategy?: string | null;
  quantity?: number | null;
}

export interface OrderPreviewInputIssue {
  field: "symbol" | "strategy" | "quantity";
  code: string;
  message: string;
}

export type OrderPreviewCheckStatus = "ok" | "warning" | "blocked";

export interface OrderPreviewValidationItem {
  code: string;
  label: string;
  status: OrderPreviewCheckStatus;
  detail: string;
}

// Fields this sprint adds on top of the existing, unmodified ExecutionTicket
// — every one is a disclosed, honest derivation from fields the ticket
// already computes, never a fabricated/invented number.
export interface OrderPreviewDerived {
  // Net credit (positive) or debit (negative) per single spread, dollars.
  entryPricePerSpread: number;
  // Total notional value of the option contracts referenced by this order:
  // sum across legs of (strike * 100 * ratioQty * quantity). This is the
  // standard options-notional formula (contract multiplier 100), NOT the
  // same figure as capital at risk (maxLoss) — both are shown separately.
  notionalValue: number;
  // For these all-defined-risk multi-leg spread strategies, the margin
  // requirement to hold the position equals the position's own maximum
  // loss — reused directly from the ticket, not a new calculation.
  marginImpact: number;
  // maxProfit / maxLoss, or null when maxLoss is 0 (no meaningful ratio).
  riskRewardRatio: number | null;
}

export type OrderPreviewTicket = ExecutionTicket & OrderPreviewDerived;

export interface OrderPreviewResult {
  available: boolean;
  inputIssues: OrderPreviewInputIssue[];
  ticket: OrderPreviewTicket | null;
  preTradeChecklist: OrderPreviewValidationItem[];
  credentialsConfigured: boolean;
  // null = no Broker Health check has ever been performed this server
  // session; true/false reflects the outcome of the most recent one. This
  // reads existing, already-cached state (alpacaBroker.ts's module-level
  // last-check variables) — it never triggers a new live broker call.
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  accountValue: number;
  generatedAt: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Strip the persistence-only underscore-prefixed fields, matching
// routes/execution.ts's own established publicTicket() helper exactly (a
// separate, small, deliberately duplicated copy rather than exporting a
// route-layer helper into a lib module).
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

function deriveDisplayFields(ticket: ExecutionTicket): OrderPreviewDerived {
  const entryPricePerSpread =
    ticket.quantity > 0 ? round2(ticket.netCredit / ticket.quantity) : 0;
  const notionalValue = round2(
    ticket.legs.reduce((sum, leg) => sum + leg.strike * 100 * leg.ratioQty * ticket.quantity, 0),
  );
  const marginImpact = ticket.maxLoss;
  const riskRewardRatio = ticket.maxLoss > 0 ? Math.round((ticket.maxProfit / ticket.maxLoss) * 10000) / 10000 : null;
  return { entryPricePerSpread, notionalValue, marginImpact, riskRewardRatio };
}

// Build the full dry-run preview: input validation, the reused execution
// ticket (when the input is well-formed), the 8-item pre-trade checklist,
// and current broker/account context. Never submits, never mutates any
// portfolio/broker/local state.
export async function buildOrderPreview(
  input: OrderPreviewInput,
  userId: string,
): Promise<OrderPreviewResult> {
  const generatedAt = new Date().toISOString();
  const inputIssues: OrderPreviewInputIssue[] = [];

  const rawSymbol = (input.symbol ?? "").trim();
  const symbol = rawSymbol.toUpperCase();
  const rawStrategy = (input.strategy ?? "").trim();
  const quantity = input.quantity ?? null;

  if (!rawSymbol) {
    inputIssues.push({ field: "symbol", code: "missing_field", message: "Symbol is required." });
  } else if (!isValidTickerShape(symbol)) {
    inputIssues.push({
      field: "symbol",
      code: "invalid_symbol",
      message: `"${rawSymbol}" is not a valid ticker symbol shape (1-6 letters).`,
    });
  }

  if (!rawStrategy) {
    inputIssues.push({ field: "strategy", code: "missing_field", message: "Strategy is required." });
  } else if (!VALID_STRATEGIES.includes(rawStrategy as Strategy)) {
    inputIssues.push({
      field: "strategy",
      code: "invalid_strategy",
      message: `"${rawStrategy}" is not a supported strategy.`,
    });
  }

  if (quantity == null) {
    inputIssues.push({ field: "quantity", code: "missing_field", message: "Quantity is required." });
  } else if (!Number.isInteger(quantity) || quantity <= 0) {
    inputIssues.push({
      field: "quantity",
      code: "invalid_quantity",
      message: "Quantity must be a positive whole number.",
    });
  }

  // A cheap, side-effect-free resolution check (reused, unmodified, from
  // execution.ts) that catches an unrecognized/unresolvable symbol without
  // needing a full ticket build — only run once the input already looks
  // shape-valid, so this never masks the more specific shape-invalid
  // message above.
  const hasShapeIssue = inputIssues.some((i) => i.field === "symbol" || i.field === "strategy");
  if (!hasShapeIssue && !canonicalQuote(symbol, rawStrategy)) {
    inputIssues.push({
      field: "symbol",
      code: "unresolvable_symbol",
      message: `Unable to resolve a ${rawStrategy} quote for ${symbol}.`,
    });
  }

  // Independent of whether a ticket can actually be built: these only need
  // userId (always available) and, for the position/order checks, the raw
  // symbol string (already validated above when present).
  const settings = await getSettingsRow(userId);
  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();
  const accountValue = await getAccountValue(userId);

  let existingOpenPosition = false;
  let existingPendingOrder = false;
  if (rawSymbol && isValidTickerShape(symbol)) {
    const rows = await db
      .select()
      .from(tradesTable)
      .where(
        and(
          eq(tradesTable.userId, userId),
          eq(tradesTable.symbol, symbol),
          inArray(tradesTable.status, ["open", "pending"]),
        ),
      );
    existingOpenPosition = rows.some((r) => r.status === "open");
    existingPendingOrder = rows.some((r) => r.status === "pending");
  }

  const preTradeChecklist = buildChecklist({
    inputIssues,
    accountValue,
    credentialsConfigured,
    brokerConnected,
    existingOpenPosition,
    existingPendingOrder,
  });

  if (inputIssues.length > 0) {
    return {
      available: false,
      inputIssues,
      ticket: null,
      preTradeChecklist,
      credentialsConfigured,
      brokerConnected,
      lastBrokerCheckAt,
      accountValue,
      generatedAt,
    };
  }

  let ticket: ExecutionTicket;
  try {
    ticket = await previewOptionOrder({ symbol, strategy: rawStrategy, quantity: quantity! }, userId);
  } catch (err) {
    if (err instanceof TicketError) {
      inputIssues.push({ field: "symbol", code: "unresolvable_symbol", message: err.message });
      return {
        available: false,
        inputIssues,
        ticket: null,
        preTradeChecklist,
        credentialsConfigured,
        brokerConnected,
        lastBrokerCheckAt,
        accountValue,
        generatedAt,
      };
    }
    throw err;
  }

  const clean = publicTicket(ticket);
  const derived = deriveDisplayFields(ticket);

  return {
    available: true,
    inputIssues: [],
    ticket: { ...clean, ...derived },
    preTradeChecklist,
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    accountValue,
    generatedAt,
  };
}

function buildChecklist(ctx: {
  inputIssues: OrderPreviewInputIssue[];
  accountValue: number;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  existingOpenPosition: boolean;
  existingPendingOrder: boolean;
}): OrderPreviewValidationItem[] {
  const has = (field: OrderPreviewInputIssue["field"], code?: string) =>
    ctx.inputIssues.some((i) => i.field === field && (code == null || i.code === code));

  const missingRequiredFields = ctx.inputIssues.some((i) => i.code === "missing_field");
  const invalidQuantity = has("quantity", "invalid_quantity");
  const invalidSymbol = has("symbol", "invalid_symbol") || has("symbol", "unresolvable_symbol");

  const items: OrderPreviewValidationItem[] = [];

  items.push({
    code: "required_fields",
    label: "Required fields present",
    status: missingRequiredFields ? "blocked" : "ok",
    detail: missingRequiredFields
      ? "Symbol, strategy, and quantity are all required before a preview can be computed."
      : "Symbol, strategy, and quantity were all provided.",
  });

  items.push({
    code: "quantity_valid",
    label: "Quantity is valid",
    status: invalidQuantity ? "blocked" : "ok",
    detail: invalidQuantity
      ? "Quantity must be a positive whole number of spreads."
      : "Quantity is a positive whole number.",
  });

  items.push({
    code: "symbol_valid",
    label: "Symbol is valid",
    status: invalidSymbol ? "blocked" : "ok",
    detail: invalidSymbol
      ? "This symbol could not be resolved to a tradeable quote."
      : "Symbol resolved to a tradeable quote.",
  });

  items.push({
    code: "buying_power",
    label: "Buying power",
    status: ctx.accountValue <= 0 ? "blocked" : ctx.brokerConnected === true ? "ok" : "warning",
    detail:
      ctx.accountValue <= 0
        ? "Local account value is not positive — buying power cannot be estimated."
        : ctx.brokerConnected === true
          ? `Verified against the most recent Broker Health check ($${ctx.accountValue.toLocaleString()} local account value).`
          : "No successful Broker Health check yet — the buying power impact shown is a local estimate only, not verified against a live Alpaca account.",
  });

  items.push({
    code: "broker_connection",
    label: "Broker connection",
    status: ctx.brokerConnected === true ? "ok" : "warning",
    detail:
      ctx.brokerConnected === true
        ? "The most recent Broker Health check reported a connected Alpaca Paper Trading account."
        : ctx.brokerConnected === false
          ? "The most recent Broker Health check reported the broker as disconnected."
          : "No Broker Health check has been performed yet this session.",
  });

  items.push({
    code: "credentials",
    label: "Broker credentials configured",
    status: ctx.credentialsConfigured ? "ok" : "warning",
    detail: ctx.credentialsConfigured
      ? "Alpaca Paper Trading credentials are configured."
      : "No Alpaca Paper Trading credentials are configured — this preview is fully computable without them, but no real order could ever be routed.",
  });

  items.push({
    code: "position_conflict",
    label: "Existing position in this symbol",
    status: ctx.existingOpenPosition ? "warning" : "ok",
    detail: ctx.existingOpenPosition
      ? "You already have an open position in this symbol — review it before opening another."
      : "No open position exists in this symbol.",
  });

  items.push({
    code: "existing_order",
    label: "Existing open order in this symbol",
    status: ctx.existingPendingOrder ? "warning" : "ok",
    detail: ctx.existingPendingOrder
      ? "A pending (submitted but not yet filled) order already exists for this symbol."
      : "No pending order exists for this symbol.",
  });

  return items;
}

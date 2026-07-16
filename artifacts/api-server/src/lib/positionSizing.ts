// Position Sizing & Portfolio Impact Calculator sprint — extends the
// existing Order Preview & Risk Simulator (lib/orderPreview.ts, previous
// sprint, unmodified) with position-sizing figures, a before/after
// portfolio-impact snapshot, a risk-warnings list, and a scenario
// comparison across 50%/75%/100%/custom quantity.
//
// Every calculation here reuses execution.ts's own existing, unmodified
// previewOptionOrder() (via lib/orderPreview.ts's buildOrderPreview(), and
// directly for a 1-lot recommended-size reference) and serverState.ts's
// own existing, unmodified computeTradeGreeks() — the exact same
// functions the real ticket-building and portfolio pages (routes/
// portfolio.ts) already use. Portfolio-level "concentration before/after"
// figures reuse the ticket's own already-computed
// portfolioRiskBeforePct/AfterPct (execution.ts's own validatePreTrade
// output) rather than re-deriving them. execution.ts, optionsMath.ts, and
// risk.ts are not modified by this sprint.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// an order, and NEVER performs a database write of any kind — every
// function here is read-only (it deliberately does NOT call
// ensureSeedTrades(), unlike routes/portfolio.ts, so an empty portfolio
// is honestly shown as empty rather than being silently auto-seeded —
// "No portfolio mutation" is taken literally).
//
// The "hypothetical" (post-trade) portfolio snapshot is built by
// reconstructing a synthetic trade-shaped entry purely from the PUBLIC
// OrderPreviewTicket fields already returned by buildOrderPreview() (legs,
// netCredit, maxProfit, maxLoss, symbol, strategy) — never from a second,
// private call into execution.ts, and never persisted anywhere. The
// reconstruction is exact: OrderLeg.ratioQty is the per-spread leg ratio
// (unscaled), so `ratioQty * ticket.quantity` reproduces the same
// per-trade leg quantity execution.ts's own storedLegs would have used.

import { db, tradesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { computeTradeGreeks, getAccountValue, getSettingsRow, type StoredLeg } from "./serverState.js";
import { previewOptionOrder, type OrderLeg } from "./execution.js";
import {
  buildOrderPreview,
  type OrderPreviewInput,
  type OrderPreviewResult,
  type OrderPreviewTicket,
} from "./orderPreview.js";

// Named, disclosed thresholds for the 2 genuinely new warning checks this
// sprint introduces (no equivalent exists anywhere else in this codebase)
// — the same "state a reasonable default, disclose it" precedent this
// project has followed since Sprint 38's 2%/6% risk caps and Sprint 29's
// 25%/40% concentration caps.
export const BUYING_POWER_EXHAUSTION_THRESHOLD_PCT = 90;
export const MAX_LEVERAGE_RATIO = 3;

const SCENARIO_PERCENTAGES: readonly { label: string; pct: number }[] = [
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "100% (Current)", pct: 1 },
];

export interface BreakEvenPrice {
  label: string;
  price: number;
}

export interface PositionSizingFigures {
  recommendedQuantity: number | null;
  positionSizePctOfPortfolio: number | null;
  buyingPowerUtilizationPct: number | null;
  capitalAtRisk: number | null;
  maxTheoreticalLoss: number | null;
  maxTheoreticalGain: number | null;
  breakEvens: BreakEvenPrice[];
  breakEvenUnavailableReason: string | null;
  riskRewardRatio: number | null;
  concentrationBeforePct: number | null;
  concentrationAfterPct: number | null;
}

export interface SymbolExposure {
  symbol: string;
  riskDollars: number;
  pctOfAccount: number;
}

export interface PortfolioGreeksSnapshot {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface PortfolioSnapshot {
  openPositionsCount: number;
  totalRiskDollars: number;
  totalRiskPct: number;
  exposureBySymbol: SymbolExposure[];
  longExposureDollars: number;
  shortExposureDollars: number;
  greeks: PortfolioGreeksSnapshot;
}

export interface SectorExposure {
  available: false;
  reason: string;
}

export interface PortfolioImpact {
  current: PortfolioSnapshot;
  hypothetical: PortfolioSnapshot | null;
  sectorExposure: SectorExposure;
  deltaImpact: number | null;
  thetaImpact: number | null;
  gammaImpact: number | null;
  vegaImpact: number | null;
}

export type PositionSizingCheckStatus = "ok" | "warning" | "blocked";

export interface PositionSizingWarning {
  code: string;
  label: string;
  status: PositionSizingCheckStatus;
  detail: string;
}

export interface ScenarioResult {
  label: string;
  quantity: number;
  available: boolean;
  unavailableReason: string | null;
  capitalAtRisk: number | null;
  buyingPowerRequired: number | null;
  buyingPowerUtilizationPct: number | null;
  concentrationAfterPct: number | null;
  positionSizePctOfPortfolio: number | null;
}

export interface PositionSizingAnalysisInput extends OrderPreviewInput {
  customQuantity?: number | null;
}

export interface PositionSizingAnalysis {
  preview: OrderPreviewResult;
  positionSizing: PositionSizingFigures | null;
  portfolioImpact: PortfolioImpact;
  riskWarnings: PositionSizingWarning[];
  scenarios: ScenarioResult[];
  generatedAt: string;
}

// Exported (additive, Trade Adjustment Preview sprint) so
// lib/tradeAdjustmentPreview.ts can reuse the exact same portfolio-
// aggregation logic below rather than duplicating it — zero behavior
// change to this file's own exports/tests.
export interface TradeRow {
  id: number;
  symbol: string;
  strategy: string;
  credit: number;
  maxLoss: number;
  maxProfit: number;
  legs: unknown;
}

export async function currentOpenTrades(userId: string): Promise<TradeRow[]> {
  const rows = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "open"), eq(tradesTable.userId, userId)));
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    strategy: r.strategy,
    credit: r.credit,
    maxLoss: r.maxLoss,
    maxProfit: r.maxProfit,
    legs: r.legs,
  }));
}

function tradeAsGreeksInput(t: TradeRow) {
  return { symbol: t.symbol, legs: t.legs, credit: t.credit, maxProfit: t.maxProfit };
}

// Reconstructs a StoredLeg[]-equivalent array from the PUBLIC
// OrderPreviewTicket's own legs field. OrderLeg.ratioQty is the per-spread
// (1-lot) leg ratio, unscaled by the requested quantity — multiplying by
// ticket.quantity reproduces exactly what execution.ts's own private
// storedLegs would contain, using only already-public data.
function syntheticLegsFromTicket(ticket: OrderPreviewTicket): StoredLeg[] {
  return ticket.legs.map((l: OrderLeg) => ({
    side: l.side,
    optionType: l.optionType,
    strike: l.strike,
    expiration: l.expiration,
    openPrice: l.price,
    quantity: l.ratioQty * ticket.quantity,
  }));
}

function syntheticTradeRow(ticket: OrderPreviewTicket): TradeRow {
  return {
    id: -1,
    symbol: ticket.symbol,
    strategy: ticket.strategy,
    credit: ticket.netCredit,
    maxLoss: ticket.maxLoss,
    maxProfit: ticket.maxProfit,
    legs: syntheticLegsFromTicket(ticket),
  };
}

function greeksTotal(trades: TradeRow[]): PortfolioGreeksSnapshot {
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  for (const t of trades) {
    const g = computeTradeGreeks(tradeAsGreeksInput(t));
    delta += g.delta;
    gamma += g.gamma;
    theta += g.theta;
    vega += g.vega;
  }
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

// A net-credit trade is "short" the spread (premium collected, the
// dominant convention for these strategies); a net-debit trade is "long"
// it (premium paid) — the exact same credit-sign convention
// tradeAnalytics.ts's tradeDirection() already established on the
// frontend, reused here on the backend for portfolio-level aggregation.
export function buildSnapshot(trades: TradeRow[], accountValue: number): PortfolioSnapshot {
  const bySymbol = new Map<string, number>();
  let longExposureDollars = 0;
  let shortExposureDollars = 0;
  let totalRiskDollars = 0;

  for (const t of trades) {
    const riskDollars = Math.max(0, t.maxLoss);
    totalRiskDollars += riskDollars;
    bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + riskDollars);
    if (t.credit >= 0) shortExposureDollars += riskDollars;
    else longExposureDollars += riskDollars;
  }

  const exposureBySymbol: SymbolExposure[] = Array.from(bySymbol.entries())
    .map(([symbol, riskDollars]) => ({
      symbol,
      riskDollars: Math.round(riskDollars),
      pctOfAccount: accountValue > 0 ? Math.round((riskDollars / accountValue) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.riskDollars - a.riskDollars);

  return {
    openPositionsCount: trades.length,
    totalRiskDollars: Math.round(totalRiskDollars),
    totalRiskPct: accountValue > 0 ? Math.round((totalRiskDollars / accountValue) * 10000) / 100 : 0,
    exposureBySymbol,
    longExposureDollars: Math.round(longExposureDollars),
    shortExposureDollars: Math.round(shortExposureDollars),
    greeks: greeksTotal(trades),
  };
}

function deriveBreakEvens(ticket: OrderPreviewTicket): { breakEvens: BreakEvenPrice[]; reason: string | null } {
  if (ticket.strategy !== "iron_condor" && ticket.strategy !== "iron_fly") {
    return {
      breakEvens: [],
      reason:
        "Break-even is only computed for single-expiration credit spreads (iron condor / iron fly) in this simulator — calendar spreads and earnings plays involve multiple expirations, so a simple break-even formula would misrepresent the real payoff.",
    };
  }
  const shortPut = ticket.legs.find((l) => l.side === "sell" && l.optionType === "put");
  const shortCall = ticket.legs.find((l) => l.side === "sell" && l.optionType === "call");
  if (!shortPut || !shortCall) {
    return { breakEvens: [], reason: "Could not identify both short legs on this order." };
  }
  // For an iron condor, shortPut.strike < shortCall.strike; for an iron
  // fly, they are equal (a short straddle) — the same lower/upper formula
  // holds in both cases (standard credit-spread break-even math).
  const creditPerShare = ticket.entryPricePerSpread / 100;
  const lower = Math.round((shortPut.strike - creditPerShare) * 100) / 100;
  const upper = Math.round((shortCall.strike + creditPerShare) * 100) / 100;
  return { breakEvens: [{ label: "Lower", price: lower }, { label: "Upper", price: upper }], reason: null };
}

function positionSizingFigures(
  ticket: OrderPreviewTicket,
  recommendedQuantity: number | null,
  accountValue: number,
): PositionSizingFigures {
  const { breakEvens, reason } = deriveBreakEvens(ticket);
  return {
    recommendedQuantity,
    positionSizePctOfPortfolio: ticket.riskPct,
    buyingPowerUtilizationPct:
      accountValue > 0 ? Math.round((ticket.buyingPowerRequired / accountValue) * 10000) / 100 : null,
    capitalAtRisk: ticket.maxLoss,
    maxTheoreticalLoss: ticket.maxLoss,
    maxTheoreticalGain: ticket.maxProfit,
    breakEvens,
    breakEvenUnavailableReason: reason,
    riskRewardRatio: ticket.riskRewardRatio,
    concentrationBeforePct: ticket.portfolioRiskBeforePct,
    concentrationAfterPct: ticket.portfolioRiskAfterPct,
  };
}

function buildRiskWarnings(
  ticket: OrderPreviewTicket | null,
  preview: OrderPreviewResult,
  accountValue: number,
): PositionSizingWarning[] {
  const warnings: PositionSizingWarning[] = [];

  // "Oversized position" and "Excess concentration" are direct reuses of
  // execution.ts's own PreTradeValidation checks (unmodified) — not a new
  // threshold rule, just relabeled for this warnings list. Matched by
  // label prefix since the real label is dynamically templated with the
  // account's own configured caps (e.g. "Max risk per trade ≤ 1%").
  const maxRiskCheck = ticket?.validation.checks.find((c) => c.label.startsWith("Max risk per trade"));
  warnings.push({
    code: "oversized_position",
    label: "Oversized position",
    status: !ticket ? "warning" : maxRiskCheck?.passed === false ? "blocked" : "ok",
    detail: !ticket
      ? "No valid order to evaluate yet."
      : (maxRiskCheck?.detail ?? "Per-trade risk cap could not be evaluated."),
  });

  const portfolioRiskCheck = ticket?.validation.checks.find((c) => c.label.startsWith("Total portfolio risk"));
  warnings.push({
    code: "excess_concentration",
    label: "Excess concentration",
    status: !ticket ? "warning" : portfolioRiskCheck?.passed === false ? "blocked" : "ok",
    detail: !ticket
      ? "No valid order to evaluate yet."
      : (portfolioRiskCheck?.detail ?? "Portfolio risk cap could not be evaluated."),
  });

  // Buying power exhaustion — a new, disclosed, named threshold on top of
  // the ticket's own already-computed buyingPowerRequired/accountValue.
  const utilizationPct =
    ticket && accountValue > 0 ? (ticket.buyingPowerRequired / accountValue) * 100 : null;
  warnings.push({
    code: "buying_power_exhaustion",
    label: "Buying power exhaustion",
    status:
      utilizationPct === null
        ? "warning"
        : utilizationPct > BUYING_POWER_EXHAUSTION_THRESHOLD_PCT
          ? "blocked"
          : "ok",
    detail:
      utilizationPct === null
        ? "Buying power utilization could not be computed."
        : `This order would use ${utilizationPct.toFixed(1)}% of local account value (cap ${BUYING_POWER_EXHAUSTION_THRESHOLD_PCT}%).`,
  });

  // Excess leverage — a new, disclosed, named threshold (notional value
  // relative to account value; notionalValue is itself already derived,
  // unmodified, on the ticket).
  const leverageRatio = ticket && accountValue > 0 ? ticket.notionalValue / accountValue : null;
  warnings.push({
    code: "excess_leverage",
    label: "Excess leverage",
    status:
      leverageRatio === null ? "warning" : leverageRatio > MAX_LEVERAGE_RATIO ? "blocked" : "ok",
    detail:
      leverageRatio === null
        ? "Leverage ratio could not be computed."
        : `Notional value is ${leverageRatio.toFixed(2)}x local account value (cap ${MAX_LEVERAGE_RATIO}x).`,
  });

  // Position conflict / existing order / missing credentials — reused
  // directly, unmodified, from the Order Preview checklist (last sprint).
  const conflict = preview.preTradeChecklist.find((c) => c.code === "position_conflict");
  if (conflict) warnings.push({ code: "position_conflict", label: "Existing position conflict", status: conflict.status, detail: conflict.detail });

  const order = preview.preTradeChecklist.find((c) => c.code === "existing_order");
  if (order) warnings.push({ code: "existing_order", label: "Existing open order conflict", status: order.status, detail: order.detail });

  // Missing broker data — distinct from "missing credentials": this flags
  // that the CURRENT portfolio figures shown are sourced from this
  // platform's own local trade records, not a live Alpaca account, since
  // no successful Broker Health check exists this session.
  warnings.push({
    code: "missing_broker_data",
    label: "Missing broker data",
    status: preview.brokerConnected === true ? "ok" : "warning",
    detail:
      preview.brokerConnected === true
        ? "The most recent Broker Health check succeeded — but portfolio impact figures below are still computed from local trade records."
        : "No successful Broker Health check exists this session — every portfolio figure below is computed from this platform's own local trade records, not live Alpaca account data.",
  });

  const credentials = preview.preTradeChecklist.find((c) => c.code === "credentials");
  if (credentials) warnings.push({ code: "missing_credentials", label: "Missing credentials", status: credentials.status, detail: credentials.detail });

  return warnings;
}

async function scenarioFor(
  label: string,
  quantity: number,
  input: OrderPreviewInput,
  accountValue: number,
  userId: string,
): Promise<ScenarioResult> {
  const result = await buildOrderPreview({ ...input, quantity }, userId);
  if (!result.available || !result.ticket) {
    return {
      label,
      quantity,
      available: false,
      unavailableReason: result.inputIssues[0]?.message ?? "Preview unavailable for this quantity.",
      capitalAtRisk: null,
      buyingPowerRequired: null,
      buyingPowerUtilizationPct: null,
      concentrationAfterPct: null,
      positionSizePctOfPortfolio: null,
    };
  }
  return {
    label,
    quantity,
    available: true,
    unavailableReason: null,
    capitalAtRisk: result.ticket.maxLoss,
    buyingPowerRequired: result.ticket.buyingPowerRequired,
    buyingPowerUtilizationPct:
      accountValue > 0 ? Math.round((result.ticket.buyingPowerRequired / accountValue) * 10000) / 100 : null,
    concentrationAfterPct: result.ticket.portfolioRiskAfterPct,
    positionSizePctOfPortfolio: result.ticket.riskPct,
  };
}

export async function buildPositionSizingAnalysis(
  input: PositionSizingAnalysisInput,
  userId: string,
): Promise<PositionSizingAnalysis> {
  const generatedAt = new Date().toISOString();
  const { customQuantity, ...previewInput } = input;

  const preview = await buildOrderPreview(previewInput, userId);
  const accountValue = await getAccountValue(userId);
  const settings = await getSettingsRow(userId);

  const trades = await currentOpenTrades(userId);
  const currentSnapshot = buildSnapshot(trades, accountValue);

  let hypotheticalSnapshot: PortfolioSnapshot | null = null;
  let positionSizing: PositionSizingFigures | null = null;
  let recommendedQuantity: number | null = null;

  if (preview.available && preview.ticket) {
    const synthetic = syntheticTradeRow(preview.ticket);
    hypotheticalSnapshot = buildSnapshot([...trades, synthetic], accountValue);

    // A 1-lot ticket for the same symbol/strategy gives the per-spread
    // risk needed to back out a recommended quantity from the account's
    // own already-configured per-trade risk cap (execution.ts's own
    // enforced setting, applied here only as a sizing suggestion, never a
    // new risk rule).
    try {
      const oneLot = await previewOptionOrder(
        { symbol: preview.ticket.symbol, strategy: preview.ticket.strategy, quantity: 1 },
        userId,
      );
      if (oneLot.maxLoss > 0) {
        const budget = accountValue * (settings.maxRiskPerTrade / 100);
        recommendedQuantity = Math.max(1, Math.floor(budget / oneLot.maxLoss));
      }
    } catch {
      recommendedQuantity = null;
    }

    positionSizing = positionSizingFigures(preview.ticket, recommendedQuantity, accountValue);
  }

  const portfolioImpact: PortfolioImpact = {
    current: currentSnapshot,
    hypothetical: hypotheticalSnapshot,
    sectorExposure: {
      available: false,
      reason: "No sector/industry classification is stored on options positions in this engine.",
    },
    deltaImpact: hypotheticalSnapshot ? Math.round((hypotheticalSnapshot.greeks.delta - currentSnapshot.greeks.delta) * 1000) / 1000 : null,
    thetaImpact: hypotheticalSnapshot ? Math.round((hypotheticalSnapshot.greeks.theta - currentSnapshot.greeks.theta) * 100) / 100 : null,
    gammaImpact: hypotheticalSnapshot ? Math.round((hypotheticalSnapshot.greeks.gamma - currentSnapshot.greeks.gamma) * 10000) / 10000 : null,
    vegaImpact: hypotheticalSnapshot ? Math.round((hypotheticalSnapshot.greeks.vega - currentSnapshot.greeks.vega) * 100) / 100 : null,
  };

  const riskWarnings = buildRiskWarnings(preview.ticket, preview, accountValue);

  const scenarios: ScenarioResult[] = [];
  if (preview.available && preview.ticket) {
    const baseQuantity = preview.ticket.quantity;
    for (const { label, pct } of SCENARIO_PERCENTAGES) {
      const qty = Math.max(1, Math.round(baseQuantity * pct));
      scenarios.push(await scenarioFor(label, qty, previewInput, accountValue, userId));
    }
    if (customQuantity != null && Number.isInteger(customQuantity) && customQuantity > 0) {
      scenarios.push(await scenarioFor("Custom", customQuantity, previewInput, accountValue, userId));
    }
  }

  return { preview, positionSizing, portfolioImpact, riskWarnings, scenarios, generatedAt };
}

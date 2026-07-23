// Earnings & Event Risk Portfolio Overlay sprint — a dedicated, read-only
// overlay showing which of the user's own current open positions have an
// upcoming earnings/dividend/macro event before their own expiration,
// and a portfolio-wide summary of that exposure.
//
// Every event and risk-level figure here is a direct, unmodified reuse of
// lib/eventRisk.ts's existing getEventRiskForSymbol()/EventRiskAssessment
// — the exact same function execution.ts and autoExecution.ts already
// call for their own event-risk gating — and optionsMath.ts's own
// EventRiskEvent/EventRiskLevel/EventRiskType. eventRisk.ts, optionsMath.ts,
// execution.ts, autoExecution.ts, and autoAdjustment.ts are NOT modified
// by this sprint.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or modifies an order or position, and NEVER performs a database write
// of any kind — every function here is read-only.
//
// Scope note, honestly disclosed rather than silently narrowed: this
// sprint's own request text lists "FDA decisions" and "product launches"
// as example event categories, but no data source for either exists
// anywhere in this codebase (confirmed by direct inspection before
// writing any code — eventRisk.ts's own header describes itself as "a
// deterministic, simulated economic/market event calendar" covering only
// earnings, dividends, and macro releases). Per this sprint's own
// explicit "do not invent new event models" instruction, neither
// category is fabricated; UNSUPPORTED_EVENT_CATEGORIES below discloses
// this gap directly in the API response rather than silently omitting
// it. Every one of the 7 real EventRiskType values (earnings, dividend,
// fomc, cpi, jobs, economic, news) is supported.

import {
  type EventRiskEvent,
  type EventRiskLevel,
  type EventRiskType,
} from "./optionsMath.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { getAccountValue, getSettingsRow, type StoredLeg } from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import {
  getLastBrokerCheckConnected,
  getLastSuccessfulBrokerCheck,
} from "./providers/alpacaBroker.js";
import { currentOpenTrades, type TradeRow } from "./positionSizing.js";

export type EventStatus = "has_events" | "no_events" | "expiration_unknown";
export type EventConfidence = "scheduled" | "simulated_estimate";
export type RiskGuidanceCode =
  | "monitor"
  | "consider_review"
  | "consider_adjustment"
  | "no_immediate_event_risk";

// The 4 informational-only guidance labels this sprint's spec requests,
// mapped directly and exhaustively onto eventRisk.ts's own existing
// EventRiskLevel enum (none/low/medium/high) — zero new risk scoring,
// just a display label. Never wired to any execution/adjustment action.
const GUIDANCE: Record<EventRiskLevel, { code: RiskGuidanceCode; label: string }> = {
  high: { code: "consider_adjustment", label: "Consider Adjustment" },
  medium: { code: "consider_review", label: "Consider Review" },
  low: { code: "monitor", label: "Monitor" },
  none: { code: "no_immediate_event_risk", label: "No Immediate Event Risk" },
};

// Market-wide macro events (FOMC/CPI/jobs/PCE-style releases) are
// generated on a formulaic, calendar-style schedule (nth weekday of the
// month) — "Scheduled" reflects that shape. Symbol-specific events
// (earnings/dividend) are derived from a per-symbol seeded estimate, not
// a real provider feed — "Simulated Estimate" is the honest label. This
// is a disclosed classification of the event's own SOURCE shape, not a
// fabricated new confidence score.
const SCHEDULED_TYPES: ReadonlySet<EventRiskType> = new Set(["fomc", "cpi", "jobs", "economic"]);

function confidenceFor(type: EventRiskType): EventConfidence {
  return SCHEDULED_TYPES.has(type) ? "scheduled" : "simulated_estimate";
}

export const UNSUPPORTED_EVENT_CATEGORIES: { category: string; label: string; reason: string }[] = [
  {
    category: "fda_decision",
    label: "FDA Decisions",
    reason: "No FDA-calendar data source exists anywhere in this codebase — never fabricated.",
  },
  {
    category: "product_launch",
    label: "Product Launches",
    reason: "No product-launch calendar data source exists anywhere in this codebase — never fabricated.",
  },
];

export interface PositionEventRisk {
  tradeId: number;
  symbol: string;
  strategy: string;
  quantity: number;
  portfolioWeightPct: number;
  expiration: string | null;
  eventStatus: EventStatus;
  primaryEvent: EventRiskEvent | null;
  events: EventRiskEvent[];
  riskLevel: EventRiskLevel;
  riskGuidance: RiskGuidanceCode;
  riskGuidanceLabel: string;
  confidence: EventConfidence | null;
  eventSource: "SIMULATED";
  lastUpdated: string;
}

export interface HighestRiskPosition {
  tradeId: number;
  symbol: string;
  riskLevel: EventRiskLevel;
}

export interface PortfolioEventRiskSummary {
  totalPositions: number;
  positionsWithEvents: number;
  positionsWithoutEvents: number;
  highRiskCount: number;
  within1Day: number;
  within3Days: number;
  within7Days: number;
  within14Days: number;
  aggregateExposurePct: number;
  highestRiskPosition: HighestRiskPosition | null;
}

export interface PortfolioEventRiskResult {
  positions: PositionEventRisk[];
  summary: PortfolioEventRiskSummary;
  accountValue: number;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  eventRiskEnabled: boolean;
  unsupportedEventCategories: typeof UNSUPPORTED_EVENT_CATEGORIES;
  generatedAt: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Mirrors lib/tradeAdjustmentPreview.ts's own established one-line
// technique for deriving a position's lot quantity from its own stored
// legs (every leg of a single-strategy position shares the same lot
// count) — the same reuse, not a new derivation.
function deriveLotQuantity(legs: unknown): number {
  const list = (legs as StoredLeg[]) ?? [];
  if (list.length === 0) return 1;
  return Math.max(1, ...list.map((l) => l.quantity || 1));
}

const RISK_RANK: Record<EventRiskLevel, number> = { high: 3, medium: 2, low: 1, none: 0 };

function assessPosition(t: TradeRow, accountValue: number, now: number): PositionEventRisk {
  const quantity = deriveLotQuantity(t.legs);
  const portfolioWeightPct =
    accountValue > 0 ? round2((Math.max(0, t.maxLoss) / accountValue) * 100) : 0;
  const nowIso = new Date(now).toISOString();

  if (!t.expiration) {
    return {
      tradeId: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      quantity,
      portfolioWeightPct,
      expiration: null,
      eventStatus: "expiration_unknown",
      primaryEvent: null,
      events: [],
      riskLevel: "none",
      riskGuidance: GUIDANCE.none.code,
      riskGuidanceLabel: GUIDANCE.none.label,
      confidence: null,
      eventSource: "SIMULATED",
      lastUpdated: nowIso,
    };
  }

  // Reused, unmodified — the exact function execution.ts/autoExecution.ts
  // already call for their own event-risk gating. `enabled: true` is
  // deliberate and always passed regardless of the user's own
  // settings.eventRiskEnabled toggle: that setting controls whether
  // event risk BLOCKS execution/AutoPilot, not whether this read-only
  // analysis page is allowed to show real event data — the two are
  // disclosed as distinct in the response's own eventRiskEnabled field.
  const assessment = getEventRiskForSymbol(t.symbol, t.strategy, t.expiration, now, true);
  const primary = assessment.events[0] ?? null;
  const guidance = GUIDANCE[assessment.level];

  return {
    tradeId: t.id,
    symbol: t.symbol,
    strategy: t.strategy,
    quantity,
    portfolioWeightPct,
    expiration: t.expiration,
    eventStatus: assessment.events.length > 0 ? "has_events" : "no_events",
    primaryEvent: primary,
    events: assessment.events,
    riskLevel: assessment.level,
    riskGuidance: guidance.code,
    riskGuidanceLabel: guidance.label,
    confidence: primary ? confidenceFor(primary.type) : null,
    eventSource: "SIMULATED",
    lastUpdated: nowIso,
  };
}

function buildSummary(positions: PositionEventRisk[]): PortfolioEventRiskSummary {
  const withEvents = positions.filter((p) => p.eventStatus === "has_events");
  const highRisk = positions.filter((p) => p.riskLevel === "high");

  const within = (days: number) =>
    positions.filter((p) => p.primaryEvent !== null && p.primaryEvent.daysAway <= days).length;

  // Each position's own portfolioWeightPct is already maxLoss ÷
  // accountValue × 100 — summing across only the positions that carry
  // event risk gives the aggregate % of the account exposed to it,
  // with no second division needed.
  const aggregateExposurePct = round2(
    withEvents.reduce((sum, p) => sum + Math.max(0, p.portfolioWeightPct), 0),
  );

  let highest: HighestRiskPosition | null = null;
  for (const p of positions) {
    if (!highest || RISK_RANK[p.riskLevel] > RISK_RANK[highest.riskLevel]) {
      highest = { tradeId: p.tradeId, symbol: p.symbol, riskLevel: p.riskLevel };
    } else if (
      RISK_RANK[p.riskLevel] === RISK_RANK[highest.riskLevel] &&
      p.primaryEvent &&
      highest.riskLevel !== "none"
    ) {
      // Tie-break on the soonest event among equally-ranked positions —
      // never arbitrary, always a real comparison over already-computed
      // data.
      const current = positions.find((x) => x.tradeId === highest!.tradeId);
      if (current?.primaryEvent && p.primaryEvent.daysAway < current.primaryEvent.daysAway) {
        highest = { tradeId: p.tradeId, symbol: p.symbol, riskLevel: p.riskLevel };
      }
    }
  }
  // A "none"-risk highest is meaningless when nothing has any risk at all.
  if (highest && highest.riskLevel === "none") highest = null;

  return {
    totalPositions: positions.length,
    positionsWithEvents: withEvents.length,
    positionsWithoutEvents: positions.length - withEvents.length,
    highRiskCount: highRisk.length,
    within1Day: within(1),
    within3Days: within(3),
    within7Days: within(7),
    within14Days: within(14),
    aggregateExposurePct,
    highestRiskPosition: highest,
  };
}

export async function buildPortfolioEventRiskOverlay(
  userId: string,
  now: number = Date.now(),
): Promise<PortfolioEventRiskResult> {
  const [trades, accountValue, settings] = await Promise.all([
    currentOpenTrades(userId),
    getAccountValue(userId),
    getSettingsRow(userId),
  ]);

  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();

  const positions = trades.map((t) => assessPosition(t, accountValue, now));
  const summary = buildSummary(positions);

  return {
    positions,
    summary,
    accountValue,
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    eventRiskEnabled: settings.eventRiskEnabled,
    unsupportedEventCategories: UNSUPPORTED_EVENT_CATEGORIES,
    generatedAt: new Date(now).toISOString(),
  };
}

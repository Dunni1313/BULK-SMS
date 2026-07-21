// Phase 39 — Institutional Scenario & Stress Testing Engine.
//
// ANALYTICAL ONLY. This module never predicts, forecasts, recommends a
// trade, hedges, auto-executes, or runs a Monte Carlo/random simulation.
// Every scenario here is a deterministic, user-named "what if this
// hypothetical market move happened right now" repricing over the
// calling user's own already-persisted, real holdings/positions/trades —
// never a probability estimate of it actually happening.
//
//   - Options — lib/portfolioStressTest.ts's own buildPortfolioStressTest()
//     (an already-shipped, already-tested What-If simulator) is reused
//     VERBATIM, unmodified, for every price/volatility scenario — it
//     already reprices every open options position via optionsMath.ts's
//     own unmodified bs() at a shocked underlying price / shocked IV /
//     reduced time-to-expiration, and already produces Portfolio Impact,
//     Asset/Strategy Impact, Greeks Impact, Buying Power Impact, and
//     Capital Impact. Zero new math for those two scenario categories.
//   - Options interest-rate scenarios are the ONE genuinely new formula
//     this phase adds — optionsMath.ts's own exported bs() already
//     accepts an optional risk-free-rate parameter `r` that no existing
//     caller in this codebase ever supplies (every caller lets it default
//     to bs()'s own internal 4.5% constant). This module supplies a
//     shocked rate to that already-existing, unmodified parameter — a
//     genuine reuse of existing deterministic mathematics, not a new
//     pricing model, and optionsMath.ts itself is never touched.
//   - Investing/Trading — equities have no convexity or Greeks, so their
//     scenario repricing is a linear, deterministic formula:
//     shockedPrice = currentPrice * (1 + priceShockPct/100). Investing
//     reuses lib/portfolioConstruction.ts's own buildPortfolioAllocation()
//     for current price/sector; Trading reuses
//     lib/tradingMarketData.ts's own getQuote() for current price, and a
//     best-effort Trading Journal join (the same loose tradingPositionId
//     reference Phase 38's Performance Engine already established) for
//     Strategy Impact.
//   - Volatility and interest-rate scenarios are options-native concepts.
//     Investing/Trading holdings have no IV/Greeks formalism in this
//     codebase for a raw equity position, so both scenario categories
//     honestly report `available: false` for those two engines — never
//     approximated from a price-only proxy.
//
// See docs/Institutional-Scenario-Model.md for the full, itemised
// reused-vs-new breakdown.

import { db, investingHoldingsTable, tradingPositionsTable, tradingJournalEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getFundamentalsProvider } from "./fundamentals.js";
import { buildPortfolioAllocation, type PortfolioHoldingInput } from "./portfolioConstruction.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { getSettingsRow } from "./serverState.js";
import { buildPortfolioStressTest, DEFAULT_SCENARIO_PRESETS as OPTIONS_DEFAULT_PRESETS, type ScenarioShockInput, type PortfolioStressTestResult } from "./portfolioStressTest.js";
import { getSnapshot, bs } from "./optionsMath.js";
import { currentOpenTrades, type TradeRow } from "./positionSizing.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const PRICE_SHOCK_MIN_PCT = -99;
const PRICE_SHOCK_MAX_PCT = 1000;

// ─── Shared scenario definitions ────────────────────────────────────────

export type ScenarioCategory = "price" | "volatility" | "rate";

export interface ScenarioDefinition {
  key: string;
  label: string;
  category: ScenarioCategory;
  priceShockPct: number;
  ivShockPct: number;
  ratePointsShock: number; // Options only — absolute percentage-point delta (1 = +100bps)
}

// The kickoff's own named examples: Market ±5%/±10%, Volatility
// Increase/Decrease, Interest Rate Increase/Decrease. "Custom percentage
// move" is a caller-supplied addition, never a default.
export const DEFAULT_SCENARIOS: ScenarioDefinition[] = [
  { key: "market_up_5", label: "Market +5%", category: "price", priceShockPct: 5, ivShockPct: 0, ratePointsShock: 0 },
  { key: "market_down_5", label: "Market -5%", category: "price", priceShockPct: -5, ivShockPct: 0, ratePointsShock: 0 },
  { key: "market_up_10", label: "Market +10%", category: "price", priceShockPct: 10, ivShockPct: 0, ratePointsShock: 0 },
  { key: "market_down_10", label: "Market -10%", category: "price", priceShockPct: -10, ivShockPct: 0, ratePointsShock: 0 },
  { key: "volatility_up", label: "Volatility Increase (+20%)", category: "volatility", priceShockPct: 0, ivShockPct: 20, ratePointsShock: 0 },
  { key: "volatility_down", label: "Volatility Decrease (-20%)", category: "volatility", priceShockPct: 0, ivShockPct: -20, ratePointsShock: 0 },
  { key: "rate_up", label: "Interest Rate Increase (+100bps)", category: "rate", priceShockPct: 0, ivShockPct: 0, ratePointsShock: 1 },
  { key: "rate_down", label: "Interest Rate Decrease (-100bps)", category: "rate", priceShockPct: 0, ivShockPct: 0, ratePointsShock: -1 },
];

export interface CustomScenarioInput {
  label?: string | null;
  priceShockPct?: number | null;
}

export function buildCustomScenario(input: CustomScenarioInput, index: number): ScenarioDefinition {
  const pct = clamp(input.priceShockPct ?? 0, PRICE_SHOCK_MIN_PCT, PRICE_SHOCK_MAX_PCT);
  return {
    key: `custom_${index}`,
    label: input.label && input.label.trim().length > 0 ? input.label : `Custom (${pct >= 0 ? "+" : ""}${pct}%)`,
    category: "price",
    priceShockPct: pct,
    ivShockPct: 0,
    ratePointsShock: 0,
  };
}

const INAPPLICABLE_VOLATILITY_REASON =
  "Volatility scenarios apply to options positions via implied volatility — a raw equity holding has no IV/Greeks formalism in this codebase, so this is honestly unavailable rather than approximated.";
const INAPPLICABLE_RATE_REASON =
  "Interest-rate scenarios apply to options positions via the risk-free rate in Black-Scholes pricing — a raw equity holding has no deterministic rate-sensitivity formula in this codebase, so this is honestly unavailable rather than approximated.";

export interface ScenarioAttributionEntry {
  key: string;
  label: string;
  impactDollars: number;
}

// ─── 1. Investing scenario view ─────────────────────────────────────────

export interface InvestingHoldingScenarioImpact {
  symbol: string;
  sector: string | null;
  shares: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  shockedPrice: number | null;
  shockedMarketValue: number | null;
  impactDollars: number | null;
}

export interface InvestingScenarioResult {
  scenario: ScenarioDefinition;
  available: boolean;
  reason: string | null;
  totalMarketValueBefore: number | null;
  totalMarketValueAfter: number | null;
  totalImpactDollars: number | null;
  totalImpactPct: number | null;
  holdings: InvestingHoldingScenarioImpact[];
  sectorImpact: ScenarioAttributionEntry[];
  assetImpact: ScenarioAttributionEntry[];
}

export interface InvestingScenarioView {
  portfolioCount: number;
  holdingsCount: number;
  baseMarketValue: number | null;
  results: InvestingScenarioResult[];
  summary: string;
}

export async function buildInvestingScenarioView(userId: string, scenarios: ScenarioDefinition[]): Promise<InvestingScenarioView> {
  const rows = await db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  const portfolioCount = new Set(rows.map((r) => r.portfolioId)).size;

  if (rows.length === 0) {
    return {
      portfolioCount: 0,
      holdingsCount: 0,
      baseMarketValue: null,
      results: scenarios.map((scenario) => ({
        scenario,
        available: scenario.category === "price",
        reason: scenario.category === "volatility" ? INAPPLICABLE_VOLATILITY_REASON : scenario.category === "rate" ? INAPPLICABLE_RATE_REASON : null,
        totalMarketValueBefore: null,
        totalMarketValueAfter: null,
        totalImpactDollars: null,
        totalImpactPct: null,
        holdings: [],
        sectorImpact: [],
        assetImpact: [],
      })),
      summary: "This user has no Investing holdings on record yet.",
    };
  }

  const holdingInputs: PortfolioHoldingInput[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
    avgCostBasis: r.avgCostBasis,
  }));
  const provider = await getFundamentalsProvider(userId);
  const allocation = await buildPortfolioAllocation(holdingInputs, provider);

  const baseMarketValue = allocation.totalMarketValue;

  const results: InvestingScenarioResult[] = scenarios.map((scenario) => {
    if (scenario.category !== "price") {
      return {
        scenario,
        available: false,
        reason: scenario.category === "volatility" ? INAPPLICABLE_VOLATILITY_REASON : INAPPLICABLE_RATE_REASON,
        totalMarketValueBefore: baseMarketValue,
        totalMarketValueAfter: null,
        totalImpactDollars: null,
        totalImpactPct: null,
        holdings: [],
        sectorImpact: [],
        assetImpact: [],
      };
    }

    const holdings: InvestingHoldingScenarioImpact[] = allocation.holdings.map((h) => {
      const shockedPrice = h.currentPrice != null ? h.currentPrice * (1 + scenario.priceShockPct / 100) : null;
      const shockedMarketValue = h.shares != null && shockedPrice != null ? h.shares * shockedPrice : null;
      const impactDollars = shockedMarketValue != null && h.marketValue != null ? shockedMarketValue - h.marketValue : null;
      return {
        symbol: h.symbol,
        sector: h.sector,
        shares: h.shares,
        currentPrice: h.currentPrice,
        marketValue: h.marketValue != null ? round2(h.marketValue) : null,
        shockedPrice: shockedPrice != null ? round2(shockedPrice) : null,
        shockedMarketValue: shockedMarketValue != null ? round2(shockedMarketValue) : null,
        impactDollars: impactDollars != null ? round2(impactDollars) : null,
      };
    });

    const withImpact = holdings.filter((h) => h.impactDollars != null);
    const totalImpactDollars = withImpact.length > 0 ? round2(withImpact.reduce((s, h) => s + (h.impactDollars as number), 0)) : null;
    const totalMarketValueAfter = baseMarketValue != null && totalImpactDollars != null ? round2(baseMarketValue + totalImpactDollars) : null;
    const totalImpactPct = totalImpactDollars != null && baseMarketValue != null && baseMarketValue !== 0 ? round2((totalImpactDollars / baseMarketValue) * 100) : null;

    const sectorImpact = attributeByKey(withImpact.map((h) => ({ key: h.sector ?? "Unclassified", label: h.sector ?? "Unclassified", impactDollars: h.impactDollars as number })));
    const assetImpact = attributeByKey(withImpact.map((h) => ({ key: h.symbol, label: h.symbol, impactDollars: h.impactDollars as number })));

    return {
      scenario,
      available: true,
      reason: null,
      totalMarketValueBefore: baseMarketValue,
      totalMarketValueAfter,
      totalImpactDollars,
      totalImpactPct,
      holdings,
      sectorImpact,
      assetImpact,
    };
  });

  return {
    portfolioCount,
    holdingsCount: rows.length,
    baseMarketValue,
    results,
    summary: `${rows.length} holding(s) across ${portfolioCount} portfolio(s) evaluated across ${scenarios.length} scenario(s).`,
  };
}

function attributeByKey(entries: { key: string; label: string; impactDollars: number }[]): ScenarioAttributionEntry[] {
  const byKey = new Map<string, { label: string; impactDollars: number }>();
  for (const e of entries) {
    const existing = byKey.get(e.key);
    if (existing) existing.impactDollars += e.impactDollars;
    else byKey.set(e.key, { label: e.label, impactDollars: e.impactDollars });
  }
  return [...byKey.entries()]
    .map(([key, v]) => ({ key, label: v.label, impactDollars: round2(v.impactDollars) }))
    .sort((a, b) => Math.abs(b.impactDollars) - Math.abs(a.impactDollars));
}

// ─── 2. Trading scenario view ───────────────────────────────────────────

export interface TradingPositionScenarioImpact {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number | null;
  shockedPrice: number | null;
  impactDollars: number | null;
  setupType: string | null;
}

export interface TradingScenarioResult {
  scenario: ScenarioDefinition;
  available: boolean;
  reason: string | null;
  totalImpactDollars: number | null;
  positions: TradingPositionScenarioImpact[];
  strategyImpact: ScenarioAttributionEntry[];
  assetImpact: ScenarioAttributionEntry[];
}

export interface TradingScenarioView {
  openPositionsCount: number;
  results: TradingScenarioResult[];
  summary: string;
}

async function resolveTradingSetupTypes(userId: string): Promise<Map<number, string | null>> {
  const journalRows = await db
    .select({ tradingPositionId: tradingJournalEntriesTable.tradingPositionId, setupType: tradingJournalEntriesTable.setupType })
    .from(tradingJournalEntriesTable)
    .where(eq(tradingJournalEntriesTable.userId, userId))
    .orderBy(desc(tradingJournalEntriesTable.createdAt));
  const map = new Map<number, string | null>();
  for (const j of journalRows) {
    if (j.tradingPositionId == null) continue;
    if (!map.has(j.tradingPositionId)) map.set(j.tradingPositionId, j.setupType ?? null);
  }
  return map;
}

export async function buildTradingScenarioView(userId: string, scenarios: ScenarioDefinition[]): Promise<TradingScenarioView> {
  const rows = (await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId))).filter((r) => r.status === "open");

  if (rows.length === 0) {
    return {
      openPositionsCount: 0,
      results: scenarios.map((scenario) => ({
        scenario,
        available: scenario.category === "price",
        reason: scenario.category === "volatility" ? INAPPLICABLE_VOLATILITY_REASON : scenario.category === "rate" ? INAPPLICABLE_RATE_REASON : null,
        totalImpactDollars: null,
        positions: [],
        strategyImpact: [],
        assetImpact: [],
      })),
      summary: "This user has no open Trading positions on record yet.",
    };
  }

  const provider = await getMarketDataProvider(userId);
  const setupTypeByPositionId = await resolveTradingSetupTypes(userId);
  const distinctSymbols = [...new Set(rows.map((r) => r.symbol))];
  const priceBySymbol = new Map<string, number | null>();
  await Promise.all(
    distinctSymbols.map(async (symbol) => {
      const quote = await provider.getQuote(symbol).catch(() => null);
      priceBySymbol.set(symbol, quote?.price ?? null);
    }),
  );

  const results: TradingScenarioResult[] = scenarios.map((scenario) => {
    if (scenario.category !== "price") {
      return {
        scenario,
        available: false,
        reason: scenario.category === "volatility" ? INAPPLICABLE_VOLATILITY_REASON : INAPPLICABLE_RATE_REASON,
        totalImpactDollars: null,
        positions: [],
        strategyImpact: [],
        assetImpact: [],
      };
    }

    const positions: TradingPositionScenarioImpact[] = rows.map((r) => {
      const currentPrice = priceBySymbol.get(r.symbol) ?? null;
      const shockedPrice = currentPrice != null ? currentPrice * (1 + scenario.priceShockPct / 100) : null;
      const direction = r.side === "short" ? -1 : 1;
      const impactDollars = shockedPrice != null && currentPrice != null ? (shockedPrice - currentPrice) * r.quantity * direction : null;
      return {
        id: r.id,
        symbol: r.symbol,
        side: r.side,
        quantity: r.quantity,
        entryPrice: r.entryPrice,
        currentPrice,
        shockedPrice: shockedPrice != null ? round2(shockedPrice) : null,
        impactDollars: impactDollars != null ? round2(impactDollars) : null,
        setupType: setupTypeByPositionId.get(r.id) ?? null,
      };
    });

    const withImpact = positions.filter((p) => p.impactDollars != null);
    const totalImpactDollars = withImpact.length > 0 ? round2(withImpact.reduce((s, p) => s + (p.impactDollars as number), 0)) : null;

    const strategyImpact = attributeByKey(withImpact.map((p) => ({ key: (p.setupType ?? "unclassified").toLowerCase(), label: p.setupType ?? "Unclassified", impactDollars: p.impactDollars as number })));
    const assetImpact = attributeByKey(withImpact.map((p) => ({ key: p.symbol, label: p.symbol, impactDollars: p.impactDollars as number })));

    return { scenario, available: true, reason: null, totalImpactDollars, positions, strategyImpact, assetImpact };
  });

  return {
    openPositionsCount: rows.length,
    results,
    summary: `${rows.length} open position(s) evaluated across ${scenarios.length} scenario(s).`,
  };
}

// ─── 3. Options scenario view ───────────────────────────────────────────
//
// Price/volatility scenarios reuse lib/portfolioStressTest.ts's own
// buildPortfolioStressTest() verbatim — zero new repricing math. Interest-
// rate scenarios are the one genuinely new formula: a shocked risk-free
// rate is supplied to optionsMath.ts's own exported, unmodified bs(),
// mirroring lib/portfolioStressTest.ts's own computeShockedGreeks() shape
// exactly but varying rate instead of price/IV/time.

export interface OptionsRateScenarioPositionImpact {
  tradeId: number;
  symbol: string;
  strategy: string;
  costToClose: number;
  unrealizedPnl: number;
}

export interface OptionsRateScenarioResult {
  scenario: ScenarioDefinition;
  available: boolean;
  baseRiskFreeRate: number;
  shockedRiskFreeRate: number;
  totalImpactDollars: number;
  positions: OptionsRateScenarioPositionImpact[];
}

export interface OptionsScenarioView {
  stressTest: PortfolioStressTestResult;
  rateScenarios: OptionsRateScenarioResult[];
}

function computeRateShockedTrade(trade: TradeRow, rate: number): OptionsRateScenarioPositionImpact | null {
  const snap = getSnapshot(trade.symbol);
  if (!snap) return null;
  let sellMid = 0;
  let buyMid = 0;
  for (const leg of trade.legs as { side: string; optionType: "call" | "put"; strike: number; expiration: string; quantity: number }[]) {
    const daysRemaining = Math.max(1, Math.ceil((new Date(leg.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const T = daysRemaining / 365;
    const g = bs(snap.price, leg.strike, T, snap.iv, leg.optionType, rate);
    if (leg.side === "sell") sellMid += g.price * leg.quantity;
    else buyMid += g.price * leg.quantity;
  }
  const costToClose = (sellMid - buyMid) * 100;
  const unrealizedPnl = trade.credit - costToClose;
  return { tradeId: trade.id, symbol: trade.symbol, strategy: trade.strategy, costToClose: round2(costToClose), unrealizedPnl: round2(unrealizedPnl) };
}

async function buildOptionsRateScenarios(userId: string, rateScenarios: ScenarioDefinition[]): Promise<OptionsRateScenarioResult[]> {
  if (rateScenarios.length === 0) return [];
  const [trades, settings] = await Promise.all([currentOpenTrades(userId), getSettingsRow(userId)]);
  const baseRate = settings.investingRiskFreeRate ?? 0.045;
  return rateScenarios.map((scenario) => {
    const shockedRate = baseRate + scenario.ratePointsShock / 100;
    const basePositions = trades.map((t) => computeRateShockedTrade(t, baseRate)).filter((p): p is OptionsRateScenarioPositionImpact => p !== null);
    const shockedPositions = trades.map((t) => computeRateShockedTrade(t, shockedRate)).filter((p): p is OptionsRateScenarioPositionImpact => p !== null);
    const baseByTradeId = new Map(basePositions.map((p) => [p.tradeId, p.unrealizedPnl]));
    const totalImpactDollars = round2(shockedPositions.reduce((s, p) => s + (p.unrealizedPnl - (baseByTradeId.get(p.tradeId) ?? 0)), 0));
    return { scenario, available: trades.length > 0, baseRiskFreeRate: round2(baseRate * 100), shockedRiskFreeRate: round2(shockedRate * 100), totalImpactDollars, positions: shockedPositions };
  });
}

export async function buildOptionsScenarioView(userId: string, scenarios: ScenarioDefinition[]): Promise<OptionsScenarioView> {
  const priceAndVolScenarios = scenarios.filter((s) => s.category === "price" || s.category === "volatility");
  const rateScenarios = scenarios.filter((s) => s.category === "rate");

  const shockInputs: ScenarioShockInput[] = priceAndVolScenarios.map((s) => ({ label: s.label, priceShockPct: s.priceShockPct, ivShockPct: s.ivShockPct, timeDecayDays: 0 }));
  const [stressTest, rateResults] = await Promise.all([
    buildPortfolioStressTest({ scenarios: shockInputs.length > 0 ? shockInputs : OPTIONS_DEFAULT_PRESETS }, userId),
    buildOptionsRateScenarios(userId, rateScenarios),
  ]);

  return { stressTest, rateScenarios: rateResults };
}

// ─── 4. Combined (cross-engine) scenario view ───────────────────────────

export interface EngineScenarioImpact {
  engine: "investing" | "trading" | "options";
  scenarioKey: string;
  scenarioLabel: string;
  available: boolean;
  impactDollars: number | null;
}

export interface CombinedScenarioView {
  byEngine: EngineScenarioImpact[];
  sectorImpact: { scenarioKey: string; sector: string; impactDollars: number }[];
  strategyImpact: { engine: "trading" | "options"; scenarioKey: string; key: string; label: string; impactDollars: number }[];
  assetImpact: { engine: "investing" | "trading" | "options"; scenarioKey: string; symbol: string; impactDollars: number }[];
}

export function buildCombinedScenarioView(investing: InvestingScenarioView, trading: TradingScenarioView, options: OptionsScenarioView): CombinedScenarioView {
  const byEngine: EngineScenarioImpact[] = [];
  const sectorImpact: CombinedScenarioView["sectorImpact"] = [];
  const strategyImpact: CombinedScenarioView["strategyImpact"] = [];
  const assetImpact: CombinedScenarioView["assetImpact"] = [];

  for (const r of investing.results) {
    byEngine.push({ engine: "investing", scenarioKey: r.scenario.key, scenarioLabel: r.scenario.label, available: r.available, impactDollars: r.totalImpactDollars });
    for (const s of r.sectorImpact) sectorImpact.push({ scenarioKey: r.scenario.key, sector: s.label, impactDollars: s.impactDollars });
    for (const a of r.assetImpact) assetImpact.push({ engine: "investing", scenarioKey: r.scenario.key, symbol: a.key, impactDollars: a.impactDollars });
  }

  for (const r of trading.results) {
    byEngine.push({ engine: "trading", scenarioKey: r.scenario.key, scenarioLabel: r.scenario.label, available: r.available, impactDollars: r.totalImpactDollars });
    for (const s of r.strategyImpact) strategyImpact.push({ engine: "trading", scenarioKey: r.scenario.key, key: s.key, label: s.label, impactDollars: s.impactDollars });
    for (const a of r.assetImpact) assetImpact.push({ engine: "trading", scenarioKey: r.scenario.key, symbol: a.key, impactDollars: a.impactDollars });
  }

  for (const s of options.stressTest.scenarios) {
    byEngine.push({ engine: "options", scenarioKey: s.label, scenarioLabel: s.label, available: true, impactDollars: s.unrealizedPnlImpact });
    for (const e of s.after.exposureByStrategy) strategyImpact.push({ engine: "options", scenarioKey: s.label, key: e.strategy, label: e.strategy, impactDollars: e.markValue });
    for (const e of s.after.exposureBySymbol) assetImpact.push({ engine: "options", scenarioKey: s.label, symbol: e.symbol, impactDollars: e.markValue });
  }
  for (const r of options.rateScenarios) {
    byEngine.push({ engine: "options", scenarioKey: r.scenario.key, scenarioLabel: r.scenario.label, available: r.available, impactDollars: r.totalImpactDollars });
  }

  return { byEngine, sectorImpact, strategyImpact, assetImpact };
}

// ─── Full dashboard orchestration ───────────────────────────────────────

export interface ScenarioDashboard {
  scenarios: ScenarioDefinition[];
  investing: InvestingScenarioView;
  trading: TradingScenarioView;
  options: OptionsScenarioView;
  combined: CombinedScenarioView;
  generatedAt: string;
}

export interface BuildScenarioDashboardInput {
  customScenarios?: CustomScenarioInput[];
}

export async function buildScenarioDashboard(userId: string, input: BuildScenarioDashboardInput = {}): Promise<ScenarioDashboard> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user, first documented in lib/riskExposureEngine.ts (Phase 37). This
  // dashboard fans out multiple concurrent settings-touching reads for the
  // same user in one request too, so the same guard applies: resolve the
  // settings row once, up front.
  await getSettingsRow(userId);

  const custom = (input.customScenarios ?? []).map((c, i) => buildCustomScenario(c, i));
  const scenarios = [...DEFAULT_SCENARIOS, ...custom];

  const [investing, trading, options] = await Promise.all([
    buildInvestingScenarioView(userId, scenarios),
    buildTradingScenarioView(userId, scenarios),
    buildOptionsScenarioView(userId, scenarios),
  ]);

  const combined = buildCombinedScenarioView(investing, trading, options);

  return { scenarios, investing, trading, options, combined, generatedAt: new Date().toISOString() };
}

// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// PURE COMPOSITION LAYER. MONITORING AND ORGANISATION ONLY. Zero trade
// recommendations, zero buy/sell signals, zero AI predictions, zero
// forecasting, zero machine learning, zero portfolio optimisation, zero
// auto rebalancing, zero auto execution, zero auto watchlist generation.
// "Opportunity Overview" below is a deterministic, descriptive snapshot of
// each watched symbol's own already-computed state across the existing
// engines — never a ranked or scored "buy this" signal.
//
// Every current value here is reused verbatim from an already-shipped,
// already-tested engine:
//   - lib/riskExposureEngine.ts's buildRiskExposureDashboard() (Phase 37)
//     — per-symbol Investing allocation, per-symbol Options allocation,
//     capital allocation, Greeks (portfolio-wide), the Compliance Timeline.
//   - lib/performanceAttribution.ts's buildPerformanceDashboard() (Phase 38)
//     — per-holding/per-position/per-trade Performance.
//   - lib/scenarioEngine.ts's buildScenarioDashboard() (Phase 39) — per-
//     holding/per-position Scenario impact under the platform's own
//     default shock scenarios (Investing/Trading only — see the honest
//     scope note on scenarioWorstCaseImpactDollars below).
//   - lib/decisionSupportEngine.ts's buildDiversificationSummary()
//     (Phase 40) — Investing/Options diversification scores.
//   - lib/complianceEngine.ts's evaluatePolicy() (Phase 42) — per-policy
//     compliance status, filtered here by target symbol.
//   - lib/coach.ts's positionGreeks() (existing Options Greeks primitive)
//     — summed over a watched symbol's own open Options legs.
//
// Because every one of these dashboards is a whole-PORTFOLIO read (never a
// per-symbol external provider fetch), computing analytics for every
// watched symbol costs zero additional provider calls beyond the one-time
// dashboard fetch — the same reason lib/complianceEngine.ts's own
// per-policy evaluation is cheap regardless of how many policies exist.
// This lets the entire Watchlists Dashboard (including "Opportunity
// Overview") be built EAGERLY, in one call, matching this phase's own
// "reuse existing deterministic infrastructure wherever possible"
// instruction — there is no N+1-provider-call reason to split it into a
// separate on-demand route the way Statements/Peers/Filings (Phase 2)
// were, since none of those engines are queried per-symbol here.

import { db, tradesTable, type InvestingWatchlistRow } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSettingsRow } from "./serverState.js";
import { buildRiskExposureDashboard, type RiskExposureDashboard } from "./riskExposureEngine.js";
import { buildPerformanceDashboard, type PerformanceDashboard } from "./performanceAttribution.js";
import { buildScenarioDashboard, type ScenarioDashboard } from "./scenarioEngine.js";
import { buildDiversificationSummary, type DiversificationSummary } from "./decisionSupportEngine.js";
import { buildPortfolioConcentrationOverlay } from "./portfolioConcentration.js";
import { buildOptionsIncomeDashboard } from "./optionsIncomeAnalytics.js";
import { loadOptionsIncomeSummaryInputs } from "../routes/optionsIncome.js";
import { listPolicies } from "./compliancePolicies.js";
import { evaluatePolicy, type PolicyEvaluation } from "./complianceEngine.js";
import { positionGreeks } from "./coach.js";
import type { QuoteLeg } from "./optionsMath.js";
import { listAllItems, listWatchlists, countItemsByWatchlist } from "./watchlists.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// ─── Per-symbol analytics ────────────────────────────────────────────────

export interface SymbolAnalytics {
  symbol: string;
  heldInInvesting: boolean;
  heldInTrading: boolean;
  heldInOptions: boolean;
  investing: { marketValue: number | null; weightPct: number | null; unrealizedPnl: number | null; unrealizedPnlPct: number | null; sector: string | null } | null;
  trading: { openPositionsCount: number; closedPositionsCount: number; totalRealizedPnl: number | null } | null;
  options: { weightPct: number | null; openPositionsCount: number; totalCurrentPnl: number | null; netDelta: number | null; netTheta: number | null } | null;
  compliance: { status: PolicyEvaluation["status"]; policyLabel: string; detail: string } | null;
  // Worst-case impact under the platform's own default shock scenarios
  // (lib/scenarioEngine.ts's DEFAULT_SCENARIOS). Deliberately scoped to
  // Investing and Trading holdings only, which carry a clean per-position
  // impactDollars figure — Options' own scenario view models interest-rate
  // shocks and a portfolio-level stress test, not a per-symbol price-shock
  // impact in the same shape, so an Options-only position honestly reports
  // this as null rather than fabricating a comparable figure.
  scenarioWorstCaseImpactDollars: number | null;
  scenarioWorstCaseLabel: string | null;
}

interface EngineData {
  risk: RiskExposureDashboard;
  performance: PerformanceDashboard;
  scenario: ScenarioDashboard;
  diversification: DiversificationSummary;
  evaluations: PolicyEvaluation[];
  optionGreeksBySymbol: Map<string, { delta: number; theta: number }>;
}

async function loadOpenOptionGreeksBySymbol(userId: string): Promise<Map<string, { delta: number; theta: number }>> {
  const rows = await db
    .select({ symbol: tradesTable.symbol, legs: tradesTable.legs })
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
  const map = new Map<string, { delta: number; theta: number }>();
  for (const r of rows) {
    const g = positionGreeks(r.symbol, r.legs as QuoteLeg[]);
    const sym = r.symbol.toUpperCase();
    const prior = map.get(sym) ?? { delta: 0, theta: 0 };
    map.set(sym, { delta: prior.delta + g.delta, theta: prior.theta + g.theta });
  }
  return map;
}

async function loadEngineData(userId: string): Promise<EngineData> {
  // getSettingsRow() (lib/serverState.ts) is a plain check-then-insert with
  // no upsert safety — a known, pre-existing dormant race for a brand-new
  // user, first documented in lib/riskExposureEngine.ts (Phase 37) and
  // reused since in every dashboard that fans out multiple concurrent
  // settings-touching reads (lib/complianceEngine.ts, Phase 42). This
  // dashboard fans out FOUR top-level engine dashboards concurrently, each
  // of which does its own internal pre-warm — resolving it once here, up
  // front, guarantees every nested pre-warm below finds the row already
  // created.
  await getSettingsRow(userId);

  const [risk, performance, scenario, policies, optionsConcentration, optionsIncomeInputs, optionGreeksBySymbol] = await Promise.all([
    buildRiskExposureDashboard(userId),
    buildPerformanceDashboard(userId),
    buildScenarioDashboard(userId),
    listPolicies(userId),
    buildPortfolioConcentrationOverlay(userId),
    loadOptionsIncomeSummaryInputs(userId),
    loadOpenOptionGreeksBySymbol(userId),
  ]);

  const diversification: DiversificationSummary = buildDiversificationSummary(risk, optionsConcentration);
  const optionsIncome = buildOptionsIncomeDashboard(optionsIncomeInputs);
  const evaluations = policies.map((p) => evaluatePolicy(p, { risk, diversification, optionsThetaMonthly: optionsIncome.overview.theta.monthly }));

  return { risk, performance, scenario, diversification, evaluations, optionGreeksBySymbol };
}

function buildSymbolAnalytics(symbol: string, data: EngineData): SymbolAnalytics {
  const sym = symbol.toUpperCase();
  const { risk, performance, scenario, evaluations, optionGreeksBySymbol } = data;

  const investingAlloc = risk.investing.allocationBySymbol.find((h) => h.symbol.toUpperCase() === sym) ?? null;
  const investingPerf = performance.investing.holdings.find((h) => h.symbol.toUpperCase() === sym) ?? null;
  const heldInInvesting = investingAlloc != null || investingPerf != null;
  const investing = heldInInvesting
    ? {
        marketValue: investingAlloc?.marketValue ?? investingPerf?.marketValue ?? null,
        weightPct: investingAlloc?.weightPct ?? null,
        unrealizedPnl: investingPerf?.unrealizedPnl ?? null,
        unrealizedPnlPct: investingPerf?.unrealizedPnlPct ?? null,
        sector: investingPerf?.sector ?? null,
      }
    : null;

  const tradingPositions = performance.trading.positions.filter((p) => p.symbol.toUpperCase() === sym);
  const heldInTrading = tradingPositions.length > 0;
  const trading = heldInTrading
    ? {
        openPositionsCount: tradingPositions.filter((p) => p.status === "open").length,
        closedPositionsCount: tradingPositions.filter((p) => p.status === "closed").length,
        totalRealizedPnl: tradingPositions.some((p) => p.realizedPnl != null) ? round(tradingPositions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0)) : null,
      }
    : null;

  const optionsAlloc = risk.options.dashboard.allocationBySymbol.find((b) => b.key.toUpperCase() === sym) ?? null;
  const optionsTrades = performance.options.trades.filter((t) => t.symbol.toUpperCase() === sym);
  const greeks = optionGreeksBySymbol.get(sym) ?? null;
  const heldInOptions = optionsAlloc != null || optionsTrades.length > 0;
  const options = heldInOptions
    ? {
        weightPct: optionsAlloc?.weightPct ?? null,
        openPositionsCount: optionsTrades.filter((t) => t.status !== "closed").length,
        totalCurrentPnl: optionsTrades.some((t) => t.currentPnl != null) ? round(optionsTrades.reduce((s, t) => s + (t.currentPnl ?? 0), 0)) : null,
        netDelta: greeks ? round(greeks.delta) : null,
        netTheta: greeks ? round(greeks.theta) : null,
      }
    : null;

  const positionPolicy = evaluations.find((e) => e.policyType === "position_allocation_max" && e.targetKey?.toUpperCase() === sym);
  const compliance = positionPolicy ? { status: positionPolicy.status, policyLabel: positionPolicy.label, detail: positionPolicy.detail } : null;

  let worst: { impactDollars: number; label: string } | null = null;
  const consider = (impactDollars: number | null, scenarioLabel: string) => {
    if (impactDollars == null) return;
    const rounded = round(impactDollars);
    if (worst == null || rounded < worst.impactDollars) worst = { impactDollars: rounded, label: scenarioLabel };
  };
  for (const r of scenario.investing.results) {
    const h = r.holdings.find((x) => x.symbol.toUpperCase() === sym);
    if (h) consider(h.impactDollars, r.scenario.label);
  }
  for (const r of scenario.trading.results) {
    for (const p of r.positions.filter((x) => x.symbol.toUpperCase() === sym)) consider(p.impactDollars, r.scenario.label);
  }

  return {
    symbol: sym,
    heldInInvesting,
    heldInTrading,
    heldInOptions,
    investing,
    trading,
    options,
    compliance,
    scenarioWorstCaseImpactDollars: worst ? (worst as { impactDollars: number; label: string }).impactDollars : null,
    scenarioWorstCaseLabel: worst ? (worst as { impactDollars: number; label: string }).label : null,
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export interface WatchlistSummary {
  id: number;
  name: string;
  kind: string;
  description: string;
  archived: boolean;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItemView {
  id: number;
  watchlistId: number;
  symbol: string;
  category: string;
  tags: string[];
  notes: string;
  sortOrder: number;
  addedAt: string;
  analytics: SymbolAnalytics;
}

export interface WatchlistHealthEntry {
  watchlistId: number;
  name: string;
  kind: string;
  itemCount: number;
  heldCount: number;
  notHeldCount: number;
  breachCount: number;
  totalMarketValue: number | null;
  totalUnrealizedPnl: number | null;
}

export interface WatchlistsCrossEngineSummary {
  capitalAllocation: RiskExposureDashboard["combined"]["capitalAllocation"];
  investingDiversification: DiversificationSummary["investing"];
  optionsDiversification: DiversificationSummary["options"];
  complianceSummary: { totalPolicies: number; enabledPolicies: number; compliantCount: number; breachCount: number; unavailableCount: number };
  executiveHealth: { healthScore: number; overallRiskRating: { code: string; label: string } };
}

export interface WatchlistsDashboardSummary {
  watchlistCount: number;
  itemCount: number;
  distinctSymbolCount: number;
  heldSymbolCount: number;
  highestRisk: { symbol: string; detail: string } | null;
  highestExposure: { symbol: string; weightPct: number; engine: "investing" | "options" } | null;
  highestAllocation: { symbol: string; marketValue: number; engine: "investing" } | null;
  policyBreaches: PolicyEvaluation[];
  scenarioImpact: { worstCaseTotalImpactDollars: number | null; detail: string };
  performanceSummary: { totalUnrealizedPnl: number | null; totalRealizedPnl: number | null; detail: string };
  outstandingIssues: string[];
}

export interface WatchlistsDashboard {
  watchlists: WatchlistSummary[];
  items: WatchlistItemView[];
  opportunityOverview: SymbolAnalytics[];
  watchlistHealth: WatchlistHealthEntry[];
  crossEngineSummary: WatchlistsCrossEngineSummary;
  dashboardSummary: WatchlistsDashboardSummary;
  generatedAt: string;
}

export async function buildWatchlistsDashboard(userId: string): Promise<WatchlistsDashboard> {
  const [watchlistRows, itemRows, data] = await Promise.all([listWatchlists(userId), listAllItems(userId), loadEngineData(userId)]);

  const counts = await countItemsByWatchlist(userId, watchlistRows.map((w) => w.id));

  const watchlists: WatchlistSummary[] = watchlistRows.map((w: InvestingWatchlistRow) => ({
    id: w.id,
    name: w.name,
    kind: w.kind,
    description: w.description,
    archived: w.archived,
    sortOrder: w.sortOrder,
    itemCount: counts.get(w.id) ?? 0,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }));

  // Per-symbol analytics is pure and depends only on the already-loaded
  // EngineData — computed once per distinct symbol, then attached to
  // every item row that references that symbol, never recomputed per item.
  const analyticsBySymbol = new Map<string, SymbolAnalytics>();
  const distinctSymbols = [...new Set(itemRows.map((i) => i.symbol.toUpperCase()))];
  for (const sym of distinctSymbols) analyticsBySymbol.set(sym, buildSymbolAnalytics(sym, data));

  const items: WatchlistItemView[] = itemRows
    .map((i) => ({
      id: i.id,
      watchlistId: i.watchlistId,
      symbol: i.symbol,
      category: i.category,
      tags: i.tags,
      notes: i.notes,
      sortOrder: i.sortOrder,
      addedAt: i.addedAt.toISOString(),
      analytics: analyticsBySymbol.get(i.symbol.toUpperCase())!,
    }))
    .sort((a, b) => a.watchlistId - b.watchlistId || a.sortOrder - b.sortOrder);

  const opportunityOverview = distinctSymbols.map((s) => analyticsBySymbol.get(s)!);

  const watchlistHealth: WatchlistHealthEntry[] = watchlistRows.map((w) => {
    const own = items.filter((i) => i.watchlistId === w.id);
    const held = own.filter((i) => i.analytics.heldInInvesting || i.analytics.heldInTrading || i.analytics.heldInOptions);
    const breaches = own.filter((i) => i.analytics.compliance?.status === "breach");
    const withMarketValue = own.filter((i) => i.analytics.investing?.marketValue != null);
    const withPnl = own.filter((i) => i.analytics.investing?.unrealizedPnl != null);
    return {
      watchlistId: w.id,
      name: w.name,
      kind: w.kind,
      itemCount: own.length,
      heldCount: held.length,
      notHeldCount: own.length - held.length,
      breachCount: breaches.length,
      totalMarketValue: withMarketValue.length > 0 ? round(withMarketValue.reduce((s, i) => s + (i.analytics.investing?.marketValue ?? 0), 0)) : null,
      totalUnrealizedPnl: withPnl.length > 0 ? round(withPnl.reduce((s, i) => s + (i.analytics.investing?.unrealizedPnl ?? 0), 0)) : null,
    };
  });

  const enabledEvals = data.evaluations.filter((e) => e.enabled);
  const crossEngineSummary: WatchlistsCrossEngineSummary = {
    capitalAllocation: data.risk.combined.capitalAllocation,
    investingDiversification: data.diversification.investing,
    optionsDiversification: data.diversification.options,
    complianceSummary: {
      totalPolicies: data.evaluations.length,
      enabledPolicies: enabledEvals.length,
      compliantCount: enabledEvals.filter((e) => e.status === "compliant").length,
      breachCount: enabledEvals.filter((e) => e.status === "breach").length,
      unavailableCount: enabledEvals.filter((e) => e.status === "unavailable").length,
    },
    executiveHealth: { healthScore: data.risk.options.dashboard.healthScore, overallRiskRating: data.risk.options.dashboard.overallRiskRating },
  };

  const dashboardSummary = buildDashboardSummary(watchlists, items.length, opportunityOverview, data);

  return { watchlists, items, opportunityOverview, watchlistHealth, crossEngineSummary, dashboardSummary, generatedAt: new Date().toISOString() };
}

function buildDashboardSummary(watchlists: WatchlistSummary[], itemCount: number, opportunityOverview: SymbolAnalytics[], data: EngineData): WatchlistsDashboardSummary {
  const held = opportunityOverview.filter((s) => s.heldInInvesting || s.heldInTrading || s.heldInOptions);

  const withScenario = held.filter((s) => s.scenarioWorstCaseImpactDollars != null);
  const highestRisk = withScenario.length > 0 ? withScenario.reduce((worst, s) => (s.scenarioWorstCaseImpactDollars! < worst.scenarioWorstCaseImpactDollars! ? s : worst)) : null;

  type ExposureCandidate = { symbol: string; weightPct: number; engine: "investing" | "options" };
  const exposureCandidates: ExposureCandidate[] = [];
  for (const s of held) {
    if (s.investing?.weightPct != null) exposureCandidates.push({ symbol: s.symbol, weightPct: s.investing.weightPct, engine: "investing" });
    if (s.options?.weightPct != null) exposureCandidates.push({ symbol: s.symbol, weightPct: s.options.weightPct, engine: "options" });
  }
  const highestExposure = exposureCandidates.length > 0 ? exposureCandidates.reduce((best, c) => (c.weightPct > best.weightPct ? c : best)) : null;

  const withMarketValue = held.filter((s) => s.investing?.marketValue != null);
  const highestAllocation =
    withMarketValue.length > 0
      ? (() => {
          const top = withMarketValue.reduce((best, s) => (s.investing!.marketValue! > best.investing!.marketValue! ? s : best));
          return { symbol: top.symbol, marketValue: top.investing!.marketValue!, engine: "investing" as const };
        })()
      : null;

  const policyBreaches = data.evaluations.filter((e) => e.enabled && e.status === "breach");

  const scenarioValues = held.map((s) => s.scenarioWorstCaseImpactDollars).filter((v): v is number => v != null);
  const worstCaseTotalImpactDollars = scenarioValues.length > 0 ? round(scenarioValues.reduce((s, v) => s + v, 0)) : null;
  const scenarioImpact = {
    worstCaseTotalImpactDollars,
    detail:
      worstCaseTotalImpactDollars == null
        ? "No watched symbols are currently held anywhere — scenario impact is unavailable."
        : `Under the platform's own default shock scenarios, the worst-case combined impact across held, watched symbols is $${worstCaseTotalImpactDollars.toLocaleString()}.`,
  };

  const unrealizedValues = held.map((s) => s.investing?.unrealizedPnl).filter((v): v is number => v != null);
  const realizedValues = held.map((s) => s.trading?.totalRealizedPnl).filter((v): v is number => v != null);
  const totalUnrealizedPnl = unrealizedValues.length > 0 ? round(unrealizedValues.reduce((s, v) => s + v, 0)) : null;
  const totalRealizedPnl = realizedValues.length > 0 ? round(realizedValues.reduce((s, v) => s + v, 0)) : null;
  const performanceSummary = {
    totalUnrealizedPnl,
    totalRealizedPnl,
    detail:
      totalUnrealizedPnl == null && totalRealizedPnl == null
        ? "No watched symbols are currently held anywhere — performance is unavailable."
        : `Watched, held symbols show ${totalUnrealizedPnl != null ? `$${totalUnrealizedPnl.toLocaleString()} unrealized` : "no resolvable unrealized P&L"} and ${totalRealizedPnl != null ? `$${totalRealizedPnl.toLocaleString()} realized` : "no resolvable realized P&L"}.`,
  };

  const outstandingIssues: string[] = [];
  const notHeldCount = opportunityOverview.length - held.length;
  if (notHeldCount > 0) outstandingIssues.push(`${notHeldCount} watched symbol(s) are not currently held in any engine.`);
  if (policyBreaches.length > 0) outstandingIssues.push(`${policyBreaches.length} enabled compliance policy(ies) are currently in breach.`);
  const unavailableCompliance = held.filter((s) => s.compliance == null).length;
  if (unavailableCompliance > 0) outstandingIssues.push(`${unavailableCompliance} held, watched symbol(s) have no position-allocation policy configured for compliance monitoring.`);
  if (watchlists.length === 0) outstandingIssues.push("No watchlists have been created yet.");
  if (outstandingIssues.length === 0) outstandingIssues.push("No outstanding issues detected.");

  return {
    watchlistCount: watchlists.length,
    itemCount,
    distinctSymbolCount: opportunityOverview.length,
    heldSymbolCount: held.length,
    highestRisk: highestRisk ? { symbol: highestRisk.symbol, detail: `Worst-case scenario impact of $${highestRisk.scenarioWorstCaseImpactDollars!.toLocaleString()} under "${highestRisk.scenarioWorstCaseLabel}".` } : null,
    highestExposure,
    highestAllocation,
    policyBreaches,
    scenarioImpact,
    performanceSummary,
    outstandingIssues,
  };
}

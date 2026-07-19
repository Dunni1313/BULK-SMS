// Phase 16 — Institutional Monitoring & Alerts Engine.
//
// PURE ORCHESTRATION LAYER. This module introduces no new valuation model,
// quality score, financial ratio, or portfolio-risk formula. Every signal it
// diffs is read directly off already-shipped, already-tested engine output:
//
//   - Symbol-level signals (recommendation, valuation, business quality,
//     investment committee verdict, Tom Nash verdict, dividend yield,
//     financial strength) all come from buildOpportunityRow() (Phase 15,
//     lib/opportunityDiscovery.ts) — itself a pure re-expression of
//     buildValueResearchReport()'s own fields, never recomputed here.
//   - Earnings alerts reuse the report's own already-computed "Earnings in
//     ~N days" risk flag (lib/valueReport.ts) verbatim — zero new fetch,
//     zero new logic.
//   - Portfolio-level signals (quality drift, diversification, sector
//     concentration, single-symbol concentration) all come from
//     buildPortfolioIntelligence() (Phase 13, lib/portfolioIntelligence.ts)
//     and lib/investingRisk.ts's own concentration caps — reused verbatim.
//   - Opportunity-match signals reuse applyScreenerFilters()/
//     rankOpportunities()/scanOpportunities() (Phase 15) unmodified.
//
// The ONE genuinely new mechanism this file adds is change-detection itself:
// comparing an already-computed "current state" against the last-observed
// state stored in investing_monitoring_states (a generic cache, not a new
// scoring model — see that table's own schema comment) and framing the
// result as an AlertCandidate. This is the same "diff a state I've already
// computed against what I saw last time" pattern buildPortfolioIntelligence()
// already established for its own qualityDrift scorecard (Phase 13) — this
// file just applies that identical pattern to more dimensions and to
// per-symbol signals.
//
// DETERMINISTIC ONLY: zero LLM calls, zero price forecasting, zero
// probability guessing anywhere in this file.

import { db, investingMonitoringStatesTable, valueWatchlistTable, investingPortfoliosTable, investingHoldingsTable, investingSavedScreensTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { AlertCandidate, AlertSeverity } from "./notifications.js";
import { resolveFundamentals, type FundamentalsProvider } from "./fundamentals.js";
import { buildValueResearchReport } from "./valueReport.js";
import { buildOpportunityRow, type OpportunityRow, scanOpportunities, applyScreenerFilters, rankOpportunities, type OpportunityScreenerFilters } from "./opportunityDiscovery.js";
import { buildPortfolioIntelligence, type PreviousPortfolioSnapshot } from "./portfolioIntelligence.js";
import type { PortfolioHoldingInput } from "./portfolioConstruction.js";

// ─── Generic monitoring-state read/write ───────────────────────────────────

async function readState<T>(userId: string, entityType: string, entityKey: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(investingMonitoringStatesTable)
    .where(
      and(
        eq(investingMonitoringStatesTable.userId, userId),
        eq(investingMonitoringStatesTable.entityType, entityType),
        eq(investingMonitoringStatesTable.entityKey, entityKey),
      ),
    );
  return row ? (row.stateJson as T) : null;
}

async function writeState(userId: string, entityType: string, entityKey: string, state: unknown): Promise<void> {
  await db
    .insert(investingMonitoringStatesTable)
    .values({ userId, entityType, entityKey, stateJson: state as object })
    .onConflictDoUpdate({
      target: [investingMonitoringStatesTable.userId, investingMonitoringStatesTable.entityType, investingMonitoringStatesTable.entityKey],
      set: { stateJson: state as object, updatedAt: new Date() },
    });
}

// ─── Symbol-level monitoring ────────────────────────────────────────────────

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function decisionSeverity(rec: string): AlertSeverity {
  if (rec === "Sell" || rec === "Avoid") return "critical";
  if (rec === "Reduce") return "warning";
  return "info";
}

// Deterministic, disclosed rule-based diffs over an already-computed
// OpportunityRow pair — never a new judgment, quotes real values. Exported
// (in addition to being used internally) so it can be unit-tested directly
// against fully-controlled fixtures, the same "export a pure computation for
// direct testability" precedent as classifyMarginOfSafety()/
// computeWatchlistTargets().
export function diffSymbolState(previous: OpportunityRow, current: OpportunityRow): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const symbol = current.symbol;
  const dataSource = current.dataSource === "LIVE" ? "LIVE" : "SIMULATED";

  if (previous.decisionRecommendation !== current.decisionRecommendation) {
    candidates.push({
      type: "decision_change",
      title: `${symbol}: Decision Engine recommendation changed`,
      message: `${symbol}'s recommendation moved from ${previous.decisionRecommendation} to ${current.decisionRecommendation}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:decision:${previous.decisionRecommendation}->${current.decisionRecommendation}`,
      severity: decisionSeverity(current.decisionRecommendation),
      previousValue: previous.decisionRecommendation,
      currentValue: current.decisionRecommendation,
      evidence: [`Synthesis score: ${previous.rankScore} -> ${current.rankScore}`, current.rankExplanation],
      recommendedAction: `Review ${symbol} on the Institutional Decision Engine page.`,
    });
  }

  if (previous.valuationRating !== current.valuationRating) {
    candidates.push({
      type: "valuation_change",
      title: `${symbol}: valuation rating changed`,
      message: `${symbol}'s valuation moved from ${previous.valuationRating} to ${current.valuationRating}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:valuation:${previous.valuationRating}->${current.valuationRating}`,
      severity: current.valuationRating === "Very Expensive" ? "warning" : "info",
      previousValue: previous.valuationRating,
      currentValue: current.valuationRating,
      evidence: [
        `Consolidated margin of safety: ${previous.marginOfSafety != null ? fmtPct(previous.marginOfSafety) : "n/a"} -> ${current.marginOfSafety != null ? fmtPct(current.marginOfSafety) : "n/a"}`,
      ],
      recommendedAction: `Review ${symbol}'s valuation models on the Value Research page.`,
    });
  }

  if (previous.businessQualityRating !== current.businessQualityRating) {
    candidates.push({
      type: "quality_change",
      title: `${symbol}: Business Quality rating changed`,
      message: `${symbol}'s Business Quality moved from ${previous.businessQualityRating} to ${current.businessQualityRating}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:quality:${previous.businessQualityRating}->${current.businessQualityRating}`,
      severity: current.businessQualityRating === "Weak" ? "warning" : "info",
      previousValue: previous.businessQualityRating,
      currentValue: current.businessQualityRating,
      evidence: [`Business Quality score: ${previous.businessQualityScore} -> ${current.businessQualityScore}`],
      recommendedAction: `Review ${symbol}'s Business Quality breakdown on the Value Research page.`,
    });
  }

  if (previous.investmentCommitteeVerdict !== current.investmentCommitteeVerdict) {
    candidates.push({
      type: "committee_change",
      title: `${symbol}: Investment Committee verdict changed`,
      message: `${symbol}'s Investment Committee verdict moved from ${previous.investmentCommitteeVerdict} to ${current.investmentCommitteeVerdict}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:committee:${previous.investmentCommitteeVerdict}->${current.investmentCommitteeVerdict}`,
      severity: current.investmentCommitteeVerdict === "Wait" ? "warning" : "info",
      previousValue: previous.investmentCommitteeVerdict,
      currentValue: current.investmentCommitteeVerdict,
      evidence: [`Committee confidence: ${previous.investmentCommitteeConfidence} -> ${current.investmentCommitteeConfidence}`],
      recommendedAction: `Review ${symbol}'s Investment Committee votes on the Value Research page.`,
    });
  }

  if (previous.tomNashVerdict !== current.tomNashVerdict) {
    candidates.push({
      type: "tomnash_change",
      title: `${symbol}: Tom Nash verdict changed`,
      message: `${symbol}'s Tom Nash verdict moved from ${previous.tomNashVerdict} to ${current.tomNashVerdict}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:tomnash:${previous.tomNashVerdict}->${current.tomNashVerdict}`,
      severity: current.tomNashVerdict === "Wait" ? "warning" : "info",
      previousValue: previous.tomNashVerdict,
      currentValue: current.tomNashVerdict,
      evidence: [`Tom Nash conviction score: ${previous.tomNashConvictionScore} -> ${current.tomNashConvictionScore}`],
      recommendedAction: `Review ${symbol}'s Tom Nash pillar scores on the Value Research page.`,
    });
  }

  const FINANCIAL_STRENGTH_ORDER = ["Risky", "Weak", "Acceptable", "Strong"];
  const prevRank = FINANCIAL_STRENGTH_ORDER.indexOf(previous.financialStrengthRating);
  const currRank = FINANCIAL_STRENGTH_ORDER.indexOf(current.financialStrengthRating);
  if (prevRank !== -1 && currRank !== -1 && currRank < prevRank) {
    candidates.push({
      type: "financial_deterioration",
      title: `${symbol}: Financial Strength deteriorated`,
      message: `${symbol}'s Financial Strength moved from ${previous.financialStrengthRating} to ${current.financialStrengthRating}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:financial:${previous.financialStrengthRating}->${current.financialStrengthRating}`,
      severity: current.financialStrengthRating === "Risky" ? "critical" : "warning",
      previousValue: previous.financialStrengthRating,
      currentValue: current.financialStrengthRating,
      evidence: [`Financial Strength score: ${previous.financialStrengthScore} -> ${current.financialStrengthScore}`],
      recommendedAction: `Review ${symbol}'s balance sheet on the Value Research page.`,
    });
  }

  // Dividend change: a cut (drop to zero, or a >=25% relative decrease) or a
  // meaningful increase (>=25% relative increase) — a named, disclosed
  // threshold, never a fabricated "any change" spam trigger.
  const prevDiv = previous.dividendYield;
  const currDiv = current.dividendYield;
  if (prevDiv > 0 && currDiv === 0) {
    candidates.push({
      type: "dividend_change",
      title: `${symbol}: dividend eliminated`,
      message: `${symbol}'s dividend yield dropped from ${fmtPct(prevDiv)} to 0%.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:dividend:cut`,
      severity: "critical",
      previousValue: fmtPct(prevDiv),
      currentValue: "0%",
      evidence: [`Dividend yield: ${fmtPct(prevDiv)} -> 0%`],
      recommendedAction: `Review ${symbol}'s income profile on the Value Research page.`,
    });
  } else if (prevDiv > 0 && currDiv > 0 && Math.abs(currDiv - prevDiv) / prevDiv >= 0.25) {
    const direction = currDiv < prevDiv ? "cut" : "increased";
    candidates.push({
      type: "dividend_change",
      title: `${symbol}: dividend yield ${direction}`,
      message: `${symbol}'s dividend yield moved from ${fmtPct(prevDiv)} to ${fmtPct(currDiv)}.`,
      dataSource,
      relatedSymbol: symbol,
      dedupKey: `monitoring:symbol:${symbol}:dividend:${direction}:${fmtPct(currDiv)}`,
      severity: direction === "cut" ? "warning" : "info",
      previousValue: fmtPct(prevDiv),
      currentValue: fmtPct(currDiv),
      evidence: [`Dividend yield: ${fmtPct(prevDiv)} -> ${fmtPct(currDiv)}`],
      recommendedAction: `Review ${symbol}'s income profile on the Value Research page.`,
    });
  }

  return candidates;
}

// Earnings Alerts — reuses the report's own already-computed "Earnings in ~N
// days" risk flag verbatim (lib/valueReport.ts). Zero new fetch, zero new
// logic. Fires once per distinct earnings-window text via the existing
// dedup-while-unread mechanism (never re-fires every tick while still true
// and unread, and re-fires honestly once the window text itself changes).
export function earningsAlertFor(symbol: string, dataSource: string, risks: { text: string }[]): AlertCandidate | null {
  const flag = risks.find((r) => r.text.startsWith("Earnings in ~"));
  if (!flag) return null;
  return {
    type: "earnings_alert",
    title: `${symbol}: upcoming earnings`,
    message: flag.text,
    dataSource: dataSource === "LIVE" ? "LIVE" : "SIMULATED",
    relatedSymbol: symbol,
    dedupKey: `monitoring:symbol:${symbol}:earnings:${flag.text}`,
    severity: "info",
    previousValue: null,
    currentValue: null,
    evidence: [flag.text],
    recommendedAction: `Review ${symbol}'s earnings history on the Value Research page's Earnings tab.`,
  };
}

// The bounded, per-user symbol universe automatically monitored: every
// Watchlist symbol plus every distinct symbol held across the user's own
// Portfolio Construction portfolios — never the full Opportunity Discovery
// universe (that stays on-demand, see evaluateOpportunityMonitoringAlerts()
// below), mirroring the exact bounded-scope discipline
// evaluateWatchlistAlerts()/evaluateRiskAlerts() already established
// (Phase 4, Sprint 56): monitor only what the user already tracks.
export async function resolveMonitoredSymbols(userId: string): Promise<string[]> {
  const watchlistRows = await db.select({ symbol: valueWatchlistTable.symbol }).from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  const holdingRows = await db.select({ symbol: investingHoldingsTable.symbol }).from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  return [...new Set([...watchlistRows.map((r) => r.symbol), ...holdingRows.map((r) => r.symbol)])];
}

export async function evaluateSymbolMonitoringAlerts(userId: string, provider: FundamentalsProvider): Promise<AlertCandidate[]> {
  const symbols = await resolveMonitoredSymbols(userId);
  if (symbols.length === 0) return [];

  const candidates: AlertCandidate[] = [];
  await Promise.all(
    symbols.map(async (symbol) => {
      const f = await resolveFundamentals(provider, symbol).catch(() => null);
      if (!f) return;
      const report = await buildValueResearchReport(symbol, f.asOf, provider, f).catch(() => null);
      if (!report) return;
      const current = buildOpportunityRow(f, report);

      const previous = await readState<OpportunityRow>(userId, "symbol", symbol);
      if (previous) candidates.push(...diffSymbolState(previous, current));

      const earnings = earningsAlertFor(symbol, current.dataSource, report.risks);
      if (earnings) candidates.push(earnings);

      await writeState(userId, "symbol", symbol, current);
    }),
  );
  return candidates;
}

// ─── Portfolio-level monitoring ─────────────────────────────────────────────

async function resolveHoldingInputs(portfolioId: number, userId: string): Promise<PortfolioHoldingInput[]> {
  const rows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, portfolioId), eq(investingHoldingsTable.userId, userId)));
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
    avgCostBasis: r.avgCostBasis,
  }));
}

export async function evaluatePortfolioMonitoringAlerts(userId: string, provider: FundamentalsProvider): Promise<AlertCandidate[]> {
  const portfolios = await db.select().from(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  if (portfolios.length === 0) return [];

  const candidates: AlertCandidate[] = [];
  const dataSource = provider.isLive ? "LIVE" : "SIMULATED";

  await Promise.all(
    portfolios.map(async (portfolio) => {
      const holdings = await resolveHoldingInputs(portfolio.id, userId);
      if (holdings.length === 0) return;

      const entityKey = String(portfolio.id);
      const previous = await readState<PreviousPortfolioSnapshot>(userId, "portfolio", entityKey);
      const intelligence = await buildPortfolioIntelligence(holdings, provider, previous).catch(() => null);
      if (!intelligence) return;

      // Quality drift — reuses buildPortfolioIntelligence()'s own already-
      // computed qualityDrift scorecard directly. Zero new formula.
      if (previous && intelligence.risk.qualityDrift.label === "Deteriorating") {
        candidates.push({
          type: "portfolio_drift",
          title: `${portfolio.name}: quality drift detected`,
          message: intelligence.risk.qualityDrift.detail,
          dataSource,
          relatedSymbol: null,
          dedupKey: `monitoring:portfolio:${portfolio.id}:quality-drift`,
          severity: "warning",
          previousValue: previous.qualityScore != null ? String(previous.qualityScore) : null,
          currentValue: intelligence.qualityScore.score != null ? String(intelligence.qualityScore.score) : null,
          evidence: [intelligence.risk.qualityDrift.detail],
          recommendedAction: `Review "${portfolio.name}" on the Institutional Portfolio Manager page.`,
        });
      }

      // Diversification drift — the one small, disclosed extension of the
      // exact same drift-labeling pattern buildPortfolioIntelligence()
      // already established for qualityDrift, applied here to the
      // diversification score (which that function doesn't already diff).
      if (previous?.diversificationScore != null && intelligence.diversificationScore.score != null) {
        const drift = intelligence.diversificationScore.score - previous.diversificationScore;
        if (drift <= -10) {
          candidates.push({
            type: "portfolio_drift",
            title: `${portfolio.name}: diversification deteriorated`,
            message: `Diversification score moved ${drift} points since the last check (${previous.diversificationScore} -> ${intelligence.diversificationScore.score}).`,
            dataSource,
            relatedSymbol: null,
            dedupKey: `monitoring:portfolio:${portfolio.id}:diversification-drift`,
            severity: "warning",
            previousValue: String(previous.diversificationScore),
            currentValue: String(intelligence.diversificationScore.score),
            evidence: [`Diversification score: ${previous.diversificationScore} -> ${intelligence.diversificationScore.score}`],
            recommendedAction: `Review "${portfolio.name}"'s sector/position allocation on the Institutional Portfolio Manager page.`,
          });
        }
      }

      // Sector concentration — reuses risk.sectorExposure.capBreached
      // directly (lib/investingRisk.ts, Phase 2 Sprint 29). Zero new formula.
      if (intelligence.risk.sectorExposure.capBreached) {
        candidates.push({
          type: "sector_concentration_breach",
          title: `${portfolio.name}: sector concentration cap breached`,
          message: intelligence.risk.sectorExposure.detail,
          dataSource,
          relatedSymbol: null,
          dedupKey: `monitoring:portfolio:${portfolio.id}:sector-concentration`,
          severity: "warning",
          previousValue: null,
          currentValue: intelligence.risk.sectorExposure.largestSectorWeightPct != null ? `${intelligence.risk.sectorExposure.largestSectorWeightPct}%` : null,
          evidence: [intelligence.risk.sectorExposure.detail],
          recommendedAction: `Review "${portfolio.name}"'s sector allocation on the Institutional Portfolio Manager page.`,
        });
      }

      // Position sizing (Engine 1) — reuses risk.concentration.capBreached
      // directly. This is Engine 1's own analog of the already-shipped
      // Engine 2 risk_cap_breached alert (Phase 3, Sprint 38/44) — a
      // parallel detection over Portfolio Construction holdings, not a
      // duplicate of the trading-positions check.
      if (intelligence.risk.concentration.capBreached) {
        candidates.push({
          type: "position_sizing_breach",
          title: `${portfolio.name}: single-position concentration cap breached`,
          message: intelligence.risk.concentration.detail,
          dataSource,
          relatedSymbol: intelligence.risk.concentration.largestSymbol,
          dedupKey: `monitoring:portfolio:${portfolio.id}:position-sizing`,
          severity: "warning",
          previousValue: null,
          currentValue: intelligence.risk.concentration.largestSymbolWeightPct != null ? `${intelligence.risk.concentration.largestSymbolWeightPct}%` : null,
          evidence: [intelligence.risk.concentration.detail],
          recommendedAction: `Review "${portfolio.name}"'s position sizes on the Institutional Portfolio Manager page.`,
        });
      }

      await writeState(userId, "portfolio", entityKey, {
        qualityScore: intelligence.qualityScore.score,
        riskScore: intelligence.risk.overall.score,
        diversificationScore: intelligence.diversificationScore.score,
      } satisfies PreviousPortfolioSnapshot);
    }),
  );

  return candidates;
}

// ─── Opportunity Alerts (on-demand only) ────────────────────────────────────
//
// Deliberately NOT part of the automatic background tick — a full scan is
// real, non-trivial work (up to ~70 report builds), and running that
// automatically every 5 minutes for every user with a saved screen would
// break Phase 15's own disclosed cost-control discipline ("a scan is always
// an explicit, user-triggered action, never eager"). This function is
// therefore only ever called from the explicit on-demand
// POST /monitoring-engine/check route, mirroring the same
// "never a side effect of a plain read" discipline every other on-demand
// action in this codebase already follows.
const OPPORTUNITY_MATCH_TOP_N = 10;

export async function evaluateOpportunityMonitoringAlerts(userId: string, provider: FundamentalsProvider): Promise<AlertCandidate[]> {
  const savedScreens = await db.select().from(investingSavedScreensTable).where(eq(investingSavedScreensTable.userId, userId));
  if (savedScreens.length === 0) return [];

  const candidates: AlertCandidate[] = [];
  const dataSource = provider.isLive ? "LIVE" : "SIMULATED";

  for (const screen of savedScreens) {
    const scan = await scanOpportunities(provider, {}).catch(() => null);
    if (!scan) continue;
    const filters = (screen.filtersJson ?? {}) as OpportunityScreenerFilters;
    const screened = applyScreenerFilters(scan.rows, filters);
    const ranked = rankOpportunities(screened.rows).slice(0, OPPORTUNITY_MATCH_TOP_N);
    const currentSymbols = ranked.map((r) => r.symbol);

    const entityKey = String(screen.id);
    const previousSymbols = await readState<string[]>(userId, "saved_screen", entityKey);
    // Never fabricate a "new match" on the very first evaluation of a saved
    // screen — with no prior baseline to compare against, today's top N is
    // simply the baseline being established, not a genuine change. Matches
    // the identical "skip diffing when previous is null" discipline
    // diffSymbolState()/evaluatePortfolioMonitoringAlerts() already apply.
    const newMatches = previousSymbols == null ? [] : currentSymbols.filter((s) => !previousSymbols.includes(s));

    for (const symbol of newMatches) {
      const row = ranked.find((r) => r.symbol === symbol);
      candidates.push({
        type: "opportunity_match",
        title: `${symbol}: new match for "${screen.name}"`,
        message: `${symbol} newly appears in your saved screen "${screen.name}"'s top ${OPPORTUNITY_MATCH_TOP_N} results.`,
        dataSource,
        relatedSymbol: symbol,
        dedupKey: `monitoring:saved-screen:${screen.id}:match:${symbol}`,
        severity: "info",
        previousValue: null,
        currentValue: row?.decisionRecommendation ?? null,
        evidence: row ? [row.rankExplanation] : [],
        recommendedAction: `Review ${symbol} on the Institutional Opportunity Discovery page.`,
      });
    }

    await writeState(userId, "saved_screen", entityKey, currentSymbols);
  }

  return candidates;
}

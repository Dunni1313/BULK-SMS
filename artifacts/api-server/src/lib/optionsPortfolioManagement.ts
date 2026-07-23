// Phase 36 — Institutional Position Lifecycle Manager.
//
// PURE COMPOSITION LAYER. Zero new portfolio math. Position concentration,
// strategy allocation, expiration ladder, sector allocation, capital
// utilisation, and buying power allocation are all reused directly from
// the existing Portfolio Risk Dashboard (lib/portfolioDashboard.ts,
// Phase — Portfolio Risk Dashboard, unmodified) — the same
// `buildPortfolioDashboard()` call `GET /portfolio/dashboard` itself
// makes. Income allocation reuses lib/optionsIncomeAnalytics.ts's own
// theta by-symbol/by-strategy breakdown and strategy mix (Phase 35,
// unmodified). The Expiration Tracker reuses `buildUpcomingExpirations()`
// (Phase 35) directly. This file adds no new scoring, no new risk
// formula, no new allocation math — only assembly.

import { buildPortfolioDashboard, type PortfolioDashboardResult } from "./portfolioDashboard.js";
import { buildOptionsIncomeDashboard, type OptionsIncomeDashboard } from "./optionsIncomeAnalytics.js";
import { loadOptionsIncomeSummaryInputs } from "../routes/optionsIncome.js";
import { buildPortfolioExposureTimeline, buildLifecycleSummary, type ExposureTimelinePoint, type LifecycleSummary } from "./optionsLifecycle.js";

export interface OptionsPortfolioManagementView {
  // Reused verbatim from the existing Portfolio Risk Dashboard — never
  // recomputed here.
  positionConcentration: PortfolioDashboardResult["allocationBySymbol"];
  strategyAllocation: PortfolioDashboardResult["allocationByStrategy"];
  sectorAllocation: PortfolioDashboardResult["allocationBySector"];
  expirationLadder: PortfolioDashboardResult["expirationDistribution"];
  capitalUtilisation: {
    portfolioValue: number;
    totalRiskDollars: number;
    totalRiskPct: number;
  };
  buyingPowerAllocation: {
    buyingPower: number;
  };
  // Reused verbatim from the Options Income Engine (Phase 35).
  incomeAllocation: {
    bySymbol: OptionsIncomeDashboard["overview"]["theta"]["bySymbol"];
    byStrategy: OptionsIncomeDashboard["overview"]["theta"]["byStrategy"];
    strategyMix: OptionsIncomeDashboard["strategyMix"];
  };
  expirationTracker: OptionsIncomeDashboard["upcomingExpirations"];
  exposureTimeline: ExposureTimelinePoint[];
  lifecycleSummary: LifecycleSummary;
  generatedAt: string;
}

export async function buildOptionsPortfolioManagementView(userId: string): Promise<OptionsPortfolioManagementView> {
  const [dashboard, incomeInputs, exposureTimeline, lifecycleSummary] = await Promise.all([
    buildPortfolioDashboard(userId),
    loadOptionsIncomeSummaryInputs(userId),
    buildPortfolioExposureTimeline(userId),
    buildLifecycleSummary(userId),
  ]);
  const incomeDashboard = buildOptionsIncomeDashboard(incomeInputs);

  return {
    positionConcentration: dashboard.allocationBySymbol,
    strategyAllocation: dashboard.allocationByStrategy,
    sectorAllocation: dashboard.allocationBySector,
    expirationLadder: dashboard.expirationDistribution,
    capitalUtilisation: {
      portfolioValue: dashboard.portfolioValue,
      totalRiskDollars: dashboard.totalRiskDollars,
      totalRiskPct: dashboard.totalRiskPct,
    },
    buyingPowerAllocation: {
      buyingPower: dashboard.buyingPower,
    },
    incomeAllocation: {
      bySymbol: incomeDashboard.overview.theta.bySymbol,
      byStrategy: incomeDashboard.overview.theta.byStrategy,
      strategyMix: incomeDashboard.strategyMix,
    },
    expirationTracker: incomeDashboard.upcomingExpirations,
    exposureTimeline,
    lifecycleSummary,
    generatedAt: new Date().toISOString(),
  };
}

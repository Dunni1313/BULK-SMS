// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Timeline Engine.
//
// Persists one snapshot row per (user, calendar day) to the new
// intelligence_snapshots table — never more than once per day, no
// automatic polling, matching this whole project's established
// discipline. Every persisted column is a snapshot of an already-
// computed value from an existing, unmodified module (see
// lib/db/src/schema/intelligenceSnapshots.ts's own header for the full
// rationale). Reads the most recent PRIOR day's row to power both the
// Observation Engine's/Health Engine's own trend comparisons and this
// module's own new/resolved/persistent observation diffing.
//
// Written via a real DB-level upsert (.onConflictDoNothing()) against
// the table's own (userId, snapshotDate) unique index — safe under
// concurrent calls for the same user/day, unlike a plain
// check-then-insert.

import { and, desc, eq, lt } from "drizzle-orm";
import { db, intelligenceSnapshotsTable, type IntelligenceSnapshotRow } from "@workspace/db";
import type { PortfolioDashboardResult } from "./portfolioDashboard.js";
import type { ThetaIncome } from "./thetaIncome.js";
import type { Observation } from "./intelligenceObservations.js";
import type { TrendDirection } from "./intelligenceTrend.js";
import { computeTrend } from "./intelligenceTrend.js";

export type TimelineEntryStatus = "new" | "resolved" | "persistent";

export interface TimelineEntry {
  code: string;
  label: string;
  category: string;
  status: TimelineEntryStatus;
}

export interface TimelineChange {
  label: string;
  direction: TrendDirection;
  detail: string;
}

export interface RiskRatingChange {
  from: string;
  to: string;
}

export interface Timeline {
  entries: TimelineEntry[];
  healthChange: TimelineChange | null;
  riskRatingChange: RiskRatingChange | null;
  incomeChange: TimelineChange | null;
  asOf: string;
  comparedTo: string | null;
}

// Display metadata for observation codes that may no longer be present
// in the CURRENT observation list (a "resolved" entry, by definition,
// has no current Observation object to read a label from) — pure label
// metadata, not duplicated business logic; kept in sync with
// intelligenceObservations.ts's own code strings by the shared test
// suite (intelligenceTimeline.test.ts asserts every code
// buildObservations() can ever emit has a registry entry).
const OBSERVATION_LABEL_REGISTRY: Record<string, { label: string; category: string }> = {
  portfolio_health_improved: { label: "Portfolio Health improved", category: "portfolio_health" },
  portfolio_health_declined: { label: "Portfolio Health declined", category: "portfolio_health" },
  buying_power_increasing: { label: "Buying Power increasing", category: "buying_power" },
  buying_power_decreasing: { label: "Buying Power decreasing", category: "buying_power" },
  theta_income_improving: { label: "Theta income improving", category: "theta_income" },
  theta_income_slowing: { label: "Theta income slowing", category: "theta_income" },
  diversification_improving: { label: "Diversification improving", category: "diversification" },
  diversification_declining: { label: "Diversification declining", category: "diversification" },
  concentration_elevated: { label: "Concentration elevated", category: "concentration" },
  large_directional_exposure: { label: "Large directional exposure", category: "directional_exposure" },
  large_greeks_exposure: { label: "Large Greeks exposure", category: "greeks_exposure" },
  event_risk_elevated: { label: "Event Risk elevated", category: "event_risk" },
  broker_disconnected: { label: "Broker disconnected", category: "broker_status" },
  paper_trading_active: { label: "Paper Trading active", category: "paper_trading_status" },
  credentials_unavailable: { label: "Credentials unavailable", category: "credentials_status" },
};

export function labelForCode(code: string): { label: string; category: string } {
  return OBSERVATION_LABEL_REGISTRY[code] ?? { label: code, category: "unknown" };
}

function todayDateStr(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getPriorSnapshot(userId: string, now: Date = new Date()): Promise<IntelligenceSnapshotRow | null> {
  const today = todayDateStr(now);
  const rows = await db
    .select()
    .from(intelligenceSnapshotsTable)
    .where(and(eq(intelligenceSnapshotsTable.userId, userId), lt(intelligenceSnapshotsTable.snapshotDate, today)))
    .orderBy(desc(intelligenceSnapshotsTable.snapshotDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordSnapshotIfNeeded(
  userId: string,
  dash: PortfolioDashboardResult,
  theta: ThetaIncome,
  observations: Observation[],
  now: Date = new Date(),
): Promise<void> {
  const concentration = dash.healthFactors.find((f) => f.code === "concentration");
  const diversification = dash.healthFactors.find((f) => f.code === "diversification");
  const eventRisk = dash.healthFactors.find((f) => f.code === "event_risk");
  const directionalExposure = dash.healthFactors.find((f) => f.code === "directional_exposure");
  const greeksExposure = dash.healthFactors.find((f) => f.code === "net_greeks_exposure");

  await db
    .insert(intelligenceSnapshotsTable)
    .values({
      userId,
      snapshotDate: todayDateStr(now),
      healthScore: dash.healthScore,
      overallRiskRatingCode: dash.overallRiskRating.code,
      buyingPower: dash.buyingPower,
      totalRiskPct: dash.totalRiskPct,
      concentrationScore: concentration?.score ?? 0,
      diversificationScore: diversification?.score ?? 0,
      eventRiskScore: eventRisk?.score ?? 0,
      directionalExposureScore: directionalExposure?.score ?? 0,
      greeksExposureScore: greeksExposure?.score ?? 0,
      thetaMonthly: theta.monthly,
      netDelta: dash.netGreeks.delta,
      observationCodes: observations.map((o) => o.code),
    })
    .onConflictDoNothing({
      target: [intelligenceSnapshotsTable.userId, intelligenceSnapshotsTable.snapshotDate],
    });
}

export function buildTimeline(
  observations: Observation[],
  prior: IntelligenceSnapshotRow | null,
  dash: PortfolioDashboardResult,
  theta: ThetaIncome,
  now: Date = new Date(),
): Timeline {
  const currentCodes = new Set(observations.map((o) => o.code));
  const priorCodes = new Set<string>((prior?.observationCodes as string[] | null) ?? []);

  const entries: TimelineEntry[] = [];
  for (const o of observations) {
    const status: TimelineEntryStatus = priorCodes.has(o.code) ? "persistent" : "new";
    entries.push({ code: o.code, label: o.title, category: o.category, status });
  }
  for (const code of priorCodes) {
    if (!currentCodes.has(code)) {
      const meta = labelForCode(code);
      entries.push({ code, label: meta.label, category: meta.category, status: "resolved" });
    }
  }

  let healthChange: TimelineChange | null = null;
  let incomeChange: TimelineChange | null = null;
  let riskRatingChange: RiskRatingChange | null = null;

  if (prior) {
    const healthTrend = computeTrend(dash.healthScore, prior.healthScore);
    if (healthTrend.direction !== "insufficient_history") {
      healthChange = {
        label: "Portfolio Health",
        direction: healthTrend.direction,
        detail: `${prior.healthScore}/100 → ${dash.healthScore}/100`,
      };
    }
    const incomeTrend = computeTrend(theta.monthly, prior.thetaMonthly);
    if (incomeTrend.direction !== "insufficient_history") {
      incomeChange = {
        label: "Theta Income (Monthly)",
        direction: incomeTrend.direction,
        detail: `${prior.thetaMonthly.toFixed(2)} → ${theta.monthly.toFixed(2)}`,
      };
    }
    if (prior.overallRiskRatingCode !== dash.overallRiskRating.code) {
      riskRatingChange = { from: prior.overallRiskRatingCode, to: dash.overallRiskRating.code };
    }
  }

  return {
    entries,
    healthChange,
    riskRatingChange,
    incomeChange,
    asOf: now.toISOString(),
    comparedTo: prior?.snapshotDate ?? null,
  };
}

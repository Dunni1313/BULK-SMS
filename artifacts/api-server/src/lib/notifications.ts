// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56; see docs/Phase-4-Master-Execution-Plan.md's Sprint 56 as-built
// note). Delivery channel: in-app notification center, per the project
// owner's own explicit kickoff decision (email/push both need real
// credentials/infrastructure this session doesn't have and can't verify
// end-to-end).
//
// Zero new detection logic — both trigger sources are already-tested,
// already-shipped engine functions, reused unmodified:
//   - Engine 1: computeWatchlistTargets() (lib/watchlistTargets.ts,
//     extracted from routes/stockAnalyst.ts this sprint — the exact same
//     detection the Watchlist Polish "Check Targets" button, Phase 2
//     Sprint 27, already exercises).
//   - Engine 2: buildTradingRiskAnalysis()'s own capBreached flags (Phase 3
//     Sprint 38/44 — the exact same detection GET /trading/risk already
//     exposes).
// This module's only genuinely new logic is the alert-candidate framing
// (title/message/dedup key) and the persistence/dedup bookkeeping.
//
// Every alert candidate carries an honest dataSource ("SIMULATED"|"LIVE")
// sourced directly from the provider that produced the underlying
// detection — never hardcoded, never fabricated.

import {
  db,
  valueWatchlistTable,
  tradingPositionsTable,
  settingsTable,
  platformNotificationsTable,
  type PlatformNotificationRow,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { computeWatchlistTargets } from "./watchlistTargets.js";
import { getFundamentalsProvider } from "./fundamentals.js";
import { buildTradingRiskAnalysis, type TradingPositionInput } from "./tradingRisk.js";
import { getMarketDataProvider } from "./tradingMarketData.js";
import { getSettingsRow } from "./serverState.js";
import { logger } from "./logger.js";
import { recordJobRun } from "./systemHealth.js";
// Phase 16 — Institutional Monitoring & Alerts Engine's own two automatic,
// bounded-scope evaluators (symbol-level + portfolio-level change
// detection). evaluateOpportunityMonitoringAlerts() is deliberately NOT
// imported here — it stays on-demand only, called directly from
// routes/monitoringEngine.ts's own explicit check endpoint, never from the
// automatic background tick (see that function's own header comment).
import { evaluateSymbolMonitoringAlerts, evaluatePortfolioMonitoringAlerts } from "./monitoringEngine.js";
// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine. The one
// genuinely new evaluator this sprint adds to this already-existing
// pipeline — see lib/workflowReminders.ts's own header comment for why
// this is the sole workflow automation modeled as a real, async push
// notification rather than a purely frontend-derived Task.
import { evaluateJournalReminders } from "./workflowReminders.js";

// AlertType/AlertSeverity/AlertCandidate moved to lib/alertTypes.ts during
// the Version 1 Release Candidate (RC1) hardening pass, to break a
// type-only circular dependency with lib/monitoringEngine.ts. Re-exported
// here unchanged so every existing importer of these types from this file
// (including routes/monitoringEngine.ts) keeps compiling with zero
// changes of its own. See lib/alertTypes.ts's own header comment for the
// full rationale.
export type { AlertType, AlertSeverity, AlertCandidate } from "./alertTypes.js";
import type { AlertCandidate } from "./alertTypes.js";

function fmtUsd(n: number | null): string {
  return n == null ? "n/a" : `$${n.toFixed(2)}`;
}

// Engine 1 trigger source (Phase 2, Sprint 27's own watchlist target-
// crossing check). A watchlist row with no target set for a given field
// honestly never fires that field's alert (computeWatchlistTargets()
// itself returns null, not a fabricated crossed/not-crossed verdict).
export async function evaluateWatchlistAlerts(userId: string): Promise<AlertCandidate[]> {
  const rows = await db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId));
  if (rows.length === 0) return [];

  const provider = await getFundamentalsProvider(userId);
  const candidates: AlertCandidate[] = [];
  for (const row of rows) {
    const check = await computeWatchlistTargets(row, provider);
    if (check.priceTargetCrossed === true) {
      candidates.push({
        type: "watchlist_target_crossed",
        title: `${row.symbol}: buy price target reached`,
        message: `${row.symbol} is now at ${fmtUsd(check.currentPrice)}, at or below your desired buy price of ${fmtUsd(row.desiredBuyPrice)}.`,
        dataSource: provider.dataSource,
        relatedSymbol: row.symbol,
        dedupKey: `watchlist:${row.id}:price`,
        severity: "info",
        previousValue: fmtUsd(row.desiredBuyPrice),
        currentValue: fmtUsd(check.currentPrice),
        evidence: [`Desired buy price: ${fmtUsd(row.desiredBuyPrice)}`, `Current price: ${fmtUsd(check.currentPrice)}`],
        recommendedAction: `Review ${row.symbol} on the Value Research or Institutional Decision Engine page.`,
      });
    }
    if (check.marginOfSafetyTargetCrossed === true) {
      candidates.push({
        type: "watchlist_target_crossed",
        title: `${row.symbol}: margin of safety target reached`,
        message: `${row.symbol} is now at ${fmtUsd(check.currentPrice)}, meeting or exceeding your ${row.marginOfSafetyTarget}% margin-of-safety target.`,
        dataSource: provider.dataSource,
        relatedSymbol: row.symbol,
        dedupKey: `watchlist:${row.id}:mos`,
        severity: "info",
        previousValue: `${row.marginOfSafetyTarget}% target`,
        currentValue: fmtUsd(check.currentPrice),
        evidence: [`Margin-of-safety target: ${row.marginOfSafetyTarget}%`, `Current price: ${fmtUsd(check.currentPrice)}`],
        recommendedAction: `Review ${row.symbol} on the Value Research or Institutional Decision Engine page.`,
      });
    }
  }
  return candidates;
}

// Engine 2 trigger source (Phase 3, Sprint 38/44's own Risk Management hard-
// cap breach detection). A user with no open, stop/target-defined positions
// or no account value set gets an honest empty result — never a fabricated
// breach.
export async function evaluateRiskAlerts(userId: string): Promise<AlertCandidate[]> {
  const positionRows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  if (positionRows.length === 0) return [];

  const positions: TradingPositionInput[] = positionRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side === "short" ? "short" : "long",
    status: r.status === "closed" ? "closed" : "open",
    quantity: r.quantity,
    entryPrice: r.entryPrice,
    stopPrice: r.stopPrice ?? null,
    targetPrice: r.targetPrice ?? null,
  }));

  const settings = await getSettingsRow(userId);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);
  const dataSource: "SIMULATED" | "LIVE" = provider.isLive ? "LIVE" : "SIMULATED";

  const candidates: AlertCandidate[] = [];
  if (analysis.positionSizing.capBreached) {
    candidates.push({
      type: "risk_cap_breached",
      title: "Position sizing risk cap breached",
      message: analysis.positionSizing.detail,
      dataSource,
      relatedSymbol: analysis.positionSizing.largestPositionSymbol ?? null,
      dedupKey: `risk:position-sizing`,
      severity: "warning",
      previousValue: null,
      currentValue: null,
      evidence: [analysis.positionSizing.detail],
      recommendedAction: "Review your open positions on the Trading Research page's Risk panel.",
    });
  }
  if (analysis.portfolioBudget.capBreached) {
    candidates.push({
      type: "risk_cap_breached",
      title: "Portfolio risk budget cap breached",
      message: analysis.portfolioBudget.detail,
      dataSource,
      relatedSymbol: null,
      dedupKey: `risk:portfolio-budget`,
      severity: "warning",
      previousValue: null,
      currentValue: null,
      evidence: [analysis.portfolioBudget.detail],
      recommendedAction: "Review your open positions on the Trading Research page's Risk panel.",
    });
  }
  return candidates;
}

// Persists alert candidates for one user, honoring the active-dedup-key
// uniqueness (a candidate is skipped, never duplicated, if an unread
// notification with the same dedupKey already exists for this user — see
// manual-migrations/014_platform_notifications.sql for the full dedup
// design rationale). Extracted (Phase 16) so both the automatic, bounded
// evaluators below and routes/monitoringEngine.ts's own on-demand full-check
// endpoint (which additionally includes Opportunity Alerts) share the exact
// same persistence/dedup logic rather than a second, duplicated copy of it.
export async function persistAlertCandidates(userId: string, candidates: AlertCandidate[]): Promise<PlatformNotificationRow[]> {
  if (candidates.length === 0) return [];

  const existingUnread = await db
    .select({ dedupKey: platformNotificationsTable.dedupKey })
    .from(platformNotificationsTable)
    .where(and(eq(platformNotificationsTable.userId, userId), eq(platformNotificationsTable.isRead, false)));
  const existingKeys = new Set(existingUnread.map((r) => r.dedupKey));

  const created: PlatformNotificationRow[] = [];
  for (const c of candidates) {
    if (existingKeys.has(c.dedupKey)) continue;
    try {
      const [row] = await db
        .insert(platformNotificationsTable)
        .values({
          userId,
          type: c.type,
          title: c.title,
          message: c.message,
          dataSource: c.dataSource,
          relatedSymbol: c.relatedSymbol,
          dedupKey: c.dedupKey,
          severity: c.severity ?? "info",
          previousValue: c.previousValue ?? null,
          currentValue: c.currentValue ?? null,
          evidence: c.evidence ?? null,
          recommendedAction: c.recommendedAction ?? null,
        })
        .returning();
      created.push(row);
      existingKeys.add(c.dedupKey);
    } catch {
      // Best-effort: a concurrent evaluation could race the same dedup key
      // past the check above and into the partial unique index — never
      // treated as a hard failure, matching recordAuditEvent's own
      // established best-effort-write philosophy (Sprint 10).
    }
  }
  return created;
}

// Honors the alertsEnabled settings toggle; runs only the automatic,
// bounded-scope evaluators (Watchlist/Risk/Symbol/Portfolio) — never
// Opportunity Alerts, which stay on-demand only (see
// evaluateOpportunityMonitoringAlerts()'s own header comment in
// lib/monitoringEngine.ts).
export async function evaluateAndPersistAlertsForUser(userId: string): Promise<PlatformNotificationRow[]> {
  const settings = await getSettingsRow(userId);
  if (!settings.alertsEnabled) return [];

  const provider = await getFundamentalsProvider(userId);
  const [watchlistCandidates, riskCandidates, symbolCandidates, portfolioCandidates, journalCandidates] = await Promise.all([
    evaluateWatchlistAlerts(userId).catch(() => [] as AlertCandidate[]),
    evaluateRiskAlerts(userId).catch(() => [] as AlertCandidate[]),
    evaluateSymbolMonitoringAlerts(userId, provider).catch(() => [] as AlertCandidate[]),
    evaluatePortfolioMonitoringAlerts(userId, provider).catch(() => [] as AlertCandidate[]),
    evaluateJournalReminders(userId).catch(() => [] as AlertCandidate[]),
  ]);
  const candidates = [...watchlistCandidates, ...riskCandidates, ...symbolCandidates, ...portfolioCandidates, ...journalCandidates];
  return persistAlertCandidates(userId, candidates);
}

// Phase 1 Sprint 8's own "armed users" query shape (autoExecution.ts's
// getArmedExecutionUserIds — read for pattern reference only, that
// protected file is not imported or modified here), applied to alerts:
// only users with alertsEnabled=true are evaluated on each scheduler tick.
// Never touches autoExecutionLog, the kill switch, or either automation
// engine — this is a wholly independent, purely informational capability.
export async function evaluateAndPersistAlertsForAllUsers(): Promise<void> {
  const enabledUsers = await db
    .select({ userId: settingsTable.userId })
    .from(settingsTable)
    .where(eq(settingsTable.alertsEnabled, true));
  for (const { userId } of enabledUsers) {
    await evaluateAndPersistAlertsForUser(userId).catch(() => []);
  }
}

// Background generation — this is what makes the notification center a
// genuine push surface (a new unread alert can appear even if the user
// never revisits a page to trigger POST /notifications/check), the
// platform's first push-based (not pull-only) capability. A longer
// interval than the 60s auto-execution/auto-adjustment tick, since each
// run makes real provider calls per watchlist row / open position across
// every alerts-enabled user — 5 minutes is frequent enough for an
// advisory alert, not so frequent it hammers the fundamentals/market-data
// provider seams. Mirrors lib/requestMetrics.ts's own
// startRequestMetricsTimer() shape exactly: idempotent, unref'd so it
// never keeps the process alive on its own, and started only from the
// real server entrypoint (index.ts), never from app.ts — so the ~1,000+
// existing tests that import app.js directly never accumulate a real
// setInterval. Wholly independent of, and never touches, the auto-
// execution/auto-adjustment scheduler, their kill switch, or
// autoExecutionLog.
const ALERTS_SCHEDULER_INTERVAL_MS = 5 * 60_000;
let alertsTimer: NodeJS.Timeout | null = null;

export function startAlertsScheduler(): void {
  if (alertsTimer) return;
  alertsTimer = setInterval(() => {
    // Phase 6, Sprint 74 — recordJobRun() is pure observation: it times and
    // records the outcome of the exact same call below, never changing what
    // it does.
    const start = performance.now();
    evaluateAndPersistAlertsForAllUsers()
      .then(() => recordJobRun("alerts", { success: true, durationMs: performance.now() - start }))
      .catch((err) => {
        logger.error({ err }, "Alerts scheduler tick failed");
        recordJobRun("alerts", {
          success: false,
          durationMs: performance.now() - start,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });
  }, ALERTS_SCHEDULER_INTERVAL_MS);
  alertsTimer.unref();
}

export function stopAlertsScheduler(): void {
  if (alertsTimer) {
    clearInterval(alertsTimer);
    alertsTimer = null;
  }
}

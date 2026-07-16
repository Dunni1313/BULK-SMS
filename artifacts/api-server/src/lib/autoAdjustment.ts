// Task #20 — Auto-Adjustment engine.
//
// The sibling of the Full-Auto OPENING engine (autoExecution.ts), but for managing
// OPEN positions. When mode=full_auto AND the dedicated auto-adjust switch is armed,
// a scheduler tick walks every open trade, runs the SAME deterministic adjustment
// evaluation the advisory endpoints use, and auto-acts ONLY on the de-risking subset
// (close_for_profit / close_for_loss / reduce_risk). It NEVER rolls or converts —
// those are structural changes left to the human — and it routes every close through
// the shared closeTradePosition helper so auto and manual exits are identical.
//
// Safety mirrors autoExecution.ts: single-flight so the scheduler tick and the manual
// trigger can't overlap, and the arm gate is re-read from live DB state before EVERY
// close so flipping the switch off halts the loop in real time.

import { db, tradesTable, autoExecutionLogTable, settingsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getSettingsRow } from "./serverState.js";
import { evaluateTradeAdjustment, AUTO_ACTIONABLE, type AdjustmentAction } from "./adjustment.js";
import { closeTradePosition } from "./tradeClose.js";
import { logger } from "./logger.js";
import { getLegacyOwnerUserId } from "./legacyOwner.js";

// ─── Pure arm gate (no I/O — unit-tested in phase8.adjustment.test.ts) ────────

// Auto-adjust is gated by THREE switches, all of which must be armed:
//   1. mode === "full_auto"        — the execution mode
//   2. autoExecuteEnabled          — the AutoPilot MASTER kill switch (governs ALL
//                                     automation; if the operator disarms it, nothing
//                                     automated runs, including auto-adjust)
//   3. autoAdjustEnabled           — the subordinate auto-adjust-specific switch
// The master kill switch is checked BEFORE the subordinate switch so disarming
// automation globally takes precedence and reports the master reason.
export function autoAdjustAllowed(
  mode: string,
  autoExecuteEnabled: boolean,
  autoAdjustEnabled: boolean,
): { allowed: boolean; reason: string | null } {
  if (mode !== "full_auto") return { allowed: false, reason: "Full-Auto mode is not active" };
  if (!autoExecuteEnabled) return { allowed: false, reason: "Master kill switch (auto-execute) is OFF" };
  if (!autoAdjustEnabled) return { allowed: false, reason: "Auto-adjust switch is OFF" };
  return { allowed: true, reason: null };
}

// Human-readable exit label for each auto-actionable action.
function exitReasonFor(action: AdjustmentAction): string {
  switch (action) {
    case "close_for_profit":
      return "Auto-adjust: profit target reached";
    case "close_for_loss":
      return "Auto-adjust: loss exit rule";
    case "reduce_risk":
      return "Auto-adjust: de-risk (close)";
    default:
      return "Auto-adjust";
  }
}

export interface AutoAdjustDecisionRecord {
  symbol: string | null;
  strategy: string | null;
  decision: "executed" | "skipped" | "blocked";
  action: string;
  reason: string;
  tradeId: number | null;
  realizedPnl: number | null;
}

export interface AutoAdjustCycleResult {
  runId: string;
  ranAt: string;
  blocked: boolean;
  blockReason: string | null;
  scanned: number;
  executed: number;
  skipped: number;
  decisions: AutoAdjustDecisionRecord[];
}

async function logDecision(runId: string, t: { ravishScore: number } | null, d: AutoAdjustDecisionRecord): Promise<void> {
  await db.insert(autoExecutionLogTable).values({
    runId,
    kind: "adjust",
    decision: d.decision,
    reason: d.reason,
    symbol: d.symbol,
    strategy: d.strategy,
    ravishScore: t?.ravishScore ?? 0,
    tradeId: d.tradeId,
    alpacaOrderId: null,
  });
}

// Single-flight guard, keyed per user (Phase 1, Sprint 8 — see
// runAutoAdjustmentCycleForAllUsers below). Shared by the scheduler tick and the
// manual POST /execution/auto/adjust/run trigger so two cycles for the SAME user
// can never overlap, while different users' cycles run independently.
const adjustCycleInFlightUserIds = new Set<string>();

// Run one auto-adjustment cycle for a single user. `userId` defaults to the
// legacy-owner stand-in when omitted, preserving this function's exact
// pre-Sprint-8 single-user behavior for existing callers/tests.
export async function runAutoAdjustmentCycle(userId?: string): Promise<AutoAdjustCycleResult> {
  const uid = userId ?? (await getLegacyOwnerUserId());
  const runId = randomUUID();
  const ranAt = new Date().toISOString();

  if (adjustCycleInFlightUserIds.has(uid)) {
    return {
      runId,
      ranAt,
      blocked: true,
      blockReason: "Another auto-adjustment cycle is already running",
      scanned: 0,
      executed: 0,
      skipped: 0,
      decisions: [],
    };
  }
  adjustCycleInFlightUserIds.add(uid);
  try {
    return await runAdjustLocked(runId, ranAt, uid);
  } finally {
    adjustCycleInFlightUserIds.delete(uid);
  }
}

// Phase 1, Sprint 8 — the scheduler runs this once per user currently armed for
// auto-adjust (all three switches — see autoAdjustAllowed), so a disarmed user's
// open positions are never touched by another user's armed cycle: each cycle only
// ever queries and closes that one user's own trades.
export async function runAutoAdjustmentCycleForAllUsers(): Promise<AutoAdjustCycleResult[]> {
  const userIds = await getArmedAdjustmentUserIds();
  const results: AutoAdjustCycleResult[] = [];
  for (const uid of userIds) {
    results.push(await runAutoAdjustmentCycle(uid));
  }
  return results;
}

// Users currently armed for auto-adjust (all three switches on — master before
// subordinate, mirroring autoAdjustAllowed's own precedence). Read fresh from
// settings on every scheduler tick — never cached.
async function getArmedAdjustmentUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: settingsTable.userId })
    .from(settingsTable)
    .where(
      and(
        eq(settingsTable.executionMode, "full_auto"),
        eq(settingsTable.autoExecuteEnabled, true),
        eq(settingsTable.autoAdjustEnabled, true),
      ),
    );
  return rows.map((r) => r.userId);
}

async function runAdjustLocked(runId: string, ranAt: string, userId: string): Promise<AutoAdjustCycleResult> {
  const settings0 = await getSettingsRow(userId);
  const gate0 = autoAdjustAllowed(settings0.executionMode, settings0.autoExecuteEnabled, settings0.autoAdjustEnabled);
  if (!gate0.allowed) {
    const blockRecord: AutoAdjustDecisionRecord = {
      symbol: null,
      strategy: null,
      decision: "blocked",
      action: "none",
      reason: gate0.reason ?? "Blocked",
      tradeId: null,
      realizedPnl: null,
    };
    try {
      await logDecision(runId, null, blockRecord);
    } catch (err) {
      logger.error({ err, reason: gate0.reason }, "Auto-adjust blocked-path audit log write failed");
    }
    return { runId, ranAt, blocked: true, blockReason: gate0.reason, scanned: 0, executed: 0, skipped: 0, decisions: [blockRecord] };
  }

  const open = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "open"), eq(tradesTable.userId, userId)))
    .orderBy(desc(tradesTable.ravishScore));

  const decisions: AutoAdjustDecisionRecord[] = [];
  let executed = 0;
  let skipped = 0;

  const record = async (t: { ravishScore: number } | null, rec: AutoAdjustDecisionRecord): Promise<void> => {
    decisions.push(rec);
    try {
      await logDecision(runId, t, rec);
    } catch (err) {
      logger.error({ err, decision: rec.decision, symbol: rec.symbol }, "Auto-adjust audit log write failed");
    }
  };

  for (const t of open) {
    // Re-read the arm gate against LIVE state before every action so the operator
    // flipping the switch off halts the loop immediately.
    const live = await getSettingsRow(userId);
    const gate = autoAdjustAllowed(live.executionMode, live.autoExecuteEnabled, live.autoAdjustEnabled);
    if (!gate.allowed) {
      await record(null, {
        symbol: null,
        strategy: null,
        decision: "blocked",
        action: "none",
        reason: gate.reason ?? "Halted mid-cycle",
        tradeId: null,
        realizedPnl: null,
      });
      break;
    }

    const adj = evaluateTradeAdjustment(t, live);

    if (!adj.autoActionable || !AUTO_ACTIONABLE.has(adj.action)) {
      skipped += 1;
      await record(t, {
        symbol: t.symbol,
        strategy: t.strategy,
        decision: "skipped",
        action: adj.action,
        reason: `Advisory only — recommended "${adj.actionLabel}" is not an auto-actionable de-risk`,
        tradeId: t.id,
        realizedPnl: null,
      });
      continue;
    }

    // Confirm the trade is still open right before closing (a manual close may have
    // landed since the open-list snapshot).
    const [fresh] = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.id, t.id), eq(tradesTable.userId, userId)));
    if (!fresh || fresh.status !== "open") {
      skipped += 1;
      await record(t, {
        symbol: t.symbol,
        strategy: t.strategy,
        decision: "skipped",
        action: adj.action,
        reason: "Trade is no longer open",
        tradeId: t.id,
        realizedPnl: null,
      });
      continue;
    }

    try {
      const closed = await closeTradePosition(fresh, userId, exitReasonFor(adj.action));
      executed += 1;
      await record(t, {
        symbol: t.symbol,
        strategy: t.strategy,
        decision: "executed",
        action: adj.action,
        reason: `${exitReasonFor(adj.action)} — realized $${closed.realizedPnl.toFixed(0)}`,
        tradeId: t.id,
        realizedPnl: closed.realizedPnl,
      });
    } catch (err) {
      skipped += 1;
      const reasonText = err instanceof Error ? err.message : "Auto-adjust close failed";
      logger.error({ err, symbol: t.symbol }, "Auto-adjust close failed");
      await record(t, {
        symbol: t.symbol,
        strategy: t.strategy,
        decision: "skipped",
        action: adj.action,
        reason: reasonText,
        tradeId: t.id,
        realizedPnl: null,
      });
    }
  }

  return {
    runId,
    ranAt,
    blocked: false,
    blockReason: null,
    scanned: open.length,
    executed,
    skipped,
    decisions,
  };
}

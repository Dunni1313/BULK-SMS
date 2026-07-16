// Phase 6 — Full-Auto execution engine.
//
// When the engine is in `full_auto` mode AND the master auto-execute switch is
// armed, a scheduler (see index.ts) runs cycles on an interval. Each cycle scans
// the ranked candidates, runs the EXACT same Phase 5 pre-trade risk gate as the
// Trade Ticket, and auto-submits only those that pass — bounded by hard guardrails
// (per-day trade cap, concurrent-position cap, auto-only score floor, daily-loss
// circuit breaker). It never bypasses a risk check, and the master switch is a kill
// switch: with it off, nothing is ever auto-submitted, even in full_auto mode.

import { db, tradesTable, scannerResultsTable, autoExecutionLogTable, settingsTable } from "@workspace/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  buildTicket,
  executeValidatedTicket,
  MIN_RAVISH_SCORE,
  type ExecutionTicket,
} from "./execution.js";
import { getAccountValue, getSettingsRow } from "./serverState.js";
import { getEventRiskForSymbol } from "./eventRisk.js";
import { logger } from "./logger.js";
import { getLegacyOwnerUserId } from "./legacyOwner.js";

// ─── Pure guardrail logic (no I/O — unit-tested in phase6.test.ts) ───────────

export interface AutoGuardrailInput {
  mode: string; // executionMode
  autoEnabled: boolean; // master switch / kill switch
  tradesToday: number;
  maxTradesPerDay: number;
  concurrentPositions: number;
  maxConcurrentPositions: number;
  dailyRealizedPnl: number; // dollars (negative = loss today)
  accountValue: number;
  maxDailyLossPct: number;
}

export interface AutoGuardrailResult {
  allowed: boolean;
  reason: string | null;
  // How many more trades the cycle may open before a count-based cap is hit.
  remainingCapacity: number;
}

// Cycle-level pre-flight. Returns allowed=false with a single human reason when a
// guardrail halts the whole cycle, otherwise the remaining trade capacity.
export function evaluateAutoGuardrails(input: AutoGuardrailInput): AutoGuardrailResult {
  if (input.mode !== "full_auto") {
    return { allowed: false, reason: "Full-Auto mode is not active", remainingCapacity: 0 };
  }
  if (!input.autoEnabled) {
    return {
      allowed: false,
      reason: "Auto-execute switch is OFF (kill switch engaged)",
      remainingCapacity: 0,
    };
  }

  const dailyLossLimit = (input.maxDailyLossPct / 100) * Math.max(0, input.accountValue);
  if (input.dailyRealizedPnl < 0 && Math.abs(input.dailyRealizedPnl) >= dailyLossLimit) {
    return {
      allowed: false,
      reason: `Daily loss circuit breaker tripped: $${Math.abs(input.dailyRealizedPnl).toFixed(0)} loss ≥ ${input.maxDailyLossPct}% limit`,
      remainingCapacity: 0,
    };
  }

  const byDay = Math.max(0, input.maxTradesPerDay - input.tradesToday);
  if (byDay <= 0) {
    return {
      allowed: false,
      reason: `Daily trade cap reached (${input.tradesToday}/${input.maxTradesPerDay})`,
      remainingCapacity: 0,
    };
  }

  const byConcurrent = Math.max(0, input.maxConcurrentPositions - input.concurrentPositions);
  if (byConcurrent <= 0) {
    return {
      allowed: false,
      reason: `Concurrent-position cap reached (${input.concurrentPositions}/${input.maxConcurrentPositions})`,
      remainingCapacity: 0,
    };
  }

  return { allowed: true, reason: null, remainingCapacity: Math.min(byDay, byConcurrent) };
}

export type CandidateDecision = "execute" | "skip" | "reject";

// Per-candidate decision once the cycle is cleared to trade. A candidate is only
// executed when it passes the full risk validation AND clears the auto-only score
// floor (which is intentionally >= the hard execution floor).
export function decideCandidate(input: {
  validationValid: boolean;
  ravishScore: number;
  autoMinScore: number;
  violations: string[];
  eventBlockAuto?: boolean;
  eventReason?: string;
}): { decision: CandidateDecision; reason: string } {
  // Event Risk Filter: high event risk halts auto-execution before any score/risk
  // gate so AutoPilot never opens into a major event (earnings/FOMC/CPI/jobs).
  if (input.eventBlockAuto) {
    return {
      decision: "skip",
      reason: input.eventReason ?? "Event risk too high for auto-execution",
    };
  }
  const floor = Math.max(input.autoMinScore, MIN_RAVISH_SCORE);
  if (input.ravishScore < floor) {
    return {
      decision: "skip",
      reason: `Ravish Score ${input.ravishScore.toFixed(1)} below the auto floor ${floor}`,
    };
  }
  if (!input.validationValid) {
    return {
      decision: "reject",
      reason: `Risk validation failed: ${input.violations.join("; ")}`,
    };
  }
  return { decision: "execute", reason: "Passed all pre-trade checks and auto score floor" };
}

// ─── Account/portfolio snapshot helpers ──────────────────────────────────────

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function countTradesToday(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(tradesTable)
    .where(
      and(
        eq(tradesTable.executionMode, "full_auto"),
        gte(tradesTable.createdAt, startOfUtcDay()),
        eq(tradesTable.userId, userId),
      ),
    );
  return rows.length;
}

async function countConcurrentPositions(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(tradesTable)
    .where(and(inArray(tradesTable.status, ["open", "pending"]), eq(tradesTable.userId, userId)));
  return rows.length;
}

async function dailyRealizedPnl(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(tradesTable)
    .where(
      and(
        eq(tradesTable.status, "closed"),
        gte(tradesTable.closeDate, startOfUtcDay()),
        eq(tradesTable.userId, userId),
      ),
    );
  return rows.reduce((s, t) => s + (t.currentPnl ?? 0), 0);
}

// ─── Cycle ───────────────────────────────────────────────────────────────────

export interface AutoDecisionRecord {
  symbol: string | null;
  strategy: string | null;
  decision: "executed" | "skipped" | "rejected" | "blocked";
  reason: string;
  ravishScore: number;
  tradeId: number | null;
  orderId: string | null;
}

export interface AutoCycleResult {
  runId: string;
  ranAt: string;
  blocked: boolean;
  blockReason: string | null;
  scanned: number;
  executed: number;
  skipped: number;
  rejected: number;
  decisions: AutoDecisionRecord[];
}

async function logDecision(runId: string, d: AutoDecisionRecord): Promise<void> {
  await db.insert(autoExecutionLogTable).values({
    runId,
    decision: d.decision,
    reason: d.reason,
    symbol: d.symbol,
    strategy: d.strategy,
    ravishScore: d.ravishScore,
    tradeId: d.tradeId,
    alpacaOrderId: d.orderId,
  });
}

// Single-flight guard, keyed per user (Phase 1, Sprint 8 — the automation
// scheduler is now per-user; see runAutoExecutionCycleForAllUsers below). The
// scheduler tick and the manual /execution/auto/run endpoint share this so two
// cycles for the SAME user can never run concurrently and double-spend that
// user's capacity snapshot — while two DIFFERENT users' cycles run independently.
const cycleInFlightUserIds = new Set<string>();

// Re-read settings + live counts and re-run the guardrail gate. Called at the top
// of the cycle AND before every individual execution so the kill switch halts in
// real time and the caps reflect trades opened earlier in this same loop.
async function freshGate(userId: string): Promise<{
  gate: AutoGuardrailResult;
  settings: Awaited<ReturnType<typeof getSettingsRow>>;
}> {
  const settings = await getSettingsRow(userId);
  const accountValue = await getAccountValue(userId);
  const [tradesToday, concurrentPositions, realizedPnl] = await Promise.all([
    countTradesToday(userId),
    countConcurrentPositions(userId),
    dailyRealizedPnl(userId),
  ]);
  const gate = evaluateAutoGuardrails({
    mode: settings.executionMode,
    autoEnabled: settings.autoExecuteEnabled,
    tradesToday,
    maxTradesPerDay: settings.autoMaxTradesPerDay,
    concurrentPositions,
    maxConcurrentPositions: settings.autoMaxConcurrentPositions,
    dailyRealizedPnl: realizedPnl,
    accountValue,
    maxDailyLossPct: settings.autoMaxDailyLossPct,
  });
  return { gate, settings };
}

// Run one full-auto cycle for a single user. Safe to call from the scheduler (once
// per armed user — see runAutoExecutionCycleForAllUsers) or a manual-trigger
// endpoint: it is a no-op (returns blocked) unless mode=full_auto and the master
// switch is armed for THIS user, and it is single-flighted per userId so two
// overlapping invocations for the same user cannot breach that user's caps.
// `userId` defaults to the legacy-owner stand-in when omitted, preserving this
// function's exact pre-Sprint-8 single-user behavior for existing callers/tests.
export async function runAutoExecutionCycle(userId?: string): Promise<AutoCycleResult> {
  const uid = userId ?? (await getLegacyOwnerUserId());
  const runId = randomUUID();
  const ranAt = new Date().toISOString();

  if (cycleInFlightUserIds.has(uid)) {
    return {
      runId,
      ranAt,
      blocked: true,
      blockReason: "Another auto-execution cycle is already running",
      scanned: 0,
      executed: 0,
      skipped: 0,
      rejected: 0,
      decisions: [],
    };
  }
  cycleInFlightUserIds.add(uid);
  try {
    return await runCycleLocked(runId, ranAt, uid);
  } finally {
    cycleInFlightUserIds.delete(uid);
  }
}

// Phase 1, Sprint 8 — the scheduler runs this once per user currently armed
// (executionMode=full_auto AND autoExecuteEnabled), so the kill switch and every
// guardrail below are genuinely per-user: a disarmed user's positions are never
// touched by another user's armed cycle, because each cycle only ever queries and
// acts on that one user's own scanner results, trades, and settings.
export async function runAutoExecutionCycleForAllUsers(): Promise<AutoCycleResult[]> {
  const userIds = await getArmedExecutionUserIds();
  const results: AutoCycleResult[] = [];
  for (const uid of userIds) {
    results.push(await runAutoExecutionCycle(uid));
  }
  return results;
}

// Users currently armed for full-auto OPENING (both switches on). Read fresh from
// settings on every scheduler tick — never cached — so arming/disarming takes
// effect on the very next tick.
async function getArmedExecutionUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: settingsTable.userId })
    .from(settingsTable)
    .where(and(eq(settingsTable.executionMode, "full_auto"), eq(settingsTable.autoExecuteEnabled, true)));
  return rows.map((r) => r.userId);
}

async function runCycleLocked(runId: string, ranAt: string, userId: string): Promise<AutoCycleResult> {
  const pre = await freshGate(userId);
  const gate = pre.gate;
  let settings = pre.settings;

  if (!gate.allowed) {
    const blockRecord: AutoDecisionRecord = {
      symbol: null,
      strategy: null,
      decision: "blocked",
      reason: gate.reason ?? "Blocked",
      ravishScore: 0,
      tradeId: null,
      orderId: null,
    };
    try {
      await logDecision(runId, blockRecord);
    } catch (err) {
      logger.error({ err, reason: gate.reason }, "Auto-execution blocked-path audit log write failed");
    }
    return {
      runId,
      ranAt,
      blocked: true,
      blockReason: gate.reason,
      scanned: 0,
      executed: 0,
      skipped: 0,
      rejected: 0,
      decisions: [blockRecord],
    };
  }

  // Highest-ranked candidates first; only need a handful given the capacity cap.
  const candidates = await db
    .select()
    .from(scannerResultsTable)
    .where(eq(scannerResultsTable.userId, userId))
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(20);

  const decisions: AutoDecisionRecord[] = [];
  let executed = 0;
  let skipped = 0;
  let rejected = 0;

  // Audit logging must never change the accounting outcome: a logging failure on an
  // executed trade must NOT reclassify it as rejected. We record + push the decision
  // first, then best-effort persist it.
  const record = async (rec: AutoDecisionRecord): Promise<void> => {
    decisions.push(rec);
    try {
      await logDecision(runId, rec);
    } catch (err) {
      logger.error({ err, decision: rec.decision, symbol: rec.symbol }, "Auto-execution audit log write failed");
    }
  };

  for (const c of candidates) {
    let ticket: (ExecutionTicket & { _scannerResultId?: number | null }) | null = null;
    try {
      ticket = (await buildTicket(
        {
          scannerResultId: c.id,
          quantity: settings.autoQuantityPerTrade,
        },
        userId,
      )) as ExecutionTicket & { _scannerResultId?: number | null };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unable to build ticket";
      rejected += 1;
      await record({
        symbol: c.symbol,
        strategy: c.strategy,
        decision: "rejected",
        reason,
        ravishScore: c.ravishScore,
        tradeId: null,
        orderId: null,
      });
      continue;
    }

    // Event Risk Filter: block auto-execution when this candidate's window carries
    // genuinely high event risk (non-play earnings or an FOMC, or penalty at the cap).
    // Routine monthly macro (CPI/jobs/PCE) stays "medium" and does NOT block here.
    // Gated by the dedicated setting.
    const eventAssessment = getEventRiskForSymbol(
      ticket.symbol,
      ticket.strategy,
      ticket.expiration,
      Date.now(),
      settings.eventRiskEnabled,
    );
    const eventBlockAuto = settings.eventRiskAutoBlockHigh && eventAssessment.blockAuto;

    const { decision, reason } = decideCandidate({
      validationValid: ticket.validation.valid,
      ravishScore: ticket.ravishScore,
      autoMinScore: settings.autoMinRavishScore,
      violations: ticket.validation.violations,
      eventBlockAuto,
      eventReason: `Event risk too high (${eventAssessment.level}) — ${
        eventAssessment.events.map((e) => e.label).join(", ") || "major event in window"
      }`,
    });

    if (decision === "skip") {
      skipped += 1;
      await record({
        symbol: ticket.symbol,
        strategy: ticket.strategy,
        decision: "skipped",
        reason,
        ravishScore: ticket.ravishScore,
        tradeId: null,
        orderId: null,
      });
      continue;
    }

    if (decision === "reject") {
      rejected += 1;
      await record({
        symbol: ticket.symbol,
        strategy: ticket.strategy,
        decision: "rejected",
        reason,
        ravishScore: ticket.ravishScore,
        tradeId: null,
        orderId: null,
      });
      continue;
    }

    // decision === "execute". Re-evaluate the kill switch + caps against LIVE state
    // right before pulling the trigger: trades opened earlier in this loop (or by a
    // manual submit) count now, and an operator flipping the switch off mid-cycle
    // halts immediately rather than after the original capacity is drained.
    const live = await freshGate(userId);
    settings = live.settings;
    if (!live.gate.allowed) {
      await record({
        symbol: null,
        strategy: null,
        decision: "blocked",
        reason: live.gate.reason ?? "Halted mid-cycle",
        ravishScore: 0,
        tradeId: null,
        orderId: null,
      });
      break;
    }

    try {
      const result = await executeValidatedTicket(ticket, "full_auto", userId);
      executed += 1;
      await record({
        symbol: ticket.symbol,
        strategy: ticket.strategy,
        decision: "executed",
        reason: `Auto-submitted via ${result.broker} (${result.status})`,
        ravishScore: ticket.ravishScore,
        tradeId: result.tradeId,
        orderId: result.orderId,
      });
    } catch (err) {
      rejected += 1;
      const reasonText = err instanceof Error ? err.message : "Order routing failed";
      logger.error({ err, symbol: ticket.symbol }, "Auto-execution routing failed");
      await record({
        symbol: ticket.symbol,
        strategy: ticket.strategy,
        decision: "rejected",
        reason: reasonText,
        ravishScore: ticket.ravishScore,
        tradeId: null,
        orderId: null,
      });
    }
  }

  return {
    runId,
    ranAt,
    blocked: false,
    blockReason: null,
    scanned: decisions.length,
    executed,
    skipped,
    rejected,
    decisions,
  };
}

// ─── Status + log readers (for the AutoPilot UI) ─────────────────────────────

export interface AutoExecutionStatus {
  executionMode: string;
  autoExecuteEnabled: boolean;
  armed: boolean; // mode=full_auto AND switch on
  guardrails: {
    maxTradesPerDay: number;
    maxConcurrentPositions: number;
    minRavishScore: number;
    maxDailyLossPct: number;
    quantityPerTrade: number;
  };
  today: {
    tradesToday: number;
    concurrentPositions: number;
    dailyRealizedPnl: number;
    accountValue: number;
    remainingCapacity: number;
    dailyLossLimit: number;
  };
  blockReason: string | null;
}

export async function getAutoExecutionStatus(userId?: string): Promise<AutoExecutionStatus> {
  const uid = userId ?? (await getLegacyOwnerUserId());
  const settings = await getSettingsRow(uid);
  const accountValue = await getAccountValue(uid);
  const [tradesToday, concurrentPositions, realizedPnl] = await Promise.all([
    countTradesToday(uid),
    countConcurrentPositions(uid),
    dailyRealizedPnl(uid),
  ]);

  const gate = evaluateAutoGuardrails({
    mode: settings.executionMode,
    autoEnabled: settings.autoExecuteEnabled,
    tradesToday,
    maxTradesPerDay: settings.autoMaxTradesPerDay,
    concurrentPositions,
    maxConcurrentPositions: settings.autoMaxConcurrentPositions,
    dailyRealizedPnl: realizedPnl,
    accountValue,
    maxDailyLossPct: settings.autoMaxDailyLossPct,
  });

  return {
    executionMode: settings.executionMode,
    autoExecuteEnabled: settings.autoExecuteEnabled,
    armed: settings.executionMode === "full_auto" && settings.autoExecuteEnabled,
    guardrails: {
      maxTradesPerDay: settings.autoMaxTradesPerDay,
      maxConcurrentPositions: settings.autoMaxConcurrentPositions,
      minRavishScore: settings.autoMinRavishScore,
      maxDailyLossPct: settings.autoMaxDailyLossPct,
      quantityPerTrade: settings.autoQuantityPerTrade,
    },
    today: {
      tradesToday,
      concurrentPositions,
      dailyRealizedPnl: Math.round(realizedPnl),
      accountValue: Math.round(accountValue),
      remainingCapacity: gate.remainingCapacity,
      dailyLossLimit: Math.round((settings.autoMaxDailyLossPct / 100) * accountValue),
    },
    blockReason: gate.allowed ? null : gate.reason,
  };
}

export interface AutoLogRow {
  id: number;
  runId: string;
  kind: string;
  decision: string;
  reason: string;
  symbol: string | null;
  strategy: string | null;
  ravishScore: number;
  tradeId: number | null;
  alpacaOrderId: string | null;
  createdAt: string;
}

// `kind` filters the log to a single engine: "open" = full-auto opening engine,
// "adjust" = auto-adjustment engine. Omit to return both interleaved.
// `filters` narrows the rows server-side: `decision` (executed/skipped/rejected/
// blocked) and `symbol` (exact match). Both are optional and combine with AND.
export async function getAutoExecutionLog(
  limit = 50,
  kind?: "open" | "adjust",
  filters?: { decision?: string; symbol?: string },
): Promise<AutoLogRow[]> {
  const conditions = [
    kind ? eq(autoExecutionLogTable.kind, kind) : undefined,
    filters?.decision ? eq(autoExecutionLogTable.decision, filters.decision) : undefined,
    filters?.symbol ? eq(autoExecutionLogTable.symbol, filters.symbol) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(autoExecutionLogTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(autoExecutionLogTable.id))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    runId: r.runId,
    kind: r.kind,
    decision: r.decision,
    reason: r.reason,
    symbol: r.symbol,
    strategy: r.strategy,
    ravishScore: r.ravishScore,
    tradeId: r.tradeId,
    alpacaOrderId: r.alpacaOrderId,
    createdAt: r.createdAt.toISOString(),
  }));
}

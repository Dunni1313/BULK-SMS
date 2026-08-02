// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow.
//
// Two brand-new tables (see 045_ai_trading_coach.sql for the full
// reuse-audit rationale): ai_trading_coach_preferences (one row per user,
// durable across sessions) and ai_trading_coach_daily_state (one row per
// user per trading day, upserted on first read for "today", mirroring
// intelligence_snapshots' own upsert-on-read precedent). Deliberately kept
// outside the OpenAPI/orval typed contract and hand-validated, matching
// every other AI-coach-family route (aiCoachConversations.ts,
// aiWorkspaces.ts, aiNotebooks.ts, aiStrategies.ts, tradePlans.ts) — this
// avoids the same zod dependency-conflict risk Sprint 6 already disclosed
// when it tried routing OpenAPI codegen through this family of tables.
//
// GET /ai-trading-coach/state returns preferences + today's daily state +
// live market clock status (reused directly, unmodified, from
// lib/marketCalendar.ts's own getMarketClockStatus() — never re-derived
// here). This route computes and bundles persisted coach state only; the
// actual 11-step daily workflow model, its readiness signals, and its
// "what's the one next recommended action" logic all live in the frontend
// (src/lib/tradingCoachWorkflow.ts), which reads live data from each
// existing engine's own already-shipped hooks — nothing about a user's
// portfolio, trades, scans, or decisions is computed, cached, or
// duplicated in this table or this route.
//
// PATCH /ai-trading-coach/state mutates completedStepIds/skippedStepIds/
// noTradeReason for a caller-specified trading date (defaults to today,
// in America/New_York — the platform's one existing "trading day" concept,
// see todayTradingDateEt() below).
//
// PATCH /ai-trading-coach/preferences mutates experienceLevel/
// beginnerModeEnabled — the one genuinely new, durable persistence
// requirement this sprint's reuse audit found (see migration 045's own
// header comment for why no existing Settings field or component state
// could hold this).
//
// Every read/write is scoped via getScopedUserId(req); there is no 404
// path here since every resource is upsert-on-read/write, always exactly
// one row per (own user[, trading date]), never a separate resource id a
// caller could guess. Neither table nor this route is read or written by
// the auto-execution/auto-adjustment engines or their kill switch — this
// is a purely advisory, informational surface with no bearing on trade
// execution.

import { Router, type IRouter } from "express";
import { db, aiTradingCoachPreferencesTable, aiTradingCoachDailyStateTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getSettingsRow } from "../lib/serverState.js";
import { getMarketClockStatus } from "../lib/marketCalendar.js";

const router: IRouter = Router();

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "institutional"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === "string" && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

const TRADING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ET_TIME_ZONE = "America/New_York";

// The platform's one existing "trading day" concept — mirrors
// lib/marketCalendar.ts's own private ET_TIME_ZONE constant. No new
// per-user timezone field exists anywhere in this codebase; inventing one
// was explicitly out of this sprint's own scope (migration 045's header).
export function todayTradingDateEt(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // en-CA formats as YYYY-MM-DD
}

async function loadOrCreatePreferences(userId: string) {
  const existing = await db
    .select()
    .from(aiTradingCoachPreferencesTable)
    .where(eq(aiTradingCoachPreferencesTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(aiTradingCoachPreferencesTable).values({ userId }).returning();
  return created;
}

async function loadOrCreateDailyState(userId: string, tradingDate: string) {
  const existing = await db
    .select()
    .from(aiTradingCoachDailyStateTable)
    .where(
      and(
        eq(aiTradingCoachDailyStateTable.userId, userId),
        eq(aiTradingCoachDailyStateTable.tradingDate, tradingDate),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(aiTradingCoachDailyStateTable)
    .values({ userId, tradingDate })
    .returning();
  return created;
}

router.get("/ai-trading-coach/state", async (req, res) => {
  const userId = await getScopedUserId(req);
  const tradingDate = todayTradingDateEt();
  const [preferences, dailyState, settings] = await Promise.all([
    loadOrCreatePreferences(userId),
    loadOrCreateDailyState(userId, tradingDate),
    getSettingsRow(userId),
  ]);
  const marketClock = await getMarketClockStatus(settings.alpacaApiKey ?? null);
  res.json({ preferences, dailyState, marketClock, tradingDate });
});

router.patch("/ai-trading-coach/preferences", async (req, res) => {
  const userId = await getScopedUserId(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Partial<{ experienceLevel: ExperienceLevel; beginnerModeEnabled: boolean }> = {};

  if (body.experienceLevel !== undefined) {
    if (!isExperienceLevel(body.experienceLevel)) {
      res.status(400).json({ error: `experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(", ")}` });
      return;
    }
    updates.experienceLevel = body.experienceLevel;
  }
  if (body.beginnerModeEnabled !== undefined) {
    if (typeof body.beginnerModeEnabled !== "boolean") {
      res.status(400).json({ error: "beginnerModeEnabled must be a boolean" });
      return;
    }
    updates.beginnerModeEnabled = body.beginnerModeEnabled;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "at least one of experienceLevel, beginnerModeEnabled is required" });
    return;
  }

  await loadOrCreatePreferences(userId);
  const [updated] = await db
    .update(aiTradingCoachPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(aiTradingCoachPreferencesTable.userId, userId))
    .returning();
  res.json(updated);
});

router.patch("/ai-trading-coach/state", async (req, res) => {
  const userId = await getScopedUserId(req);
  const body = (req.body ?? {}) as Record<string, unknown>;

  let tradingDate = todayTradingDateEt();
  if (body.tradingDate !== undefined) {
    if (typeof body.tradingDate !== "string" || !TRADING_DATE_RE.test(body.tradingDate)) {
      res.status(400).json({ error: "tradingDate must be a YYYY-MM-DD string" });
      return;
    }
    tradingDate = body.tradingDate;
  }

  const updates: Partial<{ completedStepIds: string[]; skippedStepIds: string[]; noTradeReason: string | null }> = {};
  if (body.completedStepIds !== undefined) {
    if (!Array.isArray(body.completedStepIds) || !body.completedStepIds.every((v) => typeof v === "string")) {
      res.status(400).json({ error: "completedStepIds must be an array of strings" });
      return;
    }
    updates.completedStepIds = body.completedStepIds as string[];
  }
  if (body.skippedStepIds !== undefined) {
    if (!Array.isArray(body.skippedStepIds) || !body.skippedStepIds.every((v) => typeof v === "string")) {
      res.status(400).json({ error: "skippedStepIds must be an array of strings" });
      return;
    }
    updates.skippedStepIds = body.skippedStepIds as string[];
  }
  if (body.noTradeReason !== undefined) {
    if (body.noTradeReason !== null && typeof body.noTradeReason !== "string") {
      res.status(400).json({ error: "noTradeReason must be a string or null" });
      return;
    }
    updates.noTradeReason = body.noTradeReason as string | null;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "at least one of completedStepIds, skippedStepIds, noTradeReason is required" });
    return;
  }

  await loadOrCreateDailyState(userId, tradingDate);
  const [updated] = await db
    .update(aiTradingCoachDailyStateTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(aiTradingCoachDailyStateTable.userId, userId),
        eq(aiTradingCoachDailyStateTable.tradingDate, tradingDate),
      ),
    )
    .returning();
  res.json(updated);
});

export default router;

// Phase 36 — Institutional Position Lifecycle Manager.
//
// DETERMINISTIC PORTFOLIO MANAGEMENT WORKFLOWS ONLY. No live brokerage
// execution, no auto trading, no auto adjustments, no AI predictions, no
// direction forecasting, no position recommendations, no trade alerts, no
// automated rolling, no automated assignment handling. Every lifecycle
// stage transition, review log entry, adjustment journal entry, and
// assignment note is an explicit user action recorded here — nothing in
// this file changes a stage, schedules a reminder, or fires a
// notification on its own.
//
// Position Timeline / Position History / Adjustment Journal / Assignment
// Tracker are all filtered views over one append-only event log
// (options_lifecycle_events) — zero duplicated storage, zero duplicated
// query logic.

import { db, tradesTable, optionsLifecycleStateTable, optionsLifecycleEventsTable, optionsPositionChecklistsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { instantiateChecklistItems } from "./optionsLifecycleChecklists.js";

export const LIFECYCLE_STAGES = ["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const REVIEW_CADENCES = ["daily", "weekly", "monthly", "expiration", "manual"] as const;
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];

export const LIFECYCLE_EVENT_TYPES = ["stage_change", "review", "adjustment_note", "assignment_note"] as const;
export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPES)[number];

function isLifecycleStage(v: string): v is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly string[]).includes(v);
}
function isReviewCadence(v: string): v is ReviewCadence {
  return (REVIEW_CADENCES as readonly string[]).includes(v);
}

async function ownedTrade(userId: string, tradeId: number) {
  const [row] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, userId)));
  return row ?? null;
}

// Drizzle's `timestamp(...)` columns (no `{ mode: "string" }`) round-trip
// as real JS `Date` objects, not strings — every OpenAPI-validated
// response schema for these tables declares createdAt/updatedAt as
// `string`, matching the established convention already used by
// routes/tradingStrategyChecklists.ts's own row mapping. These small
// serializers are the one place that conversion happens, so every route
// below returns an already-well-shaped object without repeating it.
function serializeState<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function serializeEvent<T extends { createdAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
function serializeChecklist<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function getLifecycleState(userId: string, tradeId: number) {
  const trade = await ownedTrade(userId, tradeId);
  if (!trade) return null;
  const [state] = await db
    .select()
    .from(optionsLifecycleStateTable)
    .where(and(eq(optionsLifecycleStateTable.tradeId, tradeId), eq(optionsLifecycleStateTable.userId, userId)));
  return state ? serializeState(state) : null;
}

// Honest default stage for a position with no explicit lifecycle state
// recorded yet — never fabricated "draft" for a real, already-open trade;
// reflects the trade's own real `status` column.
export function defaultStageFor(tradeStatus: string): LifecycleStage {
  if (tradeStatus === "closed") return "closed";
  if (tradeStatus === "cancelled" || tradeStatus === "rejected") return "draft";
  return "open";
}

export async function getOrCreateLifecycleState(userId: string, tradeId: number) {
  const trade = await ownedTrade(userId, tradeId);
  if (!trade) return null;
  const existing = await getLifecycleState(userId, tradeId);
  if (existing) return existing;
  const [created] = await db
    .insert(optionsLifecycleStateTable)
    .values({ userId, tradeId, stage: defaultStageFor(trade.status), reviewCadence: "manual" })
    .returning();
  return created ? serializeState(created) : null;
}

export async function setLifecycleStage(userId: string, tradeId: number, stage: string) {
  if (!isLifecycleStage(stage)) return null;
  const existing = await getOrCreateLifecycleState(userId, tradeId);
  if (!existing) return null;
  const [updated] = await db
    .update(optionsLifecycleStateTable)
    .set({ stage })
    .where(and(eq(optionsLifecycleStateTable.tradeId, tradeId), eq(optionsLifecycleStateTable.userId, userId)))
    .returning();
  await db.insert(optionsLifecycleEventsTable).values({
    userId,
    tradeId,
    eventType: "stage_change",
    stage,
    detail: `Stage set to ${stage}.`,
  });
  return updated ? serializeState(updated) : null;
}

export async function setReviewCadence(userId: string, tradeId: number, cadence: string) {
  if (!isReviewCadence(cadence)) return null;
  const existing = await getOrCreateLifecycleState(userId, tradeId);
  if (!existing) return null;
  const [updated] = await db
    .update(optionsLifecycleStateTable)
    .set({ reviewCadence: cadence })
    .where(and(eq(optionsLifecycleStateTable.tradeId, tradeId), eq(optionsLifecycleStateTable.userId, userId)))
    .returning();
  return updated ? serializeState(updated) : null;
}

async function logEvent(userId: string, tradeId: number, eventType: LifecycleEventType, detail: string, extra: { reviewType?: string } = {}) {
  const trade = await ownedTrade(userId, tradeId);
  if (!trade) return null;
  const [created] = await db
    .insert(optionsLifecycleEventsTable)
    .values({ userId, tradeId, eventType, detail, reviewType: extra.reviewType ?? null })
    .returning();
  return created ? serializeEvent(created) : null;
}

export async function logReview(userId: string, tradeId: number, reviewType: string, detail: string) {
  if (!isReviewCadence(reviewType)) return null;
  return logEvent(userId, tradeId, "review", detail, { reviewType });
}

export async function logAdjustmentNote(userId: string, tradeId: number, detail: string) {
  return logEvent(userId, tradeId, "adjustment_note", detail);
}

export async function logAssignmentNote(userId: string, tradeId: number, detail: string) {
  return logEvent(userId, tradeId, "assignment_note", detail);
}

// Position Timeline / Position History — the full, unfiltered event log
// for one position, newest first. Adjustment Journal and Assignment
// Tracker are the same data, filtered client-side (or via the
// eventType query param on the route) by eventType — never a second
// query path.
export async function getPositionTimeline(userId: string, tradeId: number) {
  const trade = await ownedTrade(userId, tradeId);
  if (!trade) return null;
  const rows = await db
    .select()
    .from(optionsLifecycleEventsTable)
    .where(and(eq(optionsLifecycleEventsTable.tradeId, tradeId), eq(optionsLifecycleEventsTable.userId, userId)))
    .orderBy(desc(optionsLifecycleEventsTable.createdAt));
  return rows.map(serializeEvent);
}

export async function getOrCreateChecklist(userId: string, tradeId: number, strategyKey: string) {
  const trade = await ownedTrade(userId, tradeId);
  if (!trade) return null;
  const [existing] = await db
    .select()
    .from(optionsPositionChecklistsTable)
    .where(and(eq(optionsPositionChecklistsTable.tradeId, tradeId), eq(optionsPositionChecklistsTable.userId, userId)));
  if (existing) return serializeChecklist(existing);
  const items = instantiateChecklistItems(strategyKey);
  if (!items) return null;
  const [created] = await db.insert(optionsPositionChecklistsTable).values({ userId, tradeId, strategyKey, items }).returning();
  return created ? serializeChecklist(created) : null;
}

export async function toggleChecklistItem(userId: string, tradeId: number, itemId: string, checked: boolean) {
  const [existing] = await db
    .select()
    .from(optionsPositionChecklistsTable)
    .where(and(eq(optionsPositionChecklistsTable.tradeId, tradeId), eq(optionsPositionChecklistsTable.userId, userId)));
  if (!existing) return null;
  const nextItems = existing.items.map((i) => (i.id === itemId ? { ...i, checked } : i));
  const [updated] = await db
    .update(optionsPositionChecklistsTable)
    .set({ items: nextItems })
    .where(and(eq(optionsPositionChecklistsTable.tradeId, tradeId), eq(optionsPositionChecklistsTable.userId, userId)))
    .returning();
  return updated ? serializeChecklist(updated) : null;
}

// ─── Portfolio-wide composition ────────────────────────────────────────────

export interface LifecycleSummaryEntry {
  stage: LifecycleStage;
  count: number;
}

export interface LifecycleSummary {
  totalPositions: number;
  byStage: LifecycleSummaryEntry[];
  positionsAwaitingReview: number;
}

// Position Lifecycle Summary — every real trades row tallied by its own
// current lifecycle stage (an explicit state row when one exists, else
// the honest default derived from the trade's own real status). Zero
// fabricated stage.
export async function buildLifecycleSummary(userId: string): Promise<LifecycleSummary> {
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
  const states = await db.select().from(optionsLifecycleStateTable).where(eq(optionsLifecycleStateTable.userId, userId));
  const stateByTradeId = new Map(states.map((s) => [s.tradeId, s]));

  const counts = new Map<LifecycleStage, number>();
  for (const stage of LIFECYCLE_STAGES) counts.set(stage, 0);
  let awaitingReview = 0;
  for (const trade of trades) {
    const state = stateByTradeId.get(trade.id);
    const stage = state && isLifecycleStage(state.stage) ? state.stage : defaultStageFor(trade.status);
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
    if (stage === "monitoring" || stage === "near_expiration" || stage === "assignment_risk") awaitingReview++;
  }

  return {
    totalPositions: trades.length,
    byStage: LIFECYCLE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 })),
    positionsAwaitingReview: awaitingReview,
  };
}

export interface ExposureTimelinePoint {
  monthEnd: string; // YYYY-MM-DD
  openPositionsCount: number;
  byStrategy: { strategy: string; count: number }[];
}

// Portfolio Exposure Timeline — a deterministic reconstruction of what
// was actually open at each trailing month-end, from each real trade's
// own openDate/closeDate. Never a fabricated snapshot, never a forecast
// — a position only counts at a given month-end if its own real
// openDate is on/before that date and its own real closeDate is
// null/after that date.
export async function buildPortfolioExposureTimeline(userId: string, months = 6, asOf: Date = new Date()): Promise<ExposureTimelinePoint[]> {
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));

  const points: ExposureTimelinePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i + 1, 0)); // last day of that month
    const openAtBucket = trades.filter((t) => {
      if (!t.openDate) return false;
      const opened = new Date(t.openDate) <= bucket;
      const stillOpen = !t.closeDate || new Date(t.closeDate) > bucket;
      return opened && stillOpen;
    });
    const byStrategy = new Map<string, number>();
    for (const t of openAtBucket) byStrategy.set(t.strategy, (byStrategy.get(t.strategy) ?? 0) + 1);
    points.push({
      monthEnd: bucket.toISOString().slice(0, 10),
      openPositionsCount: openAtBucket.length,
      byStrategy: [...byStrategy.entries()].map(([strategy, count]) => ({ strategy, count })),
    });
  }
  return points;
}

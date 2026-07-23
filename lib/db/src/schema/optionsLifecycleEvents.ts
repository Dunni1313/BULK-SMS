import { pgTable, serial, uuid, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradesTable } from "./trades";

// Phase 36 — Institutional Position Lifecycle Manager.
//
// An append-only event log, one row per user-recorded action for a
// position: a stage change, a scheduled/manual review, an adjustment
// journal entry, or an assignment-risk note. This single table backs
// Position Timeline, Position History, Adjustment Journal, and Assignment
// Tracker as filtered views (eventType) over the same data — never a
// separate table per feature, and never an automatically-generated event.
//
// tradeId uses the same real ON DELETE CASCADE relationship as
// options_lifecycle_state (a genuine sub-resource of its own trade).
// userId is mandatory + ON DELETE RESTRICT, matching every other
// user-scoped table.
export const optionsLifecycleEventsTable = pgTable(
  "options_lifecycle_events",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => tradesTable.id, { onDelete: "cascade" }),
    // "stage_change" | "review" | "adjustment_note" | "assignment_note"
    eventType: text("event_type").notNull(),
    // Only populated for "stage_change" events — the stage the position
    // was moved to.
    stage: text("stage"),
    // Only populated for "review" events — "daily" | "weekly" | "monthly"
    // | "expiration" | "manual".
    reviewType: text("review_type"),
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("options_lifecycle_events_user_id_idx").on(table.userId),
    index("options_lifecycle_events_trade_id_idx").on(table.tradeId),
  ],
);

export const insertOptionsLifecycleEventSchema = createInsertSchema(optionsLifecycleEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOptionsLifecycleEvent = z.infer<typeof insertOptionsLifecycleEventSchema>;
export type OptionsLifecycleEventRow = typeof optionsLifecycleEventsTable.$inferSelect;

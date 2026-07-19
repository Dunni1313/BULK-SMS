import { pgTable, serial, uuid, text, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56). In-app notification center, per the project owner's own
// kickoff decision (see manual-migrations/014_platform_notifications.sql
// for the full rationale). Brand-new table, NOT NULL from creation, no
// backfill needed. userId mandatory + ON DELETE RESTRICT, matching every
// other user-scoped table's convention.
//
// dedupKey + the partial unique index (only enforced while isRead=false)
// prevent alert spam: at most one unread notification can exist per
// (userId, dedupKey) at a time.
//
// Phase 16 — Institutional Monitoring & Alerts Engine. Five additive
// columns (severity/previousValue/currentValue/evidence/recommendedAction)
// so every alert — old and new alert types alike — can honestly carry the
// full Reason/Evidence/Previous/Current/Severity/Recommended-Action shape
// this phase requires. `severity` defaults to "info" (a safe, honest
// default for the two pre-existing alert types, which are re-populated
// with a real severity going forward — never retroactively rewritten for
// old rows). The other four stay nullable: a value is supplied only when
// it's a genuine, non-fabricated fact about that specific alert.
export const platformNotificationsTable = pgTable(
  "platform_notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    // Deliberately no default — every alert-generating call site must state
    // its data source explicitly, satisfying this sprint's own "no alert is
    // ever sent for SIMULATED data without being labeled as such" criterion.
    dataSource: text("data_source").notNull(),
    relatedSymbol: text("related_symbol"),
    dedupKey: text("dedup_key").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    severity: text("severity").notNull().default("info"), // "info" | "warning" | "critical"
    previousValue: text("previous_value"),
    currentValue: text("current_value"),
    evidence: jsonb("evidence"), // string[] — quotes real, already-computed facts, never fabricated
    recommendedAction: text("recommended_action"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_notifications_user_id_idx").on(table.userId),
    uniqueIndex("platform_notifications_active_dedup_idx")
      .on(table.userId, table.dedupKey)
      .where(sql`${table.isRead} = false`),
  ],
);

export const insertPlatformNotificationSchema = createInsertSchema(platformNotificationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlatformNotification = z.infer<typeof insertPlatformNotificationSchema>;
export type PlatformNotificationRow = typeof platformNotificationsTable.$inferSelect;

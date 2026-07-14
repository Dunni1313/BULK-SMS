import { pgTable, serial, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
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

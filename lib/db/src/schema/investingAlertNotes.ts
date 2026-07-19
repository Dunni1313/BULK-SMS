import { pgTable, serial, uuid, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 16 — Institutional Monitoring & Alerts Engine. A plain, free-text,
// per-user note attached to a specific alert (platform_notifications row) —
// mirrors investing_decision_notes/investing_research_notes exactly.
// `notificationId` is a loose, unenforced reference (no foreign key),
// matching journal_entries.trade_id's and investing_decision_notes'
// tradingPositionId's own established precedent — a note survives even if
// the underlying notification is later deleted or was never a "real" row
// (defensive, not expected in practice since notifications are never
// deleted today, only marked read).
export const investingAlertNotesTable = pgTable(
  "investing_alert_notes",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    notificationId: integer("notification_id"),
    symbol: text("symbol"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_alert_notes_user_id_idx").on(table.userId),
    index("investing_alert_notes_notification_id_idx").on(table.notificationId),
  ],
);

export const insertInvestingAlertNoteSchema = createInsertSchema(investingAlertNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingAlertNote = z.infer<typeof insertInvestingAlertNoteSchema>;
export type InvestingAlertNoteRow = typeof investingAlertNotesTable.$inferSelect;

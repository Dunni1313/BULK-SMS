import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation. Mirrors
// aiMessages.ts's own shape exactly (see manual migration
// 037_trading_coach_messages.sql for the full rationale on why this is a
// new, dedicated table rather than a reuse of ai_messages itself).
export const tradingCoachMessagesTable = pgTable("trading_coach_messages", {
  id: serial("id").primaryKey(),
  // ON DELETE RESTRICT: deleting a user must never silently delete their
  // coach conversation history, matching every other user-scoped table.
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  role: text("role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("trading_coach_messages_user_id_idx").on(table.userId),
]);

export const insertTradingCoachMessageSchema = createInsertSchema(tradingCoachMessagesTable).omit({ id: true, createdAt: true });
export type InsertTradingCoachMessage = z.infer<typeof insertTradingCoachMessageSchema>;
export type TradingCoachMessage = typeof tradingCoachMessagesTable.$inferSelect;

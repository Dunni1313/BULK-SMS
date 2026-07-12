import { pgTable, serial, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiMessagesTable = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 3 — nullable multi-tenancy anchor. Not yet backfilled,
  // enforced, or read/written by any route (see the approved Phase 1 plan §2.5).
  userId: uuid("user_id"),
  role: text("role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessagesTable).omit({ id: true, createdAt: true });
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessagesTable.$inferSelect;

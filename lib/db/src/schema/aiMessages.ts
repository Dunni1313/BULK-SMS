import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiMessagesTable = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessagesTable).omit({ id: true, createdAt: true });
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessagesTable.$inferSelect;

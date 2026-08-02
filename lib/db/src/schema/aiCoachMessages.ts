// v1.5.0, Sprint 6 — AI Coach Memory. See manual migration
// 039_ai_coach_conversations.sql for the full rationale. Stores only the
// final, already-narrated question/answer text of a completed turn — never
// an internal system prompt, a tool/grounding-context payload, or a secret.
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiCoachConversationsTable } from "./aiCoachConversations";

export const aiCoachMessagesTable = pgTable(
  "ai_coach_messages",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a message has no meaning independent of its
    // conversation — deleting the conversation deletes its own messages
    // outright, the same precedent as investing_holdings ->
    // investing_portfolios (Phase 13).
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => aiCoachConversationsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_coach_messages_conversation_idx").on(table.conversationId, table.createdAt)],
);

export const insertAiCoachMessageSchema = createInsertSchema(aiCoachMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiCoachMessage = z.infer<typeof insertAiCoachMessageSchema>;
export type AiCoachMessage = typeof aiCoachMessagesTable.$inferSelect;

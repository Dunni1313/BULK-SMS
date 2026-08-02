// v1.5.0, Sprint 6 — AI Coach Memory. See manual migration
// 039_ai_coach_conversations.sql for the full rationale (neither
// ai_messages nor trading_coach_messages supports multi-conversation
// grouping, and the latter belongs to the separate, out-of-scope "AI
// Trading Assistant" feature).
//
// coachId is deliberately free text, not a Postgres enum — restricted at
// the application layer to "trading" | "investing" | "options" (see
// artifacts/api-server/src/routes/aiCoachConversations.ts's own
// COACH_IDS), matching this codebase's established free-text-discriminator
// convention (e.g. investing_filing_analysis.filing_type).
import { pgTable, serial, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const aiCoachConversationsTable = pgTable(
  "ai_coach_conversations",
  {
    id: serial("id").primaryKey(),
    // ON DELETE RESTRICT: deleting a user must never silently delete their
    // coach conversation history, matching every other user-scoped table.
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    coachId: text("coach_id").notNull(),
    title: text("title").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_coach_conversations_user_coach_idx").on(table.userId, table.coachId, table.updatedAt)],
);

export const insertAiCoachConversationSchema = createInsertSchema(aiCoachConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiCoachConversation = z.infer<typeof insertAiCoachConversationSchema>;
export type AiCoachConversation = typeof aiCoachConversationsTable.$inferSelect;

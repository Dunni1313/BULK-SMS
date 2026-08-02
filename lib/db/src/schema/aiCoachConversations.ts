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
//
// v1.5.0, Sprint 7 — AI Workspaces (manual migration 040_ai_workspaces.sql)
// added two small, additive columns on top of this unchanged shape:
// workspaceId (nullable — optional workspace membership, never required,
// so every pre-Sprint-7 conversation keeps working identically) and
// favourite (a plain per-conversation flag, independent of workspace
// membership). Neither column changes any pre-existing row's behavior.
import { pgTable, serial, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { aiWorkspacesTable } from "./aiWorkspaces";

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
    // Sprint 7 — nullable: a conversation may or may not belong to a
    // workspace. ON DELETE SET NULL: deleting a workspace detaches its
    // conversations rather than destroying their history (see migration
    // 040's own header comment for the full rationale).
    workspaceId: integer("workspace_id").references(() => aiWorkspacesTable.id, { onDelete: "set null" }),
    // Sprint 7 — independent of workspace membership.
    favourite: boolean("favourite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_coach_conversations_user_coach_idx").on(table.userId, table.coachId, table.updatedAt),
    index("ai_coach_conversations_workspace_idx").on(table.workspaceId),
  ],
);

export const insertAiCoachConversationSchema = createInsertSchema(aiCoachConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiCoachConversation = z.infer<typeof insertAiCoachConversationSchema>;
export type AiCoachConversation = typeof aiCoachConversationsTable.$inferSelect;

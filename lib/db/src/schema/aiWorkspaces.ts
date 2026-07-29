// v1.5.0, Sprint 7 — AI Workspaces. See manual migration
// 040_ai_workspaces.sql for the full rationale. coachId is deliberately
// free text, restricted at the application layer to the same three coach
// ids Sprint 6's ai_coach_conversations already established (see
// artifacts/api-server/src/routes/aiCoachConversations.ts's own COACH_IDS,
// reused directly by routes/aiWorkspaces.ts, never redefined).
import { pgTable, serial, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const aiWorkspacesTable = pgTable(
  "ai_workspaces",
  {
    id: serial("id").primaryKey(),
    // ON DELETE RESTRICT: deleting a user must never silently delete their
    // workspaces, matching every other user-scoped table.
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    coachId: text("coach_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_workspaces_user_coach_idx").on(table.userId, table.coachId, table.updatedAt)],
);

export const insertAiWorkspaceSchema = createInsertSchema(aiWorkspacesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiWorkspace = z.infer<typeof insertAiWorkspaceSchema>;
export type AiWorkspace = typeof aiWorkspacesTable.$inferSelect;

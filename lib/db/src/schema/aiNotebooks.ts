// v1.5.0, Sprint 8 — AI Research Notebooks. See manual migration
// 041_ai_notebooks.sql for the full rationale (workspace_id nullable +
// SET NULL, mirroring ai_coach_conversations.workspace_id's own Sprint 7
// precedent rather than ai_workspace_files/notes' own CASCADE; version is
// a basic monotonic counter, not full snapshot history).
//
// coachId is deliberately free text, not a Postgres enum — restricted at
// the application layer to "trading" | "investing" | "options" (see
// artifacts/api-server/src/routes/aiNotebooks.ts's own COACH_IDS, reused
// directly from aiCoachConversations.ts, not redefined), matching this
// codebase's established free-text-discriminator convention.
import { pgTable, serial, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { aiWorkspacesTable } from "./aiWorkspaces";

export const aiNotebooksTable = pgTable(
  "ai_notebooks",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    // Nullable: a notebook may or may not belong to a workspace.
    // ON DELETE SET NULL: deleting a workspace detaches its notebooks
    // rather than destroying accumulated research (see migration 041's
    // own header comment for the full rationale).
    workspaceId: integer("workspace_id").references(() => aiWorkspacesTable.id, { onDelete: "set null" }),
    coachId: text("coach_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    tags: text("tags").array().notNull().default([]),
    // "Version history (basic)" — a monotonic counter bumped on every
    // title/description edit, not a full diffable snapshot history.
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_notebooks_user_coach_idx").on(table.userId, table.coachId, table.updatedAt),
    index("ai_notebooks_workspace_idx").on(table.workspaceId),
  ],
);

export const insertAiNotebookSchema = createInsertSchema(aiNotebooksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiNotebook = z.infer<typeof insertAiNotebookSchema>;
export type AiNotebook = typeof aiNotebooksTable.$inferSelect;

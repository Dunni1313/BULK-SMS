// v1.5.0, Sprint 7 — AI Workspaces. See manual migration
// 040_ai_workspaces.sql for the full rationale. File REFERENCES only — a
// name plus an external URL/note — this codebase has no binary
// file-upload/storage infrastructure anywhere; never a fabricated upload
// capability. No user_id — ownership is transitively via workspace_id ->
// ai_workspaces.user_id, the same no-redundant-denormalization pattern
// ai_coach_messages already established relative to
// ai_coach_conversations.user_id (Sprint 6).
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiWorkspacesTable } from "./aiWorkspaces";

export const aiWorkspaceFilesTable = pgTable(
  "ai_workspace_files",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a file reference has no meaning independent of
    // the workspace it was attached to, the same precedent as
    // ai_coach_messages -> ai_coach_conversations (Sprint 6).
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => aiWorkspacesTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_workspace_files_workspace_idx").on(table.workspaceId)],
);

export const insertAiWorkspaceFileSchema = createInsertSchema(aiWorkspaceFilesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiWorkspaceFile = z.infer<typeof insertAiWorkspaceFileSchema>;
export type AiWorkspaceFile = typeof aiWorkspaceFilesTable.$inferSelect;

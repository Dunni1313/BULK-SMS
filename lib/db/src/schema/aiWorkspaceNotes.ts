// v1.5.0, Sprint 7 — AI Workspaces. See manual migration
// 040_ai_workspaces.sql for the full rationale. One kind-discriminated
// table for quick notes, saved AI summaries, saved conclusions, and saved
// action items — all the same {kind, content} shape, so this is the
// smallest schema that satisfies all four "Research Features" bullet
// points, not four separate tables. No user_id — ownership is
// transitively via workspaceId -> ai_workspaces.userId, the same
// no-redundant-denormalization pattern ai_coach_messages already
// established relative to ai_coach_conversations.userId (Sprint 6).
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiWorkspacesTable } from "./aiWorkspaces";

export const AI_WORKSPACE_NOTE_KINDS = ["note", "summary", "conclusion", "action_item"] as const;
export type AiWorkspaceNoteKind = (typeof AI_WORKSPACE_NOTE_KINDS)[number];

export const aiWorkspaceNotesTable = pgTable(
  "ai_workspace_notes",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a note has no meaning independent of its
    // workspace, the same precedent as ai_coach_messages ->
    // ai_coach_conversations (Sprint 6).
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => aiWorkspacesTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_workspace_notes_workspace_idx").on(table.workspaceId, table.createdAt)],
);

export const insertAiWorkspaceNoteSchema = createInsertSchema(aiWorkspaceNotesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiWorkspaceNote = z.infer<typeof insertAiWorkspaceNoteSchema>;
export type AiWorkspaceNote = typeof aiWorkspaceNotesTable.$inferSelect;

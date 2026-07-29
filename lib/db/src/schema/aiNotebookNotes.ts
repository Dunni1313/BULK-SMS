// v1.5.0, Sprint 8 — AI Research Notebooks. See manual migration
// 041_ai_notebooks.sql for the full rationale. One kind-discriminated
// table for rich-text notes, AI-generated summaries, key findings, action
// items, references, and saved AI responses — the smallest schema that
// satisfies every "Each notebook contains" bullet point without a
// separate table per kind. No user_id — ownership is transitively via
// notebookId -> ai_notebooks.userId, the same no-redundant-denormalization
// pattern ai_workspace_notes already established relative to
// ai_workspaces.userId (Sprint 7).
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiNotebooksTable } from "./aiNotebooks";

export const NOTEBOOK_NOTE_KINDS = ["note", "summary", "finding", "action_item", "reference", "saved_response"] as const;
export type NotebookNoteKind = (typeof NOTEBOOK_NOTE_KINDS)[number];

export const aiNotebookNotesTable = pgTable(
  "ai_notebook_notes",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a note has no meaning independent of its
    // notebook, the same precedent as ai_workspace_notes ->
    // ai_workspaces (Sprint 7).
    notebookId: integer("notebook_id")
      .notNull()
      .references(() => aiNotebooksTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_notebook_notes_notebook_idx").on(table.notebookId, table.createdAt)],
);

export const insertAiNotebookNoteSchema = createInsertSchema(aiNotebookNotesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiNotebookNote = z.infer<typeof insertAiNotebookNoteSchema>;
export type AiNotebookNote = typeof aiNotebookNotesTable.$inferSelect;

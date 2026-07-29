// v1.5.0, Sprint 8 — AI Research Notebooks. See manual migration
// 041_ai_notebooks.sql for the full rationale. "Linked conversations" and
// "Linked uploaded files (references only)" in ONE table (matching the
// approved scope's own literal "Notebook links" naming), discriminated by
// linkType with two nullable target-id columns — exactly one populated
// per row, enforced by a DB CHECK constraint (migration 041) — rather than
// a single untyped/unenforced generic reference, preserving real
// foreign-key integrity to both ai_coach_conversations and
// ai_workspace_files. No user_id — ownership is transitively via
// notebookId -> ai_notebooks.userId, the same pattern
// ai_notebook_notes/ai_workspace_notes already established.
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiNotebooksTable } from "./aiNotebooks";
import { aiCoachConversationsTable } from "./aiCoachConversations";
import { aiWorkspaceFilesTable } from "./aiWorkspaceFiles";

export const NOTEBOOK_LINK_TYPES = ["conversation", "file"] as const;
export type NotebookLinkType = (typeof NOTEBOOK_LINK_TYPES)[number];

export const aiNotebookLinksTable = pgTable(
  "ai_notebook_links",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a link has no meaning without its notebook, the
    // same precedent as ai_notebook_notes -> ai_notebooks.
    notebookId: integer("notebook_id")
      .notNull()
      .references(() => aiNotebooksTable.id, { onDelete: "cascade" }),
    linkType: text("link_type").notNull(),
    // ON DELETE CASCADE from whichever target it points to — a link to a
    // since-deleted conversation or file reference is meaningless and
    // should never dangle.
    conversationId: integer("conversation_id").references(() => aiCoachConversationsTable.id, { onDelete: "cascade" }),
    fileId: integer("file_id").references(() => aiWorkspaceFilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_notebook_links_notebook_idx").on(table.notebookId)],
);

export const insertAiNotebookLinkSchema = createInsertSchema(aiNotebookLinksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiNotebookLink = z.infer<typeof insertAiNotebookLinkSchema>;
export type AiNotebookLink = typeof aiNotebookLinksTable.$inferSelect;

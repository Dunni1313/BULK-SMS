// v1.5.0, Sprint 9 — AI Strategy Builder. See manual migration
// 042_ai_strategies.sql for the full rationale. One table discriminated by
// `kind`, covering every approved-scope strategy section — 14 singleton
// qualitative sections (Market Context through AI Notes) plus 3
// many-per-strategy reference kinds (Attachments, Research Links, Notebook
// References), the latter carrying a REAL typed foreign-key reference
// (refNotebookId/refConversationId/refFileId) rather than an untyped
// generic pointer, mirroring ai_notebook_links' own real-FK-integrity
// precedent from Sprint 8. Singleton-ness for the 14 qualitative kinds is
// enforced by a partial unique index in the migration itself (Drizzle's
// schema definition here is a query-builder shape only, per this
// codebase's own "hand-written SQL, not drizzle-kit push" convention —
// see CLAUDE.md rule 7); it is not re-expressed here.
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiStrategiesTable } from "./aiStrategies";
import { aiNotebooksTable } from "./aiNotebooks";
import { aiCoachConversationsTable } from "./aiCoachConversations";
import { aiWorkspaceFilesTable } from "./aiWorkspaceFiles";

export const STRATEGY_SECTION_KINDS = [
  "market_context",
  "setup",
  "checklist",
  "entry",
  "stop",
  "targets",
  "risk",
  "position_size",
  "trade_management",
  "exit_rules",
  "invalidation",
  "common_mistakes",
  "psychology_notes",
  "ai_notes",
  "attachment",
  "research_link",
  "notebook_reference",
] as const;
export type StrategySectionKind = (typeof STRATEGY_SECTION_KINDS)[number];

// The 3 kinds excluded from the DB's own singleton unique index — a
// strategy may have many of each.
export const MULTI_STRATEGY_SECTION_KINDS = ["attachment", "research_link", "notebook_reference"] as const;

export const aiStrategySectionsTable = pgTable(
  "ai_strategy_sections",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a section has no meaning without its strategy,
    // the same precedent as ai_notebook_notes -> ai_notebooks.
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => aiStrategiesTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content"),
    // ON DELETE SET NULL from whichever target it points to — deleting a
    // linked notebook/conversation/file leaves an honest, still-visible
    // "reference no longer available" row rather than silently vanishing
    // content the user wrote alongside it.
    refNotebookId: integer("ref_notebook_id").references(() => aiNotebooksTable.id, { onDelete: "set null" }),
    refConversationId: integer("ref_conversation_id").references(() => aiCoachConversationsTable.id, { onDelete: "set null" }),
    refFileId: integer("ref_file_id").references(() => aiWorkspaceFilesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_strategy_sections_strategy_idx").on(table.strategyId)],
);

export const insertAiStrategySectionSchema = createInsertSchema(aiStrategySectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiStrategySection = z.infer<typeof insertAiStrategySectionSchema>;
export type AiStrategySection = typeof aiStrategySectionsTable.$inferSelect;

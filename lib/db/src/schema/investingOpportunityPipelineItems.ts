import { pgTable, serial, uuid, text, jsonb, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built as
// a distinctly-named "Opportunity Pipeline" — see
// docs/v1.5.0-Sprint-21-Opportunity-Discovery-Engine.md §1 for the
// disclosed naming-collision reasoning against the pre-existing Phase 15
// Opportunity Discovery scanner). Persists only a user's own explicitly
// CAPTURED opportunities and their pipeline stage — the discovery
// computation itself is always recomputed fresh, never stored here, the
// same discipline investing_saved_screens (Phase 15) already established.
//
// Brand-new table: NOT NULL from creation, no backfill needed. userId is
// mandatory + ON DELETE RESTRICT, matching every other per-user table's
// convention. linkedNotebookId is a loose, unenforced reference (mirrors
// journal_entries.trade_id/trading_journal_entries.trading_position_id) —
// points at an existing AI Coach Notebook created via the Research
// Workspace's own workflow, never a second research artifact.
export const investingOpportunityPipelineItemsTable = pgTable(
  "investing_opportunity_pipeline_items",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    origin: text("origin").notNull(),
    evidenceJson: jsonb("evidence_json").notNull().$type<string[]>(),
    relatedAssetsJson: jsonb("related_assets_json").notNull().$type<string[]>(),
    relatedSectorsJson: jsonb("related_sectors_json").notNull().$type<string[]>(),
    priority: text("priority").notNull(),
    stage: text("stage").notNull().default("discovered"),
    linkedNotebookId: integer("linked_notebook_id"),
    relatedResearchSymbol: text("related_research_symbol"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [index("investing_opportunity_pipeline_items_user_id_idx").on(table.userId)],
);

export const insertInvestingOpportunityPipelineItemSchema = createInsertSchema(
  investingOpportunityPipelineItemsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvestingOpportunityPipelineItem = z.infer<typeof insertInvestingOpportunityPipelineItemSchema>;
export type InvestingOpportunityPipelineItemRow = typeof investingOpportunityPipelineItemsTable.$inferSelect;

// v1.5.0, Sprint 10 — Institutional Trade Planner. See manual migration
// 043_trade_plans.sql for the full rationale. One table discriminated by
// `kind`, covering every approved-scope Trade Plan section — 18 singleton
// sections (Market Context through Personal Notes) plus 3 many-per-plan
// reference kinds (Attachments, Research References, Notebook References —
// the last also covering AI Conversation references), mirroring
// ai_strategy_sections' own kind-discriminated design exactly. Singleton-
// ness for the 18 qualitative kinds is enforced by a partial unique index
// in the migration itself (Drizzle's schema definition here is a
// query-builder shape only, per CLAUDE.md rule 7); it is not re-expressed
// here.
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradePlansTable } from "./tradePlans";
import { aiNotebooksTable } from "./aiNotebooks";
import { aiCoachConversationsTable } from "./aiCoachConversations";
import { aiWorkspaceFilesTable } from "./aiWorkspaceFiles";

export const TRADE_PLAN_SECTION_KINDS = [
  "market_context",
  "trade_thesis",
  "bias",
  "catalysts",
  "entry_zone",
  "confirmation_rules",
  "invalidation",
  "stop_loss",
  "target_1",
  "target_2",
  "target_3",
  "risk_reward",
  "maximum_risk",
  "position_size_notes",
  "trade_management",
  "exit_plan",
  "psychology_checklist",
  "personal_notes",
  "attachment",
  "research_reference",
  "notebook_reference",
] as const;
export type TradePlanSectionKind = (typeof TRADE_PLAN_SECTION_KINDS)[number];

// The 3 kinds excluded from the DB's own singleton unique index — a plan
// may have many of each.
export const MULTI_TRADE_PLAN_SECTION_KINDS = ["attachment", "research_reference", "notebook_reference"] as const;

export const tradePlanSectionsTable = pgTable(
  "trade_plan_sections",
  {
    id: serial("id").primaryKey(),
    // ON DELETE CASCADE: a section has no meaning without its plan, the
    // same precedent as ai_strategy_sections -> ai_strategies.
    tradePlanId: integer("trade_plan_id")
      .notNull()
      .references(() => tradePlansTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content"),
    // Populated only for the notebook_reference kind.
    refNotebookId: integer("ref_notebook_id").references(() => aiNotebooksTable.id, { onDelete: "set null" }),
    refConversationId: integer("ref_conversation_id").references(() => aiCoachConversationsTable.id, { onDelete: "set null" }),
    // Populated only for the attachment kind.
    refFileId: integer("ref_file_id").references(() => aiWorkspaceFilesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trade_plan_sections_trade_plan_idx").on(table.tradePlanId)],
);

export const insertTradePlanSectionSchema = createInsertSchema(tradePlanSectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradePlanSection = z.infer<typeof insertTradePlanSectionSchema>;
export type TradePlanSection = typeof tradePlanSectionsTable.$inferSelect;

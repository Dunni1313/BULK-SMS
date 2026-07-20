import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradingStrategiesTable } from "./tradingStrategies";

// Phase 30 — Institutional Strategy Framework.
//
// A specific INSTANCE of a strategy's own checklist template (see
// tradingStrategies.checklist) applied to one real use — completion
// state, per-item notes, and evidence links, per the Checklist Engine's
// required shape (Required Items, Optional Items, Completion State,
// Notes, Evidence Links). Zero strategy-specific checklist CONTENT is
// hardcoded anywhere in this file — every item's own label/required flag
// is copied from the parent strategy's own user-authored template at
// instantiation time (see lib/tradingStrategyFramework.ts's
// instantiateChecklistItems()).
//
// strategyId is a REAL foreign key with ON DELETE CASCADE — a checklist
// instance is a genuine sub-resource of its own strategy (the same
// relationship investing_holdings.portfolio_id -> investing_portfolios.id
// already established as this codebase's one disclosed CASCADE exception,
// Phase 2 Sprint 28), not a loose, unenforced reference like
// trading_journal_entries.trading_position_id.
//
// Brand-new table: NOT NULL from creation, zero existing rows, no
// backfill needed. userId is mandatory + ON DELETE RESTRICT, matching
// every other user-scoped table.
export const tradingStrategyChecklistsTable = pgTable(
  "trading_strategy_checklists",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    strategyId: integer("strategy_id").notNull(),
    symbol: text("symbol"),
    status: text("status").notNull().default("in_progress"),
    items: jsonb("items").notNull().$type<
      { id: string; label: string; required: boolean; completed: boolean; notes: string; evidenceLinks: { sourceType: string; label: string; detail: string; url: string | null }[] }[]
    >(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("trading_strategy_checklists_user_id_idx").on(table.userId),
    index("trading_strategy_checklists_strategy_id_idx").on(table.strategyId),
    foreignKey({
      columns: [table.strategyId],
      foreignColumns: [tradingStrategiesTable.id],
      name: "trading_strategy_checklists_strategy_id_fk",
    }).onDelete("cascade"),
  ],
);

export const insertTradingStrategyChecklistSchema = createInsertSchema(tradingStrategyChecklistsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingStrategyChecklist = z.infer<typeof insertTradingStrategyChecklistSchema>;
export type TradingStrategyChecklistRow = typeof tradingStrategyChecklistsTable.$inferSelect;

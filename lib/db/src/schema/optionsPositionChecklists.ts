import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradesTable } from "./trades";

// Phase 36 — Institutional Position Lifecycle Manager.
//
// A specific INSTANCE of a strategy's own static institutional checklist
// template (lib/optionsLifecycleChecklists.ts) applied to one real
// position — completion state only, mirroring
// trading_strategy_checklists' own established shape exactly (Phase 30).
// Zero strategy-specific checklist CONTENT is stored here — every item's
// own id/label is copied from the static template at instantiation time;
// this table only ever stores which items are checked.
//
// tradeId uses the same real ON DELETE CASCADE relationship as
// options_lifecycle_state — a genuine 1:1 sub-resource of its own trade,
// enforced via a unique constraint (one checklist instance per position).
export const optionsPositionChecklistsTable = pgTable(
  "options_position_checklists",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => tradesTable.id, { onDelete: "cascade" }),
    strategyKey: text("strategy_key").notNull(),
    items: jsonb("items").notNull().$type<{ id: string; label: string; required: boolean; checked: boolean }[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("options_position_checklists_user_id_idx").on(table.userId),
    unique("options_position_checklists_trade_id_unique").on(table.tradeId),
  ],
);

export const insertOptionsPositionChecklistSchema = createInsertSchema(optionsPositionChecklistsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOptionsPositionChecklist = z.infer<typeof insertOptionsPositionChecklistSchema>;
export type OptionsPositionChecklistRow = typeof optionsPositionChecklistsTable.$inferSelect;

import { pgTable, serial, uuid, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tradesTable } from "./trades";

// Phase 36 — Institutional Position Lifecycle Manager.
//
// The CURRENT deterministic lifecycle stage for one position (a real
// existing `trades` row). No automatic transitions anywhere in this
// codebase set this column — every change is an explicit user action via
// PATCH /options-lifecycle/:tradeId/state. `reviewCadence` is the
// position's own assigned review schedule (daily/weekly/monthly/
// expiration/manual) — a plain stored preference, never a reminder or
// notification trigger.
//
// tradeId is a REAL foreign key with ON DELETE CASCADE — lifecycle state
// is a genuine 1:1 sub-resource of its own trade (the same relationship
// investing_holdings.portfolio_id -> investing_portfolios.id and
// trading_strategy_checklists.strategy_id -> trading_strategies.id
// already established as this codebase's disclosed CASCADE precedent for
// genuine sub-resources), not a loose, unenforced reference. One row per
// trade, enforced via a unique constraint.
//
// Brand-new table: NOT NULL from creation, zero existing rows, no
// backfill needed. userId is mandatory + ON DELETE RESTRICT, matching
// every other user-scoped table.
export const optionsLifecycleStateTable = pgTable(
  "options_lifecycle_state",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => tradesTable.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("draft"),
    reviewCadence: text("review_cadence").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("options_lifecycle_state_user_id_idx").on(table.userId),
    unique("options_lifecycle_state_trade_id_unique").on(table.tradeId),
  ],
);

export const insertOptionsLifecycleStateSchema = createInsertSchema(optionsLifecycleStateTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOptionsLifecycleState = z.infer<typeof insertOptionsLifecycleStateSchema>;
export type OptionsLifecycleStateRow = typeof optionsLifecycleStateTable.$inferSelect;

import { pgTable, serial, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 30 — Institutional Strategy Framework.
//
// Real persistence for user-authored Strategy Metadata. This is
// deliberately a METADATA-ONLY record — name, description, category,
// timeframes, markets, required evidence, a checklist item TEMPLATE,
// educational notes, references, version. There is no entry/exit logic,
// no signal field, no trading-rule column of any kind: the whole point of
// this table is to let a trader formalize the shape of their OWN
// methodology (however they define it) without this platform interpreting
// or evaluating it. No named methodology (ICT/SMC/ASAD/Trader Bill/Tom
// Nash/Dunni Framework) is seeded here — this table starts empty for
// every user and stays empty until a user creates their own entry,
// mirroring lib/trading/strategyService.ts's own Phase 24
// "never seed a placeholder" precedent for STRATEGY_REGISTRY.
//
// category/timeframes/markets/requiredEvidence/checklist/references are
// all free-form (jsonb arrays / plain text), not DB enums — mirroring
// trading_journal_entries.setup_type and investing_filing_analysis.filing_type's
// own established "free text, not a DB enum" precedent, so future
// categories/evidence types need no migration.
//
// Brand-new table: NOT NULL from creation, zero existing rows, no
// backfill needed (same precedent as trading_trade_plans, Phase 25).
// userId is mandatory + ON DELETE RESTRICT, matching every other
// user-scoped table.
export const tradingStrategiesTable = pgTable(
  "trading_strategies",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    timeframes: jsonb("timeframes").notNull().$type<string[]>(),
    markets: jsonb("markets").notNull().$type<string[]>(),
    requiredEvidence: jsonb("required_evidence").notNull().$type<string[]>(),
    checklist: jsonb("checklist").notNull().$type<{ id: string; label: string; required: boolean }[]>(),
    educationalNotes: text("educational_notes").notNull().default(""),
    references: jsonb("references").notNull().$type<string[]>(),
    version: text("version").notNull().default("1.0.0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("trading_strategies_user_id_idx").on(table.userId)],
);

export const insertTradingStrategySchema = createInsertSchema(tradingStrategiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingStrategy = z.infer<typeof insertTradingStrategySchema>;
export type TradingStrategyRow = typeof tradingStrategiesTable.$inferSelect;

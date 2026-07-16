import { pgTable, serial, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Task #66 — Value-investing watchlist. The user saves a symbol they are tracking
// as a long-term value-investor candidate, with their own fair-value estimate and
// desired buy price (both nullable — never fabricated), a margin-of-safety target,
// a reason, the last-researched date, and the current advisory decision.
//
// Advisory/education only — saving to the watchlist never places or schedules any
// order. Fair-value / buy-price fields are nullable by design: if the user (or the
// engine) cannot compute a reliable number, it stays null rather than fabricated.
export const valueWatchlistTable = pgTable("value_watchlist", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  category: text("category").notNull().default("Researching"),
  fairValueEstimate: real("fair_value_estimate"),
  desiredBuyPrice: real("desired_buy_price"),
  marginOfSafetyTarget: real("margin_of_safety_target").notNull().default(25),
  reason: text("reason").notNull().default(""),
  currentDecision: text("current_decision").notNull().default("WATCHLIST"),
  lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("value_watchlist_user_id_idx").on(table.userId),
]);

export const insertValueWatchlistSchema = createInsertSchema(valueWatchlistTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertValueWatchlist = z.infer<typeof insertValueWatchlistSchema>;
export type ValueWatchlistRow = typeof valueWatchlistTable.$inferSelect;

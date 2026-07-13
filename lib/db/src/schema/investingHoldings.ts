import { pgTable, serial, uuid, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investingPortfoliosTable } from "./investingPortfolios";

// Phase 2, Sprint 28 — Portfolio Construction. A single symbol's target
// weight (and, optionally, the shares actually held) within one portfolio.
// `shares` is nullable by design: a holding can be a pure target line item
// before any shares are actually entered — never fabricated as 0. Current
// market price/value is deliberately NOT stored here — it's always resolved
// fresh from the live/simulated Fundamentals provider on read, the same
// never-persist-a-price discipline the Watchlist's Sprint 27 target-checking
// already established.
//
// Brand-new table: NOT NULL from creation (except `shares`, which is
// honestly nullable), no nullable->backfill->enforce migration needed (same
// precedent as platform_audit_log/investing_filing_analysis). `userId` is
// mandatory + ON DELETE RESTRICT, matching every other user-scoped table —
// kept directly on this table (not just reachable via a join through
// portfolioId) so every fetch-by-id query can scope ownership in the query
// itself, the same discipline Sprint 7 established for every business table.
//
// `portfolioId` deliberately uses ON DELETE CASCADE, NOT RESTRICT — the one
// disclosed exception to this app's otherwise-universal RESTRICT convention.
// Deleting your own portfolio is a normal, expected, self-service cleanup
// action on your own sub-resource (unlike deleting a whole user, which
// RESTRICT protects against doing by accident) — the portfolio and its
// holdings are meant to be deleted together.
export const investingHoldingsTable = pgTable("investing_holdings", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => investingPortfoliosTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  targetWeightPct: real("target_weight_pct").notNull().default(0),
  shares: real("shares"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("investing_holdings_user_id_idx").on(table.userId),
  index("investing_holdings_portfolio_id_idx").on(table.portfolioId),
]);

export const insertInvestingHoldingSchema = createInsertSchema(investingHoldingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingHolding = z.infer<typeof insertInvestingHoldingSchema>;
export type InvestingHoldingRow = typeof investingHoldingsTable.$inferSelect;
